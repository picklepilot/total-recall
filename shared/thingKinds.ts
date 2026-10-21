export const THING_FIELD_TYPES = ['text', 'number', 'date', 'url'] as const

export type ThingFieldType = (typeof THING_FIELD_TYPES)[number]

export interface ThingField {
  id: string
  label: string
  type: ThingFieldType
  value: string
}

export interface ThingFieldPreset {
  label: string
  type: ThingFieldType
}

export interface ThingKindPreset {
  id: string
  label: string
  fields: ThingFieldPreset[]
}

/** Creation presets. A thing copies these onto itself; the kind is not a schema. */
export const THING_KINDS: ThingKindPreset[] = [
  {
    id: 'book',
    label: 'Book',
    fields: [
      { label: 'Author', type: 'text' },
      { label: 'Year', type: 'number' },
      { label: 'ISBN', type: 'text' },
    ],
  },
  {
    id: 'movie',
    label: 'Movie',
    fields: [
      { label: 'Director', type: 'text' },
      { label: 'Year', type: 'number' },
    ],
  },
  {
    id: 'person',
    label: 'Person',
    fields: [{ label: 'How we met', type: 'text' }],
  },
  {
    id: 'place',
    label: 'Place',
    fields: [{ label: 'Where', type: 'text' }],
  },
  {
    id: 'tool',
    label: 'Tool',
    fields: [{ label: 'Maker', type: 'text' }],
  },
  {
    id: 'vehicle',
    label: 'Vehicle',
    fields: [
      { label: 'Make', type: 'text' },
      { label: 'Year', type: 'number' },
    ],
  },
  { id: 'other', label: 'Other', fields: [] },
]

export const DEFAULT_THING_KIND = 'other'
export const LAST_THING_KIND_KEY = 'total-recall-last-thing-kind'

const FIELD_TYPES = new Set<string>(THING_FIELD_TYPES)
const MAX_FIELDS = 40
const MAX_LABEL = 80
const MAX_VALUE = 2000
const MAX_THING_IDS = 40

export function thingKindById(id: string): ThingKindPreset | undefined {
  return THING_KINDS.find((kind) => kind.id === id)
}

export function thingKindLabel(id: string): string {
  return thingKindById(id)?.label ?? 'Other'
}

export function normalizeKind(kind: string): string {
  const slug = kind.trim().toLowerCase().slice(0, 40)
  return slug || DEFAULT_THING_KIND
}

export function newThingFieldId(): string {
  return crypto.randomUUID()
}

/** Suggested fields for a new thing. Empty values; the detail page fills them in. */
export function fieldsFromKind(kind: string): ThingField[] {
  const preset = thingKindById(normalizeKind(kind))
  if (!preset) return []
  return preset.fields.map((field) => ({
    id: newThingFieldId(),
    label: field.label,
    type: field.type,
    value: '',
  }))
}

/** Trim labels, drop blanks, coerce unknown types, and give duplicate ids a new one. */
export function normalizeThingFields(input: unknown): ThingField[] {
  if (!Array.isArray(input)) return []
  const out: ThingField[] = []
  const seen = new Set<string>()
  for (const raw of input) {
    if (!raw || typeof raw !== 'object') continue
    const row = raw as Record<string, unknown>
    const label = String(row.label ?? '').trim().slice(0, MAX_LABEL)
    if (!label) continue
    let id = String(row.id ?? '').trim()
    if (!id || seen.has(id)) id = newThingFieldId()
    seen.add(id)
    const typeRaw = String(row.type ?? '')
    const type: ThingFieldType = FIELD_TYPES.has(typeRaw) ? (typeRaw as ThingFieldType) : 'text'
    const value = String(row.value ?? '').trim().slice(0, MAX_VALUE)
    out.push({ id, label, type, value })
    if (out.length >= MAX_FIELDS) break
  }
  return out
}

/** Preset labels not already on the thing, matched case-insensitively. */
export function missingSuggestedFields(kind: string, fields: { label: string }[]): ThingFieldPreset[] {
  const preset = thingKindById(normalizeKind(kind))
  if (!preset) return []
  const have = new Set(fields.map((field) => field.label.trim().toLowerCase()))
  return preset.fields.filter((field) => !have.has(field.label.trim().toLowerCase()))
}

export function normalizeThingIds(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  const out: string[] = []
  for (const item of value) {
    if (typeof item !== 'string') continue
    const id = item.trim()
    if (!id || out.includes(id)) continue
    out.push(id)
    if (out.length >= MAX_THING_IDS) break
  }
  return out
}

export function readLastThingKind(): string {
  if (typeof localStorage === 'undefined') return DEFAULT_THING_KIND
  try {
    const stored = localStorage.getItem(LAST_THING_KIND_KEY)
    if (stored && thingKindById(stored)) return stored
  } catch {
    /* private mode */
  }
  return DEFAULT_THING_KIND
}

export function writeLastThingKind(kind: string) {
  if (typeof localStorage === 'undefined') return
  const slug = normalizeKind(kind)
  if (!thingKindById(slug)) return
  try {
    localStorage.setItem(LAST_THING_KIND_KEY, slug)
  } catch {
    /* private mode */
  }
}
