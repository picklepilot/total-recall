import {
  FieldValue,
  type DocumentSnapshot,
  type QueryDocumentSnapshot,
} from 'firebase-admin/firestore'
import { embedText } from './geminiEmbedding'

export function buildEmbedSource(data: Record<string, unknown>): string {
  const tags = (Array.isArray(data.tags) ? data.tags : []) as string[]
  const parts = [
    tags.join(' '),
    String(data.contentText ?? ''),
    String(data.url ?? ''),
    (data.linkPreview as { title?: string; description?: string } | null)?.title ?? '',
    (data.linkPreview as { title?: string; description?: string } | null)?.description ?? '',
  ]
  return parts.filter(Boolean).join('\n').trim().slice(0, 7500)
}

type EntryDocSnap = QueryDocumentSnapshot | DocumentSnapshot

/**
 * Computes an embedding and writes `embedding` (+ metadata) on the document.
 */
export async function applyEmbeddingToEntryDoc(
  doc: EntryDocSnap,
  geminiApiKey: string,
  ownerUid: string,
): Promise<'indexed' | 'skipped' | 'forbidden'> {
  const data = doc.data() as Record<string, unknown> | undefined
  if (!data) return 'skipped'
  if (data.userId !== ownerUid) return 'forbidden'

  const source = buildEmbedSource(data)
  if (!source) return 'skipped'

  const vector = await embedText(geminiApiKey, source, 'index')

  await doc.ref.update({
    embedding: FieldValue.vector(vector),
    embedModel: 'gemini-embedding-001',
    embeddedAt: FieldValue.serverTimestamp(),
  })

  return 'indexed'
}
