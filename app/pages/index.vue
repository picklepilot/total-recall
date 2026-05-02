<script setup lang="ts">
import type { LinkPreview } from '@/types/entry'
import { parseLinkEmbed } from '@/lib/linkEmbeds'
import LinkAttachment from '@/components/LinkAttachment.vue'
import { useDebounceFn } from '@vueuse/core'
import {
  TagsInput,
  TagsInputInput,
  TagsInputItem,
  TagsInputItemDelete,
  TagsInputItemText,
} from '@/components/ui/tags-input'

const nuxtApp = useNuxtApp()
const { ready, addEntry } = useEntries()
const { signedIn, authHeaders } = useAuth()

const firebaseConfigured = useFirebaseUiReady()

const feedback = ref<{ type: 'ok' | 'err'; text: string } | null>(null)

const url = ref('')
const tagsModel = ref<string[]>([])
const contentJson = ref(JSON.stringify({ type: 'doc', content: [{ type: 'paragraph' }] }))
const contentText = ref('')
const preview = ref<LinkPreview | null>(null)
const previewLoading = ref(false)
const previewError = ref('')
const submitting = ref(false)

const editorRef = ref<{ clear: () => void } | null>(null)

function onEditorChange(json: string, text: string) {
  contentJson.value = json
  contentText.value = text
}

const fetchPreview = useDebounceFn(async () => {
  preview.value = null
  previewError.value = ''
  const u = url.value.trim()
  if (!u) return
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

async function onSubmit() {
  feedback.value = null
  if (!nuxtApp.$firebaseReady) {
    feedback.value = {
      type: 'err',
      text: 'Firebase is not configured. Add NUXT_PUBLIC_FIREBASE_* to .env.',
    }
    return
  }
  if (!signedIn.value) {
    feedback.value = { type: 'err', text: 'Sign in with Google first (header).' }
    return
  }
  const hasNote = contentText.value.trim().length > 0
  const hasUrl = url.value.trim().length > 0
  if (!hasNote && !hasUrl) {
    feedback.value = { type: 'err', text: 'Add a note, a link, or both.' }
    return
  }
  submitting.value = true
  try {
    await addEntry({
      contentJson: contentJson.value,
      contentText: contentText.value,
      url: hasUrl ? url.value.trim() : null,
      linkPreview: preview.value,
      tags: tagsModel.value.map((t) => t.trim().toLowerCase()).filter(Boolean),
    })
    feedback.value = { type: 'ok', text: 'Saved to your log.' }
    url.value = ''
    tagsModel.value = []
    preview.value = null
    previewError.value = ''
    editorRef.value?.clear()
    contentText.value = ''
    contentJson.value = JSON.stringify({ type: 'doc', content: [{ type: 'paragraph' }] })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Could not save entry.'
    feedback.value = { type: 'err', text: msg }
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="space-y-10">
    <div class="space-y-2">
      <h1 class="text-2xl font-semibold tracking-tight">New entry</h1>
      <p class="text-sm text-muted-foreground leading-relaxed">
        Capture a link, a thought, or both. Everything stays in your Firebase project.
      </p>
    </div>

    <p
      v-if="feedback"
      class="rounded-lg border px-4 py-3 text-sm"
      :class="
        feedback.type === 'ok'
          ? 'border-emerald-500/35 bg-emerald-500/5 text-foreground'
          : 'border-destructive/40 bg-destructive/5 text-destructive'
      "
    >
      {{ feedback.text }}
    </p>

    <Card v-if="!firebaseConfigured" class="border-amber-500/30 bg-amber-500/5">
      <CardHeader class="pb-2">
        <CardTitle class="text-base">Connect Firebase</CardTitle>
        <CardDescription>
          Copy
          <code class="rounded bg-muted px-1 py-0.5 text-xs">.env.example</code>
          to
          <code class="rounded bg-muted px-1 py-0.5 text-xs">.env</code>
          and add web app keys. Enable Firestore and Google sign-in, then deploy
          <code class="rounded bg-muted px-1 py-0.5 text-xs">firestore.rules</code>.
        </CardDescription>
      </CardHeader>
    </Card>

    <Card v-else-if="!signedIn" class="border-border/80 bg-muted/30">
      <CardHeader class="pb-2">
        <CardTitle class="text-base">Sign in</CardTitle>
        <CardDescription>
          Use Google in the header so your entries stay private to your account.
        </CardDescription>
      </CardHeader>
    </Card>

    <form class="space-y-8" @submit.prevent="onSubmit">
      <div class="space-y-2">
        <Label for="url" class="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Link (optional)
        </Label>
        <Input
          id="url"
          v-model="url"
          type="url"
          autocomplete="off"
          placeholder="https://…"
          class="h-11 rounded-lg bg-card/50"
        />
        <p v-if="previewLoading" class="text-xs text-muted-foreground">Fetching preview…</p>
        <p v-else-if="previewError" class="text-xs text-destructive">{{ previewError }}</p>
      </div>

      <LinkAttachment
        v-if="showLinkAttachment"
        :url="urlTrimmed"
        :link-preview="preview"
      />

      <div class="space-y-2">
        <Label class="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Note
        </Label>
        <ClientOnly>
          <MediumEditor ref="editorRef" @change="onEditorChange" />
          <template #fallback>
            <div
              class="flex min-h-[220px] items-center justify-center rounded-xl border border-dashed border-border text-sm text-muted-foreground"
            >
              Loading editor…
            </div>
          </template>
        </ClientOnly>
      </div>

      <div class="space-y-2">
        <Label
          for="tags-input"
          class="text-xs font-medium uppercase tracking-wider text-muted-foreground"
        >
          Tags
        </Label>
        <TagsInput v-model="tagsModel" class="w-full min-h-11 rounded-lg bg-card/50 px-2.5 py-2 gap-1.5">
          <TagsInputItem
            v-for="(item, i) in tagsModel"
            :key="`${i}-${item}`"
            :value="item"
          >
            <TagsInputItemText />
            <TagsInputItemDelete />
          </TagsInputItem>
          <TagsInputInput
            id="tags-input"
            placeholder="music, ideas, important…"
            class="min-h-6"
          />
        </TagsInput>
        <p class="text-xs text-muted-foreground">
          Press Enter or comma to add a tag. Click × to remove. Saved in lowercase.
        </p>
      </div>

      <div class="flex justify-end pt-2">
        <Button
          type="submit"
          size="lg"
          class="rounded-full px-8"
          :disabled="submitting || !ready"
        >
          {{ submitting ? 'Saving…' : 'Save entry' }}
        </Button>
      </div>
    </form>
  </div>
</template>
