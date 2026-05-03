/**
 * Plain-text snippets for embeddings and LLM context (Firestore `widgets` shape).
 * Keep in sync with `EntryWidget` in `app/types/entry.ts`.
 */
export function formatEntryWidgetsPlain(widgets: unknown): string {
  if (!Array.isArray(widgets)) return ''
  const parts: string[] = []
  for (const raw of widgets) {
    if (!raw || typeof raw !== 'object') continue
    const w = raw as { type?: string; value?: unknown }
    if (w.type === 'starRating' && typeof w.value === 'number') {
      parts.push(`${w.value}/5 star rating`)
    }
  }
  return parts.join(' · ')
}
