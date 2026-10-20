<script setup lang="ts">
import { Link2, Star } from 'lucide-vue-next'

defineProps<{
  linkActive: boolean
  starActive: boolean
}>()

const emit = defineEmits<{
  toggleLink: []
  toggleStar: []
}>()

const tileClass =
  'flex min-h-[5.5rem] flex-col items-center justify-center gap-2 rounded-2xl border px-3 py-4 text-center transition active:scale-[0.98] motion-reduce:active:scale-100'
const tileIdle = 'border-border/80 bg-card/50 text-muted-foreground hover:bg-card hover:text-foreground'
const tileOn = 'border-primary/50 bg-primary/5 text-foreground ring-2 ring-primary/35'
</script>

<template>
  <div class="grid grid-cols-2 gap-3 sm:max-w-sm">
    <button
      type="button"
      class="touch-manipulation"
      :class="[tileClass, linkActive ? tileOn : tileIdle]"
      :aria-pressed="linkActive"
      :aria-label="linkActive ? 'Hide link field' : 'Show link field'"
      @click="emit('toggleLink')"
    >
      <Link2 class="size-7 shrink-0 opacity-90" aria-hidden="true" />
      <span class="text-sm font-medium leading-tight">Link</span>
    </button>
    <button
      type="button"
      class="touch-manipulation"
      :class="[tileClass, starActive ? tileOn : tileIdle]"
      :aria-pressed="starActive"
      :aria-label="starActive ? 'Hide rating field' : 'Show rating field'"
      @click="emit('toggleStar')"
    >
      <Star class="size-7 shrink-0 opacity-90" aria-hidden="true" />
      <span class="text-sm font-medium leading-tight">Rating</span>
    </button>
  </div>
</template>
