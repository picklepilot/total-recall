import {
  FieldValue,
  type DocumentSnapshot,
  type QueryDocumentSnapshot,
} from 'firebase-admin/firestore'
import { formatEntryWidgetsPlain } from '~~/shared/entryWidgetsPlain'
import { joinEmbedSource } from '~~/shared/thingPrompt'
import { embedText } from './geminiEmbedding'
import { loadThingNames, namesForIds, thingIdsFromEntry } from './thingNames'

export function buildEmbedSource(data: Record<string, unknown>, thingNames: string[] = []): string {
  const tags = (Array.isArray(data.tags) ? data.tags : []) as string[]
  return joinEmbedSource({
    tags,
    thingNames,
    widgetsPlain: formatEntryWidgetsPlain(data.widgets, data.url, data.linkPreview),
    contentText: String(data.contentText ?? ''),
  })
}

type EntryDocSnap = QueryDocumentSnapshot | DocumentSnapshot

export type ApplyEmbeddingOptions = {
  /** Wait this long before calling Gemini (reindex pacing for free-tier RPM). */
  paceBeforeEmbedMs?: number
}

/**
 * Computes an embedding and writes `embedding` (+ metadata) on the document.
 */
export async function applyEmbeddingToEntryDoc(
  doc: EntryDocSnap,
  geminiApiKey: string,
  ownerUid: string,
  options?: ApplyEmbeddingOptions,
): Promise<'indexed' | 'skipped' | 'forbidden'> {
  const data = doc.data() as Record<string, unknown> | undefined
  if (!data) return 'skipped'
  if (data.userId !== ownerUid) return 'forbidden'

  const thingIds = thingIdsFromEntry(data)
  const thingNameMap = thingIds.length
    ? await loadThingNames(doc.ref.firestore, ownerUid, thingIds)
    : new Map<string, string>()
  const source = buildEmbedSource(data, namesForIds(thingNameMap, thingIds))
  if (!source) return 'skipped'

  const pace = options?.paceBeforeEmbedMs ?? 0
  if (pace > 0) await new Promise((r) => setTimeout(r, pace))

  const vector = await embedText(geminiApiKey, source, 'index')

  await doc.ref.update({
    embedding: FieldValue.vector(vector),
    embedModel: 'gemini-embedding-001',
    embeddedAt: FieldValue.serverTimestamp(),
  })

  return 'indexed'
}
