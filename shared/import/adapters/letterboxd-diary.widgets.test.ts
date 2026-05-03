import { describe, expect, it } from 'vitest'
import { letterboxdRatingToStarWidget } from './letterboxd-diary'

describe('letterboxdRatingToStarWidget', () => {
  it('returns null for empty or invalid', () => {
    expect(letterboxdRatingToStarWidget('')).toBeNull()
    expect(letterboxdRatingToStarWidget('  ')).toBeNull()
    expect(letterboxdRatingToStarWidget('nope')).toBeNull()
    expect(letterboxdRatingToStarWidget('6')).toBeNull()
    expect(letterboxdRatingToStarWidget('-1')).toBeNull()
  })

  it('parses half steps and comma decimals', () => {
    expect(letterboxdRatingToStarWidget('4.5')).toEqual({ type: 'starRating', value: 4.5 })
    expect(letterboxdRatingToStarWidget('4,5')).toEqual({ type: 'starRating', value: 4.5 })
    expect(letterboxdRatingToStarWidget('3')).toEqual({ type: 'starRating', value: 3 })
    expect(letterboxdRatingToStarWidget('0')).toEqual({ type: 'starRating', value: 0 })
  })

  it('rounds to nearest half star within 0–5', () => {
    expect(letterboxdRatingToStarWidget('4.25')?.value).toBe(4.5)
    expect(letterboxdRatingToStarWidget('4.24')?.value).toBe(4)
  })
})
