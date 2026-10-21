<script setup lang="ts">
import {
  Download,
  History,
  LogOut,
  Moon,
  PenLine,
  Sparkles,
  Sun,
} from "lucide-vue-next";
import { useDark } from "@vueuse/core";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const route = useRoute();
const { user, signedIn, signInWithGoogle, logout } = useAuth();

const firebaseConfigured = useFirebaseUiReady();

const isDark = useDark({ storageKey: "total-recall-color-scheme" });

function toggleColorMode() {
  isDark.value = !isDark.value;
}

const navItems = [
  { to: "/", label: "Add", icon: PenLine },
  { to: "/timeline", label: "Timeline", icon: History },
  { to: "/ask", label: "Ask", icon: Sparkles },
  { to: "/import", label: "Import", icon: Download },
];

const userInitial = computed(() =>
  (user.value?.displayName || user.value?.email || "?").charAt(0).toUpperCase(),
);

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
  <div class="relative isolate flex min-h-dvh flex-col text-foreground">
    <div
      class="mesh-bg pointer-events-none fixed inset-0 -z-10"
      aria-hidden="true"
    />
    <header
      class="sticky top-0 z-20 pt-[env(safe-area-inset-top)] backdrop-blur-xl"
    >
      <div
        class="mx-auto flex h-24 sm:h-14 max-w-3xl items-center justify-between gap-3 px-8 sm:px-5"
      >
        <NuxtLink
          to="/"
          class="flex items-center gap-2 text-[0.95rem] font-semibold tracking-tight"
        >
          <span
            class="grid size-7 place-items-center rounded-full bg-foreground text-background"
            aria-hidden="true"
          >
            <span class="text-[0.7rem] font-bold leading-none">TR</span>
          </span>
          <span class="sr-only">Total Recall</span>
        </NuxtLink>

        <nav
          class="hidden items-center gap-1 text-sm sm:flex"
          aria-label="Main"
        >
          <NuxtLink
            v-for="item in navItems"
            :key="item.to"
            :to="item.to"
            class="rounded-full px-3 py-1.5 text-muted-foreground transition-colors hover:text-foreground"
            :class="
              route.path === item.to
                ? 'bg-muted font-medium text-foreground'
                : ''
            "
          >
            {{ item.label }}
          </NuxtLink>
        </nav>

        <div class="flex items-center gap-1.5">
          <ClientOnly>
            <Button
              variant="ghost"
              size="icon"
              class="rounded-full text-muted-foreground hover:text-foreground"
              :aria-label="
                isDark ? 'Switch to light mode' : 'Switch to dark mode'
              "
              @click="toggleColorMode"
            >
              <Sun v-if="isDark" class="size-4" />
              <Moon v-else class="size-4" />
            </Button>
            <template #fallback>
              <span class="size-8" aria-hidden="true" />
            </template>
          </ClientOnly>
          <DropdownMenu v-if="firebaseConfigured && signedIn && user">
            <DropdownMenuTrigger
              class="grid size-8 cursor-pointer place-items-center overflow-hidden rounded-full bg-muted text-xs font-semibold text-muted-foreground outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-ring/50 data-[state=open]:ring-2 data-[state=open]:ring-ring/40"
              aria-label="Account menu"
              :title="user.email ?? undefined"
            >
              <img
                v-if="user.photoURL"
                :src="user.photoURL"
                alt=""
                class="size-full object-cover"
                referrerpolicy="no-referrer"
              />
              <template v-else>{{ userInitial }}</template>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" class="w-56">
              <DropdownMenuLabel class="flex flex-col gap-0.5 font-normal">
                <span
                  v-if="user.displayName"
                  class="truncate text-sm font-medium text-foreground"
                >
                  {{ user.displayName }}
                </span>
                <span
                  v-if="user.email"
                  class="truncate text-xs text-muted-foreground"
                  >{{ user.email }}</span
                >
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem @select="logout()">
                <LogOut />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            v-else-if="firebaseConfigured"
            size="sm"
            class="h-8 rounded-full px-3.5 text-xs"
            :disabled="signingIn"
            @click="onSignIn"
          >
            {{ signingIn ? "Signing in…" : "Sign in" }}
          </Button>
        </div>
      </div>
    </header>

    <main
      class="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 pt-6 pb-[calc(6rem+env(safe-area-inset-bottom))] sm:px-5 sm:pt-10 sm:pb-16"
    >
      <slot />
    </main>

    <nav
      class="fixed inset-x-0 bottom-0 z-20 border-t border-border/50 bg-background/65 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl sm:hidden"
      aria-label="Main"
    >
      <div class="mx-auto grid h-16 max-w-md grid-cols-4">
        <NuxtLink
          v-for="item in navItems"
          :key="item.to"
          :to="item.to"
          class="flex touch-manipulation flex-col items-center justify-center gap-1 text-[0.7rem] font-medium transition-colors"
          :class="
            route.path === item.to ? 'text-foreground' : 'text-muted-foreground'
          "
        >
          <span
            class="grid h-7 w-12 place-items-center rounded-full transition-colors"
            :class="route.path === item.to ? 'bg-muted' : ''"
          >
            <component
              :is="item.icon"
              class="size-[1.15rem]"
              :stroke-width="route.path === item.to ? 2.25 : 1.75"
            />
          </span>
          {{ item.label }}
        </NuxtLink>
      </div>
    </nav>
  </div>
</template>
