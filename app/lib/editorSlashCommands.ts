import type { Editor } from '@tiptap/core'
import type { EditorState } from '@tiptap/pm/state'

export type SlashCommandItem = {
  title: string
  description: string
  keywords: string[]
  command: (editor: Editor) => void
}

export function getSlashContext(
  state: EditorState,
): { from: number; to: number; query: string } | null {
  const { $from } = state.selection
  if (!$from.parent.isTextblock) return null
  if ($from.parent.type.name === 'codeBlock') return null

  const blockStart = $from.start()
  const cursor = $from.pos
  const raw = state.doc.textBetween(blockStart, cursor, '\n', '\0')
  const trimmedLeft = raw.replace(/^\s+/, '')
  if (!trimmedLeft.startsWith('/')) return null
  const query = trimmedLeft.slice(1)
  if (/[\s\n]/.test(query)) return null

  return {
    from: blockStart,
    to: cursor,
    query: query.toLowerCase(),
  }
}

export function getSlashItems(): SlashCommandItem[] {
  return [
    {
      title: 'Heading 2',
      description: 'Medium section title',
      keywords: ['h2', 'title', 'subheading'],
      command: (editor) => editor.chain().focus().toggleHeading({ level: 2 }).run(),
    },
    {
      title: 'Heading 3',
      description: 'Small section title',
      keywords: ['h3', 'subtitle'],
      command: (editor) => editor.chain().focus().toggleHeading({ level: 3 }).run(),
    },
    {
      title: 'Bulleted list',
      description: 'Unordered list',
      keywords: ['ul', 'bullet', 'list'],
      command: (editor) => editor.chain().focus().toggleBulletList().run(),
    },
    {
      title: 'Numbered list',
      description: 'Ordered list',
      keywords: ['ol', 'numbered', 'list'],
      command: (editor) => editor.chain().focus().toggleOrderedList().run(),
    },
    {
      title: 'Quote',
      description: 'Block quote',
      keywords: ['blockquote', 'citation'],
      command: (editor) => editor.chain().focus().toggleBlockquote().run(),
    },
    {
      title: 'Code block',
      description: 'Multi-line code',
      keywords: ['```', 'snippet'],
      command: (editor) => editor.chain().focus().toggleCodeBlock().run(),
    },
    {
      title: 'Divider',
      description: 'Horizontal rule',
      keywords: ['hr', 'line', 'separator', '---'],
      command: (editor) => editor.chain().focus().setHorizontalRule().run(),
    },
    {
      title: 'Paragraph',
      description: 'Body text',
      keywords: ['text', 'plain', 'p'],
      command: (editor) => editor.chain().focus().setParagraph().run(),
    },
  ]
}

export function filterSlashItems(items: SlashCommandItem[], query: string): SlashCommandItem[] {
  if (!query) return items
  return items.filter(
    (item) =>
      item.title.toLowerCase().includes(query) ||
      item.description.toLowerCase().includes(query) ||
      item.keywords.some((k) => k.toLowerCase().includes(query)),
  )
}
