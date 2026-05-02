<script setup lang="ts">
import { EditorContent, useEditor } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'

const emit = defineEmits<{
  change: [json: string, text: string]
}>()

const editor = useEditor({
  extensions: [
    StarterKit.configure({
      heading: { levels: [2, 3] },
    }),
    Link.configure({ openOnClick: false }),
    Placeholder.configure({
      placeholder: 'Write what you want to remember…',
    }),
  ],
  editorProps: {
    attributes: {
      class:
        'medium-editor-tiptap min-h-[220px] px-4 py-3 text-[1.0625rem] leading-[1.65] text-foreground focus:outline-none',
    },
  },
  onUpdate: ({ editor: ed }) => {
    emit('change', JSON.stringify(ed.getJSON()), ed.getText({ blockSeparator: '\n' }))
  },
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
  </div>
</template>

<style scoped>
.medium-editor :deep(.medium-editor-tiptap h2) {
  font-size: 1.35rem;
  font-weight: 600;
  letter-spacing: -0.02em;
  margin: 1.15rem 0 0.45rem;
  line-height: 1.25;
}
.medium-editor :deep(.medium-editor-tiptap h3) {
  font-size: 1.12rem;
  font-weight: 600;
  margin: 1rem 0 0.35rem;
  line-height: 1.3;
}
.medium-editor :deep(.medium-editor-tiptap p) {
  margin: 0.55rem 0;
}
.medium-editor :deep(.medium-editor-tiptap ul),
.medium-editor :deep(.medium-editor-tiptap ol) {
  margin: 0.55rem 0;
  padding-left: 1.35rem;
}
.medium-editor :deep(.medium-editor-tiptap blockquote) {
  margin: 0.85rem 0;
  padding-left: 1rem;
  border-left: 3px solid var(--border);
  color: var(--muted-foreground);
}
.medium-editor :deep(.medium-editor-tiptap a) {
  color: var(--primary);
  text-decoration: underline;
  text-underline-offset: 3px;
}
.medium-editor :deep(p.is-editor-empty:first-child::before) {
  color: var(--muted-foreground);
  content: attr(data-placeholder);
  float: left;
  height: 0;
  pointer-events: none;
}
</style>
