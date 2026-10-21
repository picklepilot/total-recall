const MAX_EDGE = 1600
const JPEG_QUALITY = 0.85

/**
 * Resize a picked photo so Storage holds a JPEG instead of a full camera original.
 * Throws when the browser cannot decode the file (some HEIC photos).
 */
export async function prepareThingImage(file: File): Promise<Blob> {
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    throw new Error('This image could not be read. Try a JPEG or PNG.')
  }
  try {
    const longest = Math.max(bitmap.width, bitmap.height) || 1
    const scale = Math.min(1, MAX_EDGE / longest)
    const width = Math.max(1, Math.round(bitmap.width * scale))
    const height = Math.max(1, Math.round(bitmap.height * scale))
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Could not prepare the image.')
    ctx.drawImage(bitmap, 0, 0, width, height)
    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY)
    })
    if (!blob) throw new Error('Could not prepare the image.')
    return blob
  } finally {
    bitmap.close()
  }
}
