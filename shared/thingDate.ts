import { CalendarDate, parseDate } from '@internationalized/date'

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

/** Thing date fields are stored as `YYYY-MM-DD`, the same shape the old native input wrote. */
export function parseThingDate(value: string): CalendarDate | null {
  const trimmed = value.trim()
  if (!ISO_DATE.test(trimmed)) return null
  try {
    return parseDate(trimmed)
  } catch {
    return null
  }
}

const formatters = {
  medium: new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }),
  long: new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }),
}

/** Empty stays empty. Values that are not a real calendar day are shown unchanged. */
export function formatThingDate(value: string, style: 'medium' | 'long' = 'medium'): string {
  const trimmed = value.trim()
  const date = parseThingDate(trimmed)
  if (!date) return trimmed
  return formatters[style].format(new Date(date.year, date.month - 1, date.day))
}
