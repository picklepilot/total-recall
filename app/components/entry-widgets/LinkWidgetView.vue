<script setup lang="ts">
import type { LinkWidget } from '@/types/entry'
import LinkAttachment from '@/components/LinkAttachment.vue'

defineProps<{
  widget: LinkWidget
}>()
</script>

<template>
  <div class="text-sm">
    <LinkAttachment :url="widget.url" :link-preview="widget.preview" />
  </div>
</template>
