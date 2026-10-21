import {
  collection,
  deleteField,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type Firestore,
} from 'firebase/firestore'
import { deleteObject, getDownloadURL, ref as storageRef, uploadBytes } from 'firebase/storage'
import type { User } from 'firebase/auth'
import type { FirebaseStorage } from 'firebase/storage'
import type { ThingView } from '@/types/thing'
import { mapThingDoc } from '@/lib/thingDoc'
import { prepareThingImage } from '@/lib/prepareThingImage'
import {
  fieldsFromKind,
  normalizeKind,
  normalizeThingFields,
  writeLastThingKind,
  type ThingField,
} from '~~/shared/thingKinds'

const COVER_PATH = (uid: string, thingId: string) => `users/${uid}/things/${thingId}/cover`

let loadInflight: Promise<void> | null = null
let loadGeneration = 0

export function useThings() {
  const nuxtApp = useNuxtApp()
  const { authHeaders } = useAuth()
  const entriesApi = useEntries()
  const user = useState<User | null>('firebase-auth-user', () => null)
  const db = computed(() => nuxtApp.$firebaseDb as Firestore | undefined)
  const storage = computed(() => nuxtApp.$firebaseStorage as FirebaseStorage | undefined)
  const ready = computed(() => Boolean(nuxtApp.$firebaseReady && db.value && user.value))

  const byId = useState<Record<string, ThingView>>('things-by-id', () => ({}))
  const ids = useState<string[]>('things-ids', () => [])
  const loaded = useState('things-loaded', () => false)
  const loading = useState('things-loading', () => false)
  const loadError = useState<string | null>('things-load-error', () => null)
  const coverBusyId = useState<string | null>('things-cover-busy', () => null)

  const things = computed(() =>
    ids.value.map((id) => byId.value[id]).filter((thing): thing is ThingView => Boolean(thing)),
  )

  function putThing(view: ThingView, front = false) {
    byId.value = { ...byId.value, [view.id]: view }
    const rest = ids.value.filter((id) => id !== view.id)
    ids.value = front || !ids.value.includes(view.id) ? [view.id, ...rest] : ids.value
  }

  function resetCache() {
    loadGeneration += 1
    byId.value = {}
    ids.value = []
    loaded.value = false
    loading.value = false
    loadError.value = null
    coverBusyId.value = null
    loadInflight = null
  }

  watch(ready, (ok) => {
    if (!ok) resetCache()
  })

  async function ensureThings() {
    if (!ready.value || !db.value || !user.value) return
    if (loaded.value) return
    if (loadInflight) return loadInflight
    const uid = user.value.uid
    const firestore = db.value
    const generation = loadGeneration
    const work = (async () => {
      loading.value = true
      loadError.value = null
      try {
        const snap = await getDocs(
          query(collection(firestore, 'things'), where('userId', '==', uid), orderBy('updatedAt', 'desc')),
        )
        if (generation !== loadGeneration) return
        const views = snap.docs.map((d) => mapThingDoc(d.id, d.data()))
        const next = { ...byId.value }
        for (const view of views) next[view.id] = view
        byId.value = next
        const fetched = views.map((view) => view.id)
        const extras = ids.value.filter((id) => !fetched.includes(id))
        ids.value = [...extras, ...fetched]
        loaded.value = true
      } catch (e) {
        if (generation !== loadGeneration) return
        loadError.value = e instanceof Error ? e.message : 'Could not load your things.'
        throw e
      } finally {
        if (generation === loadGeneration) loading.value = false
        if (loadInflight === work) loadInflight = null
      }
    })()
    loadInflight = work
    return work
  }

  async function createThing(input: { name: string; kind: string }): Promise<ThingView> {
    if (!db.value || !user.value) throw new Error('Sign in with Google to add a thing.')
    const name = input.name.trim()
    if (!name) throw new Error('Give it a name.')
    const kind = normalizeKind(input.kind)
    const ref = doc(collection(db.value, 'things'))
    const fields = fieldsFromKind(kind)
    const now = new Date()
    await setDoc(ref, {
      userId: user.value.uid,
      name,
      kind,
      summary: '',
      fields,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
    writeLastThingKind(kind)
    const view: ThingView = {
      id: ref.id,
      userId: user.value.uid,
      name,
      kind,
      summary: '',
      imageUrl: null,
      imagePath: null,
      fields,
      identifiers: [],
      createdAt: now,
      updatedAt: now,
    }
    putThing(view, true)
    loaded.value = true
    return view
  }

  async function updateThing(
    thingId: string,
    patch: { name: string; kind: string; summary: string; fields: ThingField[] },
  ) {
    if (!db.value || !user.value) throw new Error('Sign in with Google to edit a thing.')
    const prev = byId.value[thingId]
    const name = patch.name.trim()
    if (!name) throw new Error('Give it a name.')
    const kind = normalizeKind(patch.kind)
    const summary = patch.summary.trim()
    const fields = normalizeThingFields(patch.fields)
    await updateDoc(doc(db.value, 'things', thingId), {
      name,
      kind,
      summary,
      fields,
      updatedAt: serverTimestamp(),
    })
    if (prev) {
      putThing(
        { ...prev, name, kind, summary, fields, updatedAt: new Date() },
        true,
      )
    }
    if (prev && prev.name !== name) {
      void entriesApi.reindexLinkedEntries(thingId)
    }
  }

  async function setCover(thingId: string, file: File) {
    if (!db.value || !user.value) throw new Error('Sign in with Google to add a photo.')
    if (!storage.value) throw new Error('Photo storage is not configured.')
    coverBusyId.value = thingId
    try {
      const blob = await prepareThingImage(file)
      const path = COVER_PATH(user.value.uid, thingId)
      const objectRef = storageRef(storage.value, path)
      await uploadBytes(objectRef, blob, {
        contentType: 'image/jpeg',
        cacheControl: 'private, max-age=0',
      })
      const url = await getDownloadURL(objectRef)
      const imageUrl = `${url}&v=${Date.now()}`
      await updateDoc(doc(db.value, 'things', thingId), {
        imageUrl,
        imagePath: path,
        updatedAt: serverTimestamp(),
      })
      const prev = byId.value[thingId]
      if (prev) putThing({ ...prev, imageUrl, imagePath: path, updatedAt: new Date() }, true)
    } finally {
      coverBusyId.value = null
    }
  }

  async function removeCover(thingId: string) {
    if (!db.value || !user.value) throw new Error('Sign in with Google to edit a thing.')
    const prev = byId.value[thingId]
    coverBusyId.value = thingId
    try {
      if (storage.value && prev?.imagePath) {
        try {
          await deleteObject(storageRef(storage.value, prev.imagePath))
        } catch (e) {
          console.warn('[total-recall] cover delete failed:', e)
        }
      }
      await updateDoc(doc(db.value, 'things', thingId), {
        imageUrl: deleteField(),
        imagePath: deleteField(),
        updatedAt: serverTimestamp(),
      })
      if (prev) {
        putThing({ ...prev, imageUrl: null, imagePath: null, updatedAt: new Date() }, true)
      }
    } finally {
      coverBusyId.value = null
    }
  }

  async function deleteThing(thingId: string) {
    const headers = await authHeaders()
    const res = await $fetch<{ ok: boolean; entryIds: string[] }>('/api/things/delete', {
      method: 'POST',
      body: { thingId },
      headers,
    })
    const next = { ...byId.value }
    delete next[thingId]
    byId.value = next
    ids.value = ids.value.filter((id) => id !== thingId)
    entriesApi.stripThingFromCache(thingId)
    void entriesApi.reindexEntryIds(res.entryIds ?? [])
  }

  return {
    byId,
    things,
    ready,
    loaded,
    loading,
    loadError,
    coverBusyId,
    ensureThings,
    createThing,
    updateThing,
    setCover,
    removeCover,
    deleteThing,
  }
}
