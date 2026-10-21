import { describe, expect, it } from 'vitest'
import {
  fieldsFromKind,
  missingSuggestedFields,
  normalizeKind,
  normalizeThingFields,
  normalizeThingIds,
} from './thingKinds'
import { formatThingsPlain, joinEmbedSource } from './thingPrompt'

describe('thing kind presets', () => {
  it('copies a book’s suggested fields with empty values and unique ids', () => {
    const fields = fieldsFromKind('book')
    expect(fields.map((field) => [field.label, field.type, field.value])).toEqual([
      ['Author', 'text', ''],
      ['Year', 'number', ''],
      ['ISBN', 'text', ''],
    ])
    expect(new Set(fields.map((field) => field.id)).size).toBe(3)
  })

  it('gives Other and unknown kinds no suggested fields', () => {
    expect(fieldsFromKind('other')).toEqual([])
    expect(fieldsFromKind('nope')).toEqual([])
    expect(normalizeKind('  ')).toBe('other')
    expect(normalizeKind('Book')).toBe('book')
  })

  it('offers only suggested labels that are not already on the thing', () => {
    expect(missingSuggestedFields('book', [{ label: 'author' }]).map((field) => field.label)).toEqual([
      'Year',
      'ISBN',
    ])
    expect(missingSuggestedFields('movie', [{ label: 'Director' }, { label: 'Year' }])).toEqual([])
  })
})

describe('normalizeThingFields', () => {
  it('trims, drops blank labels, coerces types, and replaces duplicate ids', () => {
    const fields = normalizeThingFields([
      null,
      { id: 'a', label: '  Author  ', type: 'text', value: '  Le Guin ' },
      { id: 'a', label: 'Year', type: 'nope', value: 1969 },
      { id: 'b', label: '   ', type: 'text', value: 'skip' },
      'junk',
    ])
    expect(fields).toHaveLength(2)
    expect(fields[0]).toMatchObject({ id: 'a', label: 'Author', type: 'text', value: 'Le Guin' })
    expect(fields[1]?.label).toBe('Year')
    expect(fields[1]?.type).toBe('text')
    expect(fields[1]?.value).toBe('1969')
    expect(fields[1]?.id).not.toBe('a')
  })

  it('returns an empty list for non-arrays', () => {
    expect(normalizeThingFields(undefined)).toEqual([])
    expect(normalizeThingIds([' a ', 'a', '', 3, 'b'])).toEqual(['a', 'b'])
  })
})

describe('thing prompt line', () => {
  it('lists unique thing names for embeddings and Ask', () => {
    expect(formatThingsPlain([' Dune ', 'Dune', '', 'Arrakis'])).toBe('things: Dune, Arrakis')
    expect(formatThingsPlain(['  ', ''])).toBe('')
  })

  it('places thing names beside tags in the embed source', () => {
    expect(
      joinEmbedSource({
        tags: ['novel'],
        thingNames: ['Dune'],
        widgetsPlain: '4/5 star rating',
        contentText: 'Still thinking about it',
      }),
    ).toBe('novel\nthings: Dune\n4/5 star rating\nStill thinking about it')
  })
})
