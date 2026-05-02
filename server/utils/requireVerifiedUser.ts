import { initializeApp, cert, getApps } from 'firebase-admin/app'
import type { ServiceAccount } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import type { DecodedIdToken } from 'firebase-admin/auth'
import type { H3Event } from 'h3'

function parseServiceAccount(raw: string | ServiceAccount): ServiceAccount {
  if (typeof raw === 'object' && raw !== null) return raw
  return JSON.parse(raw) as ServiceAccount
}

function ensureAdminApp(raw: string | ServiceAccount) {
  if (getApps().length) return
  const sa = parseServiceAccount(raw)
  initializeApp({ credential: cert(sa) })
}

function isServiceAccountConfigured(raw: unknown): boolean {
  if (raw == null) return false
  if (typeof raw === 'string') return Boolean(raw.trim())
  if (typeof raw === 'object' && !Array.isArray(raw))
    return Object.keys(raw as object).length > 0
  return false
}

/**
 * Verifies Firebase ID token and optional email allowlist (NUXT_ALLOWED_AUTH_EMAILS).
 */
export async function requireVerifiedUser(event: H3Event): Promise<DecodedIdToken> {
  const config = useRuntimeConfig(event)
  const raw = config.firebaseServiceAccountJson as string | ServiceAccount
  if (!isServiceAccountConfigured(raw)) {
    throw createError({
      statusCode: 503,
      statusMessage:
        'Missing NUXT_FIREBASE_SERVICE_ACCOUNT_JSON. Add your service account JSON for server-side auth.',
    })
  }

  ensureAdminApp(raw)

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
