import type { EntryView } from '@/types/entry'
import { formatEntryWidgetsPlain } from '~~/shared/entryWidgetsPlain'

/** Flattens recent entries into a single string for the chat API (RAG-style context). */
export function entriesToMemoryContext(entries: EntryView[], maxEntries = 80): string {
  const slice = entries.slice(0, maxEntries)
  if (!slice.length) return ''

  const lines = slice.map((e) => {
    const date = e.createdAt.toISOString().slice(0, 10)
    const parts: string[] = [`[${date}]`]
    if (e.tags.length) parts.push(`tags: ${e.tags.join(', ')}`)
    const widgetsLine = formatEntryWidgetsPlain(e.widgets)
    if (widgetsLine) parts.push(`widgets: ${widgetsLine}`)
    const note = e.contentText.trim()
    if (note) parts.push(`note: ${note}`)
    else parts.push('note: (empty)')
    return parts.join(' | ')
  })

  return lines.join('\n')
}
