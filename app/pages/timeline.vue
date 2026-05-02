<script setup lang="ts">
import { entriesToMemoryContext } from '@/utils/memoryContext'

const nuxtApp = useNuxtApp()
const firebaseConfigured = computed(() => Boolean(nuxtApp.$firebaseReady))
const { entries, ready } = useEntries()
const { signedIn, authHeaders } = useAuth()

const messages = ref<{ role: 'user' | 'assistant'; content: string }[]>([])
const chatInput = ref('')
const sending = ref(false)
const chatError = ref('')

const scrollRef = ref<HTMLElement | null>(null)

watch(
  () => messages.value.length,
  async () => {
    await nextTick()
    scrollRef.value?.scrollTo({ top: scrollRef.value.scrollHeight, behavior: 'smooth' })
  },
)

async function sendMessage() {
  const text = chatInput.value.trim()
  if (!text || sending.value) return
  chatError.value = ''
  messages.value = [...messages.value, { role: 'user', content: text }]
  chatInput.value = ''
  sending.value = true
  try {
    const memoryContext = entriesToMemoryContext(entries.value)
    const headers = await authHeaders()
    const res = await $fetch<{ reply: string; modelUnavailable?: boolean }>('/api/chat', {
      method: 'POST',
      body: { messages: messages.value, memoryContext },
      headers,
    })
    messages.value = [
      ...messages.value,
      { role: 'assistant', content: res.reply },
    ]
  } catch (e: unknown) {
    const err = e as { data?: { statusMessage?: string }; message?: string }
    chatError.value = err?.data?.statusMessage || err?.message || 'Request failed.'
    messages.value = [
      ...messages.value,
      {
        role: 'assistant',
        content: 'Something went wrong. Check NUXT_GEMINI_API_KEY and try again.',
      },
    ]
  } finally {
    sending.value = false
  }
}

function formatDay(d: Date) {
  return d.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}
</script>

<template>
  <div class="space-y-12 pb-24">
    <div class="space-y-2">
      <h1 class="text-2xl font-semibold tracking-tight">Timeline</h1>
      <p class="text-sm text-muted-foreground leading-relaxed">
        Newest first. Ask the assistant about anything that appears in this list.
      </p>
    </div>

    <Card v-if="!firebaseConfigured" class="border-amber-500/30 bg-amber-500/5">
      <CardHeader>
        <CardTitle class="text-base">Connect Firebase</CardTitle>
        <CardDescription>
          Once Firestore is configured, your entries will show up here in real time.
        </CardDescription>
      </CardHeader>
    </Card>

    <Card v-else-if="!signedIn" class="border-border/80 bg-muted/30">
      <CardHeader>
        <CardTitle class="text-base">Sign in</CardTitle>
        <CardDescription> Sign in with Google in the header to load your timeline and chat. </CardDescription>
      </CardHeader>
    </Card>

    <div v-else-if="!entries.length" class="rounded-xl border border-dashed border-border py-16 text-center">
      <p class="text-sm text-muted-foreground">No entries yet. Add something on the Add tab.</p>
    </div>

    <div v-else class="space-y-5">
      <article
        v-for="item in entries"
        :key="item.id"
        class="rounded-xl border border-border/70 bg-card/40 px-5 py-4"
      >
        <div class="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <time :datetime="item.createdAt.toISOString()">{{ formatDay(item.createdAt) }}</time>
          <template v-if="item.tags.length">
            <span v-for="t in item.tags" :key="t">
              <Badge variant="secondary" class="font-normal">{{ t }}</Badge>
            </span>
          </template>
        </div>
        <p v-if="item.contentText.trim()" class="mt-3 whitespace-pre-wrap text-sm leading-relaxed">
          {{ item.contentText.trim() }}
        </p>
        <div v-if="item.url" class="mt-3 text-sm">
          <a
            :href="item.url"
            target="_blank"
            rel="noopener noreferrer"
            class="font-medium text-primary underline underline-offset-4"
          >
            {{ item.linkPreview?.title || item.url }}
          </a>
        </div>
      </article>
    </div>

    <Separator class="my-8" />

    <section class="space-y-4">
      <div>
        <h2 class="text-lg font-semibold tracking-tight">Ask your log</h2>
        <p class="mt-1 text-sm text-muted-foreground">
          Answers use the entries above as context. Chat and link preview require a signed-in session
          verified on the server.
        </p>
      </div>

      <Card class="border-border/80 bg-card/50">
        <CardContent class="p-0">
          <div
            ref="scrollRef"
            class="max-h-[min(420px,50vh)] space-y-4 overflow-y-auto px-4 py-4"
          >
            <p
              v-if="!messages.length"
              class="text-sm text-muted-foreground"
            >
              Try: “What was the most recent music I saved?” or “What did I note about Texas?”
            </p>
            <div
              v-for="(m, i) in messages"
              :key="i"
              class="text-sm leading-relaxed"
              :class="m.role === 'user' ? 'text-foreground' : 'text-muted-foreground'"
            >
              <span class="font-medium text-foreground/90">
                {{ m.role === 'user' ? 'You' : 'Assistant' }}
              </span>
              <p class="mt-1 whitespace-pre-wrap">{{ m.content }}</p>
            </div>
          </div>
          <Separator />
          <div class="flex gap-2 p-3">
            <Input
              v-model="chatInput"
              class="rounded-lg"
              placeholder="Ask about your entries…"
              :disabled="sending || !signedIn"
              @keydown.enter.exact.prevent="sendMessage"
            />
            <Button
              class="shrink-0 rounded-lg"
              :disabled="sending || !signedIn"
              @click="sendMessage"
            >
              {{ sending ? '…' : 'Send' }}
            </Button>
          </div>
        </CardContent>
      </Card>
      <p v-if="chatError" class="text-xs text-destructive">{{ chatError }}</p>
    </section>
  </div>
</template>
