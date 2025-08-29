// Rate Limiting Service for T3Chat
import { db } from '@/db/drizzle'
import { rateLimits } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import type { UserTier } from './types'

/**
 * Initialize rate limits for a new user in PostgreSQL
 * Called when a user is created via Better Auth
 */
export async function initializeUserRateLimits(
  userId: string,
  isAnonymous: boolean = false
): Promise<void> {
  try {
    console.log(
      `🎯 Initializing rate limits for user: ${userId} (anonymous: ${isAnonymous})`
    )

    const userTier: UserTier = isAnonymous ? 'Anonymous' : 'Free'
    const now = new Date()
    const resetsAt = new Date(now.getTime() + 24 * 60 * 60 * 1000) // 24 hours from now

    await db.insert(rateLimits).values({
      id: nanoid(),
      userId: userId,
      creditsUsed: 0,
      searchCallsUsed: 0,
      researchCallsUsed: 0,
      fileUploadsUsed: 0,
      periodStart: now,
      resetsAt: resetsAt,
      currentTier: userTier,
      createdAt: now,
      updatedAt: now,
    })

    console.log(`✅ Rate limits initialized for ${userTier} user: ${userId}`)
  } catch (error) {
    console.error(
      `❌ Failed to initialize rate limits for user ${userId}:`,
      error
    )
    // Don't throw - user creation should succeed even if rate limit init fails
  }
}

/**
 * Get current rate limit usage for a user
 */
export async function getCurrentUsage(userId: string) {
  const usage = await db.query.rateLimits.findFirst({
    where: eq(rateLimits.userId, userId),
  })

  if (!usage) {
    console.warn(`⚠️ No rate limit record found for user: ${userId}`)
    return null
  }

  return usage
}

/**
 * Update user tier (when subscription changes)
 */
export async function updateUserTier(
  userId: string,
  newTier: UserTier
): Promise<void> {
  try {
    await db
      .update(rateLimits)
      .set({
        currentTier: newTier,
        updatedAt: new Date(),
      })
      .where(eq(rateLimits.userId, userId))

    console.log(`✅ Updated user tier to ${newTier} for user: ${userId}`)
  } catch (error) {
    console.error(`❌ Failed to update user tier for user ${userId}:`, error)
    throw error
  }
}
