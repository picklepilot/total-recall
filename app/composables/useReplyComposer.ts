import type { EntryView } from "@/types/entry";

/** Opens the reply composer over the current page. */
export function useReplyComposer(hooks?: {
  restoreFocus?: (entryId: string) => void;
}) {
  const replyingTo = ref<EntryView | null>(null);
  let restoreId: string | null = null;

  function openReply(entry: EntryView) {
    replyingTo.value = entry;
  }

  function closeReply() {
    restoreId = replyingTo.value?.id ?? null;
    replyingTo.value = null;
  }

  function onExited() {
    const id = restoreId;
    restoreId = null;
    if (id) hooks?.restoreFocus?.(id);
  }

  return { replyingTo, openReply, closeReply, onExited };
}
