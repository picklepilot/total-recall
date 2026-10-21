<script setup lang="ts">
import { Box, X } from "lucide-vue-next";
import { onClickOutside, useEventListener } from "@vueuse/core";
import {
  THING_KINDS,
  readLastThingKind,
  thingKindLabel,
} from "~~/shared/thingKinds";

const props = defineProps<{
  modelValue: string[];
}>();

const emit = defineEmits<{
  "update:modelValue": [ids: string[]];
}>();

const { byId, ensureThings, createThing, ready } = useThings();

const inputId = useId();
const anchorRef = ref<HTMLElement | null>(null);
const panelRef = ref<HTMLElement | null>(null);
const inputRef = ref<HTMLInputElement | null>(null);
const query = ref("");
const focused = ref(false);
const kind = ref(readLastThingKind());
const active = ref<number | "create">(0);
const creating = ref(false);
const error = ref<string | null>(null);
const panelStyle = ref({
  top: "0px",
  left: "0px",
  width: "240px",
  bottom: "auto",
});

watch(
  ready,
  (ok) => {
    if (ok) void ensureThings().catch(() => {});
  },
  { immediate: true },
);

const selected = computed(() =>
  props.modelValue.map((id) => {
    const thing = byId.value[id];
    return {
      id,
      name: thing?.name ?? "Thing",
      kind: thing?.kind ?? "other",
      imageUrl: thing?.imageUrl ?? null,
    };
  }),
);

const matches = computed(() => {
  const q = query.value.trim().toLowerCase();
  if (!q) return [];
  const taken = new Set(props.modelValue);
  return Object.values(byId.value)
    .filter(
      (thing) => !taken.has(thing.id) && thing.name.toLowerCase().includes(q),
    )
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
    .slice(0, 8);
});

const panelOpen = computed(
  () => focused.value && query.value.trim().length > 0,
);

watch(matches, (list) => {
  active.value = list.length ? 0 : "create";
});

function placePanel() {
  const el = anchorRef.value;
  if (!el) return;
  const rect = el.getBoundingClientRect();
  const spaceBelow = window.innerHeight - rect.bottom;
  const flip = spaceBelow < 240 && rect.top > 240;
  panelStyle.value = flip
    ? {
        top: "auto",
        bottom: `${window.innerHeight - rect.top + 6}px`,
        left: `${rect.left}px`,
        width: `${Math.max(rect.width, 260)}px`,
      }
    : {
        top: `${rect.bottom + 6}px`,
        bottom: "auto",
        left: `${rect.left}px`,
        width: `${Math.max(rect.width, 260)}px`,
      };
}

watch(panelOpen, (open) => {
  if (open) nextTick(placePanel);
});

useEventListener(window, "resize", () => {
  if (panelOpen.value) placePanel();
});
useEventListener(
  window,
  "scroll",
  () => {
    if (panelOpen.value) placePanel();
  },
  { capture: true },
);

onClickOutside(
  anchorRef,
  () => {
    focused.value = false;
  },
  { ignore: [panelRef] },
);

function selectThing(id: string) {
  if (props.modelValue.includes(id)) return;
  emit("update:modelValue", [...props.modelValue, id]);
  query.value = "";
  error.value = null;
  inputRef.value?.focus();
}

function remove(id: string) {
  emit(
    "update:modelValue",
    props.modelValue.filter((item) => item !== id),
  );
}

async function create(nextKind: string) {
  const name = query.value.trim();
  if (!name || creating.value) return;
  creating.value = true;
  error.value = null;
  kind.value = nextKind;
  try {
    const thing = await createThing({ name, kind: nextKind });
    emit("update:modelValue", [...props.modelValue, thing.id]);
    query.value = "";
    inputRef.value?.focus();
  } catch (e) {
    error.value =
      e instanceof Error ? e.message : "Could not create that thing.";
  } finally {
    creating.value = false;
  }
}

function cycleKind(step: number) {
  const index = THING_KINDS.findIndex((item) => item.id === kind.value);
  const next = (index + step + THING_KINDS.length) % THING_KINDS.length;
  kind.value = THING_KINDS[next]!.id;
}

function onKey(event: KeyboardEvent) {
  if (event.key === "Escape") {
    query.value = "";
    focused.value = false;
    return;
  }
  if (!query.value.trim()) return;
  const list = matches.value;
  if (event.key === "ArrowDown") {
    event.preventDefault();
    if (active.value === "create") return;
    active.value =
      active.value + 1 >= list.length ? "create" : active.value + 1;
  } else if (event.key === "ArrowUp") {
    event.preventDefault();
    if (active.value === "create")
      active.value = list.length ? list.length - 1 : "create";
    else if (active.value > 0) active.value -= 1;
  } else if (
    (event.key === "ArrowRight" || event.key === "ArrowLeft") &&
    active.value === "create"
  ) {
    event.preventDefault();
    cycleKind(event.key === "ArrowRight" ? 1 : -1);
  } else if (event.key === "Enter") {
    event.preventDefault();
    if (active.value === "create" || !list.length) void create(kind.value);
    else void selectThing(list[active.value]!.id);
  }
}
</script>

<template>
  <div ref="anchorRef" class="flex items-start gap-2">
    <Box
      class="mt-3.5 size-4 shrink-0 text-muted-foreground"
      aria-hidden="true"
    />
    <div class="min-w-0 flex-1">
      <label :for="inputId" class="sr-only">Things</label>
      <div class="flex min-h-11 flex-wrap items-center gap-1.5 py-1.5">
        <span
          v-for="thing in selected"
          :key="thing.id"
          class="inline-flex h-7 max-w-full items-center gap-1 rounded-full border border-foreground/[0.06] bg-white/70 py-0.5 pr-0.5 pl-2.5 text-[0.8rem] dark:border-white/10 dark:bg-white/10"
        >
          <NuxtLink
            :to="`/things/${thing.id}`"
            class="max-w-40 truncate font-medium"
            @click.stop
          >
            {{ thing.name }}
          </NuxtLink>
          <span class="text-muted-foreground">{{
            thingKindLabel(thing.kind)
          }}</span>
          <button
            type="button"
            class="grid size-6 place-items-center rounded-full text-muted-foreground hover:text-foreground"
            :aria-label="`Remove ${thing.name}`"
            @click="remove(thing.id)"
          >
            <X class="size-3.5" />
          </button>
        </span>
        <input
          :id="inputId"
          ref="inputRef"
          v-model="query"
          type="text"
          autocomplete="off"
          :placeholder="selected.length ? 'Add another' : 'Add a thing'"
          class="min-h-7 min-w-[8rem] flex-1 bg-transparent px-0 text-base outline-none placeholder:text-muted-foreground sm:text-sm"
          @focus="focused = true"
          @keydown="onKey"
        />
      </div>
      <p v-if="error" class="pb-1 text-xs text-destructive">{{ error }}</p>
    </div>

    <Teleport to="body">
      <div
        v-if="panelOpen"
        ref="panelRef"
        class="fixed z-[90] overflow-hidden rounded-2xl border border-foreground/[0.08] bg-popover text-popover-foreground shadow-lg"
        :style="panelStyle"
      >
        <ul
          v-if="matches.length"
          class="max-h-52 overflow-y-auto py-1"
          role="listbox"
        >
          <li v-for="(thing, index) in matches" :key="thing.id">
            <button
              type="button"
              class="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm hover:bg-muted"
              :class="active === index ? 'bg-muted' : ''"
              role="option"
              :aria-selected="active === index"
              @mousedown.prevent
              @click="selectThing(thing.id)"
            >
              <img
                v-if="thing.imageUrl"
                :src="thing.imageUrl"
                alt=""
                class="size-8 shrink-0 rounded-lg object-cover"
              />
              <span
                v-else
                class="grid size-8 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground"
              >
                <ThingKindGlyph :kind="thing.kind" icon-class="size-4" />
              </span>
              <span class="min-w-0 flex-1">
                <span class="block truncate font-medium">{{ thing.name }}</span>
                <span class="block text-xs text-muted-foreground">{{
                  thingKindLabel(thing.kind)
                }}</span>
              </span>
            </button>
          </li>
        </ul>
        <div
          class="border-foreground/[0.06] px-3 py-2.5"
          :class="matches.length ? 'border-t' : ''"
        >
          <p class="mb-2 text-sm">
            <span class="text-muted-foreground">Create</span>
            “{{ query.trim() }}”
          </p>
          <ThingKindChips
            :model-value="kind"
            @update:model-value="kind = $event"
            @activate="create"
          />
          <p v-if="creating" class="mt-2 text-xs text-muted-foreground">
            Creating…
          </p>
        </div>
      </div>
    </Teleport>
  </div>
</template>
