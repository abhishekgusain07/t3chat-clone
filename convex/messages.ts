import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { nanoid } from 'nanoid'

export const create = mutation({
  args: {
    threadId: v.string(),
    userId: v.string(), // Pass user ID from client
    role: v.union(
      v.literal('user'),
      v.literal('assistant'),
      v.literal('system'),
      v.literal('tool')
    ),
    content: v.string(),
    attachments: v.optional(
      v.array(
        v.object({
          type: v.literal('file'),
          url: v.string(),
          filename: v.string(),
          mediaType: v.string(),
          size: v.optional(v.number()),
        })
      )
    ),
    model: v.optional(v.string()),
    streamingTaskId: v.optional(v.string()),
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

    // Verify thread ownership
    const thread = await ctx.db
      .query('threads')
      .withIndex('by_thread_id', (q) => q.eq('threadId', args.threadId))
      .first()

    if (!thread || thread.userId !== args.userId) {
      throw new Error('Thread not found or unauthorized')
    }

    const now = Date.now()

    const messageId = await ctx.db.insert('messages', {
      threadId: args.threadId,
      userId: args.userId,
      role: args.role,
      content: args.content,
      isStreaming: !!args.streamingTaskId,
      streamingTaskId: args.streamingTaskId,
      attachments: args.attachments,
      model: args.model,
      createdAt: now,
      updatedAt: now,
    })

    // Update thread's last message time and increment message count
    await ctx.db.patch(thread._id, {
      lastMessageAt: now,
      messageCount: thread.messageCount + 1,
      updatedAt: now,
    })

    return { id: messageId }
  },
})

export const getByThread = query({
  args: { threadId: v.string(), userId: v.string() },
  handler: async (ctx, args) => {
    // For now, bypass Convex auth and use the passed userId
    // TODO: Fix Convex auth configuration for anonymous users

    const user = await ctx.db
      .query('users')
      .withIndex('by_auth_user_id', (q) => q.eq('authUserId', args.userId))
      .first()

    if (!user) {
      return []
    }

    // Verify thread access
    const thread = await ctx.db
      .query('threads')
      .withIndex('by_thread_id', (q) => q.eq('threadId', args.threadId))
      .first()

    if (!thread || thread.userId !== args.userId) {
      return []
    }

    return await ctx.db
      .query('messages')
      .withIndex('by_thread', (q) => q.eq('threadId', args.threadId))
      .order('asc')
      .collect()
  },
})

export const updateStreaming = mutation({
  args: {
    messageId: v.id('messages'),
    userId: v.string(), // Pass user ID from client
    content: v.string(),
    streamingContent: v.optional(v.array(v.string())),
    isComplete: v.boolean(),
    finishReason: v.optional(
      v.union(
        v.literal('stop'),
        v.literal('length'),
        v.literal('content_filter'),
        v.literal('error')
      )
    ),
    usage: v.optional(
      v.object({
        promptTokens: v.number(),
        completionTokens: v.number(),
        totalTokens: v.number(),
      })
    ),
  },
  handler: async (ctx, args) => {
    // For now, bypass Convex auth and use the passed userId
    // TODO: Fix Convex auth configuration for anonymous users

    const message = await ctx.db.get(args.messageId)
    if (!message) {
      throw new Error('Message not found')
    }

    // Verify ownership through thread
    const thread = await ctx.db
      .query('threads')
      .withIndex('by_thread_id', (q) => q.eq('threadId', message.threadId))
      .first()

    if (!thread || thread.userId !== args.userId) {
      throw new Error('Unauthorized')
    }

    await ctx.db.patch(args.messageId, {
      content: args.content,
      streamingContent: args.streamingContent,
      isStreaming: !args.isComplete,
      finishReason: args.finishReason,
      usage: args.usage,
      updatedAt: Date.now(),
    })

    // Update thread status if completed
    if (args.isComplete && thread.generationStatus === 'generating') {
      await ctx.db.patch(thread._id, {
        generationStatus: 'completed',
        activeTaskId: undefined,
        totalTokensUsed:
          thread.totalTokensUsed + (args.usage?.totalTokens || 0),
        updatedAt: Date.now(),
      })
    }

    return { success: true }
  },
})

export const deleteMessage = mutation({
  args: { messageId: v.id('messages'), userId: v.string() },
  handler: async (ctx, args) => {
    // For now, bypass Convex auth and use the passed userId
    // TODO: Fix Convex auth configuration for anonymous users

    const message = await ctx.db.get(args.messageId)
    if (!message) {
      throw new Error('Message not found')
    }

    // Verify ownership through thread
    const thread = await ctx.db
      .query('threads')
      .withIndex('by_thread_id', (q) => q.eq('threadId', message.threadId))
      .first()

    if (!thread || thread.userId !== args.userId) {
      throw new Error('Unauthorized')
    }

    await ctx.db.delete(args.messageId)

    // Update thread message count
    await ctx.db.patch(thread._id, {
      messageCount: Math.max(0, thread.messageCount - 1),
      updatedAt: Date.now(),
    })

    return { success: true }
  },
})
