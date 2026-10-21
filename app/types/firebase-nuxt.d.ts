import type { FirebaseApp } from 'firebase/app'
import type { Auth } from 'firebase/auth'
import type { Firestore } from 'firebase/firestore'
import type { FirebaseStorage } from 'firebase/storage'

declare module '#app' {
  interface NuxtApp {
    $firebaseApp: FirebaseApp | null
    $firebaseAuth: Auth | undefined
    $firebaseDb: Firestore | undefined
    $firebaseStorage: FirebaseStorage | undefined
    $firebaseReady: boolean
  }
}

export {}
