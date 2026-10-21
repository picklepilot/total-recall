import { describe, expect, it } from 'vitest'
import { formatThingDate, parseThingDate } from './thingDate'

describe('parseThingDate', () => {
  it('reads a calendar day', () => {
    const date = parseThingDate('2026-10-21')
    expect(date?.year).toBe(2026)
    expect(date?.month).toBe(10)
    expect(date?.day).toBe(21)
  })

  it('rejects empty, partial, and impossible dates', () => {
    expect(parseThingDate('')).toBeNull()
    expect(parseThingDate('2026-10')).toBeNull()
    expect(parseThingDate('October 21, 2026')).toBeNull()
    expect(parseThingDate('2026-02-31')).toBeNull()
    expect(parseThingDate('2026-13-01')).toBeNull()
  })
})

describe('formatThingDate', () => {
  it('formats a stored day for display', () => {
    expect(formatThingDate('2026-10-21')).toBe('Oct 21, 2026')
    expect(formatThingDate('2026-10-21', 'long')).toBe('October 21, 2026')
  })

  it('leaves empty and non-dates alone', () => {
    expect(formatThingDate('')).toBe('')
    expect(formatThingDate('  sometime  ')).toBe('sometime')
  })
})
