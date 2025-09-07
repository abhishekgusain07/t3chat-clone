import { v } from 'convex/values'
import { mutation, query } from './_generated/server'

export const get = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    // For now, bypass Convex auth and use the passed userId
    // TODO: Fix Convex auth configuration for anonymous users

    const user = await ctx.db
      .query('users')
      .withIndex('by_auth_user_id', (q) => q.eq('authUserId', args.userId))
      .first()

    if (!user) {
      return null
    }

    const preferences = await ctx.db
      .query('userPreferences')
      .withIndex('by_user', (q) => q.eq('userId', args.userId))
      .first()

    return preferences
  },
})

export const createOrUpdate = mutation({
  args: {
    userId: v.string(), // Pass user ID from client
    displayName: v.optional(v.string()),
    occupation: v.optional(v.string()),
    traits: v.optional(v.array(v.string())),
    additionalContext: v.optional(v.string()),
    disableExternalLinkWarning: v.optional(v.boolean()),
    invertSendBehavior: v.optional(v.boolean()),
    boringTheme: v.optional(v.boolean()),
    hidePersonalInfo: v.optional(v.boolean()),
    disableThematicBreaks: v.optional(v.boolean()),
    statsForNerds: v.optional(v.boolean()),
    mainTextFont: v.optional(v.string()),
    codeFont: v.optional(v.string()),
    currentlySelectedModel: v.optional(v.string()),
    enabledModels: v.optional(v.array(v.string())),
    shortcuts: v.optional(
      v.object({
        search: v.string(),
        newChat: v.string(),
        toggleSidebar: v.string(),
      })
    ),
    emailReceipts: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    // For now, bypass Convex auth and use the passed userId
    // TODO: Fix Convex auth configuration for anonymous users

    const { userId, ...updateFields } = args

    const user = await ctx.db
      .query('users')
      .withIndex('by_auth_user_id', (q) => q.eq('authUserId', userId))
      .first()

    if (!user) {
      throw new Error('User not found')
    }

    const existing = await ctx.db
      .query('userPreferences')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .first()

    const now = Date.now()
    const updateData = { ...updateFields, updatedAt: now }

    if (existing) {
      await ctx.db.patch(existing._id, updateData)
      return { id: existing._id }
    } else {
      const newPreferences = {
        userId: userId,
        // Defaults
        disableExternalLinkWarning: false,
        invertSendBehavior: false,
        boringTheme: false,
        hidePersonalInfo: false,
        disableThematicBreaks: false,
        statsForNerds: false,
        currentlySelectedModel: 'gpt-4o',
        enabledModels: ['gpt-4o', 'gpt-4o-mini'],
        shortcuts: {
          search: 'cmd+k',
          newChat: 'cmd+shift+o',
          toggleSidebar: 'cmd+b',
        },
        emailReceipts: true,
        createdAt: now,
        ...updateData,
      }

      const id = await ctx.db.insert('userPreferences', newPreferences)
      return { id }
    }
  },
})

export const updateEnabledModels = mutation({
  args: {
    userId: v.string(), // Pass user ID from client
    enabledModels: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    // For now, bypass Convex auth and use the passed userId
    // TODO: Fix Convex auth configuration for anonymous users

    const user = await ctx.db
      .query('users')
      .withIndex('by_auth_user_id', (q) => q.eq('authUserId', args.userId))
      .first()

    if (!user) {
      throw new Error('User not found')
    }

    const preferences = await ctx.db
      .query('userPreferences')
      .withIndex('by_user', (q) => q.eq('userId', args.userId))
      .first()

    if (!preferences) {
      throw new Error('User preferences not found')
    }

    await ctx.db.patch(preferences._id, {
      enabledModels: args.enabledModels,
      updatedAt: Date.now(),
    })

    return { success: true }
  },
})
