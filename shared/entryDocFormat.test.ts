import { describe, expect, it } from 'vitest'
import { entryDocHasRichFormatting } from './entryDocFormat'

describe('entryDocHasRichFormatting', () => {
  it('treats plain paragraphs as not rich', () => {
    expect(
      entryDocHasRichFormatting(
        JSON.stringify({
          type: 'doc',
          content: [
            { type: 'paragraph', content: [{ type: 'text', text: 'Hello' }] },
            { type: 'paragraph', content: [{ type: 'text', text: 'World' }] },
          ],
        }),
      ),
    ).toBe(false)
  })

  it('detects marks and non-paragraph blocks', () => {
    expect(
      entryDocHasRichFormatting(
        JSON.stringify({
          type: 'doc',
          content: [
            {
              type: 'paragraph',
              content: [{ type: 'text', text: 'Hi', marks: [{ type: 'bold' }] }],
            },
          ],
        }),
      ),
    ).toBe(true)
    expect(
      entryDocHasRichFormatting(
        JSON.stringify({
          type: 'doc',
          content: [{ type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'T' }] }],
        }),
      ),
    ).toBe(true)
  })

  it('returns false for invalid JSON', () => {
    expect(entryDocHasRichFormatting('not-json')).toBe(false)
  })
})
