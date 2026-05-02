/**
 * Firebase is initialized in a client-only plugin, so `$firebaseReady` is never true
 * during SSR. Using it directly in templates causes hydration mismatches. This
 * composable keeps the first client render aligned with SSR until `onMounted`.
 */
export function useFirebaseUiReady() {
  const nuxtApp = useNuxtApp()
  const mounted = useState('firebase-ui-mounted', () => false)

  onMounted(() => {
    mounted.value = true
  })

  return computed(() => mounted.value && Boolean(nuxtApp.$firebaseReady))
}
