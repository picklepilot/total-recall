import type { EntryWidget } from '@/types/entry'

/** Maps optional compose-time fields into `EntryWidget[]` for `addEntry`. Extend when new widget types get form controls. */
export function buildWidgetsFromComposeForm(state: { starRating: number }): EntryWidget[] | undefined {
  const out: EntryWidget[] = []
  if (state.starRating > 0) {
    out.push({ type: 'starRating', value: state.starRating })
  }
  return out.length ? out : undefined
}
