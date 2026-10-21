import { FieldValue, getFirestore } from 'firebase-admin/firestore'
import { planThreadBackfill, THREAD_SCHEMA_VERSION } from '~~/shared/entryThreads'

const WRITE_BATCH = 400

/**
 * One-time (per schema version) write of explicit `parentId` / thread fields and
 * root `replyCount`, so the timeline can query `parentId == null`.
 */
export default defineEventHandler(async (event) => {
  const user = await requireVerifiedUser(event)
  const uid = user.uid
  const db = getFirestore()
  const metaRef = db.collection('users').doc(uid)
  const meta = await metaRef.get()
  if (meta.data()?.threadSchema === THREAD_SCHEMA_VERSION) {
    return { updated: 0, scanned: 0, skipped: true }
  }

  const snap = await db.collection('entries').where('userId', '==', uid).get()
  const docs = snap.docs.map((d) => {
    const data = d.data()
    return {
      id: d.id,
      parentId: data.parentId as string | null | undefined,
      rootId: data.rootId as string | undefined,
      ancestorIds: data.ancestorIds as string[] | undefined,
      depth: data.depth as number | undefined,
      replyCount: data.replyCount as number | undefined,
    }
  })

  const updates = [...planThreadBackfill(docs).entries()]
  for (let i = 0; i < updates.length; i += WRITE_BATCH) {
    const batch = db.batch()
    for (const [id, fields] of updates.slice(i, i + WRITE_BATCH)) {
      batch.update(db.collection('entries').doc(id), fields)
    }
    await batch.commit()
  }

  await metaRef.set(
    {
      threadSchema: THREAD_SCHEMA_VERSION,
      threadSchemaAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  )

  return { updated: updates.length, scanned: docs.length, skipped: false }
})
