// https://nuxt.com/docs/api/configuration/nuxt-config
import tailwindcss from '@tailwindcss/vite'

export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },

  app: {
    head: {
      title: 'Total Recall',
      meta: [
        {
          name: 'description',
          content: 'A minimal log for links and thoughts, with a timeline and AI over your own entries.',
        },
      ],
      script: [
        {
          key: 'theme-init',
          innerHTML: `(function(){try{var k='total-recall-color-scheme';var s=localStorage.getItem(k);var d=s==='dark'||((s===null||s==='auto')&&window.matchMedia('(prefers-color-scheme: dark)').matches);if(d)document.documentElement.classList.add('dark');}catch(e){}})();`,
        },
      ],
    },
  },

  css: ['~/assets/css/tailwind.css'],

  vite: {
    plugins: [tailwindcss()],
  },

  modules: ['shadcn-nuxt'],

  shadcn: {
    prefix: '',
    componentDir: '@/components/ui',
  },

  runtimeConfig: {
    /** Full JSON of the Firebase service account (private key). Used to verify ID tokens on the server. */
    firebaseServiceAccountJson: '',
    /** Comma-separated emails allowed to use the app (Google sign-in). If empty, any signed-in Google user is allowed. */
    allowedAuthEmails: '',
    geminiApiKey: '',
    public: {
      firebaseApiKey: '',
      firebaseAuthDomain: '',
      firebaseProjectId: '',
      firebaseStorageBucket: '',
      firebaseMessagingSenderId: '',
      firebaseAppId: '',
    },
  },
})
