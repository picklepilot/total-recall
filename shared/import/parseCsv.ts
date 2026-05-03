/**
 * Minimal RFC-style CSV parser (quoted fields, escaped quotes).
 * Rows are string[][]; first row is typically headers.
 */
export function parseCsv(content: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let i = 0
  let inQuotes = false

  while (i < content.length) {
    const c = content[i]!

    if (inQuotes) {
      if (c === '"') {
        if (content[i + 1] === '"') {
          field += '"'
          i += 2
          continue
        }
        inQuotes = false
        i++
        continue
      }
      field += c
      i++
      continue
    }

    if (c === '"') {
      inQuotes = true
      i++
      continue
    }
    if (c === ',') {
      row.push(field)
      field = ''
      i++
      continue
    }
    if (c === '\n') {
      row.push(field)
      field = ''
      rows.push(row)
      row = []
      i++
      continue
    }
    if (c === '\r') {
      i++
      continue
    }
    field += c
    i++
  }

  if (inQuotes) {
    throw new Error('CSV has unclosed quote')
  }
  if (field.length || row.length > 0) {
    row.push(field)
    rows.push(row)
  }

  return rows
}
