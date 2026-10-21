<script setup lang="ts">
import { Box, KeyRound, LockKeyhole, Plus } from "lucide-vue-next";
import { DEFAULT_THING_KIND, thingKindLabel } from "~~/shared/thingKinds";

useHead({ title: "Things — Total Recall" });

const router = useRouter();
const firebaseConfigured = useFirebaseUiReady();
const { signedIn } = useAuth();
const { things, ready, loaded, loading, loadError, ensureThings, createThing } = useThings();

const search = ref("");
const kindFilter = ref("");
const composing = ref(false);
const name = ref("");
const kind = ref(DEFAULT_THING_KIND);
const adding = ref(false);
const addError = ref("");
const nameInput = ref<HTMLInputElement | null>(null);

watch(
  [ready, signedIn],
  ([ok, in_]) => {
    if (ok && in_) void ensureThings().catch(() => {});
  },
  { immediate: true },
);

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase();
  return things.value.filter((thing) => {
    if (kindFilter.value && thing.kind !== kindFilter.value) return false;
    if (q && !thing.name.toLowerCase().includes(q)) return false;
    return true;
  });
});

function startAdd() {
  composing.value = true;
  addError.value = "";
  nextTick(() => nameInput.value?.focus());
}

async function submitAdd() {
  if (adding.value) return;
  adding.value = true;
  addError.value = "";
  try {
    const thing = await createThing({ name: name.value, kind: kind.value });
    name.value = "";
    kind.value = DEFAULT_THING_KIND;
    composing.value = false;
    await router.push(`/things/${thing.id}`);
  } catch (e) {
    addError.value = e instanceof Error ? e.message : "Could not add that thing.";
  } finally {
    adding.value = false;
  }
}
</script>

<template>
  <div class="mx-auto flex w-full max-w-xl flex-1 flex-col">
    <header class="mb-5 flex items-end justify-between gap-4 px-4 sm:mb-7 sm:px-1">
      <h1 class="text-[1.7rem] font-semibold leading-tight tracking-tight sm:text-3xl">
        Things
      </h1>
      <button
        v-if="firebaseConfigured && signedIn"
        type="button"
        class="inline-flex h-9 shrink-0 touch-manipulation items-center gap-1.5 rounded-full border border-foreground/[0.06] bg-card/70 px-3.5 text-sm font-medium shadow-sm transition-colors hover:bg-card dark:border-white/10 dark:bg-white/[0.06] dark:hover:bg-white/10"
        @click="startAdd"
      >
        <Plus class="size-4 text-muted-foreground" aria-hidden="true" />
        Add
      </button>
    </header>

    <section
      v-if="!firebaseConfigured"
      class="my-auto rounded-3xl border border-amber-500/30 bg-amber-50/70 p-6 text-center backdrop-blur-xl dark:bg-amber-500/10"
    >
      <span class="mx-auto mb-4 grid size-12 place-items-center rounded-2xl bg-amber-500/15 text-amber-600 dark:text-amber-400">
        <KeyRound class="size-5" aria-hidden="true" />
      </span>
      <h2 class="text-base font-semibold">Connect Firebase</h2>
      <p class="mx-auto mt-1.5 max-w-sm text-sm leading-relaxed text-muted-foreground">
        Once Firestore is configured, your things will show up here.
      </p>
    </section>

    <section
      v-else-if="!signedIn"
      class="my-auto rounded-3xl border border-border/70 bg-card/80 p-6 text-center shadow-sm backdrop-blur-xl sm:p-8"
    >
      <span class="mx-auto mb-4 grid size-12 place-items-center rounded-2xl bg-muted text-muted-foreground">
        <LockKeyhole class="size-5" aria-hidden="true" />
      </span>
      <h2 class="text-base font-semibold">Sign in to see your things</h2>
      <p class="mx-auto mt-1.5 max-w-xs text-sm leading-relaxed text-muted-foreground">
        Use the Sign in button in the header to load your inventory.
      </p>
    </section>

    <template v-else>
      <form
        v-if="composing"
        class="mb-5 rounded-3xl border border-foreground/[0.06] bg-card/70 p-4 shadow-sm dark:border-white/10 dark:bg-white/[0.04]"
        @submit.prevent="submitAdd"
      >
        <label class="sr-only" for="new-thing-name">Name</label>
        <input
          id="new-thing-name"
          ref="nameInput"
          v-model="name"
          type="text"
          placeholder="Name"
          class="w-full bg-transparent text-lg font-medium outline-none placeholder:text-muted-foreground"
          @keydown.enter.prevent="submitAdd"
        />
        <ThingKindChips v-model="kind" class="mt-3" />
        <div class="mt-3 flex items-center justify-between gap-3">
          <p v-if="addError" class="text-xs text-destructive">{{ addError }}</p>
          <span v-else class="text-xs text-muted-foreground">Return to add</span>
          <Button
            type="submit"
            class="h-9 rounded-full px-4"
            :disabled="adding || !name.trim()"
          >
            {{ adding ? "Adding…" : "Add thing" }}
          </Button>
        </div>
      </form>

      <section
        v-if="loadError && !loading"
        class="rounded-3xl border border-destructive/30 bg-destructive/5 p-6 text-center"
      >
        <h2 class="text-base font-semibold">Could not load things</h2>
        <p class="mx-auto mt-1.5 max-w-sm text-sm leading-relaxed text-muted-foreground">
          {{ loadError }}
        </p>
      </section>

      <div
        v-else-if="!loaded || loading"
        aria-busy="true"
        aria-label="Loading things"
      >
        <div class="mb-3 h-9 w-full animate-pulse rounded-full bg-foreground/[0.06]" />
        <div class="divide-y divide-foreground/[0.06] overflow-hidden rounded-3xl border border-foreground/[0.06] bg-card/70 dark:bg-white/[0.04]">
          <div v-for="i in 3" :key="i" class="flex items-center gap-3 px-4 py-3.5">
            <div class="size-12 animate-pulse rounded-xl bg-foreground/[0.07]" />
            <div class="space-y-2">
              <div class="h-3.5 w-32 animate-pulse rounded-full bg-foreground/[0.07]" />
              <div class="h-3 w-16 animate-pulse rounded-full bg-foreground/[0.07]" />
            </div>
          </div>
        </div>
      </div>

      <section
        v-else-if="!things.length"
        class="my-auto rounded-3xl border border-dashed border-foreground/10 p-6 text-center sm:p-8"
      >
        <span class="mx-auto mb-4 grid size-12 place-items-center rounded-2xl bg-muted text-muted-foreground">
          <Box class="size-5" aria-hidden="true" />
        </span>
        <h2 class="text-base font-semibold">Nothing in your inventory yet</h2>
        <p class="mx-auto mt-1.5 max-w-xs text-sm leading-relaxed text-muted-foreground">
          Books, movies, people, places, tools — add the first one.
        </p>
        <Button
          v-if="!composing"
          type="button"
          size="lg"
          class="mt-5 h-12 w-full touch-manipulation rounded-full text-base sm:w-auto sm:px-8"
          @click="startAdd"
        >
          <Plus class="size-4" aria-hidden="true" />
          Add a thing
        </Button>
      </section>

      <template v-else>
        <div class="mb-4 space-y-3 px-1">
          <input
            v-model="search"
            type="search"
            placeholder="Search things"
            class="h-10 w-full rounded-full border border-foreground/[0.06] bg-card/70 px-4 text-sm outline-none placeholder:text-muted-foreground dark:border-white/10 dark:bg-white/[0.04]"
          />
          <ThingKindChips v-model="kindFilter" allow-all />
        </div>

        <p
          v-if="!filtered.length"
          class="px-4 py-10 text-center text-sm text-muted-foreground"
        >
          No things match.
        </p>
        <ol
          v-else
          class="divide-y divide-foreground/[0.06] overflow-hidden rounded-3xl border border-foreground/[0.06] bg-card/70 shadow-sm dark:divide-white/[0.06] dark:border-white/10 dark:bg-white/[0.04]"
        >
          <li v-for="thing in filtered" :key="thing.id">
            <NuxtLink
              :to="`/things/${thing.id}`"
              class="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-foreground/[0.03] sm:px-5"
            >
              <img
                v-if="thing.imageUrl"
                :src="thing.imageUrl"
                alt=""
                class="size-12 shrink-0 rounded-xl object-cover"
              />
              <span
                v-else
                class="grid size-12 shrink-0 place-items-center rounded-xl bg-muted text-muted-foreground"
              >
                <ThingKindGlyph :kind="thing.kind" icon-class="size-5" />
              </span>
              <span class="min-w-0">
                <span class="block truncate font-medium">{{ thing.name }}</span>
                <span class="block truncate text-xs text-muted-foreground">
                  {{ thingKindLabel(thing.kind) }}
                  <template v-if="thing.summary"> · {{ thing.summary }}</template>
                </span>
              </span>
            </NuxtLink>
          </li>
        </ol>
      </template>
    </template>
  </div>
</template>
