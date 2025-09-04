import { NextRequest, NextResponse } from 'next/server'
import { RateLimitService } from '@/lib/rate-limiting/service'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
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
    const session = await auth.api.getSession({
      headers: await headers(),
    })

    console.log('🔍 Rate limit check - session debug:', {
      hasSession: !!session,
      hasUser: !!session?.user,
      userId: session?.user?.id,
      isAnonymous: session?.user?.isAnonymous,
      sessionKeys: session ? Object.keys(session) : [],
      userKeys: session?.user ? Object.keys(session.user) : [],
    })

    // Handle case where session exists but user is not properly populated
    if (!session?.user?.id) {
      console.warn('⚠️ No valid user session found for rate limiting', {
        sessionExists: !!session,
        userExists: !!session?.user,
        hasUserId: !!session?.user?.id,
      })

      return NextResponse.json(
        {
          error: 'Session not found or invalid',
          code: 'SESSION_INVALID',
          details:
            'Anonymous session may still be initializing. Please try again in a moment.',
          retry: true,
        },
        { status: 401 }
      )
    }

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
