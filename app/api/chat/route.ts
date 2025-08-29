import { openai } from '@ai-sdk/openai'
import { streamText } from 'ai'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { RateLimitService } from '@/lib/rate-limiting/service'
import { calculateCreditCost } from '@/lib/rate-limiting/credits'
import { z } from 'zod'

const chatRequestSchema = z.object({
  messages: z.array(
    z.object({
      role: z.enum(['user', 'assistant', 'system']),
      content: z.string(),
    })
  ),
  model: z.string().default('gpt-4o'),
  threadId: z.optional(z.string()),
})

export async function POST(req: Request) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    })

    if (!session?.user) {
      return new Response('Unauthorized', { status: 401 })
    }

    const body = await req.json()
    const { messages, model, threadId } = chatRequestSchema.parse(body)

    // Estimate tokens for rate limit check
    const estimatedTokens = messages.reduce(
      (acc, msg) => acc + msg.content.length / 4,
      0
    )
    const tools = ['web_search_preview'] // Tools being used

    // Check rate limits before processing
    const rateLimitResult = await RateLimitService.checkRateLimit(
      session.user.id,
      'message',
      {
        model,
        estimatedTokens,
        tools,
      }
    )

    if (!rateLimitResult.allowed) {
      return new Response(
        JSON.stringify({
          error: rateLimitResult.reason,
          upgradeRequired: rateLimitResult.upgradeRequired,
          tierInfo: rateLimitResult.tierInfo,
        }),
        { status: 429, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const result = streamText({
      model: openai.responses(model),
      messages,
      tools: {
        web_search_preview: openai.tools.webSearchPreview(),
      },
      onFinish: async (result) => {
        // Track actual usage after completion
        const actualCredits = calculateCreditCost(
          model,
          result.usage.totalTokens,
          tools
        )

        await RateLimitService.incrementUsage(
          session.user.id,
          'message',
          actualCredits,
          {
            model,
            actualTokens: result.usage.totalTokens,
            tools,
            threadId,
          }
        )
      },
    })

    return result.toDataStreamResponse()
  } catch (error) {
    if (error instanceof z.ZodError) {
      return new Response(
        JSON.stringify({
          error: 'Invalid request body',
          details: error.errors,
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    console.error('Chat API error:', error)
    return new Response('Internal server error', { status: 500 })
  }
}
