import { getFirestore, type QueryDocumentSnapshot } from 'firebase-admin/firestore'
import { applyEmbeddingToEntryDoc } from '../../utils/applyEntryEmbedding'

/** Total entry processing attempts per button click (one HTTP request). */
const MAX_OPS = 50
const PAGE_SIZE = 100
const MAX_PAGES = 25
/** Stay under Gemini free-tier embed RPM (~100/min); single-threaded reindex bursts otherwise 429. */
const PACE_BEFORE_EMBED_MS = 700

interface Body {
  force?: boolean
}

function needsEmbedding(data: Record<string, unknown>, force: boolean): boolean {
  if (force) return true
  return !('embedding' in data) || data.embedding == null
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

  const body = await readBody<Body>(event).catch(() => ({}))
  const force = Boolean(body?.force)

  const db = getFirestore()

  let indexed = 0
  let skipped = 0
  let failed = 0
  let totalOps = 0
  let lastSnap: QueryDocumentSnapshot | undefined
  let pages = 0
  let lastPageWasFull = false
  let firstError: string | undefined

  outer: while (totalOps < MAX_OPS && pages < MAX_PAGES) {
    pages++
    let q = db
      .collection('entries')
      .where('userId', '==', uid)
      .orderBy('createdAt', 'desc')
      .limit(PAGE_SIZE)

    if (lastSnap) {
      q = q.startAfter(lastSnap)
    }

    const snap = await q.get()
    if (snap.empty) break

    lastPageWasFull = snap.docs.length === PAGE_SIZE
    lastSnap = snap.docs[snap.docs.length - 1]

    const candidates = snap.docs.filter((d) =>
      needsEmbedding(d.data() as Record<string, unknown>, force),
    )

    for (const doc of candidates) {
      if (totalOps >= MAX_OPS) break outer
      totalOps++

      try {
        const r = await applyEmbeddingToEntryDoc(doc, key, uid, {
          paceBeforeEmbedMs: PACE_BEFORE_EMBED_MS,
        })
        if (r === 'indexed') indexed++
        else if (r === 'skipped') skipped++
        else if (r === 'forbidden') failed++
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        if (!firstError) firstError = msg.slice(0, 500)
        console.warn('[total-recall] reindex entry failed', doc.id, e)
        failed++
      }
    }

    if (!lastPageWasFull) break
  }

  const hasMore = totalOps >= MAX_OPS && lastPageWasFull

  return {
    indexed,
    skipped,
    failed,
    /** Run again to continue (same `force` if you used it). */
    hasMore,
    /** First error message in this run (for debugging API / Firestore issues). */
    firstError,
  }
})
