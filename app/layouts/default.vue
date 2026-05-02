<script setup lang="ts">
import { Moon, Sun } from 'lucide-vue-next'
import { useDark } from '@vueuse/core'

const route = useRoute()
const nuxtApp = useNuxtApp()
const { user, signedIn, signInWithGoogle, logout } = useAuth()

const firebaseConfigured = computed(() => Boolean(nuxtApp.$firebaseReady))

const isDark = useDark({ storageKey: 'total-recall-color-scheme' })

function toggleColorMode() {
  isDark.value = !isDark.value
}

const signingIn = ref(false)
async function onSignIn() {
  signingIn.value = true
  try {
    await signInWithGoogle()
  } catch (e) {
    console.error(e)
  } finally {
    signingIn.value = false
  }
}
</script>

<template>
  <div class="min-h-screen bg-background text-foreground">
    <header
      class="sticky top-0 z-10 border-b border-border/60 bg-background/80 backdrop-blur-md"
    >
      <div class="mx-auto flex h-14 max-w-3xl items-center justify-between gap-3 px-5">
        <NuxtLink
          to="/"
          class="text-sm font-semibold tracking-tight text-foreground"
        >
          Total Recall
        </NuxtLink>
        <nav class="flex flex-1 items-center justify-end gap-4 sm:gap-6">
          <div class="flex items-center gap-4 text-sm text-muted-foreground sm:gap-6">
            <NuxtLink
              to="/"
              class="transition-colors hover:text-foreground"
              :class="route.path === '/' ? 'text-foreground font-medium' : ''"
            >
              Add
            </NuxtLink>
            <NuxtLink
              to="/timeline"
              class="transition-colors hover:text-foreground"
              :class="route.path === '/timeline' ? 'text-foreground font-medium' : ''"
            >
              Timeline
            </NuxtLink>
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            class="shrink-0 text-muted-foreground hover:text-foreground"
            :aria-label="isDark ? 'Switch to light mode' : 'Switch to dark mode'"
            @click="toggleColorMode"
          >
            <Sun v-if="isDark" class="size-4" />
            <Moon v-else class="size-4" />
          </Button>
          <div class="flex items-center gap-2">
            <template v-if="firebaseConfigured && signedIn && user">
              <span class="hidden max-w-[140px] truncate text-xs text-muted-foreground sm:inline">
                {{ user.email }}
              </span>
              <Button variant="outline" size="sm" class="h-8 rounded-md text-xs" @click="logout()">
                Sign out
              </Button>
            </template>
            <Button
              v-else-if="firebaseConfigured"
              size="sm"
              class="h-8 rounded-md text-xs"
              :disabled="signingIn"
              @click="onSignIn"
            >
              {{ signingIn ? '…' : 'Sign in with Google' }}
            </Button>
          </div>
        </nav>
      </div>
    </header>
    <main class="mx-auto max-w-3xl px-5 py-10">
      <slot />
    </main>
  </div>
</template>
