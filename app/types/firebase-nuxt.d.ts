import type { FirebaseApp } from 'firebase/app'
import type { Auth } from 'firebase/auth'
import type { Firestore } from 'firebase/firestore'

declare module '#app' {
  interface NuxtApp {
    $firebaseApp: FirebaseApp | null
    $firebaseAuth: Auth | undefined
    $firebaseDb: Firestore | undefined
    $firebaseReady: boolean
  }
}

export {}
