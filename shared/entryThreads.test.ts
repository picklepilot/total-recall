import { describe, expect, it } from 'vitest'
import {
  MAX_THREAD_DEPTH,
  buildThreadIndex,
  countDescendants,
  normalizeThreadFields,
  resolveAncestors,
  threadFieldsForNewEntry,
} from './entryThreads'

const at = (day: number) => new Date(Date.UTC(2026, 0, day))

describe('normalizeThreadFields', () => {
  it('treats legacy entries without thread fields as top-level', () => {
    expect(normalizeThreadFields('a', {})).toEqual({
      parentId: null,
      rootId: 'a',
      ancestorIds: [],
      depth: 0,
    })
  })
})

describe('threadFieldsForNewEntry', () => {
  it('creates a top-level entry rooted at itself', () => {
    expect(threadFieldsForNewEntry('new', null)).toEqual({
      parentId: null,
      rootId: 'new',
      ancestorIds: [],
      depth: 0,
    })
  })

  it('replies to a legacy top-level entry', () => {
    expect(threadFieldsForNewEntry('b', { id: 'a' })).toEqual({
      parentId: 'a',
      rootId: 'a',
      ancestorIds: ['a'],
      depth: 1,
    })
  })

  it('extends the ancestor path for nested replies', () => {
    const parent = { id: 'c', parentId: 'b', rootId: 'a', ancestorIds: ['a', 'b'], depth: 2 }
    expect(threadFieldsForNewEntry('d', parent)).toEqual({
      parentId: 'c',
      rootId: 'a',
      ancestorIds: ['a', 'b', 'c'],
      depth: 3,
    })
  })

  it('refuses to exceed the max depth', () => {
    const ancestorIds = Array.from({ length: MAX_THREAD_DEPTH }, (_, i) => `n${i}`)
    const parent = { id: 'deep', parentId: 'x', rootId: 'n0', ancestorIds, depth: MAX_THREAD_DEPTH }
    expect(() => threadFieldsForNewEntry('z', parent)).toThrow()
  })
})

describe('buildThreadIndex', () => {
  const entries = [
    { id: 'a', parentId: null, createdAt: at(1) },
    { id: 'b', parentId: 'a', createdAt: at(3) },
    { id: 'c', parentId: 'a', createdAt: at(2) },
    { id: 'd', parentId: 'c', createdAt: at(4) },
    { id: 'e', parentId: null, createdAt: at(5) },
    { id: 'orphan', parentId: 'gone', createdAt: at(6) },
  ]
  const index = buildThreadIndex(entries)

  it('lists top-level entries and orphans newest first', () => {
    expect(index.roots.map((e) => e.id)).toEqual(['orphan', 'e', 'a'])
  })

  it('orders replies oldest first', () => {
    expect(index.childrenOf.get('a')?.map((e) => e.id)).toEqual(['c', 'b'])
  })

  it('counts all descendants', () => {
    expect(countDescendants('a', index.childrenOf)).toBe(3)
    expect(countDescendants('e', index.childrenOf)).toBe(0)
  })

  it('resolves ancestors root first', () => {
    expect(resolveAncestors(['a', 'missing', 'c'], index.byId).map((e) => e.id)).toEqual([
      'a',
      'c',
    ])
  })
})
