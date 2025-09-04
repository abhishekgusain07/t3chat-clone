import { NextResponse } from 'next/server'
import { RateLimitService } from '@/lib/rate-limiting/service'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'

export async function GET() {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    })

    console.log('🔍 Rate limit GET - session debug:', {
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
