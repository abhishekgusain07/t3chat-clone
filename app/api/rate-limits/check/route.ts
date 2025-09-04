import { NextRequest, NextResponse } from 'next/server'
import { RateLimitService } from '@/lib/rate-limiting/service'
import { getOrCreateSession } from '@/lib/session-utils'
import { z } from 'zod'

const checkRequestSchema = z.object({
  action: z.enum(['message', 'search', 'research', 'file_upload']),
  metadata: z.optional(
    z.object({
      model: z.optional(z.string()),
      estimatedTokens: z.optional(z.number()),
      tools: z.optional(z.array(z.string())),
      fileSize: z.optional(z.number()),
    })
  ),
})

export async function POST(req: NextRequest) {
  try {
    // Get or create anonymous session automatically
    const sessionResult = await getOrCreateSession()

    if (!sessionResult.success || !sessionResult.session?.user?.id) {
      console.warn(
        '⚠️ Failed to establish session for rate limit check:',
        sessionResult.error
      )

      return NextResponse.json(
        {
          error: 'Failed to establish session',
          code: 'SESSION_CREATION_FAILED',
          details: sessionResult.error || 'Could not create anonymous session',
          retry: true,
        },
        { status: 401 }
      )
    }

    const session = sessionResult.session

    console.log('🔍 Rate limit check - session established:', {
      hasSession: !!session,
      hasUser: !!session?.user,
      userId: session?.user?.id,
      isAnonymous: (session?.user as any)?.isAnonymous ?? false,
      wasNewSession: sessionResult.isNewSession,
    })

    const body = await req.json()
    const validatedBody = checkRequestSchema.parse(body)

    const result = await RateLimitService.checkRateLimit(
      session.user.id,
      validatedBody.action,
      validatedBody.metadata
    )

    return NextResponse.json({
      ...result,
      success: true,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request body', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Rate limit check error:', error)
    return NextResponse.json(
      { error: 'Failed to check rate limits' },
      { status: 500 }
    )
  }
}
