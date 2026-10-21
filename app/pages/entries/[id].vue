<script setup lang="ts">
import { ArrowLeft } from 'lucide-vue-next'
import type { EntryView } from '@/types/entry'
import { entrySnippet } from '@/lib/entrySnippet'
import { buildThreadIndex, resolveAncestors } from '~~/shared/entryThreads'

useHead({ title: 'Thread — Total Recall' })

const route = useRoute()
const router = useRouter()
const firebaseConfigured = useFirebaseUiReady()
const { byId, ready, loadThread, fetchEntry, deleteEntry, updateEntryThingIds } = useEntries()
const { signedIn } = useAuth()
const { confirmAndDelete } = useEntryDeletion(deleteEntry)

const entryId = computed(() => String(route.params.id))
const pageReady = ref(false)
const missing = ref(false)

async function loadPage() {
  pageReady.value = false
  missing.value = false
  if (!ready.value) return
  const found = await fetchEntry(entryId.value)
  if (!found) {
    missing.value = true
    pageReady.value = true
    return
  }
  await loadThread(found.rootId)
  pageReady.value = true
}

watch([entryId, ready, signedIn], ([, ok, in_]) => {
  if (ok && in_) loadPage()
  else if (!in_) {
    pageReady.value = true
    missing.value = false
  }
}, { immediate: true })

const threads = computed(() => buildThreadIndex(Object.values(byId.value)))
const entry = computed(() => threads.value.byId.get(entryId.value))
const ancestors = computed(() =>
  entry.value ? resolveAncestors(entry.value.ancestorIds, threads.value.byId) : [],
)

async function onDelete(target: EntryView) {
  const hasReplies = Boolean(threads.value.childrenOf.get(target.id)?.length)
  const result = await confirmAndDelete(target, hasReplies)
  if (result === 'deleted' && target.id === entryId.value) {
    await router.replace(target.parentId ? `/entries/${target.parentId}` : '/timeline')
  }
}

const thingIds = ref<string[]>([])
const thingError = ref('')

watch(entry, (value) => {
  if (!value) return
  const next = value.thingIds.join('\0')
  if (next !== thingIds.value.join('\0')) thingIds.value = [...value.thingIds]
})

async function onThingIds(ids: string[]) {
  if (!entry.value) return
  const previous = thingIds.value
  thingIds.value = ids
  thingError.value = ''
  try {
    await updateEntryThingIds(entry.value.id, ids)
  } catch (e) {
    thingIds.value = previous
    thingError.value = e instanceof Error ? e.message : 'Could not update things.'
  }
}

const { replyingTo, openReply, closeReply, onExited } = useReplyComposer({
  restoreFocus: (id) => {
    document.querySelector<HTMLElement>(`[data-reply-for="${CSS.escape(id)}"]`)?.focus()
  },
})
</script>

<template>
  <div class="space-y-6 pb-24">
    <NuxtLink
      to="/timeline"
      class="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
    >
      <ArrowLeft class="size-4" aria-hidden="true" />
      Timeline
    </NuxtLink>

    <Card v-if="!firebaseConfigured" class="border-amber-500/30 bg-amber-500/5">
      <CardHeader>
        <CardTitle class="text-base">Connect Firebase</CardTitle>
        <CardDescription>Configure Firestore to view threads.</CardDescription>
      </CardHeader>
    </Card>

    <Card v-else-if="!signedIn" class="border-border/80 bg-muted/30">
      <CardHeader>
        <CardTitle class="text-base">Sign in</CardTitle>
        <CardDescription>
          Sign in with Google in the header to view this thread.
        </CardDescription>
      </CardHeader>
    </Card>

    <p v-else-if="!pageReady" class="text-sm text-muted-foreground">Loading…</p>

    <div
      v-else-if="missing || !entry"
      class="rounded-xl border border-dashed border-border py-16 text-center"
    >
      <p class="text-sm text-muted-foreground">
        This entry doesn't exist or was deleted.
      </p>
    </div>

    <template v-else>
      <nav v-if="ancestors.length" aria-label="Thread breadcrumbs">
        <ol class="space-y-1 border-l border-border/70 pl-4">
          <li v-for="a in ancestors" :key="a.id">
            <NuxtLink
              :to="`/entries/${a.id}`"
              class="block truncate text-sm text-muted-foreground transition-colors hover:text-foreground"
              :class="a.deleted ? 'italic' : ''"
            >
              {{ entrySnippet(a) }}
            </NuxtLink>
          </li>
        </ol>
      </nav>

      <EntryCard
        :entry="entry"
        highlighted
        reply-in-place
        @delete="onDelete"
        @reply="openReply"
      >
        <template v-if="!entry.deleted" #things>
          <ThingPicker :model-value="thingIds" @update:model-value="onThingIds" />
          <p v-if="thingError" class="mt-1 text-xs text-destructive">{{ thingError }}</p>
        </template>
      </EntryCard>

      <EntryThreadBranch
        :parent-id="entry.id"
        :children-of="threads.childrenOf"
        :max-level="6"
        reply-in-place
        class="ml-3 sm:ml-5"
        @delete="onDelete"
        @reply="openReply"
      />
    </template>
  </div>
  <ReplyComposeLayer
    :entry="replyingTo"
    @close="closeReply"
    @exited="onExited"
    @saved="closeReply"
  />
</template>
