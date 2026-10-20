import type { Timestamp } from 'firebase/firestore'

/** Set on documents created via import/backfill for dedupe and traceability. */
export interface ImportMeta {
  source: string
  externalId: string
}

export interface LinkPreview {
  title: string | null
  description: string | null
  image: string | null
  siteName: string | null
  url: string
}

/** Letterboxd-style: 0–5 in steps of 0.5. */
export interface StarRatingWidget {
  type: 'starRating'
  value: number
}

/** Canonical URL for the entry; `preview` from `/api/link-preview` when available. */
export interface LinkWidget {
  type: 'link'
  url: string
  preview: LinkPreview | null
}

/** Add union members here; register a Vue view in `app/lib/entry-widgets/registry.ts`. */
export type EntryWidget = StarRatingWidget | LinkWidget

export type EntryWidgetType = EntryWidget['type']

export interface EntryDoc {
  userId: string
  contentJson: string
  contentText: string
  tags: string[]
  createdAt: Timestamp
  /** Structured fields (link, ratings, etc.). */
  widgets?: EntryWidget[]
  importMeta?: ImportMeta
  /** Set by server (`/api/entries/index`) for Firestore vector search — not writable by clients. */
  embedModel?: string
  embeddedAt?: Timestamp
}

export interface EntryView extends Omit<EntryDoc, 'createdAt'> {
  id: string
  createdAt: Date
}
