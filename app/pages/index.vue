<script setup lang="ts">
import type { LinkPreview } from '@/types/entry'
import ComposeStarRatingField from '@/components/entry-compose/ComposeStarRatingField.vue'
import ComposeLinkField from '@/components/entry-compose/ComposeLinkField.vue'
import ComposeWidgetPickerGrid from '@/components/entry-compose/ComposeWidgetPickerGrid.vue'
import { buildWidgetsFromComposeForm } from '@/lib/entry-compose/buildWidgetsFromForm'
import {
  TagsInput,
  TagsInputInput,
  TagsInputItem,
  TagsInputItemDelete,
  TagsInputItemText,
} from '@/components/ui/tags-input'

const nuxtApp = useNuxtApp()
const { ready, addEntry } = useEntries()
const { signedIn } = useAuth()

const firebaseConfigured = useFirebaseUiReady()

const feedback = ref<{ type: 'ok' | 'err'; text: string } | null>(null)

/** Panels only after user picks a tile — keeps the first screen light on mobile. */
const composeLinkPanel = ref(false)
const composeStarPanel = ref(false)

const composeLinkUrl = ref('')
const composeLinkPreview = ref<LinkPreview | null>(null)
const tagsModel = ref<string[]>([])
const contentJson = ref(JSON.stringify({ type: 'doc', content: [{ type: 'paragraph' }] }))
const contentText = ref('')
const submitting = ref(false)

const editorRef = ref<{ clear: () => void } | null>(null)
const composeStarRating = ref(0)

function onEditorChange(json: string, text: string) {
  contentJson.value = json
  contentText.value = text
}

const linkTrimmed = computed(() => composeLinkUrl.value.trim())

function toggleLinkPanel() {
  composeLinkPanel.value = !composeLinkPanel.value
  if (!composeLinkPanel.value) {
    composeLinkUrl.value = ''
    composeLinkPreview.value = null
  }
}

function toggleStarPanel() {
  composeStarPanel.value = !composeStarPanel.value
  if (!composeStarPanel.value) {
    composeStarRating.value = 0
  }
}

function removeLinkPanel() {
  composeLinkPanel.value = false
  composeLinkUrl.value = ''
  composeLinkPreview.value = null
}

function removeStarPanel() {
  composeStarPanel.value = false
  composeStarRating.value = 0
}

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
  const hasUrl = linkTrimmed.value.length > 0
  if (!hasNote && !hasUrl) {
    feedback.value = { type: 'err', text: 'Add a note, a link, or both.' }
    return
  }
  submitting.value = true
  try {
    await addEntry({
      contentJson: contentJson.value,
      contentText: contentText.value,
      tags: tagsModel.value.map((t) => t.trim().toLowerCase()).filter(Boolean),
      widgets: buildWidgetsFromComposeForm({
        starRating: composeStarRating.value,
        link: hasUrl
          ? { url: composeLinkUrl.value.trim(), preview: composeLinkPreview.value }
          : null,
      }),
    })
    feedback.value = { type: 'ok', text: 'Saved to your log.' }
    composeLinkUrl.value = ''
    composeLinkPreview.value = null
    composeLinkPanel.value = false
    composeStarPanel.value = false
    tagsModel.value = []
    editorRef.value?.clear()
    contentText.value = ''
    contentJson.value = JSON.stringify({ type: 'doc', content: [{ type: 'paragraph' }] })
    composeStarRating.value = 0
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Could not save entry.'
    feedback.value = { type: 'err', text: msg }
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="space-y-8 sm:space-y-10">
    <div class="space-y-2">
      <h1 class="text-2xl font-semibold tracking-tight">New entry</h1>
      <p class="text-sm text-muted-foreground leading-relaxed">
        Jot the thought first. Add a link or rating only if you need them.
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

    <form v-else class="space-y-8" @submit.prevent="onSubmit">
      <div class="space-y-2">
        <Label class="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Note
        </Label>
        <ClientOnly>
          <MediumEditor ref="editorRef" @change="onEditorChange" />
          <template #fallback>
            <div
              class="flex min-h-[200px] items-center justify-center rounded-2xl border border-dashed border-border text-sm text-muted-foreground sm:min-h-[220px]"
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
        <TagsInput v-model="tagsModel" class="w-full min-h-11 rounded-xl bg-card/50 px-2.5 py-2 gap-1.5">
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
            placeholder="Optional — tap below for more"
            class="min-h-6"
          />
        </TagsInput>
      </div>

      <div class="space-y-3">
        <div class="flex items-end justify-between gap-3">
          <div class="space-y-1">
            <p class="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Add more
            </p>
            <p class="text-sm text-muted-foreground leading-snug">
              Tap a square to show that field. Tap again on the square to hide it.
            </p>
          </div>
        </div>
        <ComposeWidgetPickerGrid
          :link-active="composeLinkPanel"
          :star-active="composeStarPanel"
          @toggle-link="toggleLinkPanel"
          @toggle-star="toggleStarPanel"
        />
      </div>

      <div
        v-if="composeLinkPanel"
        class="space-y-3 rounded-2xl border border-border/80 bg-card/40 p-4"
      >
        <div class="flex items-start justify-between gap-2">
          <p class="text-sm font-medium text-foreground">Link</p>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            class="shrink-0 touch-manipulation text-muted-foreground hover:text-foreground"
            @click="removeLinkPanel"
          >
            Remove
          </Button>
        </div>
        <ComposeLinkField v-model:url="composeLinkUrl" v-model:preview="composeLinkPreview" :show-label="false" />
      </div>

      <div
        v-if="composeStarPanel"
        class="space-y-3 rounded-2xl border border-border/80 bg-card/40 p-4"
      >
        <div class="flex items-start justify-between gap-2">
          <p class="text-sm font-medium text-foreground">Rating</p>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            class="shrink-0 touch-manipulation text-muted-foreground hover:text-foreground"
            @click="removeStarPanel"
          >
            Remove
          </Button>
        </div>
        <ComposeStarRatingField v-model="composeStarRating" />
      </div>

      <div class="pt-1">
        <Button
          type="submit"
          size="lg"
          class="h-12 w-full touch-manipulation rounded-full text-base sm:ms-auto sm:w-auto sm:min-w-[11rem]"
          :disabled="submitting || !ready"
        >
          {{ submitting ? 'Saving…' : 'Save entry' }}
        </Button>
      </div>
    </form>
  </div>
</template>
