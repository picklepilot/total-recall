import type { EntryView } from '@/types/entry'

/** Flattens recent entries into a single string for the chat API (RAG-style context). */
export function entriesToMemoryContext(entries: EntryView[], maxEntries = 80): string {
  const slice = entries.slice(0, maxEntries)
  if (!slice.length) return ''

  const lines = slice.map((e) => {
    const date = e.createdAt.toISOString().slice(0, 10)
    const parts: string[] = [`[${date}]`]
    if (e.tags.length) parts.push(`tags: ${e.tags.join(', ')}`)
    if (e.url) parts.push(`url: ${e.url}`)
    if (e.linkPreview?.title) parts.push(`link_title: ${e.linkPreview.title}`)
    const note = e.contentText.trim()
    if (note) parts.push(`note: ${note}`)
    else parts.push('note: (empty)')
    return parts.join(' | ')
  })

  return lines.join('\n')
}
