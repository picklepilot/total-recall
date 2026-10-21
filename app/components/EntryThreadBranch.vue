<script setup lang="ts">
import { ChevronRight } from "lucide-vue-next";
import type { EntryView } from "@/types/entry";
import { countDescendants } from "~~/shared/entryThreads";

const props = withDefaults(
  defineProps<{
    /** Entry whose replies are rendered. */
    parentId: string;
    childrenOf: Map<string, EntryView[]>;
    /** Nesting level of these replies (1 = direct replies of the top entry shown). */
    level?: number;
    /** Deeper replies collapse into a "continue this thread" link. */
    maxLevel?: number;
    highlightId?: string;
    /** Render replies without card chrome, as rows on the thread rail. */
    flush?: boolean;
    /** When set, replies from the same day as the parent show only their time. */
    parentCreatedAt?: Date;
  }>(),
  { level: 1, maxLevel: 4, flush: false },
);

const emit = defineEmits<{
  delete: [entry: EntryView];
}>();

const replies = computed(() => props.childrenOf.get(props.parentId) ?? []);

function sameDayAsParent(d: Date) {
  return props.parentCreatedAt?.toDateString() === d.toDateString();
}
</script>

<template>
  <ol
    v-if="replies.length"
    class="border-l-2 border-foreground/[0.07] dark:border-white/[0.08]"
    :class="flush ? 'space-y-4 pl-3.5' : 'space-y-3 pl-3 sm:pl-4'"
  >
    <li
      v-for="reply in replies"
      :key="reply.id"
      :class="flush ? 'space-y-4' : 'space-y-3'"
    >
      <EntryCard
        :entry="reply"
        nested
        :flush="flush"
        :time-only="sameDayAsParent(reply.createdAt)"
        :highlighted="reply.id === highlightId"
        @delete="emit('delete', $event)"
      />
      <EntryThreadBranch
        v-if="level < maxLevel"
        :parent-id="reply.id"
        :children-of="childrenOf"
        :level="level + 1"
        :max-level="maxLevel"
        :highlight-id="highlightId"
        :flush="flush"
        :parent-created-at="parentCreatedAt && reply.createdAt"
        @delete="emit('delete', $event)"
      />
      <NuxtLink
        v-else-if="childrenOf.get(reply.id)?.length"
        :to="`/entries/${reply.id}`"
        class="inline-flex h-8 items-center gap-1 rounded-full px-2.5 text-xs font-medium text-foreground/80 transition-colors hover:bg-foreground/5 hover:text-foreground"
        :class="flush ? '-ml-2.5' : 'ml-1'"
      >
        Continue this thread
        ({{ countDescendants(reply.id, childrenOf) }} more)
        <ChevronRight class="size-3.5" aria-hidden="true" />
      </NuxtLink>
    </li>
  </ol>
</template>
