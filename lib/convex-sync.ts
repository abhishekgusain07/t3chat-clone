import { ConvexHttpClient } from 'convex/browser'
import { api } from '../convex/_generated/api'
import { initializeUserRateLimits } from './rate-limiting/service'

interface BetterAuthUser {
  id: string
  name: string
  email: string
  emailVerified: boolean
  image?: string | null
  isAnonymous?: boolean
  createdAt: Date
  updatedAt: Date
}

interface ConvexSyncResponse {
  success: boolean
  action: string
  userId: string
}

const convexClient = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!)

export async function syncUserToConvex(
  user: BetterAuthUser
): Promise<ConvexSyncResponse | null> {
  try {
    console.log(
      `🔄 Syncing user to Convex: ${user.email} (anonymous: ${user.isAnonymous})`
    )

    const result = await convexClient.mutation(api.users.syncUser, {
      authUserId: user.id,
      name: user.name,
      email: user.email,
      emailVerified: user.emailVerified,
      image: user.image || undefined,
      authCreatedAt: user.createdAt.getTime(),
      authUpdatedAt: user.updatedAt.getTime(),
    })

    console.log(
      `✅ Successfully synced user to Convex: ${result.action} user ${user.email}`
    )

    // If this is a new user, initialize rate limits in PostgreSQL
    if (result.action === 'created') {
      console.log(`🎯 Initializing rate limits for new user: ${user.email}`)
      await initializeUserRateLimits(user.id, user.isAnonymous || false)
    }

    return {
      ...result,
      userId: result.userId.toString(),
    }
  } catch (error) {
    console.error('❌ Error syncing user to Convex:', error)
    return null
  }
}
