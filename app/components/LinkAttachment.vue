<script setup lang="ts">
import type { LinkPreview } from '@/types/entry'
import { parseLinkEmbed } from '@/lib/linkEmbeds'

const props = defineProps<{
  url: string
  linkPreview?: LinkPreview | null
}>()

const embed = computed(() => parseLinkEmbed(props.url))

const hasRichPreview = computed(
  () =>
    props.linkPreview &&
    (props.linkPreview.title ||
      props.linkPreview.description ||
      props.linkPreview.image ||
      props.linkPreview.siteName),
)

const iframeAllow =
  'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen'
</script>

<template>
  <div v-if="embed" class="space-y-2">
    <div
      class="overflow-hidden rounded-xl border border-border/70 bg-black/[0.03] dark:bg-black/20"
    >
      <div :class="embed.kind === 'video' ? 'aspect-video w-full' : 'w-full'">
        <iframe
          :src="embed.embedSrc"
          :title="embed.iframeTitle"
          class="h-full w-full border-0"
          :style="
            embed.iframeHeightPx != null
              ? { minHeight: `${embed.iframeHeightPx}px`, height: `${embed.iframeHeightPx}px` }
              : undefined
          "
          loading="lazy"
          referrerpolicy="strict-origin-when-cross-origin"
          :allow="iframeAllow"
        />
      </div>
    </div>
    <a
      :href="embed.canonicalUrl"
      target="_blank"
      rel="noopener noreferrer"
      class="inline-flex text-xs font-medium text-primary underline underline-offset-4"
    >
      Open on {{ embed.providerId === 'youtube' ? 'YouTube' : embed.providerId === 'spotify' ? 'Spotify' : embed.providerId }}
    </a>
  </div>
  <a
    v-else-if="hasRichPreview && linkPreview"
    :href="url"
    target="_blank"
    rel="noopener noreferrer"
    class="block overflow-hidden rounded-xl border border-border/70 bg-card/60 transition-all relative top-0 hover:top-[-2px] hover:bg-card/80 hover:shadow-md"
  >
    <div class="flex gap-4 p-4">
      <div
        v-if="linkPreview.image"
        class="h-20 w-28 shrink-0 overflow-hidden rounded-md bg-muted"
      >
        <img
          :src="linkPreview.image"
          :alt="linkPreview.title ?? ''"
          class="h-full w-full object-cover"
          loading="lazy"
        />
      </div>
      <div class="min-w-0 space-y-1">
        <p class="text-sm font-medium leading-snug text-primary line-clamp-2">
          {{ linkPreview.title || linkPreview.siteName || 'Link' }}
        </p>
        <p v-if="linkPreview.description" class="text-xs text-muted-foreground line-clamp-3">
          {{ linkPreview.description }}
        </p>
        <p class="truncate text-xs text-muted-foreground/80">{{ url }}</p>
      </div>
    </div>
  </a>
  <a
    v-else
    :href="url"
    target="_blank"
    rel="noopener noreferrer"
    class="font-medium text-primary underline underline-offset-4"
  >
    {{ linkPreview?.title || url }}
  </a>
</template>
