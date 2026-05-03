import { getFirestore } from 'firebase-admin/firestore'
import { applyEmbeddingToEntryDoc } from '../../utils/applyEntryEmbedding'

interface Body {
  entryId?: string
}

export default defineEventHandler(async (event) => {
  const user = await requireVerifiedUser(event)
  const uid = user.uid

  const config = useRuntimeConfig(event)
  const key = config.geminiApiKey
  if (!key) {
    throw createError({
      statusCode: 503,
      statusMessage: 'NUXT_GEMINI_API_KEY is required to compute embeddings for vector search.',
    })
  }

  const body = await readBody<Body>(event)
  const entryId = body.entryId?.trim()
  if (!entryId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing entryId' })
  }

  const db = getFirestore()
  const ref = db.collection('entries').doc(entryId)
  const snap = await ref.get()
  if (!snap.exists) {
    throw createError({ statusCode: 404, statusMessage: 'Entry not found' })
  }

  const result = await applyEmbeddingToEntryDoc(snap, key, uid)
  if (result === 'forbidden') {
    throw createError({ statusCode: 403, statusMessage: 'Not your entry' })
  }
  if (result === 'skipped') {
    throw createError({ statusCode: 400, statusMessage: 'Nothing to embed for this entry' })
  }

  return { ok: true }
})
