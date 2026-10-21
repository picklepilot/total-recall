import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  where,
  type Firestore,
} from 'firebase/firestore'
import type { User } from 'firebase/auth'
import type { EntryDoc, EntryView, EntryWidget, ImportMeta, LinkPreview } from '@/types/entry'
import type { EntryImportDraft } from '~~/shared/import/types'
import { coalesceEntryWidgetsWithLegacyLink } from '~~/shared/entryWidgetsNormalize'
import { normalizeThreadFields, threadFieldsForNewEntry } from '~~/shared/entryThreads'

/** Firestore rows may include legacy `url` / `linkPreview` before link widgets. */
type EntrySnapshot = EntryDoc & { url?: string | null; linkPreview?: LinkPreview | null }

function mapDoc(id: string, data: EntrySnapshot): EntryView {
  const created = data.createdAt?.toDate?.() ?? new Date()
  const merged = coalesceEntryWidgetsWithLegacyLink(
    data.widgets,
    data.url,
    data.linkPreview,
  )
  return {
    id,
    userId: data.userId,
    contentJson: data.contentJson,
    contentText: data.contentText,
    tags: data.tags ?? [],
    createdAt: created,
    widgets: merged.length ? merged : undefined,
    importMeta: data.importMeta,
    ...normalizeThreadFields(id, data),
    deleted: Boolean(data.deleted),
  }
}

export interface ImportDraftsResult {
  imported: number
  skippedDuplicate: number
  failed: number
  errors: { index: number; message: string }[]
  /** When true, no writes or embeddings were performed (duplicate checks only). */
  dryRun?: boolean
}

export function useEntries() {
  const nuxtApp = useNuxtApp()
  const { authHeaders } = useAuth()
  const user = useState<User | null>('firebase-auth-user', () => null)
  const db = computed(() => nuxtApp.$firebaseDb as Firestore | undefined)
  /** Must use reactive `user` from onAuthStateChanged — `auth.currentUser` is not Vue-reactive. */
  const ready = computed(() => Boolean(nuxtApp.$firebaseReady && db.value && user.value))

  const entries = ref<EntryView[]>([])
  /** True once the first snapshot has arrived (distinguishes "loading" from "no entries"). */
  const loaded = ref(false)
  let unsub: (() => void) | null = null

  function subscribe() {
    if (!db.value || !user.value) return
    const uid = user.value.uid
    const q = query(
      collection(db.value, 'entries'),
      where('userId', '==', uid),
      orderBy('createdAt', 'desc'),
    )
    unsub?.()
    unsub = onSnapshot(q, (snap) => {
      const list: EntryView[] = []
      snap.forEach((doc) => {
        const d = doc.data() as EntrySnapshot
        if (d.userId === uid) list.push(mapDoc(doc.id, d))
      })
      entries.value = list
      loaded.value = true
    })
  }

  watch(
    ready,
    (ok) => {
      if (ok) subscribe()
      else {
        unsub?.()
        unsub = null
        entries.value = []
        loaded.value = false
      }
    },
    { immediate: true },
  )

  onUnmounted(() => {
    unsub?.()
    unsub = null
  })

  async function indexEntryAfterWrite(entryId: string) {
    try {
      const headers = await authHeaders()
      await $fetch('/api/entries/index', {
        method: 'POST',
        body: { entryId },
        headers,
      })
    } catch (e) {
      console.warn('[total-recall] embedding index failed (entry still saved):', e)
    }
  }

  /** Saves a new entry, optionally as a reply to `parentId`. Returns the new entry id. */
  async function addEntry(payload: {
    contentJson: string
    contentText: string
    tags: string[]
    widgets?: EntryWidget[]
    parentId?: string | null
  }): Promise<string> {
    if (!db.value || !user.value) {
      throw new Error('Sign in with Google to save entries.')
    }
    const docRef = doc(collection(db.value, 'entries'))

    let parent: ({ id: string } & EntrySnapshot) | null = null
    if (payload.parentId) {
      const parentSnap = await getDoc(doc(db.value, 'entries', payload.parentId))
      if (!parentSnap.exists()) throw new Error('The entry you are replying to no longer exists.')
      const parentData = parentSnap.data() as EntrySnapshot
      if (parentData.deleted) throw new Error('You cannot continue a deleted entry.')
      parent = { id: parentSnap.id, ...parentData }
    }

    await setDoc(docRef, {
      userId: user.value.uid,
      contentJson: payload.contentJson,
      contentText: payload.contentText,
      tags: payload.tags,
      ...(payload.widgets?.length ? { widgets: payload.widgets } : {}),
      ...threadFieldsForNewEntry(docRef.id, parent),
      createdAt: serverTimestamp(),
    })

    await indexEntryAfterWrite(docRef.id)
    return docRef.id
  }

  /** Hard-deletes a leaf entry; entries with replies become "[deleted]" placeholders. */
  async function deleteEntry(entryId: string) {
    const headers = await authHeaders()
    return await $fetch<{ result: 'deleted' | 'tombstoned' }>('/api/entries/delete', {
      method: 'POST',
      body: { entryId },
      headers,
    })
  }

  async function hasExistingImport(source: string, externalId: string): Promise<boolean> {
    if (!db.value || !user.value) return false
    const q = query(
      collection(db.value, 'entries'),
      where('userId', '==', user.value.uid),
      where('importMeta.source', '==', source),
      where('importMeta.externalId', '==', externalId),
      limit(1),
    )
    const snap = await getDocs(q)
    return !snap.empty
  }

  async function addImportedEntry(payload: {
    contentJson: string
    contentText: string
    tags: string[]
    createdAt: Date
    widgets?: EntryWidget[]
    importMeta?: ImportMeta
  }) {
    if (!db.value || !user.value) {
      throw new Error('Sign in with Google to save entries.')
    }
    const docRef = doc(collection(db.value, 'entries'))
    await setDoc(docRef, {
      userId: user.value.uid,
      contentJson: payload.contentJson,
      contentText: payload.contentText,
      tags: payload.tags,
      createdAt: Timestamp.fromDate(payload.createdAt),
      ...(payload.widgets?.length ? { widgets: payload.widgets } : {}),
      ...(payload.importMeta ? { importMeta: payload.importMeta } : {}),
      ...threadFieldsForNewEntry(docRef.id, null),
    })
    await indexEntryAfterWrite(docRef.id)
  }

  async function importDrafts(
    drafts: EntryImportDraft[],
    options?: {
      throttleMs?: number
      /** If true, only checks duplicates against Firestore; does not create entries or call embeddings. */
      dryRun?: boolean
      onProgress?: (p: { current: number; total: number }) => void
    },
  ): Promise<ImportDraftsResult> {
    const dryRun = Boolean(options?.dryRun)
    const throttleMs = options?.throttleMs ?? (dryRun ? 80 : 450)
    const errors: { index: number; message: string }[] = []
    let imported = 0
    let skippedDuplicate = 0
    let failed = 0
    const total = drafts.length

    const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

    for (let i = 0; i < total; i++) {
      const d = drafts[i]!
      try {
        if (d.importMeta) {
          const exists = await hasExistingImport(d.importMeta.source, d.importMeta.externalId)
          if (exists) {
            skippedDuplicate++
            options?.onProgress?.({ current: i + 1, total })
            if (i < total - 1 && throttleMs > 0) await sleep(throttleMs)
            continue
          }
        }
        if (dryRun) {
          imported++
        } else {
          await addImportedEntry({
            contentJson: d.contentJson,
            contentText: d.contentText,
            tags: d.tags,
            createdAt: d.createdAt,
            widgets: d.widgets,
            importMeta: d.importMeta,
          })
          imported++
        }
      } catch (e) {
        failed++
        const message = e instanceof Error ? e.message : String(e)
        errors.push({ index: i, message })
      }
      options?.onProgress?.({ current: i + 1, total })
      if (i < total - 1 && throttleMs > 0) await sleep(throttleMs)
    }

    return { imported, skippedDuplicate, failed, errors, dryRun }
  }

  return {
    entries,
    loaded,
    ready,
    addEntry,
    deleteEntry,
    addImportedEntry,
    importDrafts,
    hasExistingImport,
  }
}
