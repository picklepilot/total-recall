<script setup lang="ts">
import {
  CornerDownRight,
  Ellipsis,
  MessagesSquare,
  Trash2,
} from "lucide-vue-next";
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
    /** No card chrome; the parent supplies the surface and padding. */
    flush?: boolean;
    /** Show only the time of day (the parent already shows the date). */
    timeOnly?: boolean;
    /** Reply stays on this page and lifts the composer over the list. */
    replyInPlace?: boolean;
  }>(),
  {
    nested: false,
    highlighted: false,
    flush: false,
    timeOnly: false,
    replyInPlace: false,
  },
);

const emit = defineEmits<{
  delete: [entry: EntryView];
  reply: [entry: EntryView];
}>();

const widgets = computed(() => partitionEntryWidgets(props.entry.widgets));

const { byId: thingsById, ensureThings, ready: thingsReady } = useThings();
const { signedIn } = useAuth();

watch(
  [thingsReady, signedIn],
  ([ok, in_]) => {
    if (ok && in_ && props.entry.thingIds.length) void ensureThings().catch(() => {});
  },
  { immediate: true },
);

const linkedThings = computed(() =>
  props.entry.thingIds.flatMap((id) => {
    const thing = thingsById.value[id];
    return thing ? [thing] : [];
  }),
);

const timeLabel = computed(() => {
  const d = props.entry.createdAt;
  if (props.timeOnly) {
    return d.toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    });
  }
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year:
      d.getFullYear() === new Date().getFullYear() ? undefined : "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
});
</script>

<template>
  <article
    :class="
      flush
        ? ''
        : [
            'rounded-2xl border bg-card/40',
            nested ? 'px-4 py-3' : 'px-4 py-3.5 sm:px-5 sm:py-4',
            highlighted
              ? 'border-primary/40 ring-2 ring-primary/15'
              : 'border-border/70',
          ]
    "
  >
    <div class="flex items-start gap-2">
      <div
        class="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2 gap-y-0.5 pt-0.5 text-xs text-muted-foreground"
      >
        <NuxtLink
          :to="`/entries/${entry.id}`"
          class="shrink-0 font-medium tabular-nums text-foreground/70 underline-offset-4 hover:text-foreground hover:underline"
        >
          <time :datetime="entry.createdAt.toISOString()">{{
            timeLabel
          }}</time>
        </NuxtLink>
        <span
          v-for="t in entry.tags"
          :key="t"
          class="truncate text-muted-foreground/90"
          >#{{ t }}</span
        >
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger
          class="-mt-1.5 -mr-2 grid size-8 shrink-0 cursor-pointer touch-manipulation place-items-center rounded-full text-muted-foreground outline-none transition-colors hover:bg-foreground/5 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 data-[state=open]:bg-foreground/5"
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

    <div v-if="!entry.deleted && $slots.things" class="mt-2">
      <slot name="things" />
    </div>
    <div
      v-else-if="!entry.deleted && linkedThings.length"
      class="mt-2 flex flex-wrap gap-1.5"
    >
      <NuxtLink
        v-for="thing in linkedThings"
        :key="thing.id"
        :to="`/things/${thing.id}`"
        class="inline-flex h-7 max-w-full items-center rounded-full border border-foreground/[0.06] bg-white/70 px-2.5 text-xs font-medium text-foreground/80 hover:text-foreground dark:border-white/10 dark:bg-white/10"
      >
        <span class="truncate">{{ thing.name }}</span>
      </NuxtLink>
    </div>

    <p v-if="entry.deleted" class="mt-1 text-sm italic text-muted-foreground">
      This entry was deleted.
    </p>
    <div v-else class="mt-1 flex flex-col gap-2.5">
      <EntryWidgets
        v-if="widgets.withoutLink.length"
        :widgets="widgets.withoutLink"
      />
      <div v-if="entry.contentText.trim()">
        <ClientOnly>
          <EntryBody
            :content-json="entry.contentJson"
            :content-text="entry.contentText"
          />
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
        class="text-sm"
      />
    </div>

    <div
      v-if="!entry.deleted || $slots.footer"
      class="mt-2 -mb-1 -ml-2.5 flex flex-wrap items-center gap-1 text-xs"
    >
      <button
        v-if="!entry.deleted && replyInPlace"
        type="button"
        :data-reply-for="entry.id"
        class="inline-flex h-8 touch-manipulation items-center gap-1.5 rounded-full px-2.5 font-medium text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground"
        @click="emit('reply', entry)"
      >
        <CornerDownRight class="size-3.5" aria-hidden="true" />
        Reply
      </button>
      <NuxtLink
        v-else-if="!entry.deleted"
        :to="{ path: '/', query: { parent: entry.id } }"
        class="inline-flex h-8 touch-manipulation items-center gap-1.5 rounded-full px-2.5 font-medium text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground"
      >
        <CornerDownRight class="size-3.5" aria-hidden="true" />
        Reply
      </NuxtLink>
      <slot name="footer" />
    </div>
  </article>
</template>
