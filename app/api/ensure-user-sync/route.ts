import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { syncUserToConvex } from '@/lib/convex-sync'

export async function POST() {
  try {
    // Get current session
    const session = await auth.api.getSession({
      headers: await headers(),
    })

    if (!session?.user) {
      return new Response(JSON.stringify({ error: 'No session found' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Sync user to Convex (this will create or update the user)
    console.log(`🔄 Ensuring user ${session.user.id} exists in Convex...`)

    const syncResult = await syncUserToConvex({
      id: session.user.id,
      name: session.user.name,
      email: session.user.email,
      emailVerified: session.user.emailVerified,
      image: session.user.image,
      isAnonymous:
        (session.user as { isAnonymous?: boolean }).isAnonymous || false,
      createdAt: new Date(session.user.createdAt),
      updatedAt: new Date(session.user.updatedAt),
    })

    if (syncResult) {
      console.log(`✅ User sync result: ${syncResult.action}`)
      return new Response(
        JSON.stringify({
          success: true,
          action: syncResult.action,
          userId: syncResult.userId,
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    } else {
      console.error('❌ Failed to sync user to Convex')
      return new Response(
        JSON.stringify({
          error: 'Failed to sync user',
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    }
  } catch (error) {
    console.error('❌ Error in ensure-user-sync:', error)
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }
}
