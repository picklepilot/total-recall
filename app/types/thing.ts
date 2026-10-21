import type { Timestamp } from 'firebase/firestore'
import type { ThingField } from '~~/shared/thingKinds'

export interface ThingIdentifier {
  scheme: string
  value: string
}

export interface ThingDoc {
  userId: string
  name: string
  /** Preset slug today (`book`, `movie`, …). Any slug later, so templates need no migration. */
  kind: string
  summary?: string
  /** Display URL: an uploaded cover, or later a remote cover with no `imagePath`. */
  imageUrl?: string | null
  /** Storage object this account owns. Absent for remote URLs. */
  imagePath?: string | null
  fields: ThingField[]
  /** Reserved for a later barcode / ISBN lookup. Not written by the app yet. */
  identifiers?: ThingIdentifier[]
  createdAt: Timestamp
  updatedAt: Timestamp
}

export interface ThingView {
  id: string
  userId: string
  name: string
  kind: string
  summary: string
  imageUrl: string | null
  imagePath: string | null
  fields: ThingField[]
  identifiers: ThingIdentifier[]
  createdAt: Date
  updatedAt: Date
}
