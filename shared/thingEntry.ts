import { plainTextToTipTapDoc } from './import/tiptapDoc'
import { normalizeKind, thingKindById } from './thingKinds'

export interface NewThingEntryInput {
  id: string
  name: string
  kind: string
  summary?: string
  fields?: readonly { label: string; value: string }[]
}

/** Journal note for a thing that was just added. Empty field values are left out. */
export function entryDraftForNewThing(thing: NewThingEntryInput): {
  contentText: string
  contentJson: string
  tags: string[]
  thingIds: string[]
} {
  const name = thing.name.trim()
  const lines = [addedThingHeadline(name, thing.kind)]
  const summary = thing.summary?.trim()
  if (summary) lines.push(summary)
  for (const field of thing.fields ?? []) {
    const label = field.label.trim()
    const value = field.value.trim()
    if (!label || !value) continue
    lines.push(`${label}: ${value}`)
  }
  const contentText = lines.join('\n')
  const id = thing.id.trim()
  return {
    contentText,
    contentJson: plainTextToTipTapDoc(contentText),
    tags: [],
    thingIds: id ? [id] : [],
  }
}

function addedThingHeadline(name: string, kind: string): string {
  const preset = thingKindById(normalizeKind(kind))
  if (!preset || preset.id === 'other') return `Added ${name}.`
  const label = preset.label.toLowerCase()
  const article = /^[aeiou]/i.test(label) ? 'an' : 'a'
  return `Added ${name}, ${article} ${label}.`
}
