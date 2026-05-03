/** Build TipTap StarterKit-compatible JSON (doc + paragraphs + text). */
export function plainTextToTipTapDoc(text: string): string {
  const trimmedEnd = text.replace(/\s+$/, '')
  if (!trimmedEnd) {
    return JSON.stringify({ type: 'doc', content: [{ type: 'paragraph' }] })
  }
  const lines = trimmedEnd.split('\n')
  const content = lines.map((line) => {
    if (!line.length) {
      return { type: 'paragraph' as const }
    }
    return {
      type: 'paragraph' as const,
      content: [{ type: 'text' as const, text: line }],
    }
  })
  return JSON.stringify({ type: 'doc', content })
}
