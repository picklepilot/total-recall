import type { LinkEmbedMatch } from '../types'

const YOUTUBE_HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'music.youtube.com',
  'youtube-nocookie.com',
  'www.youtube-nocookie.com',
])

function normalizeHost(hostname: string): string {
  return hostname.replace(/^www\./, '').toLowerCase()
}

function extractVideoId(host: string, pathname: string, searchParams: URLSearchParams): string | null {
  if (host === 'youtu.be') {
    const id = pathname.split('/').filter(Boolean)[0] ?? null
    return id && /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : null
  }

  if (!YOUTUBE_HOSTS.has(host)) return null

  if (pathname.startsWith('/watch')) {
    const v = searchParams.get('v')
    return v && /^[a-zA-Z0-9_-]{11}$/.test(v) ? v : null
  }

  const embedOrShorts = pathname.match(/^\/(?:embed|shorts|live)\/([a-zA-Z0-9_-]{11})(?:\/|$)/)
  if (embedOrShorts) return embedOrShorts[1]

  return null
}

/** Recognizes common YouTube URL shapes and returns a nocookie embed URL. */
export function tryParseYoutubeEmbed(rawUrl: string): LinkEmbedMatch | null {
  let url: URL
  try {
    url = new URL(rawUrl)
  } catch {
    return null
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null

  const host = normalizeHost(url.hostname)
  const videoId = extractVideoId(host, url.pathname, url.searchParams)
  if (!videoId) return null

  const canonicalUrl = `https://www.youtube.com/watch?v=${videoId}`
  const embedSrc = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}`

  return {
    providerId: 'youtube',
    canonicalUrl,
    embedSrc,
    kind: 'video',
    iframeTitle: 'YouTube video player',
  }
}
