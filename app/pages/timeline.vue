<script setup lang="ts">
import { parseEntryDoc } from "@/lib/tiptapShared";
import LinkAttachment from "@/components/LinkAttachment.vue";

const firebaseConfigured = useFirebaseUiReady();
const { entries } = useEntries();
const { signedIn } = useAuth();

function formatDay(d: Date) {
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
</script>

<template>
  <div class="space-y-12 pb-24">
    <div class="space-y-2">
      <h1 class="text-2xl font-semibold tracking-tight">Timeline</h1>
      <p class="text-sm text-muted-foreground leading-relaxed">
        Newest first. On the
        <NuxtLink
          to="/ask"
          class="font-medium text-primary underline-offset-4 hover:underline"
        >
          Ask
        </NuxtLink>
        page you can question anything that appears in this list.
      </p>
    </div>

    <Card v-if="!firebaseConfigured" class="border-amber-500/30 bg-amber-500/5">
      <CardHeader>
        <CardTitle class="text-base">Connect Firebase</CardTitle>
        <CardDescription>
          Once Firestore is configured, your entries will show up here in real
          time.
        </CardDescription>
      </CardHeader>
    </Card>

    <Card v-else-if="!signedIn" class="border-border/80 bg-muted/30">
      <CardHeader>
        <CardTitle class="text-base">Sign in</CardTitle>
        <CardDescription>
          Sign in with Google in the header to load your timeline and chat.
        </CardDescription>
      </CardHeader>
    </Card>

    <div
      v-else-if="!entries.length"
      class="rounded-xl border border-dashed border-border py-16 text-center"
    >
      <p class="text-sm text-muted-foreground">
        No entries yet. Add something on the Add tab.
      </p>
    </div>

    <div v-else class="space-y-5">
      <article
        v-for="item in entries"
        :key="item.id"
        class="rounded-xl border border-border/70 bg-card/40 px-5 py-4"
      >
        <div
          class="flex flex-wrap items-center gap-2 text-xs text-muted-foreground"
        >
          <time :datetime="item.createdAt.toISOString()">{{
            formatDay(item.createdAt)
          }}</time>
          <template v-if="item.tags.length">
            <span v-for="t in item.tags" :key="t">
              <Badge variant="secondary" class="font-normal">{{ t }}</Badge>
            </span>
          </template>
        </div>
        <EntryWidgets v-if="item.widgets?.length" :widgets="item.widgets" class="mt-2" />
        <div v-if="item.contentText.trim()" class="mt-3">
          <ClientOnly>
            <EntryBodyTiptap
              v-if="parseEntryDoc(item.contentJson)"
              :content-json="item.contentJson"
            />
            <p v-else class="whitespace-pre-wrap text-sm leading-relaxed">
              {{ item.contentText.trim() }}
            </p>
            <template #fallback>
              <p class="whitespace-pre-wrap text-sm leading-relaxed">
                {{ item.contentText.trim() }}
              </p>
            </template>
          </ClientOnly>
        </div>
        <div v-if="item.url" class="mt-3 text-sm">
          <LinkAttachment :url="item.url" :link-preview="item.linkPreview" />
        </div>
      </article>
    </div>

  </div>
</template>
