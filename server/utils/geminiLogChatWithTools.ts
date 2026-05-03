import { buildLogChatSystemPrompt } from './logChatPrompt'
import { normalizePresentTableArgs, presentTableFunctionDeclaration } from './presentTableTool'

type GeminiPart = Record<string, unknown>

type Content = {
  role: string
  parts: GeminiPart[]
}

function partitionParts(parts: GeminiPart[] | undefined): {
  functionCalls: { name: string; args: Record<string, unknown>; id?: string }[]
  text: string
  modelParts: GeminiPart[]
} {
  const functionCalls: { name: string; args: Record<string, unknown>; id?: string }[] = []
  const modelParts: GeminiPart[] = []
  let text = ''
  for (const p of parts ?? []) {
    if (p.functionCall && typeof p.functionCall === 'object') {
      const fc = p.functionCall as Record<string, unknown>
      const name = typeof fc.name === 'string' ? fc.name : ''
      const args =
        fc.args && typeof fc.args === 'object' && !Array.isArray(fc.args)
          ? (fc.args as Record<string, unknown>)
          : {}
      const id = typeof fc.id === 'string' ? fc.id : undefined
      if (name) {
        functionCalls.push({ name, args, id })
        modelParts.push({ functionCall: p.functionCall })
      }
    }
    if (typeof p.text === 'string') text += p.text
  }
  return { functionCalls, text, modelParts }
}

function enqueueTextChunks(text: string, enqueue: (obj: Record<string, unknown>) => void) {
  const size = 56
  const trimmed = text.trimEnd()
  if (!trimmed) return
  for (let i = 0; i < trimmed.length; i += size) {
    enqueue({ t: trimmed.slice(i, i + size) })
  }
}

/**
 * Runs log Q&A with optional `present_table` tool calls, emitting SSE objects
 * (`{ ui }` for tables, `{ t }` for answer text) compatible with `/api/chat-stream`.
 */
export async function runGeminiLogChatWithTools(options: {
  apiKey: string
  question: string
  memoryContext: string
  enqueue: (obj: Record<string, unknown>) => void
}): Promise<void> {
  const { apiKey, question, memoryContext, enqueue } = options
  const system = buildLogChatSystemPrompt(memoryContext)
  const firstUserText = `${system}\n\n---\n\nQuestion: ${question}`

  const tools = [{ functionDeclarations: [presentTableFunctionDeclaration] }]

  let contents: Content[] = [{ role: 'user', parts: [{ text: firstUserText }] }]

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`

  for (let round = 0; round < 8; round++) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents,
        tools,
        toolConfig: {
          functionCallingConfig: { mode: 'AUTO' },
        },
      }),
    })

    if (!res.ok) {
      const errText = await res.text().catch(() => '')
      throw new Error(`Gemini error: ${res.status} ${errText.slice(0, 240)}`)
    }

    const data = (await res.json()) as {
      candidates?: Array<{
        content?: { parts?: GeminiPart[] }
        finishReason?: string
      }>
    }

    const cand = data.candidates?.[0]
    const parts = cand?.content?.parts
    const { functionCalls, text, modelParts } = partitionParts(parts)

    if (functionCalls.length) {
      for (const fc of functionCalls) {
        if (fc.name === 'present_table') {
          const table = normalizePresentTableArgs(fc.args)
          if (table) enqueue({ ui: table })
        }
      }

      contents.push({ role: 'model', parts: modelParts })
      contents.push({
        role: 'user',
        parts: functionCalls.map((fc) => ({
          functionResponse: {
            name: fc.name,
            ...(fc.id ? { id: fc.id } : {}),
            response: { ok: true },
          },
        })),
      })
      continue
    }

    if (text.trim()) {
      enqueueTextChunks(text, enqueue)
      return
    }

    break
  }
}
