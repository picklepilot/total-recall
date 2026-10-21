<script setup lang="ts">
import { ChevronDown } from 'lucide-vue-next'
import type { EntryView } from '@/types/entry'
import { buildThreadIndex, countDescendants } from '~~/shared/entryThreads'

const firebaseConfigured = useFirebaseUiReady()
const { entries, deleteEntry } = useEntries()
const { signedIn } = useAuth()
const { confirmAndDelete } = useEntryDeletion(deleteEntry)

const threads = computed(() => buildThreadIndex(entries.value))

const expanded = ref(new Set<string>())
function toggleThread(id: string) {
  const next = new Set(expanded.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  expanded.value = next
}

function onDelete(entry: EntryView) {
  confirmAndDelete(entry, Boolean(threads.value.childrenOf.get(entry.id)?.length))
}
</script>

<template>
  <div class="space-y-12 pb-24">
    <div class="space-y-2">
      <h1 class="text-2xl font-semibold tracking-tight">Timeline</h1>
      <p class="text-sm text-muted-foreground leading-relaxed">
        Newest first. On the
        <NuxtLink
          to="/ask"
          class="font-medium text-primary underline-offset-4 hover:underline"
        >
          Ask
        </NuxtLink>
        page you can question anything that appears in this list.
      </p>
    </div>

    <Card v-if="!firebaseConfigured" class="border-amber-500/30 bg-amber-500/5">
      <CardHeader>
        <CardTitle class="text-base">Connect Firebase</CardTitle>
        <CardDescription>
          Once Firestore is configured, your entries will show up here in real
          time.
        </CardDescription>
      </CardHeader>
    </Card>

    <Card v-else-if="!signedIn" class="border-border/80 bg-muted/30">
      <CardHeader>
        <CardTitle class="text-base">Sign in</CardTitle>
        <CardDescription>
          Sign in with Google in the header to load your timeline and chat.
        </CardDescription>
      </CardHeader>
    </Card>

    <div
      v-else-if="!entries.length"
      class="rounded-xl border border-dashed border-border py-16 text-center"
    >
      <p class="text-sm text-muted-foreground">
        No entries yet. Add something on the Add tab.
      </p>
    </div>

    <div v-else class="space-y-5">
      <section
        v-for="item in threads.roots"
        :key="item.id"
        class="space-y-3"
      >
        <EntryCard :entry="item" @delete="onDelete">
          <template
            v-if="threads.childrenOf.get(item.id)?.length"
            #footer
          >
            <button
              type="button"
              class="inline-flex items-center gap-1 font-medium text-muted-foreground transition-colors hover:text-foreground"
              :aria-expanded="expanded.has(item.id)"
              @click="toggleThread(item.id)"
            >
              <ChevronDown
                class="size-3.5 transition-transform"
                :class="expanded.has(item.id) ? '' : '-rotate-90'"
                aria-hidden="true"
              />
              {{ countDescendants(item.id, threads.childrenOf) }}
              {{
                countDescendants(item.id, threads.childrenOf) === 1
                  ? 'reply'
                  : 'replies'
              }}
            </button>
          </template>
        </EntryCard>
        <EntryThreadBranch
          v-if="expanded.has(item.id)"
          :parent-id="item.id"
          :children-of="threads.childrenOf"
          class="ml-3 sm:ml-5"
          @delete="onDelete"
        />
      </section>
    </div>
  </div>
</template>
