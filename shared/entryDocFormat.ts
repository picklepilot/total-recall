/** TipTap node types that render correctly as plain `contentText`. */
const PLAIN_TYPES = new Set(['doc', 'paragraph', 'text'])

/**
 * True when the entry JSON has lists, headings, marks, links, etc. — anything
 * that needs the read-only Tiptap renderer instead of a text node.
 */
export function entryDocHasRichFormatting(json: string): boolean {
  let doc: unknown
  try {
    doc = JSON.parse(json)
  } catch {
    return false
  }
  return nodeIsRich(doc)
}

function nodeIsRich(node: unknown): boolean {
  if (!node || typeof node !== 'object') return false
  const n = node as { type?: string; marks?: { type?: string }[]; content?: unknown[] }
  if (n.type && !PLAIN_TYPES.has(n.type)) return true
  if (n.marks?.length) return true
  return n.content?.some(nodeIsRich) ?? false
}
