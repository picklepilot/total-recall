<script setup lang="ts">
import type { EntryWidget } from '@/types/entry'
import { entryWidgetViews } from '@/lib/entry-widgets/registry'

defineProps<{
  widgets?: EntryWidget[] | null
}>()
</script>

<template>
  <div v-if="widgets?.length" class="flex flex-wrap items-center gap-3">
    <component
      :is="entryWidgetViews[w.type]"
      v-for="(w, i) in widgets"
      :key="i"
      :widget="w"
    />
  </div>
</template>
