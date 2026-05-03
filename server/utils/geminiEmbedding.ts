/**
 * Gemini embeddings for Firestore vector search (768 dims to match `firestore.indexes.json`).
 * Uses `gemini-embedding-001` with RETRIEVAL_DOCUMENT / RETRIEVAL_QUERY so indexed text and
 * search queries live in the same retrieval space.
 *
 * @see https://ai.google.dev/gemini-api/docs/embeddings
 */
const EMBEDDING_MODEL = 'gemini-embedding-001'
const OUTPUT_DIM = 768
const MAX_CHARS = 7500
const EMBED_MAX_ATTEMPTS = 6

export type EmbedPurpose = 'index' | 'query'

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

/** Parse `Retry-After` as seconds or HTTP-date (Gemini may omit this). */
function retryAfterMs(res: Response): number | undefined {
  const raw = res.headers.get('retry-after')
  if (!raw) return undefined
  const sec = Number(raw)
  if (!Number.isNaN(sec) && sec >= 0) return Math.min(120_000, sec * 1000)
  const when = Date.parse(raw)
  if (!Number.isNaN(when)) return Math.min(120_000, Math.max(0, when - Date.now()))
  return undefined
}

function taskTypeForPurpose(purpose: EmbedPurpose): string {
  return purpose === 'index' ? 'RETRIEVAL_DOCUMENT' : 'RETRIEVAL_QUERY'
}

function extractVectorValues(data: Record<string, unknown>): number[] {
  const embeddings = data.embeddings
  if (Array.isArray(embeddings) && embeddings.length > 0) {
    const first = embeddings[0] as { values?: number[] }
    if (first?.values?.length) return first.values
  }
  const single = data.embedding as { values?: number[] } | undefined
  if (single?.values?.length) return single.values
  throw new Error(
    `Unexpected embedContent response (keys: ${Object.keys(data).join(', ')}). Expected embedding.values or embeddings[0].values.`,
  )
}

/**
 * Same API key as chat (`NUXT_GEMINI_API_KEY`).
 */
export async function embedText(
  apiKey: string,
  text: string,
  purpose: EmbedPurpose,
): Promise<number[]> {
  const trimmed = text.trim().slice(0, MAX_CHARS)
  if (!trimmed) return []

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${EMBEDDING_MODEL}:embedContent?key=${encodeURIComponent(apiKey)}`

  const body: Record<string, unknown> = {
    model: `models/${EMBEDDING_MODEL}`,
    content: { parts: [{ text: trimmed }] },
    taskType: taskTypeForPurpose(purpose),
    outputDimensionality: OUTPUT_DIM,
  }

  let lastStatus = 0
  let lastErr = ''
  for (let attempt = 0; attempt < EMBED_MAX_ATTEMPTS; attempt++) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    if (res.ok) {
      const data = (await res.json()) as Record<string, unknown>
      return extractVectorValues(data)
    }

    lastStatus = res.status
    lastErr = (await res.text().catch(() => '')).slice(0, 400)
    const retryable = res.status === 429 || res.status === 503
    if (retryable && attempt < EMBED_MAX_ATTEMPTS - 1) {
      const base = retryAfterMs(res) ?? Math.min(60_000, 1000 * 2 ** attempt)
      await sleep(base)
      continue
    }
    break
  }

  throw new Error(`embedContent ${lastStatus}: ${lastErr}`)
}

/** @deprecated use `embedText(..., 'query')` */
export async function embedTextForQuery(apiKey: string, text: string): Promise<number[]> {
  return embedText(apiKey, text, 'query')
}
