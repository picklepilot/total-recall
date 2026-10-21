<script setup lang="ts">
import { ArrowLeft, PenLine } from "lucide-vue-next";
import type { EntryView } from "@/types/entry";
import type { ThingField } from "~~/shared/thingKinds";
import { missingSuggestedFields, thingKindLabel } from "~~/shared/thingKinds";

useHead({ title: "Thing — Total Recall" });

const route = useRoute();
const router = useRouter();
const firebaseConfigured = useFirebaseUiReady();
const { signedIn } = useAuth();
const {
  byId,
  ready,
  coverBusyId,
  ensureThings,
  updateThing,
  setCover,
  removeCover,
  deleteThing,
} = useThings();
const { loadEntriesForThing, deleteEntry } = useEntries();
const { confirmAndDelete } = useEntryDeletion(deleteEntry);

const thingId = computed(() => String(route.params.id));
const thing = computed(() => byId.value[thingId.value] ?? null);
const pageReady = ref(false);
const missing = ref(false);
const saveError = ref("");
const photoError = ref("");
const linked = ref<EntryView[]>([]);
const linkedError = ref("");
const deleting = ref(false);

const draft = reactive({
  name: "",
  kind: "other",
  summary: "",
  fields: [] as ThingField[],
});
const hydratedId = ref<string | null>(null);

watch(thing, (value) => {
  if (!value || hydratedId.value === value.id) return;
  hydratedId.value = value.id;
  draft.name = value.name;
  draft.kind = value.kind;
  draft.summary = value.summary;
  draft.fields = value.fields.map((field) => ({ ...field }));
});

const suggestions = computed(() => missingSuggestedFields(draft.kind, draft.fields));

async function loadPage() {
  const id = thingId.value;
  missing.value = false;
  linkedError.value = "";
  linked.value = [];
  if (!ready.value) return;
  if (!byId.value[id]) pageReady.value = false;
  try {
    await ensureThings();
  } catch {
    /* loadError is surfaced on the list; the detail still checks the cache */
  }
  if (thingId.value !== id) return;
  if (!byId.value[id]) {
    missing.value = true;
    pageReady.value = true;
    return;
  }
  pageReady.value = true;
  try {
    const entries = await loadEntriesForThing(id);
    if (thingId.value !== id) return;
    linked.value = entries;
  } catch (e) {
    if (thingId.value !== id) return;
    linkedError.value =
      e instanceof Error ? e.message : "Could not load linked entries.";
  }
}

watch(
  [thingId, ready, signedIn],
  ([, ok, in_]) => {
    if (ok && in_) void loadPage();
    else if (!in_) {
      pageReady.value = true;
      missing.value = false;
    }
  },
  { immediate: true },
);

let saveTail: Promise<void> = Promise.resolve();
let saveTimer: ReturnType<typeof setTimeout> | undefined;

async function writeDraft() {
  const current = thing.value;
  if (!current) return;
  const name = draft.name.trim();
  if (!name) {
    saveError.value = "Give it a name.";
    return;
  }
  saveError.value = "";
  try {
    await updateThing(current.id, {
      name,
      kind: draft.kind,
      summary: draft.summary,
      fields: draft.fields,
    });
  } catch (e) {
    saveError.value = e instanceof Error ? e.message : "Could not save.";
  }
}

function persistNow() {
  clearTimeout(saveTimer);
  saveTail = saveTail.then(writeDraft);
}

function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(persistNow, 400);
}

function onKind(kind: string) {
  draft.kind = kind;
  persistNow();
}

function onFields(fields: ThingField[]) {
  draft.fields = fields;
  scheduleSave();
}

function addSuggestions() {
  for (const field of suggestions.value) {
    draft.fields.push({
      id: crypto.randomUUID(),
      label: field.label,
      type: field.type,
      value: "",
    });
  }
  persistNow();
}

async function onPhoto(file: File) {
  if (!thing.value) return;
  photoError.value = "";
  try {
    await setCover(thing.value.id, file);
  } catch (e) {
    photoError.value = e instanceof Error ? e.message : "Could not save that photo.";
  }
}

async function onRemovePhoto() {
  if (!thing.value) return;
  photoError.value = "";
  try {
    await removeCover(thing.value.id);
  } catch (e) {
    photoError.value = e instanceof Error ? e.message : "Could not remove that photo.";
  }
}

async function onDelete() {
  if (!thing.value || deleting.value) return;
  if (!window.confirm("Delete this thing? Entries stay, but they will no longer link to it.")) return;
  deleting.value = true;
  try {
    await deleteThing(thing.value.id);
    await router.replace("/things");
  } catch (e) {
    saveError.value = e instanceof Error ? e.message : "Could not delete this thing.";
    deleting.value = false;
  }
}

async function onDeleteEntry(entry: EntryView) {
  const result = await confirmAndDelete(entry, entry.replyCount > 0);
  if (!result) return;
  linked.value = linked.value.filter((item) => item.id !== entry.id);
}

onBeforeUnmount(() => clearTimeout(saveTimer));
</script>

<template>
  <div class="mx-auto flex w-full max-w-xl flex-1 flex-col">
    <NuxtLink
      to="/things"
      class="mb-5 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
    >
      <ArrowLeft class="size-4" aria-hidden="true" />
      Things
    </NuxtLink>

    <p v-if="firebaseConfigured && signedIn && !pageReady" class="text-sm text-muted-foreground">
      Loading…
    </p>

    <section
      v-else-if="!firebaseConfigured || !signedIn || missing || !thing"
      class="rounded-3xl border border-dashed border-foreground/10 px-6 py-16 text-center"
    >
      <p class="text-sm text-muted-foreground">
        {{ signedIn ? "This thing doesn't exist or was deleted." : "Sign in to view this thing." }}
      </p>
    </section>

    <template v-else>
      <ThingCover
        :name="draft.name || thing.name"
        :kind="draft.kind"
        :image-url="thing.imageUrl"
        :busy="coverBusyId === thing.id"
        @file="onPhoto"
        @remove="onRemovePhoto"
      />
      <p v-if="photoError" class="mt-2 text-sm text-destructive">{{ photoError }}</p>

      <input
        v-model="draft.name"
        type="text"
        aria-label="Name"
        class="mt-5 w-full bg-transparent text-[1.7rem] font-semibold tracking-tight outline-none placeholder:text-muted-foreground sm:text-3xl"
        placeholder="Name"
        @blur="persistNow"
        @keydown.enter.prevent="($event.target as HTMLInputElement).blur()"
      />
      <p class="mt-1 text-xs font-medium tracking-[0.14em] text-muted-foreground uppercase">
        {{ thingKindLabel(draft.kind) }}
      </p>

      <ThingKindChips :model-value="draft.kind" class="mt-3" @update:model-value="onKind" />
      <button
        v-if="suggestions.length"
        type="button"
        class="mt-2 text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        @click="addSuggestions"
      >
        Add {{ suggestions.map((field) => field.label).join(", ") }}
      </button>

      <label class="mt-6 block">
        <span class="text-xs font-medium tracking-[0.14em] text-muted-foreground uppercase">
          Summary
        </span>
        <textarea
          v-model="draft.summary"
          rows="2"
          placeholder="A short line about it"
          class="mt-2 w-full resize-none bg-transparent text-sm leading-relaxed outline-none placeholder:text-muted-foreground"
          @blur="persistNow"
        />
      </label>

      <section class="mt-6">
        <h2 class="text-xs font-medium tracking-[0.14em] text-muted-foreground uppercase">
          Fields
        </h2>
        <ThingFieldList :fields="draft.fields" class="mt-3" @update:fields="onFields" />
      </section>

      <p v-if="saveError" class="mt-3 text-sm text-destructive">{{ saveError }}</p>

      <section class="mt-10">
        <div class="mb-3 flex items-center justify-between gap-3">
          <h2 class="text-xs font-medium tracking-[0.14em] text-muted-foreground uppercase">
            Entries
          </h2>
          <NuxtLink
            :to="{ path: '/', query: { thing: thing.id } }"
            class="inline-flex h-8 items-center gap-1.5 rounded-full px-2.5 text-sm font-medium text-muted-foreground hover:bg-foreground/5 hover:text-foreground"
          >
            <PenLine class="size-3.5" aria-hidden="true" />
            Write about this
          </NuxtLink>
        </div>
        <p v-if="linkedError" class="text-sm text-muted-foreground">{{ linkedError }}</p>
        <p v-else-if="!linked.length" class="text-sm text-muted-foreground">
          No entries linked yet.
        </p>
        <ol
          v-else
          class="divide-y divide-foreground/[0.06] overflow-hidden rounded-3xl border border-foreground/[0.06] bg-card/70 dark:divide-white/[0.06] dark:border-white/10 dark:bg-white/[0.04]"
        >
          <li v-for="entry in linked" :key="entry.id" class="px-4 py-3.5 sm:px-5">
            <EntryCard :entry="entry" flush @delete="onDeleteEntry" />
          </li>
        </ol>
      </section>

      <button
        type="button"
        class="mt-10 self-start text-sm font-medium text-destructive hover:underline"
        :disabled="deleting"
        @click="onDelete"
      >
        {{ deleting ? "Deleting…" : "Delete thing" }}
      </button>
    </template>
  </div>
</template>
