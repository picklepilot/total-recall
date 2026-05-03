import {
  addDoc,
  collection,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  where,
  type Firestore,
} from 'firebase/firestore'
import type { User } from 'firebase/auth'
import type { EntryDoc, EntryView, EntryWidget, ImportMeta, LinkPreview } from '@/types/entry'
import type { EntryImportDraft } from '~~/shared/import/types'

function mapDoc(id: string, data: EntryDoc): EntryView {
  const created = data.createdAt?.toDate?.() ?? new Date()
  return {
    id,
    userId: data.userId,
    contentJson: data.contentJson,
    contentText: data.contentText,
    url: data.url,
    linkPreview: data.linkPreview,
    tags: data.tags ?? [],
    createdAt: created,
    widgets: data.widgets,
    importMeta: data.importMeta,
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
        const d = doc.data() as EntryDoc
        if (d.userId === uid) list.push(mapDoc(doc.id, d))
      })
      entries.value = list
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

  async function addEntry(payload: {
    contentJson: string
    contentText: string
    url: string | null
    linkPreview: LinkPreview | null
    tags: string[]
    widgets?: EntryWidget[]
  }) {
    if (!db.value || !user.value) {
      throw new Error('Sign in with Google to save entries.')
    }
    const ref = collection(db.value, 'entries')
    const docRef = await addDoc(ref, {
      userId: user.value.uid,
      contentJson: payload.contentJson,
      contentText: payload.contentText,
      url: payload.url,
      linkPreview: payload.linkPreview,
      tags: payload.tags,
      ...(payload.widgets?.length ? { widgets: payload.widgets } : {}),
      createdAt: serverTimestamp(),
    })

    await indexEntryAfterWrite(docRef.id)
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
    url: string | null
    linkPreview: LinkPreview | null
    tags: string[]
    createdAt: Date
    widgets?: EntryWidget[]
    importMeta?: ImportMeta
  }) {
    if (!db.value || !user.value) {
      throw new Error('Sign in with Google to save entries.')
    }
    const ref = collection(db.value, 'entries')
    const docRef = await addDoc(ref, {
      userId: user.value.uid,
      contentJson: payload.contentJson,
      contentText: payload.contentText,
      url: payload.url,
      linkPreview: payload.linkPreview,
      tags: payload.tags,
      createdAt: Timestamp.fromDate(payload.createdAt),
      ...(payload.widgets?.length ? { widgets: payload.widgets } : {}),
      ...(payload.importMeta ? { importMeta: payload.importMeta } : {}),
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
            url: d.url,
            linkPreview: d.linkPreview,
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

  return { entries, ready, addEntry, addImportedEntry, importDrafts, hasExistingImport }
}
