import type { ThingDoc, ThingView } from '@/types/thing'
import { normalizeThingFields } from '~~/shared/thingKinds'

function toDate(value: { toDate?: () => Date } | undefined, fallback: Date): Date {
  if (value && typeof value.toDate === 'function') return value.toDate()
  return fallback
}

export function mapThingDoc(id: string, data: Partial<ThingDoc>): ThingView {
  const now = new Date()
  const identifiers = Array.isArray(data.identifiers)
    ? data.identifiers.flatMap((item) => {
        if (!item || typeof item.scheme !== 'string' || typeof item.value !== 'string') return []
        const scheme = item.scheme.trim()
        const value = item.value.trim()
        return scheme && value ? [{ scheme, value }] : []
      })
    : []
  return {
    id,
    userId: data.userId ?? '',
    name: (data.name ?? '').trim() || 'Untitled',
    kind: (data.kind ?? 'other').trim() || 'other',
    summary: (data.summary ?? '').trim(),
    imageUrl: data.imageUrl?.trim() || null,
    imagePath: data.imagePath?.trim() || null,
    fields: normalizeThingFields(data.fields),
    identifiers,
    createdAt: toDate(data.createdAt, now),
    updatedAt: toDate(data.updatedAt, now),
  }
}
