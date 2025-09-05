import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { nanoid } from 'nanoid'

export const create = mutation({
  args: {
    threadId: v.optional(v.string()),
    title: v.string(),
    model: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new Error('Unauthorized')
    }

    const user = await ctx.db
      .query('users')
      .withIndex('by_auth_user_id', (q) => q.eq('authUserId', identity.subject))
      .first()

    if (!user) {
      throw new Error('User not found in Convex')
    }

    const threadId = args.threadId || nanoid()
    const now = Date.now()

    const thread = await ctx.db.insert('threads', {
      threadId,
      userId: user.authUserId,
      title: args.title,
      model: args.model,
      generationStatus: 'idle',
      lastMessageAt: now,
      pinned: false,
      visibility: 'visible',
      userSetTitle: false,
      totalTokensUsed: 0,
      messageCount: 0,
      createdAt: now,
      updatedAt: now,
    })

    return { id: thread, threadId }
  },
})

export const getByUser = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      return []
    }

    const user = await ctx.db
      .query('users')
      .withIndex('by_auth_user_id', (q) => q.eq('authUserId', identity.subject))
      .first()

    if (!user) {
      return []
    }

    return await ctx.db
      .query('threads')
      .withIndex('by_user_visible', (q) =>
        q.eq('userId', user.authUserId).eq('visibility', 'visible')
      )
      .order('desc')
      .collect()
  },
})

export const getById = query({
  args: { threadId: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      return null
    }

    const user = await ctx.db
      .query('users')
      .withIndex('by_auth_user_id', (q) => q.eq('authUserId', identity.subject))
      .first()

    if (!user) {
      return null
    }

    const thread = await ctx.db
      .query('threads')
      .withIndex('by_thread_id', (q) => q.eq('threadId', args.threadId))
      .first()

    if (!thread || thread.userId !== user.authUserId) {
      return null
    }

    return thread
  },
})

export const updateStatus = mutation({
  args: {
    threadId: v.string(),
    status: v.union(
      v.literal('idle'),
      v.literal('generating'),
      v.literal('completed'),
      v.literal('failed'),
      v.literal('cancelled')
    ),
    activeTaskId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new Error('Unauthorized')
    }

    const user = await ctx.db
      .query('users')
      .withIndex('by_auth_user_id', (q) => q.eq('authUserId', identity.subject))
      .first()

    if (!user) {
      throw new Error('User not found')
    }

    const thread = await ctx.db
      .query('threads')
      .withIndex('by_thread_id', (q) => q.eq('threadId', args.threadId))
      .first()

    if (!thread || thread.userId !== user.authUserId) {
      throw new Error('Thread not found or unauthorized')
    }

    await ctx.db.patch(thread._id, {
      generationStatus: args.status,
      activeTaskId: args.activeTaskId,
      updatedAt: Date.now(),
    })

    return { success: true }
  },
})

export const updateTitle = mutation({
  args: {
    threadId: v.string(),
    title: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new Error('Unauthorized')
    }

    const user = await ctx.db
      .query('users')
      .withIndex('by_auth_user_id', (q) => q.eq('authUserId', identity.subject))
      .first()

    if (!user) {
      throw new Error('User not found')
    }

    const thread = await ctx.db
      .query('threads')
      .withIndex('by_thread_id', (q) => q.eq('threadId', args.threadId))
      .first()

    if (!thread || thread.userId !== user.authUserId) {
      throw new Error('Thread not found or unauthorized')
    }

    await ctx.db.patch(thread._id, {
      title: args.title,
      userSetTitle: true,
      updatedAt: Date.now(),
    })

    return { success: true }
  },
})
