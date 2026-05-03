import type { ChatUiTableBlock, ChatUiTableColumn } from '../../shared/types/chat-ui'

/** Gemini `functionDeclarations` entry (OpenAPI-flavoured JSON schema). */
export const presentTableFunctionDeclaration = {
  name: 'present_table',
  description:
    'Show a data table in the user interface. Use when the user asks for rankings, top-N lists, comparisons, or any answer that is clearer as columns and rows. Every value must be grounded in the Memory log you were given—do not invent facts. Prefer concise column labels.',
  parameters: {
    type: 'object',
    properties: {
      title: {
        type: 'string',
        description: 'Short optional heading shown above the table.',
      },
      columns: {
        type: 'array',
        description: 'Column definitions with stable keys used in each row object.',
        items: {
          type: 'object',
          properties: {
            key: { type: 'string', description: 'Machine key matching row object fields, e.g. band' },
            label: { type: 'string', description: 'Human-readable column header' },
          },
          required: ['key', 'label'],
        },
      },
      rows: {
        type: 'array',
        description: 'Table rows; each item is an object whose keys match column `key` values.',
        items: { type: 'object' },
      },
    },
    required: ['columns', 'rows'],
  },
} as const

const MAX_ROWS = 25
const MAX_COLS = 10
const MAX_CELL_LEN = 280
const MAX_TITLE_LEN = 120

function clampStr(s: string, max: number): string {
  const t = s.trim()
  if (t.length <= max) return t
  return `${t.slice(0, max - 1)}…`
}

function normalizeCell(value: unknown): string | number | boolean | null {
  if (value === null || value === undefined) return null
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'boolean') return value
  if (typeof value === 'bigint') return Number(value)
  return clampStr(String(value), MAX_CELL_LEN)
}

/**
 * Validates and clamps model output for `present_table`.
 * Returns null if the payload cannot be shown safely.
 */
export function normalizePresentTableArgs(raw: unknown): ChatUiTableBlock | null {
  if (!raw || typeof raw !== 'object') return null
  const args = raw as Record<string, unknown>

  const columnsIn = args.columns
  if (!Array.isArray(columnsIn) || columnsIn.length === 0) return null

  const columns: ChatUiTableColumn[] = []
  const seen = new Set<string>()
  for (const c of columnsIn) {
    if (columns.length >= MAX_COLS) break
    if (!c || typeof c !== 'object') continue
    const o = c as Record<string, unknown>
    const key = typeof o.key === 'string' ? o.key.trim() : ''
    const label = typeof o.label === 'string' ? o.label.trim() : ''
    if (!key || !label || seen.has(key)) continue
    seen.add(key)
    columns.push({ key, label: clampStr(label, 80) })
  }
  if (!columns.length) return null

  const rowsIn = args.rows
  if (!Array.isArray(rowsIn)) return null

  const rows: Record<string, string | number | boolean | null>[] = []
  for (const r of rowsIn) {
    if (rows.length >= MAX_ROWS) break
    if (!r || typeof r !== 'object') continue
    const src = r as Record<string, unknown>
    const row: Record<string, string | number | boolean | null> = {}
    for (const col of columns) {
      row[col.key] = normalizeCell(src[col.key])
    }
    rows.push(row)
  }

  const titleRaw = args.title
  const title =
    typeof titleRaw === 'string' && titleRaw.trim()
      ? clampStr(titleRaw.trim(), MAX_TITLE_LEN)
      : undefined

  return { kind: 'table', title, columns, rows }
}
