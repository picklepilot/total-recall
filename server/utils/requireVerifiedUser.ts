import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import type { DecodedIdToken } from 'firebase-admin/auth'
import type { H3Event } from 'h3'

function ensureAdminApp(serviceAccountJson: string) {
  if (getApps().length) return
  const sa = JSON.parse(serviceAccountJson)
  initializeApp({ credential: cert(sa) })
}

/**
 * Verifies Firebase ID token and optional email allowlist (NUXT_ALLOWED_AUTH_EMAILS).
 */
export async function requireVerifiedUser(event: H3Event): Promise<DecodedIdToken> {
  const config = useRuntimeConfig(event)
  const raw = config.firebaseServiceAccountJson
  if (!raw || !String(raw).trim()) {
    throw createError({
      statusCode: 503,
      statusMessage:
        'Missing NUXT_FIREBASE_SERVICE_ACCOUNT_JSON. Add your service account JSON for server-side auth.',
    })
  }

  ensureAdminApp(String(raw))

  const header = getRequestHeader(event, 'authorization')
  const m = header?.match(/^Bearer\s+(.+)$/i)
  if (!m?.[1]) {
    throw createError({ statusCode: 401, statusMessage: 'Sign in required' })
  }

  const decoded = await getAuth().verifyIdToken(m[1])

  const allowlist = String(config.allowedAuthEmails ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)

  if (allowlist.length) {
    const email = decoded.email?.toLowerCase()
    if (!email || !allowlist.includes(email)) {
      throw createError({
        statusCode: 403,
        statusMessage: 'Your account is not authorized to use this deployment.',
      })
    }
  }

  return decoded
}
