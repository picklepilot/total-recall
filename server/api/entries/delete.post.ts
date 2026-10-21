import {
  FieldValue,
  getFirestore,
  type DocumentReference,
  type Transaction,
} from 'firebase-admin/firestore'

interface Body {
  entryId?: string
}

const EMPTY_DOC_JSON = JSON.stringify({ type: 'doc', content: [{ type: 'paragraph' }] })

/**
 * Deletes an entry without breaking its thread:
 * - no replies: hard delete, then remove any "[deleted]" ancestors left with no replies;
 * - has replies: keep a "[deleted]" placeholder (content and embedding cleared).
 */
export default defineEventHandler(async (event) => {
  const user = await requireVerifiedUser(event)
  const uid = user.uid

  const body = await readBody<Body>(event)
  const entryId = body.entryId?.trim()
  if (!entryId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing entryId' })
  }

  const db = getFirestore()
  const entries = db.collection('entries')

  const hasRepliesOtherThan = async (
    tx: Transaction,
    parentId: string,
    excludeId: string | null,
  ) => {
    const snap = await tx.get(
      entries.where('userId', '==', uid).where('parentId', '==', parentId).limit(2),
    )
    return snap.docs.some((d) => d.id !== excludeId)
  }

  const result = await db.runTransaction(async (tx) => {
    const ref = entries.doc(entryId)
    const snap = await tx.get(ref)
    if (!snap.exists) {
      throw createError({ statusCode: 404, statusMessage: 'Entry not found' })
    }
    const data = snap.data()!
    if (data.userId !== uid) {
      throw createError({ statusCode: 403, statusMessage: 'Not your entry' })
    }

    if (await hasRepliesOtherThan(tx, entryId, null)) {
      tx.update(ref, {
        deleted: true,
        deletedAt: FieldValue.serverTimestamp(),
        contentJson: EMPTY_DOC_JSON,
        contentText: '',
        tags: [],
        widgets: FieldValue.delete(),
        importMeta: FieldValue.delete(),
        embedding: FieldValue.delete(),
        embedModel: FieldValue.delete(),
        embeddedAt: FieldValue.delete(),
      })
      return 'tombstoned' as const
    }

    // Transactions require all reads before writes: collect deletable ancestors first.
    const toDelete: DocumentReference[] = [ref]
    let childId = entryId
    let parentId = (data.parentId as string | null | undefined) ?? null
    while (parentId) {
      const parentRef = entries.doc(parentId)
      const parentSnap = await tx.get(parentRef)
      const parent = parentSnap.data()
      if (!parent || parent.userId !== uid || !parent.deleted) break
      if (await hasRepliesOtherThan(tx, parentId, childId)) break
      toDelete.push(parentRef)
      childId = parentId
      parentId = (parent.parentId as string | null | undefined) ?? null
    }

    for (const r of toDelete) tx.delete(r)
    return 'deleted' as const
  })

  return { result }
})
