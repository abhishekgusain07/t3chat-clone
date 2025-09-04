import { NextResponse } from 'next/server'
import { RateLimitService } from '@/lib/rate-limiting/service'
import { getOrCreateSession } from '@/lib/session-utils'

export async function GET() {
  try {
    // Get or create anonymous session automatically
    const sessionResult = await getOrCreateSession()

    if (!sessionResult.success || !sessionResult.session?.user?.id) {
      console.warn(
        '⚠️ Failed to establish session for rate limiting:',
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

    console.log('🔍 Rate limit GET - session established:', {
      hasSession: !!session,
      hasUser: !!session?.user,
      userId: session?.user?.id,
      isAnonymous: (session?.user as any)?.isAnonymous ?? false,
      wasNewSession: sessionResult.isNewSession,
    })

    const usage = await RateLimitService.getCurrentUsage(session.user.id)
    const userTier = await RateLimitService.getUserTier(session.user.id)

    return NextResponse.json({
      usage,
      tier: userTier,
      success: true,
    })
  } catch (error) {
    console.error('Rate limit fetch error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch rate limits' },
      { status: 500 }
    )
  }
}
