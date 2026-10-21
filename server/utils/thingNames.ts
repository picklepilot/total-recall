import type { Firestore } from 'firebase-admin/firestore'

export function thingIdsFromEntry(data: Record<string, unknown> | undefined): string[] {
  const ids = data?.thingIds
  if (!Array.isArray(ids)) return []
  const out: string[] = []
  for (const id of ids) {
    if (typeof id !== 'string') continue
    const trimmed = id.trim()
    if (!trimmed || out.includes(trimmed)) continue
    out.push(trimmed)
  }
  return out
}

/** Names of things this user owns, keyed by id. Missing or foreign docs are skipped. */
export async function loadThingNames(
  db: Firestore,
  uid: string,
  thingIds: string[],
): Promise<Map<string, string>> {
  const map = new Map<string, string>()
  const unique = [...new Set(thingIds)]
  for (let i = 0; i < unique.length; i += 50) {
    const chunk = unique.slice(i, i + 50)
    if (!chunk.length) continue
    const snaps = await db.getAll(...chunk.map((id) => db.collection('things').doc(id)))
    for (const snap of snaps) {
      const data = snap.data()
      if (!data || data.userId !== uid) continue
      const name = String(data.name ?? '').trim()
      if (name) map.set(snap.id, name)
    }
  }
  return map
}

export function namesForIds(map: Map<string, string>, ids: string[]): string[] {
  return ids.flatMap((id) => {
    const name = map.get(id)
    return name ? [name] : []
  })
}
