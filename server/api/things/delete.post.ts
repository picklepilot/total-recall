import { FieldValue, getFirestore } from 'firebase-admin/firestore'
import { getStorage } from 'firebase-admin/storage'

interface Body {
  thingId?: string
}

function ownedCoverPath(uid: string, thingId: string, imagePath: unknown): string | null {
  if (typeof imagePath !== 'string' || !imagePath) return null
  const prefix = `users/${uid}/things/${thingId}/`
  return imagePath.startsWith(prefix) ? imagePath : null
}

/**
 * Removes a thing, its cover, and every entry link to it.
 * Entry embeddings are refreshed by the client from the returned ids.
 */
export default defineEventHandler(async (event) => {
  const user = await requireVerifiedUser(event)
  const uid = user.uid

  const body = await readBody<Body>(event)
  const thingId = body.thingId?.trim()
  if (!thingId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing thingId' })
  }

  const db = getFirestore()
  const ref = db.collection('things').doc(thingId)
  const snap = await ref.get()
  if (!snap.exists) {
    throw createError({ statusCode: 404, statusMessage: 'Thing not found' })
  }
  const data = snap.data()!
  if (data.userId !== uid) {
    throw createError({ statusCode: 403, statusMessage: 'Not your thing' })
  }

  const linked = await db
    .collection('entries')
    .where('userId', '==', uid)
    .where('thingIds', 'array-contains', thingId)
    .get()

  const entryIds = linked.docs.map((doc) => doc.id)
  for (let i = 0; i < linked.docs.length; i += 400) {
    const chunk = linked.docs.slice(i, i + 400)
    const batch = db.batch()
    for (const entry of chunk) {
      const ids = Array.isArray(entry.get('thingIds'))
        ? (entry.get('thingIds') as unknown[]).filter((id) => id !== thingId)
        : []
      batch.update(entry.ref, {
        thingIds: ids.length ? ids : FieldValue.delete(),
      })
    }
    await batch.commit()
  }

  await ref.delete()

  const imagePath = ownedCoverPath(uid, thingId, data.imagePath)
  const bucketName = String(useRuntimeConfig(event).public.firebaseStorageBucket ?? '')
  if (imagePath && bucketName) {
    try {
      await getStorage().bucket(bucketName).file(imagePath).delete({ ignoreNotFound: true })
    } catch (e) {
      console.warn('[total-recall] could not delete thing cover:', e)
    }
  }

  return { ok: true, entryIds }
})