<script setup lang="ts">
import type { LinkPreview } from '@/types/entry'
import { parseLinkEmbed } from '@/lib/linkEmbeds'
import LinkAttachment from '@/components/LinkAttachment.vue'
import { useDebounceFn } from '@vueuse/core'

withDefaults(
  defineProps<{
    /** When false, omit the field label (e.g. parent supplies a card title). */
    showLabel?: boolean
  }>(),
  { showLabel: true },
)

const url = defineModel<string>('url', { default: '' })
const preview = defineModel<LinkPreview | null>('preview', { default: null })

const { signedIn, authHeaders } = useAuth()

const previewLoading = ref(false)
const previewError = ref('')

const fetchPreview = useDebounceFn(async () => {
  previewError.value = ''
  const u = url.value.trim()
  if (!u) {
    preview.value = null
    return
  }
  preview.value = null
  if (!signedIn.value) return
  previewLoading.value = true
  try {
    const headers = await authHeaders()
    preview.value = await $fetch<LinkPreview>('/api/link-preview', {
      params: { url: u },
      headers,
    })
  } catch (e: unknown) {
    const err = e as { data?: { statusMessage?: string }; message?: string }
    previewError.value =
      err?.data?.statusMessage || err?.message || 'Could not load a preview for this URL.'
  } finally {
    previewLoading.value = false
  }
}, 420)

watch(url, () => {
  void fetchPreview()
})

const urlTrimmed = computed(() => url.value.trim())

const showLinkAttachment = computed(() => {
  const u = urlTrimmed.value
  if (!u) return false
  if (parseLinkEmbed(u)) return true
  if (previewLoading.value) return false
  return Boolean(preview.value)
})
</script>

<template>
  <div class="space-y-2">
    <Label
      v-if="showLabel"
      for="compose-link-url"
      class="text-xs font-medium uppercase tracking-wider text-muted-foreground"
    >
      Link URL
    </Label>
    <Input
      id="compose-link-url"
      v-model="url"
      type="url"
      autocomplete="off"
      inputmode="url"
      placeholder="Paste a link"
      class="h-11 rounded-xl border-foreground/10 bg-white/80 dark:border-white/10 dark:bg-white/5"
    />
    <p v-if="previewLoading" class="text-xs text-muted-foreground">Fetching preview…</p>
    <p v-else-if="previewError" class="text-xs text-destructive">{{ previewError }}</p>
    <LinkAttachment
      v-if="showLinkAttachment"
      :url="urlTrimmed"
      :link-preview="preview"
    />
  </div>
</template>
