import type { EntryWidget, LinkPreview } from '../app/types/entry'

function parseWidgetsLoose(raw: unknown): EntryWidget[] {
  if (!Array.isArray(raw)) return []
  const out: EntryWidget[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const o = item as Record<string, unknown>
    if (o.type === 'starRating' && typeof o.value === 'number') {
      out.push({ type: 'starRating', value: o.value })
      continue
    }
    if (o.type === 'link' && typeof o.url === 'string') {
      const u = o.url.trim()
      if (!u) continue
      const preview = o.preview
      out.push({
        type: 'link',
        url: u,
        preview:
          preview && typeof preview === 'object'
            ? (preview as LinkPreview)
            : null,
      })
    }
  }
  return out
}

/**
 * Merges stored `widgets` with legacy top-level `url` / `linkPreview` from older documents.
 */
export function coalesceEntryWidgetsWithLegacyLink(
  widgets: unknown,
  legacyUrl: unknown,
  legacyPreview: unknown,
): EntryWidget[] {
  const base = parseWidgetsLoose(widgets)
  if (base.some((w) => w.type === 'link')) return base
  const u = typeof legacyUrl === 'string' ? legacyUrl.trim() : ''
  if (!u) return base
  const preview =
    legacyPreview && typeof legacyPreview === 'object'
      ? (legacyPreview as LinkPreview)
      : null
  return [...base, { type: 'link' as const, url: u, preview }]
}
