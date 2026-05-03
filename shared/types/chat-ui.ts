export type ChatUiTableColumn = { key: string; label: string }

/** Table block emitted over SSE as `{ ui: ChatUiTableBlock }` and rendered in the Ask UI. */
export type ChatUiTableBlock = {
  kind: 'table'
  title?: string
  columns: ChatUiTableColumn[]
  rows: Record<string, string | number | boolean | null>[]
}

export function isChatUiTableBlock(value: unknown): value is ChatUiTableBlock {
  if (!value || typeof value !== 'object') return false
  const v = value as ChatUiTableBlock
  if (v.kind !== 'table') return false
  if (!Array.isArray(v.columns) || !Array.isArray(v.rows)) return false
  return v.columns.every(
    (c) =>
      c &&
      typeof c === 'object' &&
      typeof (c as ChatUiTableColumn).key === 'string' &&
      typeof (c as ChatUiTableColumn).label === 'string',
  )
}
