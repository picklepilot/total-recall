import type { EntryView } from '@/types/entry'

type DeleteEntry = (entryId: string) => Promise<{ result: 'deleted' | 'tombstoned' }>

/** Confirms with the user, then deletes. Returns null if cancelled or failed. */
export function useEntryDeletion(deleteEntry: DeleteEntry) {
  const deletingId = ref<string | null>(null)

  async function confirmAndDelete(entry: EntryView, hasReplies: boolean) {
    if (deletingId.value) return null
    const message = hasReplies
      ? 'Delete this entry? Its replies stay in the thread, and it will show as deleted.'
      : 'Delete this entry? This cannot be undone.'
    if (!window.confirm(message)) return null

    deletingId.value = entry.id
    try {
      return (await deleteEntry(entry.id)).result
    } catch (e) {
      console.error(e)
      window.alert(e instanceof Error ? e.message : 'Could not delete entry.')
      return null
    } finally {
      deletingId.value = null
    }
  }

  return { deletingId, confirmAndDelete }
}
