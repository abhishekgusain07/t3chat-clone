import { NextRequest, NextResponse } from 'next/server'
import { openai } from '@ai-sdk/openai'
import { streamText } from 'ai'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { RateLimitService } from '@/lib/rate-limiting/service'
import { calculateCreditCost } from '@/lib/rate-limiting/credits'
import { ConvexHttpClient } from 'convex/browser'
import { api } from '@/convex/_generated/api'
import { z } from 'zod'
import { nanoid } from 'nanoid'

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!)

const streamRequestSchema = z.object({
  messages: z.array(
    z.object({
      role: z.enum(['user', 'assistant', 'system']),
      content: z.string(),
    })
  ),
  model: z.string(),
  continueFromTaskId: z.optional(z.string()),
})

export async function POST(
  req: NextRequest,
  { params }: { params: { threadId: string } }
) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    })

    if (!session?.user) {
      return new Response('Unauthorized', { status: 401 })
    }

    const { threadId } = params
    const body = await req.json()
    const { messages, model, continueFromTaskId } =
      streamRequestSchema.parse(body)

    // Verify thread ownership
    const thread = await convex.query(api.threads.getById, { threadId })
    if (!thread) {
      return new Response('Thread not found', { status: 404 })
    }

    // Check rate limits
    const estimatedTokens = messages.reduce(
      (acc, msg) => acc + msg.content.length / 4,
      0
    )
    const rateLimitResult = await RateLimitService.checkRateLimit(
      session.user.id,
      'message',
      { model, estimatedTokens, tools: ['web_search_preview'] }
    )

    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        {
          error: rateLimitResult.reason,
          upgradeRequired: rateLimitResult.upgradeRequired,
          tierInfo: rateLimitResult.tierInfo,
        },
        { status: 429 }
      )
    }

    // Create streaming task for resumability
    const taskId = continueFromTaskId || nanoid()

    // Update thread status
    await convex.mutation(api.threads.updateStatus, {
      threadId,
      status: 'generating',
      activeTaskId: taskId,
    })

    // Create assistant message for streaming
    const assistantMessage = await convex.mutation(api.messages.create, {
      threadId,
      role: 'assistant',
      content: '',
      model,
      streamingTaskId: taskId,
    })

    // Stream AI response
    const result = streamText({
      model: openai.responses(model),
      messages,
      tools: {
        web_search_preview: openai.tools.webSearchPreview(),
      },
      onChunk: async ({ chunk }) => {
        if (chunk.type === 'text-delta') {
          // Update streaming content in Convex
          await convex.mutation(api.messages.updateStreaming, {
            messageId: assistantMessage,
            content: chunk.textDelta,
            isComplete: false,
          })
        }
      },
      onFinish: async (result) => {
        // Mark message as complete
        await convex.mutation(api.messages.updateStreaming, {
          messageId: assistantMessage,
          content: result.text,
          isComplete: true,
          finishReason: result.finishReason,
          usage: result.usage,
        })

        // Update thread status
        await convex.mutation(api.threads.updateStatus, {
          threadId,
          status: 'completed',
        })

        // Track actual usage
        const actualCredits = calculateCreditCost(
          model,
          result.usage.totalTokens,
          ['web_search_preview']
        )
        await RateLimitService.incrementUsage(
          session.user.id,
          'message',
          actualCredits,
          {
            model,
            actualTokens: result.usage.totalTokens,
            tools: ['web_search_preview'],
            threadId,
          }
        )
      },
      onError: async (error) => {
        // Mark as failed
        await convex.mutation(api.threads.updateStatus, {
          threadId,
          status: 'failed',
        })
        console.error('Streaming error:', error)
      },
    })

    return result.toDataStreamResponse()
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request body', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Stream API error:', error)
    return new Response('Internal server error', { status: 500 })
  }
}
