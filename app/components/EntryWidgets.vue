<script setup lang="ts">
import type { EntryWidget } from '@/types/entry'
import { entryWidgetViews } from '@/lib/entry-widgets/registry'

defineProps<{
  widgets?: EntryWidget[] | null
}>()
</script>

<template>
  <div v-if="widgets?.length" class="flex w-full min-w-0 flex-col gap-3">
    <component
      :is="entryWidgetViews[w.type]"
      v-for="(w, i) in widgets"
      :key="i"
      class="w-full min-w-0"
      :widget="w"
    />
  </div>
</template>
