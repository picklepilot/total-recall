<script setup lang="ts">
import type { EntryView } from "@/types/entry";

const props = defineProps<{
  entry: EntryView | null;
}>();

const emit = defineEmits<{
  close: [];
  /** Sheet has finished sliding away. */
  exited: [];
  saved: [payload: { id: string; parentId: string | null }];
}>();

const formRef = ref<{ focus: () => void } | null>(null);
const panelRef = ref<HTMLElement | null>(null);
/** ProseMirror mounts after the slide has started, so it can't delay the first frame. */
const editorReady = ref(false);

function lockScroll(on: boolean) {
  document.documentElement.classList.toggle("reply-scroll-lock", on);
}

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function revealEditor() {
  if (!props.entry) return;
  editorReady.value = true;
  formRef.value?.focus();
}

function onEnter() {
  editorReady.value = false;
  if (prefersReducedMotion()) {
    revealEditor();
    return;
  }
  requestAnimationFrame(() => requestAnimationFrame(revealEditor));
}

function onAfterLeave() {
  editorReady.value = false;
  lockScroll(false);
  // The browser moves focus to the document when the focused sheet is
  // removed. Restore the reply button on the next frame, after that.
  requestAnimationFrame(() => emit("exited"));
}

watch(
  () => props.entry,
  (entry) => {
    if (entry) lockScroll(true);
  },
);

function focus() {
  formRef.value?.focus();
}

defineExpose({ focus });

function onKeydown(event: KeyboardEvent) {
  if (!props.entry) return;
  if (event.key === "Escape") {
    event.preventDefault();
    emit("close");
    return;
  }
  if (event.key !== "Tab" || !panelRef.value) return;
  const nodes = [
    ...panelRef.value.querySelectorAll<HTMLElement>(
      'button:not([disabled]), a[href], input:not([disabled]), textarea:not([disabled]), [contenteditable="true"]',
    ),
  ];
  if (!nodes.length) return;
  const first = nodes[0]!;
  const last = nodes[nodes.length - 1]!;
  const active = document.activeElement;
  if (
    event.shiftKey &&
    (active === first || !panelRef.value.contains(active))
  ) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && active === last) {
    event.preventDefault();
    first.focus();
  }
}

onMounted(() => window.addEventListener("keydown", onKeydown));
onBeforeUnmount(() => {
  window.removeEventListener("keydown", onKeydown);
  lockScroll(false);
});
</script>

<template>
  <Transition
    enter-active-class="reply-scrim-enter-active"
    enter-from-class="reply-scrim-enter-from"
    leave-active-class="reply-scrim-leave-active"
    leave-to-class="reply-scrim-leave-to"
  >
    <div
      v-if="entry"
      class="fixed inset-0 z-[60] bg-black/45 dark:bg-black/70"
      aria-hidden="true"
      @click="emit('close')"
    />
  </Transition>

  <Transition
    enter-active-class="reply-rise-enter-active"
    enter-from-class="reply-rise-enter-from"
    leave-active-class="reply-rise-leave-active"
    leave-to-class="reply-rise-leave-to"
    @enter="onEnter"
    @after-leave="onAfterLeave"
  >
    <div
      v-if="entry"
      class="pointer-events-none fixed inset-x-0 bottom-0 z-[70] flex justify-center px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-4"
    >
      <div
        ref="panelRef"
        role="dialog"
        aria-modal="true"
        aria-label="Reply"
        class="pointer-events-auto max-h-[calc(100dvh-env(safe-area-inset-top)-env(safe-area-inset-bottom)-1.75rem)] w-full max-w-xl overflow-y-auto overscroll-contain"
      >
        <EntryComposeForm
          ref="formRef"
          class="reply-sheet"
          :parent-id="entry.id"
          :parent="entry"
          dismiss-label="Close reply"
          :suspend-editor="!editorReady"
          @clear-parent="emit('close')"
          @saved="emit('saved', $event)"
        />
      </div>
    </div>
  </Transition>
</template>
