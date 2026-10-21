<script setup lang="ts">
import { KeyRound, LockKeyhole } from "lucide-vue-next";

const route = useRoute();
const router = useRouter();
const { signedIn, signInWithGoogle } = useAuth();

const firebaseConfigured = useFirebaseUiReady();

/** Set via `/?parent=<id>` when continuing a thread from outside the timeline. */
const parentId = computed(() =>
  typeof route.query.parent === "string" && route.query.parent
    ? route.query.parent
    : null,
);

function clearParent() {
  router.replace({ query: { ...route.query, parent: undefined } });
}

/** Set via `/?thing=<id>` from a thing's "Write about this". */
const thingId = computed(() =>
  typeof route.query.thing === "string" && route.query.thing
    ? route.query.thing
    : null,
);

function clearThing() {
  router.replace({ query: { ...route.query, thing: undefined } });
}

async function onSaved(payload: { id: string; parentId: string | null }) {
  if (payload.parentId) await router.push(`/entries/${payload.id}`);
}

/** Rendered on the client so the date matches the user's timezone. */
const todayLabel = ref("");
onMounted(() => {
  todayLabel.value = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
});

const signingIn = ref(false);
async function onSignIn() {
  signingIn.value = true;
  try {
    await signInWithGoogle();
  } catch (e) {
    console.error(e);
  } finally {
    signingIn.value = false;
  }
}
</script>

<template>
  <div class="mx-auto flex w-full max-w-xl flex-1 flex-col">
    <header class="mb-5 px-4 sm:mb-7 sm:px-1">
      <p
        class="h-4 text-xs font-medium tracking-[0.14em] text-muted-foreground uppercase"
      >
        {{ todayLabel }}
      </p>
      <h1
        class="mt-2 text-[1.7rem] leading-tight font-semibold tracking-tight sm:text-3xl"
      >
        What's the deal?
      </h1>
    </header>

    <section
      v-if="!firebaseConfigured"
      class="my-auto rounded-3xl border border-amber-500/30 bg-amber-50/70 p-6 text-center backdrop-blur-xl dark:bg-amber-500/10"
    >
      <span
        class="mx-auto mb-4 grid size-12 place-items-center rounded-2xl bg-amber-500/15 text-amber-600 dark:text-amber-400"
      >
        <KeyRound class="size-5" aria-hidden="true" />
      </span>
      <h2 class="text-base font-semibold">Connect Firebase</h2>
      <p
        class="mx-auto mt-1.5 max-w-sm text-sm leading-relaxed text-muted-foreground"
      >
        Copy
        <code class="rounded bg-muted px-1 py-0.5 text-xs">.env.example</code>
        to
        <code class="rounded bg-muted px-1 py-0.5 text-xs">.env</code>
        and add web app keys. Enable Firestore and Google sign-in, then deploy
        <code class="rounded bg-muted px-1 py-0.5 text-xs"
          >firestore.rules</code
        >.
      </p>
    </section>

    <section
      v-else-if="!signedIn"
      class="my-auto rounded-3xl border border-border/70 bg-card/80 p-6 text-center shadow-sm backdrop-blur-xl sm:p-8"
    >
      <span
        class="mx-auto mb-4 grid size-12 place-items-center rounded-2xl bg-muted text-muted-foreground"
      >
        <LockKeyhole class="size-5" aria-hidden="true" />
      </span>
      <h2 class="text-base font-semibold">Your private log</h2>
      <p
        class="mx-auto mt-1.5 max-w-xs text-sm leading-relaxed text-muted-foreground"
      >
        Sign in so your notes, links and ratings stay tied to your account.
      </p>
      <Button
        size="lg"
        class="mt-5 h-12 w-full touch-manipulation rounded-full text-base sm:w-auto sm:px-8"
        :disabled="signingIn"
        @click="onSignIn"
      >
        {{ signingIn ? "Signing in…" : "Continue with Google" }}
      </Button>
    </section>

    <div v-else class="my-auto">
      <EntryComposeForm
        :parent-id="parentId"
        :initial-thing-id="thingId"
        @clear-parent="clearParent"
        @clear-thing="clearThing"
        @saved="onSaved"
      />
    </div>
  </div>
</template>
