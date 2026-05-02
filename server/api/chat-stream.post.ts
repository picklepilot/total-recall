import { buildLogChatSystemPrompt } from '../utils/logChatPrompt'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

interface ChatBody {
  messages: ChatMessage[]
  memoryContext: string
}

function extractTextFromGeminiChunk(raw: unknown): string {
  const data = raw as {
    candidates?: { content?: { parts?: { text?: string }[] } }[]
  }
  const parts = data.candidates?.[0]?.content?.parts
  if (!parts?.length) return ''
  return parts.map((p) => p.text ?? '').join('')
}

/** Emit only new text whether the API sends cumulative or delta chunks. */
function deltaFromChunk(accumulated: string, t: string): { delta: string; next: string } {
  if (!t) return { delta: '', next: accumulated }
  if (accumulated && t.startsWith(accumulated)) {
    return { delta: t.slice(accumulated.length), next: t }
  }
  return { delta: t, next: accumulated + t }
}

export default defineEventHandler(async (event) => {
  await requireVerifiedUser(event)

  const config = useRuntimeConfig(event)
  const key = config.geminiApiKey
  const body = await readBody<ChatBody>(event)

  if (!body?.messages?.length) {
    throw createError({ statusCode: 400, statusMessage: 'Missing messages' })
  }

  const encoder = new TextEncoder()
  const lastUser = [...body.messages].reverse().find((m) => m.role === 'user')
  const question = lastUser?.content ?? ''

  const sendSse = (obj: Record<string, unknown>) =>
    encoder.encode(`data: ${JSON.stringify(obj)}\n\n`)

  if (!key) {
    const msg =
      'Add a Gemini API key to your server environment as NUXT_GEMINI_API_KEY to enable answers. Your log is still saved in Firestore.'
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(sendSse({ t: msg }))
        controller.enqueue(sendSse({ done: true, modelUnavailable: true }))
        controller.close()
      },
    })
    setResponseHeaders(event, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    })
    return new Response(stream)
  }

  const system = buildLogChatSystemPrompt(body.memoryContext ?? '')
  const geminiUrl = new URL(
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:streamGenerateContent',
  )
  geminiUrl.searchParams.set('alt', 'sse')
  geminiUrl.searchParams.set('key', key)

  const geminiRes = await fetch(geminiUrl.toString(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
    body: JSON.stringify({
      contents: [
        {
          role: 'user',
          parts: [{ text: `${system}\n\n---\n\nQuestion: ${question}` }],
        },
      ],
    }),
  })

  if (!geminiRes.ok) {
    const errText = await geminiRes.text().catch(() => '')
    throw createError({
      statusCode: 502,
      statusMessage: `Gemini error: ${geminiRes.status} ${errText.slice(0, 200)}`,
    })
  }

  if (!geminiRes.body) {
    throw createError({ statusCode: 502, statusMessage: 'Empty stream from Gemini' })
  }

  const decoder = new TextDecoder()
  let lineBuffer = ''
  let textAccumulated = ''

  function parseGeminiSseLine(trimmed: string): string {
    if (trimmed.startsWith('data:')) return trimmed.slice(5).trim()
    if (trimmed.startsWith('{')) return trimmed
    return ''
  }

  function processPayload(payload: string, controller: ReadableStreamDefaultController<Uint8Array>) {
    if (!payload || payload === '[DONE]') return
    try {
      const json = JSON.parse(payload)
      const chunkText = extractTextFromGeminiChunk(json)
      if (!chunkText) return
      const { delta, next } = deltaFromChunk(textAccumulated, chunkText)
      textAccumulated = next
      if (delta) controller.enqueue(sendSse({ t: delta }))
    } catch {
      /* ignore malformed JSON */
    }
  }

  const outStream = new ReadableStream({
    async start(controller) {
      const reader = geminiRes.body!.getReader()
      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          lineBuffer += decoder.decode(value, { stream: true })
          const lines = lineBuffer.split('\n')
          lineBuffer = lines.pop() ?? ''
          for (const line of lines) {
            const trimmed = line.trim()
            if (!trimmed) continue
            const payload = parseGeminiSseLine(trimmed)
            if (payload) processPayload(payload, controller)
          }
        }
        lineBuffer += decoder.decode()
        for (const line of lineBuffer.split('\n')) {
          const trimmed = line.trim()
          if (!trimmed) continue
          const payload = parseGeminiSseLine(trimmed)
          if (payload) processPayload(payload, controller)
        }
      } finally {
        controller.enqueue(sendSse({ done: true }))
        controller.close()
      }
    },
  })

  setResponseHeaders(event, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  })

  return new Response(outStream)
})
