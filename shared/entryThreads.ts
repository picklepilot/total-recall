/**
 * Thread structure for entries: adjacency list (`parentId`) plus an ordered
 * ancestor path (`ancestorIds`, root first). Entries saved before threading
 * have none of these fields and are treated as top-level entries.
 */

/** Matches the depth cap enforced in `firestore.rules`. */
export const MAX_THREAD_DEPTH = 64

export interface ThreadFields {
  parentId: string | null
  rootId: string
  ancestorIds: string[]
  depth: number
}

interface ThreadSource {
  parentId?: string | null
  rootId?: string
  ancestorIds?: string[]
  depth?: number
}

/** Reads thread fields with legacy defaults (no fields = top-level entry). */
export function normalizeThreadFields(id: string, data: ThreadSource): ThreadFields {
  const parentId = data.parentId ?? null
  const ancestorIds = Array.isArray(data.ancestorIds) ? data.ancestorIds : []
  return {
    parentId,
    rootId: data.rootId ?? (parentId ? ancestorIds[0] ?? parentId : id),
    ancestorIds,
    depth: typeof data.depth === 'number' ? data.depth : ancestorIds.length,
  }
}

/** Thread fields for a new entry `id`, optionally replying to `parent`. */
export function threadFieldsForNewEntry(
  id: string,
  parent: ({ id: string } & ThreadSource) | null,
): ThreadFields {
  if (!parent) {
    return { parentId: null, rootId: id, ancestorIds: [], depth: 0 }
  }
  const p = normalizeThreadFields(parent.id, parent)
  if (p.depth + 1 > MAX_THREAD_DEPTH) {
    throw new Error(`Threads can be at most ${MAX_THREAD_DEPTH} levels deep.`)
  }
  return {
    parentId: parent.id,
    rootId: p.rootId,
    ancestorIds: [...p.ancestorIds, parent.id],
    depth: p.depth + 1,
  }
}

export interface ThreadNodeInput {
  id: string
  parentId: string | null
  createdAt: Date
}

export interface ThreadIndex<T extends ThreadNodeInput> {
  byId: Map<string, T>
  /** Direct replies per entry id, oldest first. */
  childrenOf: Map<string, T[]>
  /** Top-level entries (including orphans whose parent is gone), newest first. */
  roots: T[]
}

export function buildThreadIndex<T extends ThreadNodeInput>(entries: T[]): ThreadIndex<T> {
  const byId = new Map<string, T>()
  for (const e of entries) byId.set(e.id, e)

  const childrenOf = new Map<string, T[]>()
  const roots: T[] = []
  for (const e of entries) {
    if (e.parentId && byId.has(e.parentId)) {
      const list = childrenOf.get(e.parentId)
      if (list) list.push(e)
      else childrenOf.set(e.parentId, [e])
    } else {
      roots.push(e)
    }
  }

  for (const list of childrenOf.values()) {
    list.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
  }
  roots.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())

  return { byId, childrenOf, roots }
}

export function countDescendants<T extends ThreadNodeInput>(
  id: string,
  childrenOf: Map<string, T[]>,
): number {
  let count = 0
  const stack = [...(childrenOf.get(id) ?? [])]
  while (stack.length) {
    const next = stack.pop()!
    count++
    stack.push(...(childrenOf.get(next.id) ?? []))
  }
  return count
}

/** Ancestors root-first, skipping any that are no longer loaded. */
export function resolveAncestors<T extends ThreadNodeInput>(
  ancestorIds: string[],
  byId: Map<string, T>,
): T[] {
  return ancestorIds.map((id) => byId.get(id)).filter((e): e is T => Boolean(e))
}
