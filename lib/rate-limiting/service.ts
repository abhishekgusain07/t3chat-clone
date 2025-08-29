// Comprehensive Rate Limiting Service for T3Chat
// Reference: zeronsh/src/ai/service.ts:379-413 for validation patterns

import { db } from '@/db/drizzle'
import {
  rateLimits,
  usageLogs,
  subscription,
  user,
  temporaryUpgrades,
} from '@/db/schema'
import { eq, and, gte, lte, sql } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import { calculateCreditCost } from './credits'
import {
  UserTier,
  RateLimitAction,
  RateLimitResult,
  RateLimitMetadata,
  RateLimitUsage,
  TIER_LIMITS,
  RATE_LIMIT_PERIOD_HOURS,
  RATE_LIMIT_RESET_BUFFER_MINUTES,
  RateLimitError,
  UsageType,
} from './types'

/**
 * Comprehensive Rate Limit Service
 * Handles validation, usage tracking, and tier management
 */
export class RateLimitService {
  /**
   * Check if user can perform an action within their rate limits
   * Handles edge cases: expired periods, tier changes, temporary upgrades
   */
  static async checkRateLimit(
    userId: string,
    action: RateLimitAction,
    metadata?: RateLimitMetadata
  ): Promise<RateLimitResult> {
    try {
      // 1. Get user's current tier (check for temporary upgrades first)
      const userTier = await this.getUserTier(userId)
      const limits = TIER_LIMITS[userTier]

      // 2. Get current usage, handle expired periods
      let usage = await this.getCurrentUsage(userId)

      if (!usage) {
        // Initialize rate limits if they don't exist
        await this.initializeUserRateLimits(userId, userTier === 'Anonymous')
        usage = await this.getCurrentUsage(userId)
      }

      if (!usage) {
        throw new RateLimitError(
          'Failed to initialize rate limits',
          'INIT_FAILED'
        )
      }

      // 3. Check if rate limit period has expired
      if (usage.resetsAt <= new Date()) {
        console.log(
          `🔄 Rate limit period expired for user ${userId}, resetting`
        )
        await this.resetRateLimits(userId)
        usage = await this.getCurrentUsage(userId)
      }

      // 4. Validate the specific action
      return await this.validateAction(action, usage!, limits, metadata)
    } catch (error) {
      console.error(`❌ Rate limit check failed for user ${userId}:`, error)

      if (error instanceof RateLimitError) {
        throw error
      }

      // Default to blocked on unexpected errors
      return {
        allowed: false,
        reason: 'Rate limit service unavailable',
      }
    }
  }

  /**
   * Validate specific action against usage and limits
   */
  private static async validateAction(
    action: RateLimitAction,
    usage: RateLimitUsage,
    limits: typeof TIER_LIMITS.Free,
    metadata?: RateLimitMetadata
  ): Promise<RateLimitResult> {
    switch (action) {
      case 'message':
        return this.validateMessageAction(usage, limits, metadata)

      case 'search':
        return this.validateSearchAction(usage, limits)

      case 'research':
        return this.validateResearchAction(usage, limits)

      case 'file_upload':
        return this.validateFileUploadAction(usage, limits, metadata)

      default:
        return { allowed: false, reason: 'Unknown action' }
    }
  }

  /**
   * Validate AI message requests with credit calculation
   */
  private static validateMessageAction(
    usage: RateLimitUsage,
    limits: typeof TIER_LIMITS.Free,
    metadata?: RateLimitMetadata
  ): RateLimitResult {
    const requiredCredits = metadata?.model
      ? calculateCreditCost(
          metadata.model,
          metadata.estimatedTokens || 1000,
          metadata.tools || []
        )
      : 1

    const remainingCredits = Math.max(0, limits.CREDITS - usage.creditsUsed)

    if (usage.creditsUsed + requiredCredits > limits.CREDITS) {
      return {
        allowed: false,
        reason: 'Credit limit exceeded',
        remainingCredits,
        resetsAt: usage.resetsAt,
        upgradeRequired: limits.CREDITS < TIER_LIMITS.Pro.CREDITS,
        tierInfo: {
          current: usage.currentTier,
          recommended: this.getRecommendedTier(usage.currentTier),
        },
      }
    }

    return {
      allowed: true,
      creditsRequired: requiredCredits,
      remainingCredits: remainingCredits - requiredCredits,
      tierInfo: {
        current: usage.currentTier,
      },
    }
  }

  /**
   * Validate search tool requests
   */
  private static validateSearchAction(
    usage: RateLimitUsage,
    limits: typeof TIER_LIMITS.Free
  ): RateLimitResult {
    const remainingCalls = Math.max(0, limits.SEARCH - usage.searchCallsUsed)

    if (usage.searchCallsUsed >= limits.SEARCH) {
      return {
        allowed: false,
        reason: 'Search limit exceeded',
        remainingCalls: 0,
        resetsAt: usage.resetsAt,
        upgradeRequired: limits.SEARCH < TIER_LIMITS.Pro.SEARCH,
        tierInfo: {
          current: usage.currentTier,
          recommended: this.getRecommendedTier(usage.currentTier),
        },
      }
    }

    return {
      allowed: true,
      remainingCalls: remainingCalls - 1,
      tierInfo: {
        current: usage.currentTier,
      },
    }
  }

  /**
   * Validate research tool requests (Pro+ feature)
   */
  private static validateResearchAction(
    usage: RateLimitUsage,
    limits: typeof TIER_LIMITS.Free
  ): RateLimitResult {
    // Research requires Pro subscription
    if (limits.RESEARCH === 0) {
      return {
        allowed: false,
        reason: 'Research requires Pro subscription',
        upgradeRequired: true,
        tierInfo: {
          current: usage.currentTier,
          recommended: 'Pro',
        },
      }
    }

    const remainingCalls = Math.max(
      0,
      limits.RESEARCH - usage.researchCallsUsed
    )

    if (usage.researchCallsUsed >= limits.RESEARCH) {
      return {
        allowed: false,
        reason: 'Research limit exceeded',
        remainingCalls: 0,
        resetsAt: usage.resetsAt,
        upgradeRequired: false,
        tierInfo: {
          current: usage.currentTier,
        },
      }
    }

    return {
      allowed: true,
      remainingCalls: remainingCalls - 1,
      tierInfo: {
        current: usage.currentTier,
      },
    }
  }

  /**
   * Validate file upload requests with size limits
   */
  private static validateFileUploadAction(
    usage: RateLimitUsage,
    limits: typeof TIER_LIMITS.Free,
    metadata?: RateLimitMetadata
  ): RateLimitResult {
    const remainingUploads = Math.max(
      0,
      limits.FILE_UPLOADS - usage.fileUploadsUsed
    )

    // Check file size limits (Pro users get larger files)
    if (metadata?.fileSize) {
      const maxFileSize =
        usage.currentTier === 'Pro' || usage.currentTier === 'Enterprise'
          ? 50 * 1024 * 1024 // 50MB for Pro+
          : 10 * 1024 * 1024 // 10MB for Free/Anonymous

      if (metadata.fileSize > maxFileSize) {
        return {
          allowed: false,
          reason: `File too large (max ${maxFileSize / 1024 / 1024}MB)`,
          upgradeRequired:
            usage.currentTier !== 'Pro' && usage.currentTier !== 'Enterprise',
          tierInfo: {
            current: usage.currentTier,
            recommended: 'Pro',
          },
        }
      }
    }

    if (usage.fileUploadsUsed >= limits.FILE_UPLOADS) {
      return {
        allowed: false,
        reason: 'File upload limit exceeded',
        remainingUploads: 0,
        resetsAt: usage.resetsAt,
        upgradeRequired: limits.FILE_UPLOADS < TIER_LIMITS.Pro.FILE_UPLOADS,
        tierInfo: {
          current: usage.currentTier,
          recommended: this.getRecommendedTier(usage.currentTier),
        },
      }
    }

    return {
      allowed: true,
      remainingUploads: remainingUploads - 1,
      tierInfo: {
        current: usage.currentTier,
      },
    }
  }

  /**
   * Increment usage after successful action
   * Handles database transactions and error recovery
   */
  static async incrementUsage(
    userId: string,
    action: RateLimitAction,
    amount: number = 1,
    metadata?: {
      model?: string
      sessionId?: string
      actualTokens?: number
      tools?: string[]
    }
  ): Promise<void> {
    const usageField = this.getUsageField(action)

    try {
      // Start transaction-like operation
      await db.transaction(async (tx) => {
        // 1. Increment the specific usage field
        await tx
          .update(rateLimits)
          .set({
            [usageField]: sql`${rateLimits[usageField]} + ${amount}`,
            updatedAt: new Date(),
          })
          .where(eq(rateLimits.userId, userId))

        // 2. Log the usage for analytics
        await this.logUsage(userId, action as UsageType, amount, true, metadata)
      })

      console.log(
        `✅ Incremented ${action} usage by ${amount} for user ${userId}`
      )
    } catch (error) {
      console.error(
        `❌ Failed to increment ${action} usage for user ${userId}:`,
        error
      )

      // Log failed usage attempt
      await this.logUsage(userId, action as UsageType, amount, false, {
        ...metadata,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      })

      throw new RateLimitError('Failed to update usage', 'UPDATE_FAILED')
    }
  }

  /**
   * Reset rate limits for expired period
   */
  private static async resetRateLimits(userId: string): Promise<void> {
    const now = new Date()
    const resetsAt = new Date(
      now.getTime() +
        RATE_LIMIT_PERIOD_HOURS * 60 * 60 * 1000 +
        RATE_LIMIT_RESET_BUFFER_MINUTES * 60 * 1000
    )

    await db
      .update(rateLimits)
      .set({
        creditsUsed: 0,
        searchCallsUsed: 0,
        researchCallsUsed: 0,
        fileUploadsUsed: 0,
        periodStart: now,
        resetsAt,
        updatedAt: now,
      })
      .where(eq(rateLimits.userId, userId))

    console.log(
      `🔄 Reset rate limits for user ${userId}, new period: ${resetsAt}`
    )
  }

  /**
   * Get user's current tier, considering temporary upgrades
   */
  static async getUserTier(userId: string): Promise<UserTier> {
    // 1. Check for temporary upgrades first
    const tempUpgrade = await db
      .select()
      .from(temporaryUpgrades)
      .where(
        and(
          eq(temporaryUpgrades.userId, userId),
          gte(temporaryUpgrades.expiresAt, new Date())
        )
      )
      .limit(1)

    if (tempUpgrade[0]) {
      return tempUpgrade[0].tier as UserTier
    }

    // 2. Check subscription status
    const activeSubscription = await db
      .select()
      .from(subscription)
      .where(
        and(
          eq(subscription.userId, userId),
          eq(subscription.status, 'active'),
          gte(subscription.currentPeriodEnd, new Date())
        )
      )
      .limit(1)

    if (activeSubscription[0]) {
      return 'Pro' // Active subscription = Pro tier
    }

    // 3. Check if anonymous user
    const userRecord = await db
      .select({ isAnonymous: user.isAnonymous })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1)

    if (userRecord[0]?.isAnonymous) {
      return 'Anonymous'
    }

    // 4. Default to Free tier
    return 'Free'
  }

  /**
   * Get current usage with proper typing
   */
  static async getCurrentUsage(userId: string): Promise<RateLimitUsage | null> {
    const usage = await db
      .select()
      .from(rateLimits)
      .where(eq(rateLimits.userId, userId))
      .limit(1)

    if (!usage[0]) {
      return null
    }

    const record = usage[0]
    return {
      creditsUsed: record.creditsUsed || 0,
      searchCallsUsed: record.searchCallsUsed || 0,
      researchCallsUsed: record.researchCallsUsed || 0,
      fileUploadsUsed: record.fileUploadsUsed || 0,
      currentTier: record.currentTier as UserTier,
      periodStart: record.periodStart,
      resetsAt: record.resetsAt,
    }
  }

  /**
   * Initialize rate limits for new user
   */
  static async initializeUserRateLimits(
    userId: string,
    isAnonymous: boolean = false
  ): Promise<void> {
    const userTier: UserTier = isAnonymous ? 'Anonymous' : 'Free'
    const now = new Date()
    const resetsAt = new Date(
      now.getTime() +
        RATE_LIMIT_PERIOD_HOURS * 60 * 60 * 1000 +
        RATE_LIMIT_RESET_BUFFER_MINUTES * 60 * 1000
    )

    await db.insert(rateLimits).values({
      id: nanoid(),
      userId,
      creditsUsed: 0,
      searchCallsUsed: 0,
      researchCallsUsed: 0,
      fileUploadsUsed: 0,
      periodStart: now,
      resetsAt,
      currentTier: userTier,
      createdAt: now,
      updatedAt: now,
    })

    console.log(`✅ Rate limits initialized for ${userTier} user: ${userId}`)
  }

  /**
   * Update user tier when subscription changes
   */
  static async updateUserTier(
    userId: string,
    newTier: UserTier
  ): Promise<void> {
    await db
      .update(rateLimits)
      .set({
        currentTier: newTier,
        updatedAt: new Date(),
      })
      .where(eq(rateLimits.userId, userId))

    console.log(`✅ Updated user tier to ${newTier} for user: ${userId}`)
  }

  /**
   * Log usage for analytics and debugging
   */
  private static async logUsage(
    userId: string,
    usageType: UsageType,
    creditsConsumed: number,
    success: boolean,
    metadata?: any
  ): Promise<void> {
    try {
      await db.insert(usageLogs).values({
        id: nanoid(),
        userId,
        usageType,
        creditsConsumed,
        modelUsed: metadata?.model,
        tokensUsed: metadata?.actualTokens,
        success,
        threadId: metadata?.threadId,
        sessionId: metadata?.sessionId,
        createdAt: new Date(),
      })
    } catch (error) {
      console.error('Failed to log usage:', error)
      // Don't throw - logging failure shouldn't break the main flow
    }
  }

  /**
   * Get database field name for usage type
   */
  private static getUsageField(
    action: RateLimitAction
  ): keyof typeof rateLimits.$inferInsert {
    const fieldMap = {
      message: 'creditsUsed' as const,
      search: 'searchCallsUsed' as const,
      research: 'researchCallsUsed' as const,
      file_upload: 'fileUploadsUsed' as const,
    }

    return fieldMap[action]
  }

  /**
   * Get recommended tier for upgrade prompts
   */
  private static getRecommendedTier(
    currentTier: UserTier
  ): UserTier | undefined {
    const upgradeMap = {
      Anonymous: 'Free' as const,
      Free: 'Pro' as const,
      Pro: 'Enterprise' as const,
      Enterprise: undefined,
    }

    return upgradeMap[currentTier]
  }
}

// Legacy exports for backward compatibility
export const initializeUserRateLimits =
  RateLimitService.initializeUserRateLimits
export const getCurrentUsage = RateLimitService.getCurrentUsage
export const updateUserTier = RateLimitService.updateUserTier
