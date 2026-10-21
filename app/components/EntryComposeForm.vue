<script setup lang="ts">
import {
  AlertCircle,
  Box,
  CheckCircle2,
  CornerDownRight,
  Hash,
  Link2,
  Star,
  X,
} from "lucide-vue-next";
import type { EntryView, LinkPreview } from "@/types/entry";
import ComposeStarRatingField from "@/components/entry-compose/ComposeStarRatingField.vue";
import ComposeLinkField from "@/components/entry-compose/ComposeLinkField.vue";
import ComposeAttachmentToggles from "@/components/entry-compose/ComposeAttachmentToggles.vue";
import { buildWidgetsFromComposeForm } from "@/lib/entry-compose/buildWidgetsFromForm";
import { entrySnippet } from "@/lib/entrySnippet";
import {
  TagsInput,
  TagsInputInput,
  TagsInputItem,
  TagsInputItemDelete,
  TagsInputItemText,
} from "@/components/ui/tags-input";

const props = withDefaults(
  defineProps<{
    parentId?: string | null;
    /** Pre-attach a thing from `/?thing=<id>`. */
    initialThingId?: string | null;
    /** Already-loaded parent, so the reply overlay doesn't wait on a fetch. */
    parent?: EntryView | null;
    dismissLabel?: string;
    /** Skip the editor until the open transition has finished. */
    suspendEditor?: boolean;
  }>(),
  {
    parentId: null,
    initialThingId: null,
    parent: null,
    dismissLabel: "Start a new entry instead",
    suspendEditor: false,
  },
);

const emit = defineEmits<{
  clearParent: [];
  clearThing: [];
  saved: [payload: { id: string; parentId: string | null }];
}>();

defineOptions({ inheritAttrs: false });
const attrs = useAttrs();

const nuxtApp = useNuxtApp();
const { ready, addEntry, fetchEntry } = useEntries();
const { byId: thingsById, ensureThings, ready: thingsReady } = useThings();
const { signedIn } = useAuth();

watch(
  thingsReady,
  (ok) => {
    if (ok) void ensureThings().catch(() => {});
  },
  { immediate: true },
);

const tagsFieldId = useId();

const fetchedParent = ref<EntryView | null>(null);
watch(
  () => [props.parentId, props.parent, ready.value] as const,
  async ([id, parent, ok]) => {
    if (parent || !id || !ok) {
      fetchedParent.value = null;
      return;
    }
    fetchedParent.value = await fetchEntry(id);
  },
  { immediate: true },
);
const parentEntry = computed(() => props.parent ?? fetchedParent.value);

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

const composeLinkPanel = ref(false);
const composeStarPanel = ref(false);

const composeLinkUrl = ref("");
const composeLinkPreview = ref<LinkPreview | null>(null);
const tagsModel = ref<string[]>([]);
const thingIds = ref<string[]>([]);

watch(
  () => props.initialThingId,
  (id) => {
    if (id && !thingIds.value.includes(id)) {
      thingIds.value = [id, ...thingIds.value];
    }
  },
  { immediate: true },
);

const aboutThing = computed(() => {
  const id = props.initialThingId;
  if (!id || !thingIds.value.includes(id)) return null;
  return thingsById.value[id] ?? { id, name: "this thing" };
});

function dismissThing() {
  const id = props.initialThingId;
  if (id) thingIds.value = thingIds.value.filter((item) => item !== id);
  emit("clearThing");
}
const contentJson = ref(
  JSON.stringify({ type: "doc", content: [{ type: "paragraph" }] }),
);
const contentText = ref("");
const submitting = ref(false);

const editorRef = ref<{ clear: () => void; focus: () => boolean } | null>(
  null,
);
const composeStarRating = ref(0);

const placeholder = computed(() =>
  props.parentId
    ? "Write a reply…  Type / for formatting"
    : "Write it down…  Type / for formatting",
);

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

function resetForm() {
  composeLinkUrl.value = "";
  composeLinkPreview.value = null;
  composeLinkPanel.value = false;
  composeStarPanel.value = false;
  tagsModel.value = [];
  thingIds.value = props.initialThingId ? [props.initialThingId] : [];
  editorRef.value?.clear();
  contentText.value = "";
  contentJson.value = JSON.stringify({
    type: "doc",
    content: [{ type: "paragraph" }],
  });
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
    const parentId = props.parentId;
    const newId = await addEntry({
      parentId,
      contentJson: contentJson.value,
      contentText: contentText.value,
      tags: tagsModel.value.map((t) => t.trim().toLowerCase()).filter(Boolean),
      thingIds: thingIds.value,
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
    emit("saved", { id: newId, parentId });
    if (!parentId) {
      showFeedback("ok", "Saved to your log");
      resetForm();
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Could not save entry.";
    showFeedback("err", msg);
  } finally {
    submitting.value = false;
  }
}

function focus() {
  let tries = 0;
  const run = () => {
    if (editorRef.value?.focus()) return;
    if (tries++ < 45) requestAnimationFrame(run);
  };
  nextTick(run);
}

defineExpose({ focus });
</script>

<template>
  <div>
    <form
      class="glass-panel overflow-hidden rounded-3xl"
      v-bind="attrs"
      @submit.prevent="onSubmit"
    >
      <div
        v-if="parentId"
        class="flex items-center gap-2 border-b border-foreground/[0.06] px-5 py-2.5 text-sm"
      >
        <CornerDownRight
          class="size-4 shrink-0 text-muted-foreground"
          aria-hidden="true"
        />
        <span class="shrink-0 text-muted-foreground">Continuing</span>
        <NuxtLink
          :to="`/entries/${parentId}`"
          class="min-w-0 flex-1 truncate font-medium underline-offset-4 hover:underline"
        >
          {{ parentEntry ? entrySnippet(parentEntry) : "an earlier entry" }}
        </NuxtLink>
        <button
          type="button"
          class="-m-1.5 grid size-8 shrink-0 touch-manipulation place-items-center rounded-full text-muted-foreground transition-colors hover:bg-white/70 hover:text-foreground dark:hover:bg-white/10"
          :aria-label="dismissLabel"
          @click="emit('clearParent')"
        >
          <X class="size-4" />
        </button>
      </div>
      <div
        v-if="aboutThing"
        class="flex items-center gap-2 border-b border-foreground/[0.06] px-5 py-2.5 text-sm"
      >
        <Box class="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <span class="shrink-0 text-muted-foreground">About</span>
        <NuxtLink
          :to="`/things/${aboutThing.id}`"
          class="min-w-0 flex-1 truncate font-medium underline-offset-4 hover:underline"
        >
          {{ aboutThing.name }}
        </NuxtLink>
        <button
          type="button"
          class="-m-1.5 grid size-8 shrink-0 touch-manipulation place-items-center rounded-full text-muted-foreground transition-colors hover:bg-white/70 hover:text-foreground dark:hover:bg-white/10"
          aria-label="Remove thing"
          @click="dismissThing"
        >
          <X class="size-4" />
        </button>
      </div>
      <ClientOnly v-if="!suspendEditor">
        <MediumEditor
          ref="editorRef"
          bare
          :placeholder="placeholder"
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
        v-else
        class="min-h-[11rem] px-5 pt-5 pb-3 text-base leading-relaxed text-muted-foreground sm:min-h-[13rem]"
      >
        {{ placeholder }}
      </div>

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
              class="flex items-center gap-1.5 text-xs font-medium tracking-wider text-muted-foreground uppercase"
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
              class="flex items-center gap-1.5 text-xs font-medium tracking-wider text-muted-foreground uppercase"
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

      <div class="border-t border-foreground/[0.06] px-5">
        <ThingPicker v-model="thingIds" />
      </div>

      <label
        :for="tagsFieldId"
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
            :id="tagsFieldId"
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

    <Teleport to="body">
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
          class="fixed inset-x-4 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-[80] mx-auto flex max-w-sm items-center gap-2.5 rounded-2xl px-4 py-3 text-sm font-medium shadow-lg sm:bottom-8"
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
    </Teleport>
  </div>
</template>
