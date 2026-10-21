<script setup lang="ts">
import {
  CornerDownRight,
  Ellipsis,
  MessagesSquare,
  Trash2,
} from "lucide-vue-next";
import { parseEntryDoc } from "@/lib/tiptapShared";
import { partitionEntryWidgets } from "@/lib/entry-widgets/partitionWidgets";
import type { EntryView } from "@/types/entry";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const props = withDefaults(
  defineProps<{
    entry: EntryView;
    /** Tighter padding for replies inside a thread. */
    nested?: boolean;
    /** Emphasize the entry a thread page is focused on. */
    highlighted?: boolean;
  }>(),
  { nested: false, highlighted: false },
);

const emit = defineEmits<{
  delete: [entry: EntryView];
}>();

const widgets = computed(() => partitionEntryWidgets(props.entry.widgets));

function formatDay(d: Date) {
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
</script>

<template>
  <article
    class="rounded-xl border bg-card/40"
    :class="[
      nested ? 'px-4 py-3' : 'px-5 py-4',
      highlighted
        ? 'border-primary/40 ring-2 ring-primary/15'
        : 'border-border/70',
    ]"
  >
    <div
      class="flex flex-wrap items-center gap-2 text-xs text-muted-foreground"
    >
      <NuxtLink
        :to="`/entries/${entry.id}`"
        class="hover:text-foreground hover:underline underline-offset-4"
      >
        <time :datetime="entry.createdAt.toISOString()">{{
          formatDay(entry.createdAt)
        }}</time>
      </NuxtLink>
      <template v-if="entry.tags.length">
        <span v-for="t in entry.tags" :key="t">
          <Badge variant="secondary" class="font-normal">{{ t }}</Badge>
        </span>
      </template>
      <DropdownMenu>
        <DropdownMenuTrigger
          class="-my-1 ml-auto grid size-7 cursor-pointer place-items-center rounded-full outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
          aria-label="Entry actions"
        >
          <Ellipsis class="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" class="w-48">
          <DropdownMenuItem as-child>
            <NuxtLink :to="`/entries/${entry.id}`">
              <MessagesSquare />
              Open thread
            </NuxtLink>
          </DropdownMenuItem>
          <DropdownMenuItem v-if="!entry.deleted" as-child>
            <NuxtLink :to="{ path: '/', query: { parent: entry.id } }">
              <CornerDownRight />
              Continue thread
            </NuxtLink>
          </DropdownMenuItem>
          <template v-if="!entry.deleted">
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              @select="emit('delete', entry)"
            >
              <Trash2 />
              Delete
            </DropdownMenuItem>
          </template>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>

    <p v-if="entry.deleted" class="mt-2 text-sm italic text-muted-foreground">
      This entry was deleted.
    </p>
    <template v-else>
      <EntryWidgets
        v-if="widgets.withoutLink.length"
        :widgets="widgets.withoutLink"
        class="mt-2"
      />
      <div v-if="entry.contentText.trim()" class="mt-3">
        <ClientOnly>
          <EntryBodyTiptap
            v-if="parseEntryDoc(entry.contentJson)"
            :content-json="entry.contentJson"
          />
          <p v-else class="whitespace-pre-wrap text-sm leading-relaxed">
            {{ entry.contentText.trim() }}
          </p>
          <template #fallback>
            <p class="whitespace-pre-wrap text-sm leading-relaxed">
              {{ entry.contentText.trim() }}
            </p>
          </template>
        </ClientOnly>
      </div>
      <EntryWidgets
        v-if="widgets.linksOnly.length"
        :widgets="widgets.linksOnly"
        class="mt-3 text-sm"
      />
    </template>

    <div
      v-if="!entry.deleted || $slots.footer"
      class="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs"
    >
      <NuxtLink
        v-if="!entry.deleted"
        :to="{ path: '/', query: { parent: entry.id } }"
        class="inline-flex items-center gap-1 font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <CornerDownRight class="size-3.5" aria-hidden="true" />
        Continue thread
      </NuxtLink>
      <slot name="footer" />
    </div>
  </article>
</template>
