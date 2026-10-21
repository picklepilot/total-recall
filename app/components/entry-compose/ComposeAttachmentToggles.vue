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

const pillClass =
  'inline-flex h-10 touch-manipulation items-center gap-1.5 rounded-full px-3.5 text-sm font-medium transition active:scale-[0.97] motion-reduce:active:scale-100 sm:h-9'
const pillIdle = 'text-muted-foreground hover:bg-muted hover:text-foreground'
const pillOn = 'bg-foreground/[0.07] text-foreground dark:bg-foreground/10'
</script>

<template>
  <div class="flex items-center gap-1">
    <button
      type="button"
      :class="[pillClass, linkActive ? pillOn : pillIdle]"
      :aria-pressed="linkActive"
      :aria-label="linkActive ? 'Hide link field' : 'Add a link'"
      @click="emit('toggleLink')"
    >
      <Link2 class="size-4" aria-hidden="true" />
      Link
    </button>
    <button
      type="button"
      :class="[pillClass, starActive ? pillOn : pillIdle]"
      :aria-pressed="starActive"
      :aria-label="starActive ? 'Hide rating field' : 'Add a rating'"
      @click="emit('toggleStar')"
    >
      <Star
        class="size-4"
        :class="starActive ? 'fill-amber-400 text-amber-500' : ''"
        aria-hidden="true"
      />
      Rating
    </button>
  </div>
</template>
