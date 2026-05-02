import {
  addDoc,
  collection,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  where,
  type Firestore,
} from 'firebase/firestore'
import type { EntryDoc, EntryView, LinkPreview } from '@/types/entry'

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
  }
}

export function useEntries() {
  const nuxtApp = useNuxtApp()
  const db = computed(() => nuxtApp.$firebaseDb as Firestore | undefined)
  const auth = computed(() => nuxtApp.$firebaseAuth)
  const ready = computed(() => Boolean(nuxtApp.$firebaseReady && db.value && auth.value?.currentUser))

  const entries = ref<EntryView[]>([])
  let unsub: (() => void) | null = null

  function subscribe() {
    if (!db.value || !auth.value?.currentUser) return
    const uid = auth.value.currentUser.uid
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

  async function addEntry(payload: {
    contentJson: string
    contentText: string
    url: string | null
    linkPreview: LinkPreview | null
    tags: string[]
  }) {
    if (!db.value || !auth.value?.currentUser) {
      throw new Error('Sign in with Google to save entries.')
    }
    const ref = collection(db.value, 'entries')
    await addDoc(ref, {
      userId: auth.value.currentUser.uid,
      contentJson: payload.contentJson,
      contentText: payload.contentText,
      url: payload.url,
      linkPreview: payload.linkPreview,
      tags: payload.tags,
      createdAt: serverTimestamp(),
    })
  }

  return { entries, ready, addEntry }
}
