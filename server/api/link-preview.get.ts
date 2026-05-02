import { parseLinkMetadata } from '../utils/parseLinkMetadata'

export default defineEventHandler(async (event) => {
  await requireVerifiedUser(event)

  const url = getQuery(event).url as string | undefined
  if (!url?.trim()) {
    throw createError({ statusCode: 400, statusMessage: 'Missing url' })
  }

  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    throw createError({ statusCode: 400, statusMessage: 'Invalid URL' })
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw createError({ statusCode: 400, statusMessage: 'Only http(s) URLs are allowed' })
  }

  const controller = new AbortController()
  const t = setTimeout(() => controller.abort(), 12_000)

  try {
    const res = await fetch(parsed.href, {
      signal: controller.signal,
      headers: {
        'user-agent': 'TotalRecall-LinkPreview/1.0',
        accept: 'text/html,application/xhtml+xml',
      },
    })

    if (!res.ok) {
      throw createError({
        statusCode: 502,
        statusMessage: `Origin returned ${res.status}`,
      })
    }

    const ct = res.headers.get('content-type') ?? ''
    if (!ct.includes('text/html') && !ct.includes('application/xhtml')) {
      return {
        title: parsed.hostname,
        description: null,
        image: null,
        siteName: parsed.hostname,
        url: parsed.href,
      }
    }

    const html = await res.text()
    const meta = parseLinkMetadata(html, parsed.href)
    return meta
  } catch (e) {
    if ((e as Error).name === 'AbortError') {
      throw createError({ statusCode: 504, statusMessage: 'Fetch timed out' })
    }
    throw e
  } finally {
    clearTimeout(t)
  }
})
