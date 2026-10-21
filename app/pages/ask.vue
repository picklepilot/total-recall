<script setup lang="ts">
import {
  ChevronDown,
  KeyRound,
  Loader2,
  LockKeyhole,
  PenLine,
  Sparkles,
} from "lucide-vue-next";
import {
  isChatUiTableBlock,
  type ChatUiTableBlock,
} from "~~/shared/types/chat-ui";

useHead({
  title: "Ask your log — Total Recall",
});

const firebaseConfigured = useFirebaseUiReady();
const { hasEntries, ready, checkHasEntries } = useEntries();

watch(
  ready,
  (ok) => {
    if (ok) checkHasEntries();
  },
  { immediate: true },
);
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
  [ready, hasEntries],
  ([isReady, entries]) => {
    if (isReady && entries && import.meta.client) {
      nextTick(() => document.getElementById("ask-log-input")?.focus());
    }
  },
  { immediate: true },
);

watch([reply, () => uiTables.value.length], async () => {
  if (!streaming.value) return;
  await nextTick();
  const el = responseRef.value;
  if (el) el.scrollTop = el.scrollHeight;
});
</script>

<template>
  <div
    class="mx-auto flex h-[calc(100dvh-env(safe-area-inset-top)-env(safe-area-inset-bottom)-11.5rem)] w-full max-w-xl flex-col sm:h-[calc(100dvh-env(safe-area-inset-top)-8rem)] sm:-mb-16"
  >
    <header class="mb-5 px-4 sm:mb-7 sm:px-1">
      <h1
        class="text-[1.7rem] leading-tight font-semibold tracking-tight sm:text-3xl"
      >
        Ask your log
      </h1>
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
        Once Firestore is configured, your entries will be available to search.
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
      <h2 class="text-base font-semibold">Sign in to ask your log</h2>
      <p
        class="mx-auto mt-1.5 max-w-xs text-sm leading-relaxed text-muted-foreground"
      >
        Use the Sign in button in the header to search what you've written.
      </p>
    </section>

    <section
      v-else-if="ready && hasEntries === false"
      class="my-auto rounded-3xl border border-dashed border-foreground/10 p-6 text-center sm:p-8"
    >
      <span
        class="mx-auto mb-4 grid size-12 place-items-center rounded-2xl bg-muted text-muted-foreground"
      >
        <Sparkles class="size-5" aria-hidden="true" />
      </span>
      <h2 class="text-base font-semibold">Nothing to search yet</h2>
      <p
        class="mx-auto mt-1.5 max-w-xs text-sm leading-relaxed text-muted-foreground"
      >
        Write something first so there's a log to ask about.
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

    <div
      v-else-if="!ready || hasEntries === null"
      aria-busy="true"
      aria-label="Loading"
    >
      <div
        class="overflow-hidden rounded-3xl border border-foreground/[0.06] bg-card/70 px-5 py-5 shadow-sm dark:border-white/10 dark:bg-white/[0.04]"
      >
        <div class="space-y-2.5">
          <div class="h-3.5 w-11/12 animate-pulse rounded-full bg-foreground/[0.07]" />
          <div class="h-3.5 w-4/5 animate-pulse rounded-full bg-foreground/[0.07]" />
          <div class="h-3.5 w-2/5 animate-pulse rounded-full bg-foreground/[0.07]" />
        </div>
      </div>
    </div>

    <template v-else>
      <div class="flex min-h-0 flex-1 flex-col">
        <div class="min-h-0 flex-1">
          <div
            v-if="!sessionStarted"
            class="flex h-full items-center justify-center px-4 text-center"
          >
            <div>
              <span
                class="mx-auto mb-4 grid size-12 place-items-center rounded-2xl bg-muted text-muted-foreground"
              >
                <Sparkles class="size-5" aria-hidden="true" />
              </span>
              <h2 class="text-base font-semibold">Answers show up here</h2>
              <p
                class="mx-auto mt-1.5 max-w-xs text-sm leading-relaxed text-muted-foreground"
              >
                Ask about a link, a rating, or anything you've written down.
              </p>
            </div>
          </div>

          <div
            v-else
            ref="responseRef"
            class="h-full overflow-y-auto rounded-3xl border border-foreground/[0.06] bg-card/70 px-4 py-4 shadow-sm sm:px-5 sm:py-5 dark:border-white/10 dark:bg-white/[0.04]"
            :role="streaming ? 'status' : undefined"
            :aria-live="streaming ? 'polite' : undefined"
            :aria-busy="streaming && !sawFirstChunk"
          >
            <div v-if="streaming && !sawFirstChunk" class="space-y-2.5">
              <div
                class="h-3.5 w-11/12 animate-pulse rounded-full bg-foreground/[0.07]"
              />
              <div
                class="h-3.5 w-4/5 animate-pulse rounded-full bg-foreground/[0.07]"
              />
              <div
                class="h-3.5 w-2/5 animate-pulse rounded-full bg-foreground/[0.07]"
              />
              <p class="pt-1.5 text-sm text-muted-foreground">
                Reading your log…
              </p>
            </div>

            <template v-else>
              <div v-if="uiTables.length" class="space-y-2">
                <ChatUiTable
                  v-for="(block, ti) in uiTables"
                  :key="'ui-' + ti"
                  :block="block"
                />
              </div>
              <div
                v-if="streaming && sawFirstChunk"
                class="text-base leading-relaxed whitespace-pre-wrap text-foreground"
                :class="uiTables.length ? 'mt-4' : ''"
              >
                {{ reply
                }}<span
                  class="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-foreground align-middle"
                  aria-hidden="true"
                />
              </div>
              <div
                v-else-if="!streaming && reply.trim()"
                class="space-y-4 text-base leading-relaxed text-foreground"
                :class="uiTables.length ? 'mt-4' : ''"
              >
                <p
                  v-for="(para, i) in formattedParagraphs"
                  :key="i"
                  class="text-pretty"
                >
                  {{ para }}
                </p>
              </div>
              <p
                v-if="streamError"
                class="mt-3 text-sm text-destructive"
              >
                {{ streamError }}
              </p>
            </template>
          </div>
        </div>

        <form
          class="glass-panel mt-4 shrink-0 overflow-hidden rounded-3xl"
          @submit.prevent="onSubmit"
        >
          <label class="sr-only" for="ask-log-input">Your question</label>
          <Textarea
            id="ask-log-input"
            v-model="prompt"
            :disabled="streaming"
            class="field-sizing-fixed! h-44 resize-none overflow-y-auto border-0 bg-transparent px-5 pt-5 pb-3 text-base leading-relaxed shadow-none focus-visible:ring-0 md:text-base sm:h-52 dark:bg-transparent"
            placeholder="What do you want to remember?"
            @keydown="onKeydown"
          />
          <div
            class="flex items-center justify-between gap-2 border-t border-foreground/[0.06] py-2 pr-2 pl-4"
          >
            <p class="text-xs text-muted-foreground">
              <kbd class="font-sans">⌘</kbd>
              Enter
            </p>
            <Button
              type="submit"
              class="h-10 touch-manipulation rounded-full px-5 text-sm font-semibold"
              :disabled="streaming || !prompt.trim()"
            >
              <Loader2 v-if="streaming" class="size-4 animate-spin" />
              {{ streaming ? "Thinking…" : "Ask" }}
            </Button>
          </div>
        </form>

        <details
          class="group mt-3 shrink-0 rounded-3xl border border-foreground/[0.06] bg-card/70 px-4 shadow-sm open:pb-4 sm:px-5 dark:border-white/10 dark:bg-white/[0.04]"
        >
          <summary
            class="flex h-12 cursor-pointer list-none items-center justify-between text-sm font-semibold [&::-webkit-details-marker]:hidden"
          >
            Search index
            <ChevronDown
              class="size-4 text-muted-foreground transition-transform duration-200 group-open:rotate-180"
              aria-hidden="true"
            />
          </summary>
          <div class="max-h-48 overflow-y-auto">
            <p class="text-sm leading-relaxed text-muted-foreground">
              Refresh embeddings so newer entries can be found.
            </p>
            <label class="mt-4 flex cursor-pointer items-center gap-2.5 text-sm">
              <input
                v-model="forceReindex"
                type="checkbox"
                class="size-4 rounded border-border accent-foreground"
              />
              Overwrite existing vectors
            </label>
            <Button
              type="button"
              variant="secondary"
              class="mt-4 h-10 touch-manipulation rounded-full px-5"
              :disabled="reindexing || streaming"
              @click="runReindexAll"
            >
              <Loader2 v-if="reindexing" class="size-4 animate-spin" />
              {{ reindexing ? "Reindexing…" : "Reindex all" }}
            </Button>
            <p v-if="reindexStatus" class="mt-3 text-sm text-muted-foreground">
              {{ reindexStatus }}
            </p>
          </div>
        </details>
      </div>
    </template>
  </div>
</template>
