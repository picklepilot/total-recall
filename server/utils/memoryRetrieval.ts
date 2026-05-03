import {
  getFirestore,
  type Firestore,
  type QueryDocumentSnapshot,
} from 'firebase-admin/firestore'
import { embedText } from './geminiEmbedding'
import { formatEntryDocForPrompt } from './formatEntryForPrompt'

const VECTOR_LIMIT = 16
const FALLBACK_LIMIT = 40

function docToLine(doc: QueryDocumentSnapshot): string {
  return formatEntryDocForPrompt(doc.id, doc.data() as Record<string, unknown>)
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
      const lines = vectorSnap.docs.map(docToLine)
      return lines.join('\n')
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
  return snap.docs.map(docToLine).join('\n')
}
