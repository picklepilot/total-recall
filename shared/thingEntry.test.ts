import { describe, expect, it } from 'vitest'
import { entryDraftForNewThing } from './thingEntry'

describe('entryDraftForNewThing', () => {
  it('records the name and kind, and skips empty suggested fields', () => {
    const draft = entryDraftForNewThing({
      id: 'thing-1',
      name: ' Dune ',
      kind: 'book',
      summary: '  ',
      fields: [
        { label: 'Author', value: '' },
        { label: 'Year', value: '   ' },
      ],
    })
    expect(draft.contentText).toBe('Added Dune, a book.')
    expect(draft.tags).toEqual([])
    expect(draft.thingIds).toEqual(['thing-1'])
    expect(JSON.parse(draft.contentJson)).toMatchObject({
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Added Dune, a book.' }] }],
    })
  })

  it('includes the summary and filled fields when they are already known', () => {
    const draft = entryDraftForNewThing({
      id: 'thing-2',
      name: 'Eraserhead',
      kind: 'Movie',
      summary: 'First time through.',
      fields: [
        { label: 'Director', value: 'David Lynch' },
        { label: 'Year', value: '' },
      ],
    })
    expect(draft.contentText).toBe(
      'Added Eraserhead, a movie.\nFirst time through.\nDirector: David Lynch',
    )
  })

  it('does not invent a kind phrase for Other', () => {
    expect(
      entryDraftForNewThing({ id: 'thing-3', name: 'Spare key', kind: 'other' }).contentText,
    ).toBe('Added Spare key.')
  })
})
