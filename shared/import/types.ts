import type { EntryWidget, EntryWidgetType, ImportMeta, LinkPreview } from '../../app/types/entry'

/** Normalized row all file/API adapters must produce before persistence. */
export interface EntryImportDraft {
  contentText: string
  contentJson: string
  url: string | null
  linkPreview: LinkPreview | null
  tags: string[]
  /** Diary/logical time for the entry (Firestore `createdAt`). */
  createdAt: Date
  /** Optional widgets to store on the entry (set in `parseFile` when the source has data). */
  widgets?: EntryWidget[]
  importMeta?: ImportMeta
}

export interface FileImportAdapter {
  id: string
  label: string
  kind: 'file'
  description?: string
  /**
   * Widget kinds this import may attach to drafts when source columns allow.
   * Declarative hint for UI; payloads live on each `EntryImportDraft.widgets`.
   */
  widgetsGenerated?: readonly EntryWidgetType[]
  /** e.g. `['.csv']` */
  fileExtensions: string[]
  mimeTypes?: string[]
  parseFile(text: string): EntryImportDraft[] | Promise<EntryImportDraft[]>
}

export type { EntryWidget, EntryWidgetType }
