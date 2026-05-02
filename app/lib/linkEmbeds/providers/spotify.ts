import type { LinkEmbedMatch } from '../types'

function stripIntlPrefix(pathname: string): string {
  return pathname.replace(/^\/intl-[a-z]{2}(?=\/|$)/i, '') || '/'
}

type SpotifyResource = 'track' | 'album' | 'playlist' | 'episode' | 'show'

function spotifyEmbed(type: SpotifyResource, id: string, canonicalUrl: string): LinkEmbedMatch {
  const embedSrc = `https://open.spotify.com/embed/${type}/${encodeURIComponent(id)}`
  const tall = type === 'album' || type === 'playlist'
  return {
    providerId: 'spotify',
    canonicalUrl,
    embedSrc,
    kind: 'audio',
    iframeTitle: `Spotify ${type} player`,
    iframeHeightPx: tall ? 352 : 152,
  }
}

/** Recognizes open.spotify.com track / album / playlist / episode / show links. */
export function tryParseSpotifyEmbed(rawUrl: string): LinkEmbedMatch | null {
  let url: URL
  try {
    url = new URL(rawUrl)
  } catch {
    return null
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
  if (!url.hostname.toLowerCase().endsWith('open.spotify.com')) return null

  let path = url.pathname.replace(/\/$/, '') || '/'
  path = stripIntlPrefix(path)

  const userPlaylist = path.match(/^\/user\/[^/]+\/playlist\/([a-zA-Z0-9]+)(?:\/|$)/)
  if (userPlaylist) {
    const id = userPlaylist[1]
    const canonicalUrl = `https://open.spotify.com/playlist/${id}`
    return spotifyEmbed('playlist', id, canonicalUrl)
  }

  const direct = path.match(/^\/(track|album|playlist|episode|show)\/([a-zA-Z0-9]+)(?:\/|$)/)
  if (!direct) return null

  const type = direct[1] as SpotifyResource
  const id = direct[2]
  const canonicalUrl = `https://open.spotify.com/${type}/${id}`

  return spotifyEmbed(type, id, canonicalUrl)
}
