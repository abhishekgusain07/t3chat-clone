import { NextRequest, NextResponse } from 'next/server'
import { RateLimitService } from '@/lib/rate-limiting/service'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { z } from 'zod'

const usageRequestSchema = z.object({
  action: z.enum(['message', 'search', 'research', 'file_upload']),
  amount: z.number().min(1).default(1),
  metadata: z.optional(
    z.object({
      model: z.optional(z.string()),
      sessionId: z.optional(z.string()),
      actualTokens: z.optional(z.number()),
      tools: z.optional(z.array(z.string())),
      threadId: z.optional(z.string()),
    })
  ),
})

export async function POST(req: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    })

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const validatedBody = usageRequestSchema.parse(body)

    await RateLimitService.incrementUsage(
      session.user.id,
      validatedBody.action,
      validatedBody.amount,
      validatedBody.metadata
    )

    return NextResponse.json({
      success: true,
      message: 'Usage updated successfully',
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request body', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Usage tracking error:', error)
    return NextResponse.json(
      { error: 'Failed to update usage' },
      { status: 500 }
    )
  }
}
