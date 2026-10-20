import type { EntryWidget, LinkPreview } from '@/types/entry'

/** Maps optional compose-time fields into `EntryWidget[]` for `addEntry`. */
export function buildWidgetsFromComposeForm(state: {
  starRating: number
  link: { url: string; preview: LinkPreview | null } | null
}): EntryWidget[] | undefined {
  const out: EntryWidget[] = []
  const u = state.link?.url?.trim()
  if (u) {
    out.push({ type: 'link', url: u, preview: state.link?.preview ?? null })
  }
  if (state.starRating > 0) {
    out.push({ type: 'starRating', value: state.starRating })
  }
  return out.length ? out : undefined
}
