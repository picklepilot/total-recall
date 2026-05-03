<script setup lang="ts">
import { ArrowUp, Loader2 } from "lucide-vue-next";
import {
  isChatUiTableBlock,
  type ChatUiTableBlock,
} from "~~/shared/types/chat-ui";

useHead({
  title: "Ask your log — Total Recall",
});

const nuxtApp = useNuxtApp();
const firebaseConfigured = useFirebaseUiReady();
const { entries, ready } = useEntries();
const { signedIn, authHeaders } = useAuth();

const prompt = ref("");
const sessionStarted = ref(false);
const streaming = ref(false);

const reindexing = ref(false);
const reindexStatus = ref("");
const forceReindex = ref(false);

async function runReindexAll() {
  if (!signedIn.value || reindexing.value) return;
  reindexing.value = true;
  reindexStatus.value = "";
  let totalIndexed = 0;
  let totalSkipped = 0;
  let totalFailed = 0;
  let lastFirstError = "";
  let rounds = 0;
  try {
    const headers = await authHeaders();
    while (rounds < 80) {
      rounds++;
      const res = await $fetch<{
        indexed: number;
        skipped: number;
        failed: number;
        hasMore: boolean;
        firstError?: string;
      }>("/api/entries/reindex-all", {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: { force: forceReindex.value },
      });
      totalIndexed += res.indexed;
      totalSkipped += res.skipped;
      totalFailed += res.failed;
      if (res.firstError) lastFirstError = res.firstError;
      reindexStatus.value = `Indexed ${totalIndexed}… (${totalSkipped} skipped, ${totalFailed} failed this run)`;
      if (!res.hasMore) break;
    }
    const errTail =
      totalFailed > 0 && lastFirstError
        ? ` ${lastFirstError}`
        : totalFailed > 0
          ? " Enable “Overwrite existing vectors” if old embeddings used a different model/dimension."
          : "";
    reindexStatus.value = `Done. Indexed ${totalIndexed} entr${totalIndexed === 1 ? "y" : "ies"} (${totalSkipped} skipped, ${totalFailed} failed).${errTail}`;
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Reindex failed.";
    reindexStatus.value = msg;
  } finally {
    reindexing.value = false;
  }
}
const sawFirstChunk = ref(false);
const reply = ref("");
const uiTables = ref<ChatUiTableBlock[]>([]);
const streamError = ref("");
const responseRef = ref<HTMLElement | null>(null);
const isTextareaFocused = ref(false);

const formattedParagraphs = computed(() => {
  const t = reply.value.trim();
  if (!t) return [];
  return t
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter(Boolean);
});

async function runStream() {
  const text = prompt.value.trim();
  if (!text || streaming.value) return;
  if (!signedIn.value) return;

  streamError.value = "";
  reply.value = "";
  uiTables.value = [];
  sawFirstChunk.value = false;
  streaming.value = true;
  sessionStarted.value = true;

  await nextTick();
  responseRef.value?.scrollIntoView({ behavior: "smooth", block: "start" });

  try {
    const headers = await authHeaders();
    const res = await fetch("/api/chat-stream", {
      method: "POST",
      headers: {
        ...headers,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messages: [{ role: "user" as const, content: text }],
      }),
    });

    if (!res.ok) {
      const raw = await res.text().catch(() => "");
      let msg = res.statusText || "Request failed";
      try {
        const errJson = JSON.parse(raw) as {
          statusMessage?: string;
          message?: string;
        };
        msg = errJson.statusMessage || errJson.message || msg;
      } catch {
        if (raw) msg = raw.slice(0, 200);
      }
      throw new Error(msg);
    }

    const reader = res.body?.getReader();
    if (!reader) throw new Error("No response body");

    const decoder = new TextDecoder();
    let buffer = "";

    const handleSseBlock = (block: string) => {
      const lines = block
        .replace(/\r\n/g, "\n")
        .replace(/\r/g, "\n")
        .split("\n");
      const dataLine = lines.find((l) => /^data:\s?/.test(l));
      if (!dataLine) return;
      const jsonStr = dataLine.replace(/^data:\s?/, "").trim();
      try {
        const evt = JSON.parse(jsonStr) as {
          t?: string;
          done?: boolean;
          ui?: unknown;
        };
        if (evt.ui !== undefined && isChatUiTableBlock(evt.ui)) {
          uiTables.value.push(evt.ui);
          sawFirstChunk.value = true;
        }
        if (evt.t) {
          reply.value += evt.t;
          sawFirstChunk.value = true;
        }
      } catch {
        /* ignore */
      }
    };

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const chunks = buffer.split(/\n\n/);
      buffer = chunks.pop() ?? "";
      for (const block of chunks) handleSseBlock(block);
    }
    buffer += decoder.decode();
    if (buffer.trim()) {
      for (const block of buffer.split(/\n\n/)) handleSseBlock(block);
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Something went wrong.";
    streamError.value = msg;
    uiTables.value = [];
    reply.value =
      "Could not complete the answer. Check NUXT_GEMINI_API_KEY and your connection, then try again.";
  } finally {
    streaming.value = false;
  }
}

function onSubmit() {
  void runStream();
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
    e.preventDefault();
    void runStream();
  }
}

watch(
  ready,
  (isReady) => {
    if (isReady && import.meta.client) {
      nextTick(() => document.getElementById("ask-log-input")?.focus());
    }
  },
  { immediate: true },
);
</script>

<template>
  <div class="pb-20">
    <div
      class="flex flex-col transition-all duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]"
      :class="
        sessionStarted
          ? 'min-h-0 pt-1'
          : 'min-h-[min(520px,calc(100dvh-11rem))] justify-center'
      "
    >
      <header v-if="!sessionStarted" class="mb-10 space-y-2 text-center">
        <h1 class="text-2xl font-semibold tracking-tight text-foreground">
          Ask your log
        </h1>
        <p
          class="mx-auto max-w-md text-sm leading-relaxed text-muted-foreground"
        >
          Questions retrieve the most relevant entries (Firestore vector search),
          then stream an answer. Sign in is required.
        </p>
      </header>

      <div
        class="mx-auto w-full max-w-2xl transition-all duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]"
        :class="sessionStarted ? '' : 'px-1'"
      >
        <div
          class="relative overflow-hidden rounded-2xl border bg-card/60 shadow-sm backdrop-blur-sm transition-[border-color,box-shadow,ring-color,ring-width] duration-200 dark:bg-card/40"
          :class="[
            sessionStarted ? 'shadow-md' : 'shadow-lg shadow-primary/5',
            isTextareaFocused
              ? 'border-ring ring-3 ring-ring/60 dark:ring-ring/50'
              : 'border-border/70 ring-3 ring-transparent',
          ]"
        >
          <div
            class="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-primary/35 to-transparent"
            aria-hidden="true"
          />
          <div :class="sessionStarted ? 'p-3 sm:p-4' : 'p-4 sm:p-6 sm:pb-4'">
            <label class="sr-only" for="ask-log-input">Your question</label>
            <Textarea
              id="ask-log-input"
              v-model="prompt"
              :disabled="streaming || !signedIn || !firebaseConfigured"
              :class="[
                'min-h-[7.5rem] resize-y border-0 bg-transparent dark:bg-transparent text-[15px] leading-relaxed shadow-none focus-visible:ring-0 md:min-h-[9rem]',
                sessionStarted ? 'min-h-[4.5rem] md:min-h-[5.25rem]' : '',
              ]"
              placeholder="What do you want to remember? e.g. “What was the latest link I saved about music?”"
              @keydown="onKeydown"
              @focus="isTextareaFocused = true"
              @blur="isTextareaFocused = false"
            />
            <div
              class="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-border/50 pt-3"
            >
              <p class="text-[11px] text-muted-foreground sm:text-xs">
                <kbd
                  class="rounded border border-border bg-muted/80 px-1 py-0.5 font-mono text-[10px]"
                  >⌘</kbd
                >
                <span class="mx-0.5">+</span>
                <kbd
                  class="rounded border border-border bg-muted/80 px-1 py-0.5 font-mono text-[10px]"
                  >Enter</kbd
                >
                to send
              </p>
              <Button
                class="rounded-xl gap-2 shadow-sm pr-3"
                :disabled="
                  streaming ||
                  !prompt.trim() ||
                  !signedIn ||
                  !firebaseConfigured
                "
                @click="onSubmit"
              >
                <Loader2 v-if="streaming" class="size-4 animate-spin" />
                <ArrowUp v-else class="size-4" />
                {{ streaming ? "Thinking…" : "Ask" }}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div
      v-if="signedIn && firebaseConfigured && ready && entries.length"
      class="mx-auto mt-8 max-w-2xl rounded-xl border border-border/60 bg-muted/15 px-4 py-4 sm:px-5"
    >
      <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Vector search
      </p>
      <p class="mt-1 text-sm text-muted-foreground">
        Backfill or refresh embeddings for Firestore vector search (uses your Gemini key).
      </p>
      <label class="mt-3 flex cursor-pointer items-center gap-2 text-sm text-foreground">
        <input
          v-model="forceReindex"
          type="checkbox"
          class="size-4 rounded border-border accent-primary"
        />
        Overwrite existing vectors
      </label>
      <div class="mt-4 flex flex-wrap items-center gap-3">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          class="rounded-lg"
          :disabled="reindexing || streaming"
          @click="runReindexAll"
        >
          <Loader2 v-if="reindexing" class="mr-2 size-4 animate-spin" />
          {{ reindexing ? "Reindexing…" : "Reindex all" }}
        </Button>
      </div>
      <p v-if="reindexStatus" class="mt-3 text-xs text-muted-foreground">
        {{ reindexStatus }}
      </p>
    </div>

    <Card
      v-if="!firebaseConfigured"
      class="mx-auto mt-10 max-w-2xl border-amber-500/30 bg-amber-500/5"
    >
      <CardHeader>
        <CardTitle class="text-base">Connect Firebase</CardTitle>
        <CardDescription>
          Once Firestore is configured, your entries will be available as
          context for answers.
        </CardDescription>
      </CardHeader>
    </Card>

    <Card
      v-else-if="!signedIn"
      class="mx-auto mt-10 max-w-2xl border-border/80 bg-muted/30"
    >
      <CardHeader>
        <CardTitle class="text-base">Sign in</CardTitle>
        <CardDescription>
          Sign in with Google in the header to ask questions about your log.
        </CardDescription>
      </CardHeader>
    </Card>

    <div
      v-else-if="ready && !entries.length"
      class="mx-auto mt-10 max-w-2xl rounded-xl border border-dashed border-border py-12 text-center"
    >
      <p class="text-sm text-muted-foreground">
        No entries yet.
        <NuxtLink
          to="/"
          class="font-medium text-primary underline-offset-4 hover:underline"
        >
          Add something
        </NuxtLink>
        first so there is context to search.
      </p>
    </div>

    <div
      v-if="sessionStarted && signedIn && entries.length"
      ref="responseRef"
      class="mx-auto mt-10 max-w-2xl space-y-6"
    >
      <div
        v-if="streaming && !sawFirstChunk"
        class="rounded-2xl border border-border/60 bg-muted/20 px-6 py-10"
        role="status"
        aria-live="polite"
      >
        <div class="mx-auto flex max-w-[200px] flex-col gap-3">
          <div class="flex justify-center gap-1.5">
            <span
              class="size-2.5 rounded-full bg-primary/70 animate-bounce [animation-duration:0.55s]"
              style="animation-delay: 0ms"
            />
            <span
              class="size-2.5 rounded-full bg-primary/70 animate-bounce [animation-duration:0.55s]"
              style="animation-delay: 120ms"
            />
            <span
              class="size-2.5 rounded-full bg-primary/70 animate-bounce [animation-duration:0.55s]"
              style="animation-delay: 240ms"
            />
          </div>
          <p class="text-center text-sm font-medium text-muted-foreground">
            Reading your log…
          </p>
          <div class="h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              class="h-full w-1/3 rounded-full bg-primary/50 [animation:ask-bar_1.2s_ease-in-out_infinite]"
            />
          </div>
        </div>
      </div>

      <div
        v-else-if="reply || streamError || uiTables.length"
        class="rounded-2xl border border-border/70 bg-card/50 px-5 py-6 shadow-sm sm:px-7 sm:py-8"
      >
        <p
          class="text-xs font-medium uppercase tracking-wide text-muted-foreground"
        >
          Answer
        </p>
        <div v-if="uiTables.length" class="mt-4 space-y-2">
          <ChatUiTable
            v-for="(block, ti) in uiTables"
            :key="'ui-' + ti"
            :block="block"
          />
        </div>
        <div
          v-if="streaming && sawFirstChunk"
          class="mt-4 text-[15px] leading-[1.7] text-foreground whitespace-pre-wrap"
          :class="uiTables.length ? 'pt-2' : ''"
        >
          {{ reply
          }}<span
            class="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-primary align-middle"
            aria-hidden="true"
          />
        </div>
        <div
          v-else-if="!streaming && reply.trim()"
          class="mt-4 space-y-4 text-[15px] leading-[1.7] text-foreground"
          :class="uiTables.length ? 'pt-2' : ''"
        >
          <p
            v-for="(para, i) in formattedParagraphs"
            :key="i"
            class="text-pretty"
          >
            {{ para }}
          </p>
        </div>
      </div>

      <p v-if="streamError" class="text-xs text-destructive">
        {{ streamError }}
      </p>
    </div>
  </div>
</template>

<style scoped>
@keyframes ask-bar {
  0% {
    transform: translateX(-100%);
  }
  50% {
    transform: translateX(200%);
  }
  100% {
    transform: translateX(-100%);
  }
}
</style>
