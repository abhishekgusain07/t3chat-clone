import { NextRequest, NextResponse } from 'next/server'
import { RateLimitService } from '@/lib/rate-limiting/service'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'

export async function GET() {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    })

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
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
