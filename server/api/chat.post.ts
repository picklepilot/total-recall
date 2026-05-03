import { buildLogChatSystemPrompt } from '../utils/logChatPrompt'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

interface ChatBody {
  messages: ChatMessage[]
  /** @deprecated Context is built server-side from Firestore (vector search + fallback). */
  memoryContext?: string
}

export default defineEventHandler(async (event) => {
  const user = await requireVerifiedUser(event)

  const config = useRuntimeConfig(event)
  const key = config.geminiApiKey
  const body = await readBody<ChatBody>(event)

  if (!body?.messages?.length) {
    throw createError({ statusCode: 400, statusMessage: 'Missing messages' })
  }

  if (!key) {
    return {
      reply:
        'Add a Gemini API key to your server environment as NUXT_GEMINI_API_KEY to enable answers. Your log is still saved in Firestore.',
      modelUnavailable: true,
    }
  }

  const lastUser = [...body.messages].reverse().find((m) => m.role === 'user')
  const question = lastUser?.content ?? ''

  const memoryContext = await buildMemoryContextForQuestion(user.uid, question, key)
  const system = buildLogChatSystemPrompt(memoryContext)

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(key)}`

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [
        {
          role: 'user',
          parts: [{ text: `${system}\n\n---\n\nQuestion: ${question}` }],
        },
      ],
    }),
  })

  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    throw createError({
      statusCode: 502,
      statusMessage: `Gemini error: ${res.status} ${errText.slice(0, 200)}`,
    })
  }

  const data = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[]
  }
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim()
  if (!text) {
    throw createError({ statusCode: 502, statusMessage: 'Empty model response' })
  }

  return { reply: text }
})
