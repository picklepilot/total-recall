<script setup lang="ts">
import { EditorContent, useEditor } from "@tiptap/vue-3";
import { buildEntryExtensions, parseEntryDoc } from "@/lib/tiptapShared";

const props = defineProps<{
  contentJson: string;
}>();

const editor = useEditor({
  editable: false,
  extensions: buildEntryExtensions({ openLinkOnClick: true }),
  editorProps: {
    attributes: {
      class:
        "entry-body-tiptap text-sm leading-relaxed text-foreground [overflow-wrap:anywhere] outline-none",
    },
  },
  content: parseEntryDoc(props.contentJson) ?? {
    type: "doc",
    content: [{ type: "paragraph" }],
  },
});

watch(
  () => props.contentJson,
  (json) => {
    const doc = parseEntryDoc(json);
    if (doc && editor.value) {
      editor.value.commands.setContent(doc, false);
    }
  },
);

onBeforeUnmount(() => {
  editor.value?.destroy();
});
</script>

<template>
  <!-- Host gets Vue's DOM; ProseMirror root (.entry-body-tiptap) does not — use host prefix, not scoped :deep on the PM class. -->
  <div class="entry-body-tiptap-host">
    <EditorContent v-if="editor" :editor="editor" />
  </div>
</template>

<style>
.entry-body-tiptap-host .entry-body-tiptap h2 {
  font-size: 1.2rem;
  font-weight: 600;
  letter-spacing: -0.02em;
  margin: 0.85rem 0 0.35rem;
  line-height: 1.25;
}
.entry-body-tiptap-host .entry-body-tiptap h2:first-child {
  margin-top: 0;
}
.entry-body-tiptap-host .entry-body-tiptap h3 {
  font-size: 1.05rem;
  font-weight: 600;
  margin: 0.75rem 0 0.25rem;
  line-height: 1.3;
}
.entry-body-tiptap-host .entry-body-tiptap h3:first-child {
  margin-top: 0;
}
.entry-body-tiptap-host .entry-body-tiptap p {
  margin: 0.45rem 0;
}
.entry-body-tiptap-host .entry-body-tiptap p:first-child {
  margin-top: 0;
}
.entry-body-tiptap-host .entry-body-tiptap p:last-child {
  margin-bottom: 0;
}
.entry-body-tiptap-host .entry-body-tiptap ul,
.entry-body-tiptap-host .entry-body-tiptap ol {
  margin: 0.45rem 0;
  padding-left: 1.35rem;
}
.entry-body-tiptap-host .entry-body-tiptap blockquote {
  margin: 0.65rem 0;
  padding-left: 1rem;
  border-left: 3px solid var(--border);
  color: var(--muted-foreground);
}
.entry-body-tiptap-host .entry-body-tiptap strong {
  font-weight: 600;
}
.entry-body-tiptap-host .entry-body-tiptap em {
  font-style: italic;
}
.entry-body-tiptap-host .entry-body-tiptap code {
  font-size: 0.9em;
  padding: 0.12em 0.35em;
  border-radius: 0.25rem;
  background: var(--muted);
}
.entry-body-tiptap-host .entry-body-tiptap s,
.entry-body-tiptap-host .entry-body-tiptap del {
  text-decoration: line-through;
}
.entry-body-tiptap-host .entry-body-tiptap a {
  color: var(--primary);
  text-decoration: underline;
  text-underline-offset: 3px;
}
.entry-body-tiptap-host .entry-body-tiptap pre {
  margin: 0.65rem 0;
  padding: 0.75rem 0.9rem;
  border-radius: 0.5rem;
  background: var(--muted);
  font-size: 0.9em;
  overflow-x: auto;
}
.entry-body-tiptap-host .entry-body-tiptap hr {
  margin: 0.85rem 0;
  border: none;
  border-top: 1px solid var(--border);
}
</style>
