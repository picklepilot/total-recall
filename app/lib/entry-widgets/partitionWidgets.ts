import type { EntryWidget, LinkWidget } from '@/types/entry'

export function partitionEntryWidgets(widgets: EntryWidget[] | null | undefined): {
  withoutLink: EntryWidget[]
  linksOnly: LinkWidget[]
} {
  const list = widgets ?? []
  const withoutLink: EntryWidget[] = []
  const linksOnly: LinkWidget[] = []
  for (const w of list) {
    if (w.type === 'link') linksOnly.push(w)
    else withoutLink.push(w)
  }
  return { withoutLink, linksOnly }
}
