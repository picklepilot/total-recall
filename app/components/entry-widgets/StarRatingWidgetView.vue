<script setup lang="ts">
import type { StarRatingWidget } from '@/types/entry'
import { VueStarRate } from 'vue-js-star-rating'
import 'vue-js-star-rating/dist/style.css'

const props = defineProps<{ widget: StarRatingWidget }>()

/** Local v-model mirror so the control stays in sync if the parent entry updates. */
const rating = ref(props.widget.value)
watch(
  () => props.widget.value,
  (v) => {
    rating.value = v
  },
)
</script>

<template>
  <ClientOnly>
    <VueStarRate
      v-model="rating"
      :max-stars="5"
      :allow-half="true"
      :readonly="true"
      :allow-reset="false"
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
      class-name="star-rating-widget"
      :aria-label="`Rating ${widget.value} out of 5`"
    />
    <template #fallback>
      <span class="text-sm tabular-nums text-muted-foreground">{{ widget.value }} / 5</span>
    </template>
  </ClientOnly>
</template>

<style scoped>
:deep(.star-rating-widget) {
  /* Slightly tighter alignment with timeline typography */
  line-height: 1.2;
}
</style>
