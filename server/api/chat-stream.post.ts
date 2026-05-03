import { runGeminiLogChatWithTools } from '../utils/geminiLogChatWithTools'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

interface ChatBody {
  messages: ChatMessage[]
  /** @deprecated Ignored — context is built server-side (vector search + fallback). */
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

  const encoder = new TextEncoder()
  const lastUser = [...body.messages].reverse().find((m) => m.role === 'user')
  const question = lastUser?.content ?? ''

  let memoryContext = ''
  if (key && question.trim()) {
    try {
      memoryContext = await buildMemoryContextForQuestion(user.uid, question, key)
    } catch (e) {
      console.warn('[total-recall] memory retrieval failed:', e)
    }
  }

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

  const outStream = new ReadableStream({
    async start(controller) {
      try {
        await runGeminiLogChatWithTools({
          apiKey: key,
          question,
          memoryContext,
          enqueue: (obj) => controller.enqueue(sendSse(obj)),
        })
      } catch (e) {
        console.warn('[total-recall] chat-stream:', e)
        const msg =
          e instanceof Error ? e.message : 'Could not complete the answer. Try again in a moment.'
        controller.enqueue(sendSse({ t: msg }))
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
