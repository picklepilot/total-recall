<script setup lang="ts">
const props = defineProps<{
  name: string;
  kind: string;
  imageUrl: string | null;
  busy: boolean;
}>();

const emit = defineEmits<{
  file: [file: File];
  remove: [];
}>();

const inputRef = ref<HTMLInputElement | null>(null);

function openPicker() {
  if (props.busy) return;
  inputRef.value?.click();
}

function onChange(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = "";
  if (file) emit("file", file);
}
</script>

<template>
  <div class="relative">
    <button
      type="button"
      class="relative block w-full overflow-hidden rounded-3xl border border-foreground/[0.06] bg-card/70 text-left shadow-sm dark:border-white/10 dark:bg-white/[0.04]"
      :class="kind === 'person' ? 'mx-auto aspect-square max-w-52' : 'aspect-[4/3] max-h-80'"
      :aria-label="imageUrl ? `Replace photo of ${name}` : `Add a photo of ${name}`"
      :disabled="busy"
      @click="openPicker"
    >
      <img
        v-if="imageUrl"
        :src="imageUrl"
        alt=""
        class="size-full object-cover"
      />
      <span
        v-else
        class="flex size-full flex-col items-center justify-center gap-2 text-muted-foreground"
      >
        <ThingKindGlyph :kind="kind" icon-class="size-8" />
        <span class="text-sm font-medium">Add photo</span>
      </span>
      <span
        v-if="busy"
        class="absolute inset-0 grid place-items-center bg-background/70 text-sm font-medium backdrop-blur-sm"
      >
        Saving photo…
      </span>
    </button>
    <button
      v-if="imageUrl && !busy"
      type="button"
      class="absolute top-3 right-3 inline-flex h-8 touch-manipulation items-center rounded-full bg-background/85 px-3 text-xs font-medium shadow-sm backdrop-blur-md hover:bg-background"
      @click="emit('remove')"
    >
      Remove
    </button>
    <input
      ref="inputRef"
      type="file"
      accept="image/*"
      class="sr-only"
      @change="onChange"
    />
  </div>
</template>
