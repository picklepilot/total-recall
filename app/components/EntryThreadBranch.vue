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
  }>(),
  { level: 1, maxLevel: 4 },
);

const emit = defineEmits<{
  delete: [entry: EntryView];
}>();

const replies = computed(() => props.childrenOf.get(props.parentId) ?? []);
</script>

<template>
  <ol
    v-if="replies.length"
    class="space-y-3 border-l border-border/70 pl-3 sm:pl-4"
  >
    <li v-for="reply in replies" :key="reply.id" class="space-y-3">
      <EntryCard
        :entry="reply"
        nested
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
        @delete="emit('delete', $event)"
      />
      <NuxtLink
        v-else-if="childrenOf.get(reply.id)?.length"
        :to="`/entries/${reply.id}`"
        class="ml-3 inline-flex items-center gap-1 text-xs font-medium text-primary underline-offset-4 hover:underline"
      >
        Continue this thread
        ({{ countDescendants(reply.id, childrenOf) }} more)
        <ChevronRight class="size-3.5" aria-hidden="true" />
      </NuxtLink>
    </li>
  </ol>
</template>
