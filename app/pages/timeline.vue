<script setup lang="ts">
import {
  ChevronDown,
  History,
  KeyRound,
  Loader2,
  LockKeyhole,
  PenLine,
  Sparkles,
} from 'lucide-vue-next'
import { useIntersectionObserver } from '@vueuse/core'
import type { EntryView } from '@/types/entry'
import { buildThreadIndex } from '~~/shared/entryThreads'

useHead({ title: 'Timeline — Total Recall' })

const firebaseConfigured = useFirebaseUiReady()
const {
  byId,
  roots,
  ready,
  hasMoreRoots,
  timelineLoaded,
  timelineLoading,
  loadingMore,
  loadedThreads,
  threadLoading,
  ensureTimeline,
  loadMoreRoots,
  loadThread,
  deleteEntry,
} = useEntries()
const { signedIn } = useAuth()
const { confirmAndDelete } = useEntryDeletion(deleteEntry)

const threads = computed(() => buildThreadIndex(Object.values(byId.value)))

watch(
  [ready, signedIn],
  ([ok, in_]) => {
    if (ok && in_) ensureTimeline()
  },
  { immediate: true },
)

const loadMoreEl = ref<HTMLElement | null>(null)
useIntersectionObserver(loadMoreEl, ([entry]) => {
  if (entry?.isIntersecting) loadMoreRoots()
})

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

function dayLabel(day: Date, today: Date) {
  const daysAgo = Math.round((today.getTime() - day.getTime()) / 86_400_000)
  if (daysAgo === 0) return 'Today'
  if (daysAgo === 1) return 'Yesterday'
  if (daysAgo > 1 && daysAgo < 7) {
    return day.toLocaleDateString(undefined, { weekday: 'long' })
  }
  return day.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: day.getFullYear() === today.getFullYear() ? undefined : 'numeric',
  })
}

const days = computed(() => {
  const today = startOfDay(new Date())
  const groups: { key: string; label: string; entries: EntryView[] }[] = []
  for (const entry of roots.value) {
    const day = startOfDay(entry.createdAt)
    const key = day.toISOString()
    const last = groups.at(-1)
    if (last?.key === key) last.entries.push(entry)
    else groups.push({ key, label: dayLabel(day, today), entries: [entry] })
  }
  return groups
})

const entryCountLabel = computed(() => {
  if (!signedIn.value || !timelineLoaded.value) return 'Your history'
  return 'Newest first'
})

const expanded = ref(new Set<string>())
async function toggleThread(id: string) {
  const next = new Set(expanded.value)
  if (next.has(id)) {
    next.delete(id)
    expanded.value = next
    return
  }
  next.add(id)
  expanded.value = next
  await loadThread(id)
}

function onDelete(entry: EntryView) {
  const hasReplies = entry.parentId
    ? Boolean(threads.value.childrenOf.get(entry.id)?.length)
    : entry.replyCount > 0
  confirmAndDelete(entry, hasReplies)
}
</script>

<template>
  <div class="mx-auto flex w-full max-w-xl flex-1 flex-col">
    <header class="mb-5 flex items-end justify-between gap-4 px-4 sm:mb-7 sm:px-1">
      <div class="min-w-0">
        <p
          class="h-4 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground"
        >
          {{ entryCountLabel }}
        </p>
        <h1
          class="mt-2 text-[1.7rem] font-semibold leading-tight tracking-tight sm:text-3xl"
        >
          Timeline
        </h1>
      </div>
      <NuxtLink
        v-if="firebaseConfigured && signedIn"
        to="/ask"
        class="inline-flex h-9 shrink-0 touch-manipulation items-center gap-1.5 rounded-full border border-foreground/[0.06] bg-card/70 px-3.5 text-sm font-medium shadow-sm transition-colors hover:bg-card dark:border-white/10 dark:bg-white/[0.06] dark:hover:bg-white/10"
      >
        <Sparkles class="size-4 text-muted-foreground" aria-hidden="true" />
        Ask
      </NuxtLink>
    </header>

    <section
      v-if="!firebaseConfigured"
      class="my-auto rounded-3xl border border-amber-500/30 bg-amber-50/70 p-6 text-center backdrop-blur-xl dark:bg-amber-500/10"
    >
      <span
        class="mx-auto mb-4 grid size-12 place-items-center rounded-2xl bg-amber-500/15 text-amber-600 dark:text-amber-400"
      >
        <KeyRound class="size-5" aria-hidden="true" />
      </span>
      <h2 class="text-base font-semibold">Connect Firebase</h2>
      <p
        class="mx-auto mt-1.5 max-w-sm text-sm leading-relaxed text-muted-foreground"
      >
        Once Firestore is configured, your entries will show up here in real
        time.
      </p>
    </section>

    <section
      v-else-if="!signedIn"
      class="my-auto rounded-3xl border border-border/70 bg-card/80 p-6 text-center shadow-sm backdrop-blur-xl sm:p-8"
    >
      <span
        class="mx-auto mb-4 grid size-12 place-items-center rounded-2xl bg-muted text-muted-foreground"
      >
        <LockKeyhole class="size-5" aria-hidden="true" />
      </span>
      <h2 class="text-base font-semibold">Sign in to see your timeline</h2>
      <p
        class="mx-auto mt-1.5 max-w-xs text-sm leading-relaxed text-muted-foreground"
      >
        Use the Sign in button in the header to load your entries.
      </p>
    </section>

    <div
      v-else-if="!timelineLoaded || timelineLoading"
      aria-busy="true"
      aria-label="Loading entries"
    >
      <div class="mb-2 h-7 w-20 animate-pulse rounded-full bg-foreground/[0.06]" />
      <div
        class="divide-y divide-foreground/[0.06] overflow-hidden rounded-3xl border border-foreground/[0.06] bg-card/70 shadow-sm dark:bg-white/[0.04]"
      >
        <div v-for="i in 3" :key="i" class="space-y-2.5 px-4 py-4 sm:px-5">
          <div class="h-3 w-16 animate-pulse rounded-full bg-foreground/[0.07]" />
          <div class="h-3.5 w-11/12 animate-pulse rounded-full bg-foreground/[0.07]" />
          <div class="h-3.5 w-3/5 animate-pulse rounded-full bg-foreground/[0.07]" />
        </div>
      </div>
    </div>

    <section
      v-else-if="!roots.length"
      class="my-auto rounded-3xl border border-dashed border-foreground/10 p-6 text-center sm:p-8"
    >
      <span
        class="mx-auto mb-4 grid size-12 place-items-center rounded-2xl bg-muted text-muted-foreground"
      >
        <History class="size-5" aria-hidden="true" />
      </span>
      <h2 class="text-base font-semibold">Nothing here yet</h2>
      <p
        class="mx-auto mt-1.5 max-w-xs text-sm leading-relaxed text-muted-foreground"
      >
        Everything you add shows up here, newest first.
      </p>
      <Button
        as-child
        size="lg"
        class="mt-5 h-12 w-full touch-manipulation rounded-full text-base sm:w-auto sm:px-8"
      >
        <NuxtLink to="/">
          <PenLine class="size-4" aria-hidden="true" />
          Write your first entry
        </NuxtLink>
      </Button>
    </section>

    <div v-else class="space-y-6 sm:space-y-8">
      <section
        v-for="day in days"
        :key="day.key"
        :aria-labelledby="`day-${day.key}`"
      >
        <h2
          :id="`day-${day.key}`"
          class="sticky top-[calc(6.5rem+env(safe-area-inset-top))] z-10 mb-2 flex px-1 sm:top-[calc(4rem+env(safe-area-inset-top))]"
        >
          <span
            class="rounded-full border border-foreground/[0.06] bg-background/80 px-3 py-1 text-xs font-semibold tracking-tight shadow-sm backdrop-blur-xl dark:border-white/10"
          >
            {{ day.label }}
          </span>
        </h2>

        <ol
          class="divide-y divide-foreground/[0.06] overflow-hidden rounded-3xl border border-foreground/[0.06] bg-card/70 shadow-sm dark:divide-white/[0.06] dark:border-white/10 dark:bg-white/[0.04]"
        >
          <li
            v-for="item in day.entries"
            :key="item.id"
            class="px-4 py-3.5 sm:px-5 sm:py-4"
          >
            <EntryCard :entry="item" flush time-only @delete="onDelete">
              <template v-if="item.replyCount" #footer>
                <button
                  type="button"
                  class="inline-flex h-8 touch-manipulation items-center gap-1 rounded-full px-2.5 font-medium transition-colors hover:bg-foreground/5 hover:text-foreground"
                  :class="
                    expanded.has(item.id)
                      ? 'bg-foreground/5 text-foreground'
                      : 'text-muted-foreground'
                  "
                  :aria-expanded="expanded.has(item.id)"
                  @click="toggleThread(item.id)"
                >
                  <Loader2
                    v-if="threadLoading[item.id]"
                    class="size-3.5 animate-spin"
                    aria-hidden="true"
                  />
                  {{ item.replyCount }}
                  {{ item.replyCount === 1 ? 'reply' : 'replies' }}
                  <ChevronDown
                    class="size-3.5 transition-transform duration-200"
                    :class="expanded.has(item.id) ? 'rotate-180' : ''"
                    aria-hidden="true"
                  />
                </button>
              </template>
            </EntryCard>
            <p
              v-if="expanded.has(item.id) && threadLoading[item.id] && !loadedThreads[item.id]"
              class="mt-3 text-xs text-muted-foreground"
            >
              Loading replies…
            </p>
            <EntryThreadBranch
              v-else-if="expanded.has(item.id) && loadedThreads[item.id]"
              :parent-id="item.id"
              :children-of="threads.childrenOf"
              flush
              :parent-created-at="item.createdAt"
              class="mt-3 ml-1"
              @delete="onDelete"
            />
          </li>
        </ol>
      </section>

      <div ref="loadMoreEl" class="flex justify-center pt-1">
        <Button
          v-if="hasMoreRoots"
          type="button"
          variant="secondary"
          class="h-10 touch-manipulation rounded-full px-5"
          :disabled="loadingMore"
          @click="loadMoreRoots"
        >
          {{ loadingMore ? 'Loading…' : 'Load more' }}
        </Button>
      </div>
    </div>
  </div>
</template>
