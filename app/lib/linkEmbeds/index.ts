import type { LinkEmbedMatch, LinkEmbedTryParse } from './types'
import { tryParseSpotifyEmbed } from './providers/spotify'
import { tryParseYoutubeEmbed } from './providers/youtube'

const tryParseChain: LinkEmbedTryParse[] = [tryParseYoutubeEmbed, tryParseSpotifyEmbed]

/**
 * Register an additional embed detector. The first parser that returns a match
 * wins. Use `{ prepend: true }` to run before built-in YouTube / Spotify.
 */
export function registerLinkEmbedProvider(
  tryParse: LinkEmbedTryParse,
  options?: { prepend?: boolean },
): void {
  if (options?.prepend) tryParseChain.unshift(tryParse)
  else tryParseChain.push(tryParse)
}

export function parseLinkEmbed(url: string): LinkEmbedMatch | null {
  const trimmed = url.trim()
  if (!trimmed) return null
  for (const tryParse of tryParseChain) {
    const match = tryParse(trimmed)
    if (match) return match
  }
  return null
}

export type { LinkEmbedMatch, LinkEmbedKind, LinkEmbedProviderId, LinkEmbedTryParse } from './types'
export { tryParseYoutubeEmbed } from './providers/youtube'
export { tryParseSpotifyEmbed } from './providers/spotify'
