import { coalesceEntryWidgetsWithLegacyLink } from './entryWidgetsNormalize'

/**
 * Plain-text snippets for embeddings and LLM context.
 * Pass optional legacy `url` / `linkPreview` when reading raw Firestore rows that predate link widgets.
 */
export function formatEntryWidgetsPlain(
  widgets: unknown,
  legacyUrl?: unknown,
  legacyPreview?: unknown,
): string {
  const list = coalesceEntryWidgetsWithLegacyLink(widgets, legacyUrl, legacyPreview)
  const parts: string[] = []
  for (const w of list) {
    if (w.type === 'starRating') {
      parts.push(`${w.value}/5 star rating`)
    } else if (w.type === 'link') {
      parts.push(`link: ${w.url}`)
      if (w.preview?.title) parts.push(`link_title: ${w.preview.title}`)
      const desc = w.preview?.description?.trim()
      if (desc) parts.push(desc.length > 400 ? `${desc.slice(0, 400)}…` : desc)
    }
  }
  return parts.join(' · ')
}
