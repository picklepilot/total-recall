import { formatEntryWidgetsPlain } from '~~/shared/entryWidgetsPlain'
import { formatThingsPlain } from '~~/shared/thingPrompt'

function toDate(ts: { toDate?: () => Date } | undefined): Date {
  if (ts && typeof ts.toDate === 'function') {
    return ts.toDate()
  }
  return new Date()
}

const THREAD_SNIPPET_CHARS = 120

/** Short label for an ancestor in a thread breadcrumb. */
export function formatThreadSnippet(data: Record<string, unknown> | undefined): string {
  if (!data || data.deleted) return '(deleted entry)'
  const text = String(data.contentText ?? '').trim().replace(/\s+/g, ' ')
  const fallback = formatEntryWidgetsPlain(data.widgets, data.url, data.linkPreview)
  const label = text || fallback || '(empty)'
  return label.length > THREAD_SNIPPET_CHARS
    ? `${label.slice(0, THREAD_SNIPPET_CHARS - 1)}…`
    : label
}

/**
 * One line per entry for the LLM “memory log” block.
 * `threadPath` holds root-first ancestor snippets for replies.
 */
export function formatEntryDocForPrompt(
  id: string,
  data: Record<string, unknown>,
  threadPath: string[] = [],
  thingNames: string[] = [],
): string {
  const createdAt = toDate(data.createdAt as { toDate?: () => Date } | undefined)
  const date = createdAt.toISOString().slice(0, 10)
  const tags = (Array.isArray(data.tags) ? data.tags : []) as string[]
  const contentText = String(data.contentText ?? '').trim()
  const widgetsLine = formatEntryWidgetsPlain(data.widgets, data.url, data.linkPreview)

  const parts: string[] = [`[${date}]`, `id: ${id}`]
  if (threadPath.length) {
    parts.push(`continues thread: ${threadPath.map((s) => `"${s}"`).join(' > ')}`)
  }
  if (tags.length) parts.push(`tags: ${tags.join(', ')}`)
  const thingsLine = formatThingsPlain(thingNames)
  if (thingsLine) parts.push(thingsLine)
  if (widgetsLine) parts.push(`widgets: ${widgetsLine}`)
  if (contentText) parts.push(`note: ${contentText}`)
  else parts.push('note: (empty)')
  return parts.join(' | ')
}
