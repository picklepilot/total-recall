interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

interface ChatBody {
  messages: ChatMessage[]
  /** Serialized memory log — server does not read Firestore directly */
  memoryContext: string
}

export default defineEventHandler(async (event) => {
  await requireVerifiedUser(event)

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

  const memory = body.memoryContext?.trim() || '(No entries in context.)'
  const system = `You are a calm, concise personal memory assistant. The user keeps a private log of links, notes, and tags.

Rules:
- Answer ONLY using the "Memory log" section below. If the log does not contain the answer, say you do not see that in their log and suggest what they could log next time.
- Prefer recency when the question asks for "latest" or "most recent".
- Be specific: cite titles, tags, or short quotes from the log when helpful.
- Do not invent entries or URLs.

Memory log:
${memory}`

  const lastUser = [...body.messages].reverse().find((m) => m.role === 'user')
  const question = lastUser?.content ?? ''

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
