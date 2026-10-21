<script setup lang="ts">
import { THING_KINDS } from "~~/shared/thingKinds";

const props = withDefaults(
  defineProps<{
    modelValue: string;
    /** Include an "All" chip with an empty id, for the inventory filter. */
    allowAll?: boolean;
  }>(),
  { allowAll: false },
);

const emit = defineEmits<{
  "update:modelValue": [id: string];
  /** Fired on click, after the model updates. The picker uses this to create. */
  activate: [id: string];
}>();

const options = computed(() => {
  const kinds = THING_KINDS.map((kind) => ({ id: kind.id, label: kind.label }));
  return props.allowAll ? [{ id: "", label: "All" }, ...kinds] : kinds;
});

function choose(id: string) {
  emit("update:modelValue", id);
  emit("activate", id);
}
</script>

<template>
  <div class="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Kind">
    <button
      v-for="option in options"
      :key="option.id || 'all'"
      type="button"
      role="radio"
      :aria-checked="modelValue === option.id"
      class="inline-flex h-8 touch-manipulation items-center rounded-full px-3 text-sm font-medium transition active:scale-[0.97] motion-reduce:active:scale-100"
      :class="
        modelValue === option.id
          ? 'bg-foreground text-background'
          : 'bg-foreground/[0.05] text-muted-foreground hover:text-foreground dark:bg-white/10'
      "
      @click="choose(option.id)"
    >
      {{ option.label }}
    </button>
  </div>
</template>
