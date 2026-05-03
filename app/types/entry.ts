import type { Timestamp } from 'firebase/firestore'

export interface LinkPreview {
  title: string | null
  description: string | null
  image: string | null
  siteName: string | null
  url: string
}

export interface EntryDoc {
  userId: string
  contentJson: string
  contentText: string
  url: string | null
  linkPreview: LinkPreview | null
  tags: string[]
  createdAt: Timestamp
  /** Set by server (`/api/entries/index`) for Firestore vector search — not writable by clients. */
  embedModel?: string
  embeddedAt?: Timestamp
}

export interface EntryView extends Omit<EntryDoc, 'createdAt'> {
  id: string
  createdAt: Date
}
