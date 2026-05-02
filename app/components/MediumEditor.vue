<script setup lang="ts">
import type { Editor } from '@tiptap/core'
import type { EditorState } from '@tiptap/pm/state'
import { EditorContent, useEditor } from '@tiptap/vue-3'
import { FloatingMenu } from '@tiptap/vue-3/menus'
import Placeholder from '@tiptap/extension-placeholder'
import { buildEntryExtensions } from '@/lib/tiptapShared'
import {
  filterSlashItems,
  getSlashContext,
  getSlashItems,
  type SlashCommandItem,
} from '@/lib/editorSlashCommands'

const emit = defineEmits<{
  change: [json: string, text: string]
}>()

const slashPalette = getSlashItems()
const slashUiGeneration = ref(0)
const selectedSlashIndex = ref(0)

function bumpSlashUi() {
  slashUiGeneration.value++
}

function shouldShowSlashMenu({ state }: { state: EditorState }) {
  return getSlashContext(state) !== null
}

function applySlashItem(ed: Editor, item: SlashCommandItem) {
  const ctx = getSlashContext(ed.state)
  if (!ctx) return
  ed.chain().focus().deleteRange({ from: ctx.from, to: ctx.to }).run()
  item.command(ed)
}

const editor = useEditor({
  extensions: [
    ...buildEntryExtensions({ openLinkOnClick: false }),
    Placeholder.configure({
      placeholder: 'Write what you want to remember…  Type / for blocks.',
    }),
  ],
  editorProps: {
    attributes: {
      class:
        'medium-editor-tiptap min-h-[220px] px-4 py-3 text-[1.0625rem] leading-[1.65] text-foreground focus:outline-none',
    },
    handleKeyDown(view, event) {
      const ed = editor.value
      if (!ed) return false
      const ctx = getSlashContext(view.state)
      if (!ctx) return false
      const items = filterSlashItems(slashPalette, ctx.query)

      if (event.key === 'Escape') {
        event.preventDefault()
        ed.chain().focus().deleteRange({ from: ctx.from, to: ctx.to }).run()
        return true
      }

      if (items.length === 0) return false

      if (event.key === 'ArrowDown') {
        event.preventDefault()
        selectedSlashIndex.value = (selectedSlashIndex.value + 1) % items.length
        bumpSlashUi()
        return true
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault()
        selectedSlashIndex.value =
          (selectedSlashIndex.value - 1 + items.length) % items.length
        bumpSlashUi()
        return true
      }
      if (event.key === 'Enter') {
        event.preventDefault()
        const item = items[selectedSlashIndex.value]
        if (item) applySlashItem(ed, item)
        return true
      }
      return false
    },
  },
  onSelectionUpdate: bumpSlashUi,
  onUpdate: ({ editor: ed }) => {
    bumpSlashUi()
    emit('change', JSON.stringify(ed.getJSON()), ed.getText({ blockSeparator: '\n' }))
  },
})

function onSlashItemClick(item: SlashCommandItem) {
  const ed = editor.value
  if (!ed) return
  applySlashItem(ed, item)
}

const slashMenuItems = computed(() => {
  slashUiGeneration.value
  const ed = editor.value
  if (!ed) return []
  const ctx = getSlashContext(ed.state)
  if (!ctx) return []
  return filterSlashItems(slashPalette, ctx.query)
})

watch(
  () => {
    slashUiGeneration.value
    const ed = editor.value
    const ctx = ed ? getSlashContext(ed.state) : null
    return ctx?.query ?? ''
  },
  (q, prev) => {
    if (prev !== undefined && q !== prev) selectedSlashIndex.value = 0
  },
)

watch(slashMenuItems, (items) => {
  if (selectedSlashIndex.value >= items.length) {
    selectedSlashIndex.value = Math.max(0, items.length - 1)
  }
})

onBeforeUnmount(() => {
  editor.value?.destroy()
})

defineExpose({
  clear: () => editor.value?.commands.clearContent(),
})
</script>

<template>
  <div
    class="medium-editor rounded-xl border border-border/80 bg-card/40 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
  >
    <EditorContent v-if="editor" :editor="editor" />
    <FloatingMenu
      v-if="editor"
      :editor="editor"
      plugin-key="slashCommands"
      :should-show="shouldShowSlashMenu"
      :options="{
        placement: 'bottom-start',
        offset: 8,
        flip: true,
        shift: true,
      }"
    >
      <div
        class="slash-menu z-50 max-h-[min(320px,50vh)] min-w-[240px] overflow-y-auto rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-md"
        role="listbox"
        aria-label="Block types"
        @mousedown.prevent
      >
        <template v-if="slashMenuItems.length">
          <button
            v-for="(item, i) in slashMenuItems"
            :key="item.title"
            type="button"
            role="option"
            :aria-selected="i === selectedSlashIndex"
            class="flex w-full flex-col items-start gap-0.5 rounded-md px-2.5 py-2 text-left text-sm outline-none transition-colors"
            :class="
              i === selectedSlashIndex
                ? 'bg-accent text-accent-foreground'
                : 'hover:bg-accent/60'
            "
            @click="onSlashItemClick(item)"
            @mouseenter="selectedSlashIndex = i"
          >
            <span class="font-medium leading-none">{{ item.title }}</span>
            <span
              class="text-xs leading-snug text-muted-foreground"
              :class="i === selectedSlashIndex ? 'text-accent-foreground/80' : ''"
            >
              {{ item.description }}
            </span>
          </button>
        </template>
        <div v-else class="px-2.5 py-3 text-sm text-muted-foreground">No matching blocks</div>
      </div>
    </FloatingMenu>
  </div>
</template>

<!-- ProseMirror sets .medium-editor-tiptap on a node Vue did not render, so it never gets scoped data-v — namespace under .medium-editor only. -->
<style>
.medium-editor .medium-editor-tiptap h2 {
  font-size: 1.35rem;
  font-weight: 600;
  letter-spacing: -0.02em;
  margin: 1.15rem 0 0.45rem;
  line-height: 1.25;
}
.medium-editor .medium-editor-tiptap h3 {
  font-size: 1.12rem;
  font-weight: 600;
  margin: 1rem 0 0.35rem;
  line-height: 1.3;
}
.medium-editor .medium-editor-tiptap p {
  margin: 0.55rem 0;
}
.medium-editor .medium-editor-tiptap ul,
.medium-editor .medium-editor-tiptap ol {
  margin: 0.55rem 0;
  padding-left: 1.35rem;
}
.medium-editor .medium-editor-tiptap blockquote {
  margin: 0.85rem 0;
  padding-left: 1rem;
  border-left: 3px solid var(--border);
  color: var(--muted-foreground);
}
.medium-editor .medium-editor-tiptap strong {
  font-weight: 600;
}
.medium-editor .medium-editor-tiptap em {
  font-style: italic;
}
.medium-editor .medium-editor-tiptap code {
  font-size: 0.9em;
  padding: 0.12em 0.35em;
  border-radius: 0.25rem;
  background: var(--muted);
}
.medium-editor .medium-editor-tiptap s,
.medium-editor .medium-editor-tiptap del {
  text-decoration: line-through;
}
.medium-editor .medium-editor-tiptap a {
  color: var(--primary);
  text-decoration: underline;
  text-underline-offset: 3px;
}
.medium-editor .medium-editor-tiptap pre {
  margin: 0.75rem 0;
  padding: 0.85rem 1rem;
  border-radius: 0.5rem;
  background: var(--muted);
  font-size: 0.9em;
  overflow-x: auto;
}
.medium-editor .medium-editor-tiptap hr {
  margin: 1rem 0;
  border: none;
  border-top: 1px solid var(--border);
}
.medium-editor .medium-editor-tiptap p.is-editor-empty:first-child::before {
  color: var(--muted-foreground);
  content: attr(data-placeholder);
  float: left;
  height: 0;
  pointer-events: none;
}
</style>
