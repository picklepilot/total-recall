import {
  collection,
  doc,
  getDoc,
  getDocs,
  increment,
  limit,
  orderBy,
  query,
  serverTimestamp,
  startAfter,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
  type Firestore,
  type QueryDocumentSnapshot,
} from 'firebase/firestore'
import type { User } from 'firebase/auth'
import type { EntryView, EntryWidget, ImportMeta } from '@/types/entry'
import type { EntryImportDraft } from '~~/shared/import/types'
import { mapEntryDoc, type EntrySnapshot } from '@/lib/entryDoc'
import { threadFieldsForNewEntry } from '~~/shared/entryThreads'
import { normalizeThingIds } from '~~/shared/thingKinds'

export const TIMELINE_PAGE_SIZE = 30

export interface ImportDraftsResult {
  imported: number
  skippedDuplicate: number
  failed: number
  errors: { index: number; message: string }[]
  /** When true, no writes or embeddings were performed (duplicate checks only). */
  dryRun?: boolean
}

export interface DeleteEntryResult {
  result: 'deleted' | 'tombstoned'
  deletedIds: string[]
  rootId: string
}

/** Pagination cursor is a Firestore snapshot — keep it off `useState`. */
let timelineCursor: QueryDocumentSnapshot | null = null
let backfillInflight: Promise<void> | null = null
const threadInflight = new Map<string, Promise<void>>()

export function useEntries() {
  const nuxtApp = useNuxtApp()
  const { authHeaders } = useAuth()
  const user = useState<User | null>('firebase-auth-user', () => null)
  const db = computed(() => nuxtApp.$firebaseDb as Firestore | undefined)
  /** Must use reactive `user` from onAuthStateChanged — `auth.currentUser` is not Vue-reactive. */
  const ready = computed(() => Boolean(nuxtApp.$firebaseReady && db.value && user.value))

  const byId = useState<Record<string, EntryView>>('entries-by-id', () => ({}))
  const rootIds = useState<string[]>('entries-root-ids', () => [])
  const loadedThreads = useState<Record<string, boolean>>('entries-loaded-threads', () => ({}))
  const threadLoading = useState<Record<string, boolean>>('entries-thread-loading', () => ({}))
  const hasMoreRoots = useState('entries-has-more-roots', () => false)
  const timelineLoaded = useState('entries-timeline-loaded', () => false)
  const timelineLoading = useState('entries-timeline-loading', () => false)
  const loadingMore = useState('entries-loading-more', () => false)
  const hasEntries = useState<boolean | null>('entries-has-any', () => null)
  const backfilled = useState('entries-backfilled', () => false)

  const roots = computed(() =>
    rootIds.value.map((id) => byId.value[id]).filter((e): e is EntryView => Boolean(e)),
  )
  const entries = computed(() => Object.values(byId.value))

  function putEntries(list: EntryView[]) {
    if (!list.length) return
    const next = { ...byId.value }
    for (const e of list) next[e.id] = e
    byId.value = next
  }

  function resetCache() {
    byId.value = {}
    rootIds.value = []
    loadedThreads.value = {}
    threadLoading.value = {}
    hasMoreRoots.value = false
    timelineLoaded.value = false
    timelineLoading.value = false
    loadingMore.value = false
    hasEntries.value = null
    backfilled.value = false
    timelineCursor = null
    backfillInflight = null
    threadInflight.clear()
  }

  function invalidateTimeline() {
    rootIds.value = []
    timelineLoaded.value = false
    hasMoreRoots.value = false
    timelineCursor = null
  }

  watch(ready, (ok) => {
    if (!ok) resetCache()
  })

  async function ensureBackfill() {
    if (backfilled.value || !user.value) return
    if (backfillInflight) return backfillInflight
    backfillInflight = (async () => {
      try {
        const headers = await authHeaders()
        await $fetch('/api/entries/backfill-threads', { method: 'POST', headers })
        backfilled.value = true
      } catch (e) {
        console.warn('[total-recall] thread backfill failed:', e)
      } finally {
        backfillInflight = null
      }
    })()
    return backfillInflight
  }

  async function fetchRootsPage() {
    if (!db.value || !user.value) return
    const uid = user.value.uid
    const constraints = [
      where('userId', '==', uid),
      where('parentId', '==', null),
      orderBy('createdAt', 'desc'),
      ...(timelineCursor ? [startAfter(timelineCursor)] : []),
      limit(TIMELINE_PAGE_SIZE),
    ]
    const snap = await getDocs(query(collection(db.value, 'entries'), ...constraints))
    const list: EntryView[] = []
    snap.forEach((d) => {
      const data = d.data() as EntrySnapshot
      if (data.userId === uid) list.push(mapEntryDoc(d.id, data))
    })
    putEntries(list)
    const seen = new Set(rootIds.value)
    const appended = list.map((e) => e.id).filter((id) => !seen.has(id))
    if (appended.length) rootIds.value = [...rootIds.value, ...appended]
    timelineCursor = snap.docs.at(-1) ?? timelineCursor
    hasMoreRoots.value = snap.size === TIMELINE_PAGE_SIZE
    if (list.length) hasEntries.value = true
  }

  async function ensureTimeline() {
    if (!ready.value || timelineLoaded.value || timelineLoading.value) return
    timelineLoading.value = true
    try {
      await ensureBackfill()
      await fetchRootsPage()
      timelineLoaded.value = true
    } finally {
      timelineLoading.value = false
    }
  }

  async function loadMoreRoots() {
    if (!ready.value || !hasMoreRoots.value || loadingMore.value) return
    if (!timelineCursor) {
      hasMoreRoots.value = false
      return
    }
    loadingMore.value = true
    try {
      await fetchRootsPage()
    } finally {
      loadingMore.value = false
    }
  }

  async function loadThread(rootId: string) {
    if (!db.value || !user.value || loadedThreads.value[rootId]) return
    const pending = threadInflight.get(rootId)
    if (pending) return pending
    const uid = user.value.uid
    const work = (async () => {
      threadLoading.value = { ...threadLoading.value, [rootId]: true }
      try {
        await ensureBackfill()
        const snap = await getDocs(
          query(
            collection(db.value!, 'entries'),
            where('userId', '==', uid),
            where('rootId', '==', rootId),
          ),
        )
        const list: EntryView[] = []
        snap.forEach((d) => {
          const data = d.data() as EntrySnapshot
          if (data.userId === uid) list.push(mapEntryDoc(d.id, data))
        })
        putEntries(list)
        loadedThreads.value = { ...loadedThreads.value, [rootId]: true }
      } finally {
        threadLoading.value = { ...threadLoading.value, [rootId]: false }
        threadInflight.delete(rootId)
      }
    })()
    threadInflight.set(rootId, work)
    return work
  }

  async function fetchEntry(id: string): Promise<EntryView | null> {
    const cached = byId.value[id]
    if (cached) return cached
    if (!db.value || !user.value) return null
    const snap = await getDoc(doc(db.value, 'entries', id))
    if (!snap.exists()) return null
    const data = snap.data() as EntrySnapshot
    if (data.userId !== user.value.uid) return null
    const view = mapEntryDoc(snap.id, data)
    putEntries([view])
    return view
  }

  async function checkHasEntries() {
    if (hasEntries.value !== null) return
    if (rootIds.value.length || Object.keys(byId.value).length) {
      hasEntries.value = true
      return
    }
    if (!db.value || !user.value) return
    const snap = await getDocs(
      query(collection(db.value, 'entries'), where('userId', '==', user.value.uid), limit(1)),
    )
    hasEntries.value = !snap.empty
  }

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
    thingIds?: string[]
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

    const thread = threadFieldsForNewEntry(docRef.id, parent)
    const thingIds = normalizeThingIds(payload.thingIds)
    const batch = writeBatch(db.value)
    batch.set(docRef, {
      userId: user.value.uid,
      contentJson: payload.contentJson,
      contentText: payload.contentText,
      tags: payload.tags,
      ...(thingIds.length ? { thingIds } : {}),
      ...(payload.widgets?.length ? { widgets: payload.widgets } : {}),
      ...thread,
      ...(thread.parentId ? {} : { replyCount: 0 }),
      createdAt: serverTimestamp(),
    })
    if (parent) {
      batch.update(doc(db.value, 'entries', thread.rootId), { replyCount: increment(1) })
    }
    await batch.commit()

    const createdSnap = await getDoc(docRef)
    if (createdSnap.exists()) {
      const created = mapEntryDoc(docRef.id, createdSnap.data() as EntrySnapshot)
      putEntries([created])
      if (!created.parentId) {
        if (!rootIds.value.includes(created.id)) {
          rootIds.value = [created.id, ...rootIds.value]
        }
      } else {
        const root = byId.value[created.rootId]
        if (root) {
          byId.value = {
            ...byId.value,
            [root.id]: { ...root, replyCount: root.replyCount + 1 },
          }
        }
      }
    }
    hasEntries.value = true

    await indexEntryAfterWrite(docRef.id)
    return docRef.id
  }

  /** Shows a top-level entry that was just written outside `addEntry`, then indexes it. */
  async function showSavedEntry(entryId: string) {
    const view = await fetchEntry(entryId)
    if (!view) return
    if (!view.parentId && !rootIds.value.includes(view.id)) {
      rootIds.value = [view.id, ...rootIds.value]
    }
    hasEntries.value = true
    await indexEntryAfterWrite(entryId)
  }

  function applyDeleteToCache(res: DeleteEntryResult, entryId: string) {
    if (res.result === 'tombstoned') {
      const existing = byId.value[entryId]
      if (existing) {
        byId.value = {
          ...byId.value,
          [entryId]: {
            ...existing,
            deleted: true,
            contentText: '',
            contentJson: JSON.stringify({ type: 'doc', content: [{ type: 'paragraph' }] }),
            tags: [],
            thingIds: [],
            widgets: undefined,
          },
        }
      }
      return
    }

    const gone = new Set(res.deletedIds.length ? res.deletedIds : [entryId])
    const next = { ...byId.value }
    for (const id of gone) delete next[id]
    const root = next[res.rootId]
    if (root) {
      const dec = [...gone].filter((id) => id !== res.rootId).length
      next[res.rootId] = { ...root, replyCount: Math.max(0, root.replyCount - dec) }
    }
    byId.value = next
    rootIds.value = rootIds.value.filter((id) => !gone.has(id))
    if (!rootIds.value.length && !hasMoreRoots.value && !Object.keys(byId.value).length) {
      hasEntries.value = false
    }
  }

  /** Hard-deletes a leaf entry; entries with replies become "[deleted]" placeholders. */
  async function deleteEntry(entryId: string) {
    const headers = await authHeaders()
    const res = await $fetch<DeleteEntryResult>('/api/entries/delete', {
      method: 'POST',
      body: { entryId },
      headers,
    })
    applyDeleteToCache(res, entryId)
    return { result: res.result }
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
      replyCount: 0,
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

    if (!dryRun && imported > 0) {
      invalidateTimeline()
      hasEntries.value = true
    }

    return { imported, skippedDuplicate, failed, errors, dryRun }
  }

  async function updateEntryThingIds(entryId: string, thingIds: string[]) {
    if (!db.value || !user.value) throw new Error('Sign in with Google to edit entries.')
    const nextIds = normalizeThingIds(thingIds)
    const ref = doc(db.value, 'entries', entryId)
    await updateDoc(ref, nextIds.length ? { thingIds: nextIds } : { thingIds: [] })
    const existing = byId.value[entryId]
    if (existing) {
      byId.value = { ...byId.value, [entryId]: { ...existing, thingIds: nextIds } }
    }
    await indexEntryAfterWrite(entryId)
  }

  function stripThingFromCache(thingId: string) {
    let changed = false
    const next = { ...byId.value }
    for (const [id, entry] of Object.entries(next)) {
      if (!entry.thingIds.includes(thingId)) continue
      next[id] = { ...entry, thingIds: entry.thingIds.filter((item) => item !== thingId) }
      changed = true
    }
    if (changed) byId.value = next
  }

  async function reindexEntryIds(entryIds: string[]) {
    for (const entryId of entryIds) {
      await indexEntryAfterWrite(entryId)
    }
  }

  /** Entries that list this thing, newest first. Requires the thingIds composite index. */
  async function loadEntriesForThing(thingId: string): Promise<EntryView[]> {
    if (!db.value || !user.value) return []
    const snap = await getDocs(
      query(
        collection(db.value, 'entries'),
        where('userId', '==', user.value.uid),
        where('thingIds', 'array-contains', thingId),
        orderBy('createdAt', 'desc'),
        limit(50),
      ),
    )
    const views = snap.docs.map((d) => mapEntryDoc(d.id, d.data() as EntrySnapshot))
    putEntries(views)
    return views.filter((entry) => !entry.deleted)
  }

  async function reindexLinkedEntries(thingId: string) {
    try {
      const linked = await loadEntriesForThing(thingId)
      await reindexEntryIds(linked.map((entry) => entry.id))
    } catch (e) {
      console.warn('[total-recall] could not reindex entries for thing:', e)
    }
  }

  return {
    byId,
    roots,
    entries,
    ready,
    hasEntries,
    hasMoreRoots,
    timelineLoaded,
    timelineLoading,
    loadingMore,
    loadedThreads,
    threadLoading,
    ensureTimeline,
    loadMoreRoots,
    loadThread,
    fetchEntry,
    checkHasEntries,
    addEntry,
    showSavedEntry,
    updateEntryThingIds,
    stripThingFromCache,
    reindexEntryIds,
    reindexLinkedEntries,
    loadEntriesForThing,
    deleteEntry,
    addImportedEntry,
    importDrafts,
    hasExistingImport,
  }
}
