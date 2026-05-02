import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'

export function buildEntryExtensions(options: { openLinkOnClick: boolean }) {
  return [
    StarterKit.configure({
      heading: { levels: [2, 3] },
    }),
    Link.configure({ openOnClick: options.openLinkOnClick }),
  ]
}

export function parseEntryDoc(json: string): Record<string, unknown> | null {
  try {
    const doc = JSON.parse(json) as { type?: string }
    if (doc?.type !== 'doc') return null
    return doc as Record<string, unknown>
  } catch {
    return null
  }
}
