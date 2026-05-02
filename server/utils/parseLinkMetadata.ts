function decodeEntities(raw: string) {
  return raw
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#x27;/g, "'")
}

function pickMeta(html: string, key: 'property' | 'name', value: string): string | null {
  const esc = value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const re1 = new RegExp(
    `<meta[^>]+${key}=["']${esc}["'][^>]+content=["']([^"']+)["'][^>]*>`,
    'i',
  )
  const re2 = new RegExp(
    `<meta[^>]+content=["']([^"']+)["'][^>]+${key}=["']${esc}["'][^>]*>`,
    'i',
  )
  const m = html.match(re1) || html.match(re2)
  return m ? decodeEntities(m[1]) : null
}

function pickTitle(html: string): string | null {
  const og = pickMeta(html, 'property', 'og:title')
  if (og) return og
  const tw = pickMeta(html, 'name', 'twitter:title')
  if (tw) return tw
  const m = html.match(/<title[^>]*>([^<]+)<\/title>/i)
  return m ? decodeEntities(m[1].trim()) : null
}

function absolutize(base: string, maybeRelative: string | null): string | null {
  if (!maybeRelative) return null
  try {
    return new URL(maybeRelative, base).href
  } catch {
    return maybeRelative
  }
}

export function parseLinkMetadata(html: string, pageUrl: string) {
  const title = pickTitle(html)
  const description =
    pickMeta(html, 'property', 'og:description') ||
    pickMeta(html, 'name', 'twitter:description') ||
    pickMeta(html, 'name', 'description')
  const imageRaw =
    pickMeta(html, 'property', 'og:image') || pickMeta(html, 'name', 'twitter:image')
  const siteName = pickMeta(html, 'property', 'og:site_name')
  const image = absolutize(pageUrl, imageRaw)

  return {
    title,
    description,
    image,
    siteName,
    url: pageUrl,
  }
}
