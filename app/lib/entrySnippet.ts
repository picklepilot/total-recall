import type { EntryView } from '@/types/entry'

/** One-line label for breadcrumbs and "replying to" previews. */
export function entrySnippet(entry: EntryView, maxChars = 90): string {
  if (entry.deleted) return 'Deleted entry'
  const link = entry.widgets?.find((w) => w.type === 'link')
  const label =
    entry.contentText.trim().replace(/\s+/g, ' ') ||
    (link?.type === 'link' ? link.preview?.title || link.url : '') ||
    'Untitled entry'
  return label.length > maxChars ? `${label.slice(0, maxChars - 1)}…` : label
}
