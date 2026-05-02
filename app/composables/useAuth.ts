import { GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth'
import type { User } from 'firebase/auth'

export function useAuth() {
  const nuxtApp = useNuxtApp()
  const user = useState<User | null>('firebase-auth-user', () => null)

  const signedIn = computed(() => Boolean(user.value))

  async function signInWithGoogle() {
    const auth = nuxtApp.$firebaseAuth
    if (!auth) throw new Error('Firebase Auth is not configured.')
    const provider = new GoogleAuthProvider()
    provider.setCustomParameters({ prompt: 'select_account' })
    await signInWithPopup(auth, provider)
  }

  async function logout() {
    const auth = nuxtApp.$firebaseAuth
    if (!auth) return
    await signOut(auth)
  }

  async function getIdToken(): Promise<string | null> {
    const auth = nuxtApp.$firebaseAuth
    if (!auth?.currentUser) return null
    return auth.currentUser.getIdToken()
  }

  async function authHeaders(): Promise<Record<string, string>> {
    const token = await getIdToken()
    return token ? { Authorization: `Bearer ${token}` } : {}
  }

  return {
    user,
    signedIn,
    signInWithGoogle,
    logout,
    getIdToken,
    authHeaders,
  }
}
