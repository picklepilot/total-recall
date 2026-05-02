/**
 * Identifies which provider produced the embed (for analytics, styling, copy).
 * Add new string literals as you register providers.
 */
export type LinkEmbedProviderId = 'youtube' | 'spotify' | (string & {})

export type LinkEmbedKind = 'video' | 'audio'

export interface LinkEmbedMatch {
  providerId: LinkEmbedProviderId
  /** Page URL to open in a new tab (normalized when possible). */
  canonicalUrl: string
  /** Trusted iframe URL built only from parsed IDs — never pass raw user URLs here. */
  embedSrc: string
  kind: LinkEmbedKind
  /** Short label for the iframe title attribute (accessibility). */
  iframeTitle: string
  /** When set, iframe uses this fixed height (e.g. Spotify players). */
  iframeHeightPx?: number
}

export type LinkEmbedTryParse = (url: string) => LinkEmbedMatch | null
