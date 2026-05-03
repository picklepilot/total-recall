<script setup lang="ts">
import { VueStarRate } from 'vue-js-star-rating'
import 'vue-js-star-rating/dist/style.css'

const rating = defineModel<number>({ default: 0 })
</script>

<template>
  <ClientOnly>
    <VueStarRate
      v-model="rating"
      :max-stars="5"
      :allow-half="true"
      :readonly="false"
      :allow-reset="true"
      :clearable="true"
      icon-provider="lucide"
      size="md"
      :show-counter="true"
      counter-template="{value} / {max}"
      :gap="6"
      :colors="{
        empty: 'var(--color-muted-foreground)',
        filled: '#f59e0b',
        hover: '#fbbf24',
        half: '#f59e0b',
      }"
      :animation="{ enabled: true, duration: 220, type: 'scale' }"
      class-name="compose-star-rating"
      aria-label="Optional star rating for this entry"
    />
    <template #fallback>
      <span class="text-xs text-muted-foreground">Loading rating control…</span>
    </template>
  </ClientOnly>
</template>

<style scoped>
:deep(.compose-star-rating) {
  line-height: 1.2;
}
</style>
