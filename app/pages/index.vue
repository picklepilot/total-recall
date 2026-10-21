<script setup lang="ts">
import {
  AlertCircle,
  CheckCircle2,
  Hash,
  KeyRound,
  Link2,
  LockKeyhole,
  Star,
  X,
} from "lucide-vue-next";
import type { LinkPreview } from "@/types/entry";
import ComposeStarRatingField from "@/components/entry-compose/ComposeStarRatingField.vue";
import ComposeLinkField from "@/components/entry-compose/ComposeLinkField.vue";
import ComposeAttachmentToggles from "@/components/entry-compose/ComposeAttachmentToggles.vue";
import { buildWidgetsFromComposeForm } from "@/lib/entry-compose/buildWidgetsFromForm";
import {
  TagsInput,
  TagsInputInput,
  TagsInputItem,
  TagsInputItemDelete,
  TagsInputItemText,
} from "@/components/ui/tags-input";

const nuxtApp = useNuxtApp();
const { ready, addEntry } = useEntries();
const { signedIn, signInWithGoogle } = useAuth();

const firebaseConfigured = useFirebaseUiReady();

const feedback = ref<{ type: "ok" | "err"; text: string } | null>(null);
let feedbackTimer: ReturnType<typeof setTimeout> | undefined;

function showFeedback(type: "ok" | "err", text: string) {
  clearTimeout(feedbackTimer);
  feedback.value = { type, text };
  if (type === "ok") {
    feedbackTimer = setTimeout(() => (feedback.value = null), 3000);
  }
}

onBeforeUnmount(() => clearTimeout(feedbackTimer));

/** Rendered on the client so the date matches the user's timezone. */
const todayLabel = ref("");
onMounted(() => {
  todayLabel.value = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
});

const signingIn = ref(false);
async function onSignIn() {
  signingIn.value = true;
  try {
    await signInWithGoogle();
  } catch (e) {
    console.error(e);
  } finally {
    signingIn.value = false;
  }
}

/** Panels only after user picks a toggle — keeps the first screen light on mobile. */
const composeLinkPanel = ref(false);
const composeStarPanel = ref(false);

const composeLinkUrl = ref("");
const composeLinkPreview = ref<LinkPreview | null>(null);
const tagsModel = ref<string[]>([]);
const contentJson = ref(
  JSON.stringify({ type: "doc", content: [{ type: "paragraph" }] }),
);
const contentText = ref("");
const submitting = ref(false);

const editorRef = ref<{ clear: () => void } | null>(null);
const composeStarRating = ref(0);

function onEditorChange(json: string, text: string) {
  contentJson.value = json;
  contentText.value = text;
}

const linkTrimmed = computed(() => composeLinkUrl.value.trim());
const canSave = computed(
  () => contentText.value.trim().length > 0 || linkTrimmed.value.length > 0,
);

function toggleLinkPanel() {
  composeLinkPanel.value = !composeLinkPanel.value;
  if (composeLinkPanel.value) {
    nextTick(() => document.getElementById("compose-link-url")?.focus());
  } else {
    composeLinkUrl.value = "";
    composeLinkPreview.value = null;
  }
}

function toggleStarPanel() {
  composeStarPanel.value = !composeStarPanel.value;
  if (!composeStarPanel.value) {
    composeStarRating.value = 0;
  }
}

function removeLinkPanel() {
  composeLinkPanel.value = false;
  composeLinkUrl.value = "";
  composeLinkPreview.value = null;
}

function removeStarPanel() {
  composeStarPanel.value = false;
  composeStarRating.value = 0;
}

async function onSubmit() {
  feedback.value = null;
  if (!nuxtApp.$firebaseReady) {
    showFeedback(
      "err",
      "Firebase is not configured. Add NUXT_PUBLIC_FIREBASE_* to .env.",
    );
    return;
  }
  if (!signedIn.value) {
    showFeedback("err", "Sign in with Google first.");
    return;
  }
  const hasNote = contentText.value.trim().length > 0;
  const hasUrl = linkTrimmed.value.length > 0;
  if (!hasNote && !hasUrl) {
    showFeedback("err", "Add a note, a link, or both.");
    return;
  }
  submitting.value = true;
  try {
    await addEntry({
      contentJson: contentJson.value,
      contentText: contentText.value,
      tags: tagsModel.value.map((t) => t.trim().toLowerCase()).filter(Boolean),
      widgets: buildWidgetsFromComposeForm({
        starRating: composeStarRating.value,
        link: hasUrl
          ? {
              url: composeLinkUrl.value.trim(),
              preview: composeLinkPreview.value,
            }
          : null,
      }),
    });
    showFeedback("ok", "Saved to your log");
    composeLinkUrl.value = "";
    composeLinkPreview.value = null;
    composeLinkPanel.value = false;
    composeStarPanel.value = false;
    tagsModel.value = [];
    editorRef.value?.clear();
    contentText.value = "";
    contentJson.value = JSON.stringify({
      type: "doc",
      content: [{ type: "paragraph" }],
    });
    composeStarRating.value = 0;
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Could not save entry.";
    showFeedback("err", msg);
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <div class="mx-auto flex w-full max-w-xl flex-1 flex-col">
    <header class="mb-5 px-4 sm:px-1 sm:mb-7">
      <p
        class="h-4 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground"
      >
        {{ todayLabel }}
      </p>
      <h1
        class="mt-2 text-[1.7rem] font-semibold leading-tight tracking-tight sm:text-3xl"
      >
        What's the deal?
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
        Copy
        <code class="rounded bg-muted px-1 py-0.5 text-xs">.env.example</code>
        to
        <code class="rounded bg-muted px-1 py-0.5 text-xs">.env</code>
        and add web app keys. Enable Firestore and Google sign-in, then deploy
        <code class="rounded bg-muted px-1 py-0.5 text-xs">firestore.rules</code
        >.
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
      <h2 class="text-base font-semibold">Your private log</h2>
      <p
        class="mx-auto mt-1.5 max-w-xs text-sm leading-relaxed text-muted-foreground"
      >
        Sign in so your notes, links and ratings stay tied to your account.
      </p>
      <Button
        size="lg"
        class="mt-5 h-12 w-full touch-manipulation rounded-full text-base sm:w-auto sm:px-8"
        :disabled="signingIn"
        @click="onSignIn"
      >
        {{ signingIn ? "Signing in…" : "Continue with Google" }}
      </Button>
    </section>

    <form
      v-else
      class="glass-panel my-auto overflow-hidden rounded-3xl"
      @submit.prevent="onSubmit"
    >
      <ClientOnly>
        <MediumEditor
          ref="editorRef"
          bare
          placeholder="Write it down…  Type / for formatting"
          @change="onEditorChange"
        />
        <template #fallback>
          <div
            class="min-h-[11rem] px-5 pt-5 text-base text-muted-foreground sm:min-h-[13rem]"
          >
            Start typing…
          </div>
        </template>
      </ClientOnly>

      <div
        v-if="composeLinkPanel || composeStarPanel"
        class="space-y-2.5 px-3 pb-3"
      >
        <div
          v-if="composeLinkPanel"
          class="rounded-2xl border border-foreground/[0.05] bg-foreground/[0.025] p-3.5 dark:border-white/[0.06] dark:bg-white/[0.04]"
        >
          <div class="mb-2.5 flex items-center justify-between">
            <span
              class="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground"
            >
              <Link2 class="size-3.5" aria-hidden="true" />
              Link
            </span>
            <button
              type="button"
              class="-m-1.5 grid size-8 touch-manipulation place-items-center rounded-full text-muted-foreground transition-colors hover:bg-white/70 hover:text-foreground dark:hover:bg-white/10"
              aria-label="Remove link"
              @click="removeLinkPanel"
            >
              <X class="size-4" />
            </button>
          </div>
          <ComposeLinkField
            v-model:url="composeLinkUrl"
            v-model:preview="composeLinkPreview"
            :show-label="false"
          />
        </div>

        <div
          v-if="composeStarPanel"
          class="rounded-2xl border border-foreground/[0.05] bg-foreground/[0.025] p-3.5 dark:border-white/[0.06] dark:bg-white/[0.04]"
        >
          <div class="mb-2.5 flex items-center justify-between">
            <span
              class="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground"
            >
              <Star class="size-3.5" aria-hidden="true" />
              Rating
            </span>
            <button
              type="button"
              class="-m-1.5 grid size-8 touch-manipulation place-items-center rounded-full text-muted-foreground transition-colors hover:bg-white/70 hover:text-foreground dark:hover:bg-white/10"
              aria-label="Remove rating"
              @click="removeStarPanel"
            >
              <X class="size-4" />
            </button>
          </div>
          <ComposeStarRatingField v-model="composeStarRating" />
        </div>
      </div>

      <label
        for="tags-input"
        class="flex cursor-text items-center gap-2 border-t border-foreground/[0.06] px-5 py-1.5"
      >
        <Hash
          class="size-4 shrink-0 text-muted-foreground"
          aria-hidden="true"
        />
        <span class="sr-only">Tags</span>
        <TagsInput
          v-model="tagsModel"
          class="min-h-11 flex-1 gap-1.5 rounded-none border-0 bg-transparent px-0 py-1.5 shadow-none focus-within:ring-0 dark:bg-transparent"
        >
          <TagsInputItem
            v-for="(item, i) in tagsModel"
            :key="`${i}-${item}`"
            :value="item"
            class="h-7 rounded-full border border-foreground/[0.06] bg-white/70 pl-0.5 dark:border-white/10 dark:bg-white/10"
          >
            <TagsInputItemText class="text-[0.8rem]" />
            <TagsInputItemDelete
              class="mr-1.5 text-muted-foreground hover:text-foreground"
            />
          </TagsInputItem>
          <TagsInputInput
            id="tags-input"
            :placeholder="tagsModel.length ? 'Add another' : 'Add tags'"
            class="min-h-7 px-0 text-base placeholder:text-muted-foreground sm:text-sm"
          />
        </TagsInput>
      </label>

      <div
        class="flex items-center justify-between gap-2 border-t border-foreground/[0.06] py-2 pr-2 pl-2.5"
      >
        <ComposeAttachmentToggles
          :link-active="composeLinkPanel"
          :star-active="composeStarPanel"
          @toggle-link="toggleLinkPanel"
          @toggle-star="toggleStarPanel"
        />
        <Button
          type="submit"
          class="h-10 touch-manipulation rounded-full px-5 text-sm font-semibold"
          :disabled="submitting || !ready || !canSave"
        >
          {{ submitting ? "Saving…" : "Save" }}
        </Button>
      </div>
    </form>

    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="translate-y-2 opacity-0"
      leave-active-class="transition duration-150 ease-in"
      leave-to-class="translate-y-2 opacity-0"
    >
      <div
        v-if="feedback"
        role="status"
        aria-live="polite"
        class="fixed inset-x-4 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-30 mx-auto flex max-w-sm items-center gap-2.5 rounded-2xl px-4 py-3 text-sm font-medium shadow-lg sm:bottom-8"
        :class="
          feedback.type === 'ok'
            ? 'bg-foreground text-background'
            : 'border border-destructive/30 bg-background text-destructive'
        "
      >
        <CheckCircle2
          v-if="feedback.type === 'ok'"
          class="size-4 shrink-0 text-emerald-400 dark:text-emerald-600"
        />
        <AlertCircle v-else class="size-4 shrink-0" />
        <span class="flex-1">{{ feedback.text }}</span>
        <button
          v-if="feedback.type === 'err'"
          type="button"
          class="-m-1 grid size-7 place-items-center rounded-full hover:bg-destructive/10"
          aria-label="Dismiss"
          @click="feedback = null"
        >
          <X class="size-4" />
        </button>
      </div>
    </Transition>
  </div>
</template>
