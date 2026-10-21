import type { EntryDoc, EntryView, LinkPreview } from '@/types/entry'
import { coalesceEntryWidgetsWithLegacyLink } from '~~/shared/entryWidgetsNormalize'
import { normalizeThreadFields } from '~~/shared/entryThreads'
import { normalizeThingIds } from '~~/shared/thingKinds'

/** Firestore rows may include legacy `url` / `linkPreview` before link widgets. */
export type EntrySnapshot = EntryDoc & { url?: string | null; linkPreview?: LinkPreview | null }

export function mapEntryDoc(id: string, data: EntrySnapshot): EntryView {
  const created = data.createdAt?.toDate?.() ?? new Date()
  const merged = coalesceEntryWidgetsWithLegacyLink(data.widgets, data.url, data.linkPreview)
  return {
    id,
    userId: data.userId,
    contentJson: data.contentJson,
    contentText: data.contentText,
    tags: data.tags ?? [],
    thingIds: normalizeThingIds(data.thingIds),
    createdAt: created,
    widgets: merged.length ? merged : undefined,
    importMeta: data.importMeta,
    ...normalizeThreadFields(id, data),
    deleted: Boolean(data.deleted),
    replyCount: typeof data.replyCount === 'number' ? data.replyCount : 0,
  }
}
