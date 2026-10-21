/** Prompt and embed clause for the things an entry is about. Empty when unnamed. */
export function formatThingsPlain(names: readonly string[]): string {
  const clean: string[] = []
  const seen = new Set<string>()
  for (const name of names) {
    const trimmed = name.trim()
    if (!trimmed || seen.has(trimmed)) continue
    seen.add(trimmed)
    clean.push(trimmed)
  }
  return clean.length ? `things: ${clean.join(', ')}` : ''
}

/** Text embedded for vector search. Thing names sit beside tags so a title-only link still matches. */
export function joinEmbedSource(parts: {
  tags?: readonly string[]
  thingNames?: readonly string[]
  widgetsPlain?: string
  contentText?: string
}): string {
  const chunks = [
    (parts.tags ?? []).join(' '),
    formatThingsPlain(parts.thingNames ?? []),
    parts.widgetsPlain ?? '',
    (parts.contentText ?? '').trim(),
  ]
  return chunks
    .map((part) => part.trim())
    .filter(Boolean)
    .join('\n')
    .slice(0, 7500)
}
