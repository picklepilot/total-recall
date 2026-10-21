import { initializeApp, getApps, type FirebaseApp } from 'firebase/app'
import { getAuth, onAuthStateChanged, type User } from 'firebase/auth'
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from 'firebase/firestore'
import { getStorage, type FirebaseStorage } from 'firebase/storage'

let app: FirebaseApp | null = null

export default defineNuxtPlugin(() => {
  const config = useRuntimeConfig().public

  const user = useState<User | null>('firebase-auth-user', () => null)

  if (!config.firebaseApiKey || !config.firebaseProjectId) {
    console.warn(
      '[total-recall] Firebase env missing. Set NUXT_PUBLIC_FIREBASE_* in .env (see .env.example).',
    )
    return {
      provide: {
        firebaseApp: null,
        firebaseAuth: undefined,
        firebaseDb: undefined,
        firebaseStorage: undefined,
        firebaseReady: false,
      },
    }
  }

  if (!getApps().length) {
    app = initializeApp({
      apiKey: config.firebaseApiKey,
      authDomain: config.firebaseAuthDomain,
      projectId: config.firebaseProjectId,
      storageBucket: config.firebaseStorageBucket || undefined,
      messagingSenderId: config.firebaseMessagingSenderId || undefined,
      appId: config.firebaseAppId || undefined,
    })
  } else {
    app = getApps()[0]!
  }

  const auth = getAuth(app)
  let db: Firestore
  try {
    db = initializeFirestore(app, {
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    })
  } catch {
    // HMR re-runs this plugin against an app whose Firestore is already initialized.
    db = getFirestore(app)
  }

  onAuthStateChanged(auth, (u) => {
    user.value = u
  })

  let storage: FirebaseStorage | undefined
  if (config.firebaseStorageBucket) {
    storage = getStorage(app)
  }

  return {
    provide: {
      firebaseApp: app,
      firebaseAuth: auth,
      firebaseDb: db,
      firebaseStorage: storage,
      firebaseReady: true,
    },
  }
})
