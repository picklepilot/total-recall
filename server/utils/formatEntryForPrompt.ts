import { formatEntryWidgetsPlain } from '~~/shared/entryWidgetsPlain'

function toDate(ts: { toDate?: () => Date } | undefined): Date {
  if (ts && typeof ts.toDate === 'function') {
    return ts.toDate()
  }
  return new Date()
}

/** One line per entry for the LLM “memory log” block. */
export function formatEntryDocForPrompt(id: string, data: Record<string, unknown>): string {
  const createdAt = toDate(data.createdAt as { toDate?: () => Date } | undefined)
  const date = createdAt.toISOString().slice(0, 10)
  const tags = (Array.isArray(data.tags) ? data.tags : []) as string[]
  const contentText = String(data.contentText ?? '').trim()
  const widgetsLine = formatEntryWidgetsPlain(data.widgets, data.url, data.linkPreview)

  const parts: string[] = [`[${date}]`, `id: ${id}`]
  if (tags.length) parts.push(`tags: ${tags.join(', ')}`)
  if (widgetsLine) parts.push(`widgets: ${widgetsLine}`)
  if (contentText) parts.push(`note: ${contentText}`)
  else parts.push('note: (empty)')
  return parts.join(' | ')
}
