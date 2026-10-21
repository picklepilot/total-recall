<script setup lang="ts">
import { entryDocHasRichFormatting } from "~~/shared/entryDocFormat";

const props = defineProps<{
  contentJson: string;
  contentText: string;
}>();

const host = ref<HTMLElement | null>(null);
const inView = ref(false);
const rich = computed(() => entryDocHasRichFormatting(props.contentJson));
const trimmed = computed(() => props.contentText.trim());

onMounted(() => {
  if (!rich.value) return;
  if (typeof IntersectionObserver === "undefined") {
    inView.value = true;
    return;
  }
  const io = new IntersectionObserver(
    ([entry]) => {
      if (entry?.isIntersecting) {
        inView.value = true;
        io.disconnect();
      }
    },
    { rootMargin: "240px 0px" },
  );
  if (host.value) io.observe(host.value);
  onBeforeUnmount(() => io.disconnect());
});
</script>

<template>
  <p
    v-if="!rich"
    class="whitespace-pre-wrap text-sm leading-relaxed"
  >
    {{ trimmed }}
  </p>
  <div v-else ref="host">
    <EntryBodyTiptap v-if="inView" :content-json="contentJson" />
    <p v-else class="whitespace-pre-wrap text-sm leading-relaxed">
      {{ trimmed }}
    </p>
  </div>
</template>
