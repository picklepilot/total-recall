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
import type { User } from 'firebase/auth'
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

  async function addEntry(payload: {
    contentJson: string
    contentText: string
    url: string | null
    linkPreview: LinkPreview | null
    tags: string[]
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
      createdAt: serverTimestamp(),
    })

    try {
      const headers = await authHeaders()
      await $fetch('/api/entries/index', {
        method: 'POST',
        body: { entryId: docRef.id },
        headers,
      })
    } catch (e) {
      console.warn('[total-recall] embedding index failed (entry still saved):', e)
    }
  }

  return { entries, ready, addEntry }
}
