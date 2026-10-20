import { describe, expect, it } from 'vitest'
import { coalesceEntryWidgetsWithLegacyLink } from './entryWidgetsNormalize'

describe('coalesceEntryWidgetsWithLegacyLink', () => {
  it('appends legacy url when no link widget', () => {
    const out = coalesceEntryWidgetsWithLegacyLink(
      [{ type: 'starRating', value: 4 }],
      'https://example.com',
      { title: 'T', description: null, image: null, siteName: null, url: 'https://example.com' },
    )
    expect(out).toHaveLength(2)
    expect(out[1]).toEqual({
      type: 'link',
      url: 'https://example.com',
      preview: {
        title: 'T',
        description: null,
        image: null,
        siteName: null,
        url: 'https://example.com',
      },
    })
  })

  it('does not duplicate when link widget already present', () => {
    const out = coalesceEntryWidgetsWithLegacyLink(
      [{ type: 'link', url: 'https://a.com', preview: null }],
      'https://legacy.com',
      null,
    )
    expect(out).toEqual([{ type: 'link', url: 'https://a.com', preview: null }])
  })
})
