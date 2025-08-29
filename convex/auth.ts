import { mutation } from './_generated/server'
import { v } from 'convex/values'

/**
 * Link anonymous user account to authenticated user account
 * Called when an anonymous user signs up or signs in
 * Transfers all chat data from anonymous to authenticated user
 */
export const linkAnonymousAccount = mutation({
  args: {
    anonymousUserId: v.string(),
    authenticatedUserId: v.string(),
  },
  handler: async (ctx, args) => {
    console.log(
      `🔗 Convex: Linking anonymous ${args.anonymousUserId} to authenticated ${args.authenticatedUserId}`
    )

    try {
      // 1. Transfer all threads from anonymous to authenticated user
      const anonymousThreads = await ctx.db
        .query('threads')
        .withIndex('by_user', (q) => q.eq('userId', args.anonymousUserId))
        .collect()

      console.log(`🔄 Transferring ${anonymousThreads.length} threads`)

      for (const thread of anonymousThreads) {
        await ctx.db.patch(thread._id, {
          userId: args.authenticatedUserId,
          updatedAt: Date.now(),
        })
      }

      // 2. Transfer all messages from anonymous to authenticated user
      const anonymousMessages = await ctx.db
        .query('messages')
        .filter((q) => q.eq(q.field('userId'), args.anonymousUserId))
        .collect()

      console.log(`🔄 Transferring ${anonymousMessages.length} messages`)

      for (const message of anonymousMessages) {
        await ctx.db.patch(message._id, {
          userId: args.authenticatedUserId,
          updatedAt: Date.now(),
        })
      }

      // 3. Transfer streaming tasks if any
      const streamingTasks = await ctx.db
        .query('streamingTasks')
        .filter((q) => q.eq(q.field('userId'), args.anonymousUserId))
        .collect()

      for (const task of streamingTasks) {
        await ctx.db.patch(task._id, {
          userId: args.authenticatedUserId,
        })
      }

      // 4. Handle user preferences - merge or transfer
      const anonymousPrefs = await ctx.db
        .query('userPreferences')
        .withIndex('by_user', (q) => q.eq('userId', args.anonymousUserId))
        .first()

      if (anonymousPrefs) {
        const authenticatedPrefs = await ctx.db
          .query('userPreferences')
          .withIndex('by_user', (q) => q.eq('userId', args.authenticatedUserId))
          .first()

        if (authenticatedPrefs) {
          // Authenticated user already has preferences, keep those but update timestamp
          await ctx.db.patch(authenticatedPrefs._id, {
            updatedAt: Date.now(),
          })
        } else {
          // Transfer anonymous preferences to authenticated user
          await ctx.db.patch(anonymousPrefs._id, {
            userId: args.authenticatedUserId,
            updatedAt: Date.now(),
          })
        }

        // Clean up anonymous preferences if they still exist and we didn't transfer them
        const remainingAnonymousPrefs = await ctx.db
          .query('userPreferences')
          .withIndex('by_user', (q) => q.eq('userId', args.anonymousUserId))
          .first()

        if (remainingAnonymousPrefs && authenticatedPrefs) {
          await ctx.db.delete(remainingAnonymousPrefs._id)
        }
      }

      // 5. Transfer presence records
      const presenceRecords = await ctx.db
        .query('presence')
        .withIndex('by_user', (q) => q.eq('userId', args.anonymousUserId))
        .collect()

      for (const presence of presenceRecords) {
        await ctx.db.patch(presence._id, {
          userId: args.authenticatedUserId,
          updatedAt: Date.now(),
        })
      }

      // 6. Clean up anonymous user record
      const anonymousUser = await ctx.db
        .query('users')
        .withIndex('by_auth_user_id', (q) =>
          q.eq('authUserId', args.anonymousUserId)
        )
        .first()

      if (anonymousUser) {
        await ctx.db.delete(anonymousUser._id)
      }

      console.log(
        `✅ Convex: Successfully linked anonymous account to authenticated user`
      )
      console.log(
        `📊 Transferred: ${anonymousThreads.length} threads, ${anonymousMessages.length} messages`
      )

      return {
        success: true,
        threadsTransferred: anonymousThreads.length,
        messagesTransferred: anonymousMessages.length,
      }
    } catch (error) {
      console.error(`❌ Convex: Error linking anonymous account:`, error)
      throw error
    }
  },
})
