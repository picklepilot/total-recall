import {
  getFirestore,
  type Firestore,
  type QueryDocumentSnapshot,
} from 'firebase-admin/firestore'
import { embedText } from './geminiEmbedding'
import { formatEntryDocForPrompt, formatThreadSnippet } from './formatEntryForPrompt'
import { loadThingNames, namesForIds, thingIdsFromEntry } from './thingNames'

const VECTOR_LIMIT = 16
const FALLBACK_LIMIT = 40
/** Nearest ancestors included per entry; keeps deep threads from flooding the prompt. */
const MAX_THREAD_ANCESTORS = 6

function ancestorIdsOf(doc: QueryDocumentSnapshot): string[] {
  const ids = doc.get('ancestorIds')
  return Array.isArray(ids) ? (ids as string[]).slice(-MAX_THREAD_ANCESTORS) : []
}

/** Formats entries with the snippets of their thread ancestors (fetched in one batch). */
async function docsToLines(
  db: Firestore,
  uid: string,
  docs: QueryDocumentSnapshot[],
): Promise<string> {
  const live = docs.filter((d) => !d.get('deleted'))
  const ancestorIds = [...new Set(live.flatMap(ancestorIdsOf))]

  const ancestors = new Map<string, Record<string, unknown>>()
  if (ancestorIds.length) {
    const snaps = await db.getAll(...ancestorIds.map((id) => db.collection('entries').doc(id)))
    for (const s of snaps) {
      const data = s.data()
      if (data && data.userId === uid) ancestors.set(s.id, data)
    }
  }

  const thingIds = live.flatMap((doc) => thingIdsFromEntry(doc.data() as Record<string, unknown>))
  const thingNames = await loadThingNames(db, uid, thingIds)

  return live
    .map((doc) => {
      const data = doc.data() as Record<string, unknown>
      const path = ancestorIdsOf(doc).map((id) => formatThreadSnippet(ancestors.get(id)))
      const names = namesForIds(thingNames, thingIdsFromEntry(data))
      return formatEntryDocForPrompt(doc.id, data, path, names)
    })
    .join('\n')
}

/**
 * Builds the “memory log” string for Ask/chat using vector search over `embedding`,
 * scoped to `uid`. Falls back to most recent entries if vectors are missing or the query fails.
 */
export async function buildMemoryContextForQuestion(
  uid: string,
  question: string,
  geminiApiKey: string,
): Promise<string> {
  const db = getFirestore()
  const trimmedQ = question.trim()
  if (!trimmedQ) {
    return await fallbackLines(db, uid)
  }

  try {
    const queryVector = await embedText(geminiApiKey, trimmedQ, 'query')
    if (!queryVector.length) {
      return await fallbackLines(db, uid)
    }

    const vectorSnap = await db
      .collection('entries')
      .where('userId', '==', uid)
      .findNearest({
        vectorField: 'embedding',
        queryVector: queryVector,
        limit: VECTOR_LIMIT,
        distanceMeasure: 'COSINE',
      })
      .get()

    if (!vectorSnap.empty) {
      return await docsToLines(db, uid, vectorSnap.docs)
    }
  } catch (e) {
    console.warn('[total-recall] vector retrieval failed, using recent entries:', e)
  }

  return await fallbackLines(db, uid)
}

async function fallbackLines(db: Firestore, uid: string): Promise<string> {
  const snap = await db
    .collection('entries')
    .where('userId', '==', uid)
    .orderBy('createdAt', 'desc')
    .limit(FALLBACK_LIMIT)
    .get()

  if (snap.empty) return ''
  return await docsToLines(db, uid, snap.docs)
}
