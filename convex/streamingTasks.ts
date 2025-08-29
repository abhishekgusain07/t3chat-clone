import { v } from 'convex/values'
import { mutation, query } from './_generated/server'

export const create = mutation({
  args: {
    taskId: v.string(),
    threadId: v.string(),
    model: v.string(),
    systemPrompt: v.optional(v.string()),
    temperature: v.optional(v.float64()),
    maxTokens: v.optional(v.number()),
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

    // Verify thread ownership
    const thread = await ctx.db
      .query('threads')
      .withIndex('by_thread_id', (q) => q.eq('threadId', args.threadId))
      .first()

    if (!thread || thread.userId !== user.authUserId) {
      throw new Error('Thread not found or unauthorized')
    }

    const now = Date.now()

    const taskId = await ctx.db.insert('streamingTasks', {
      taskId: args.taskId,
      threadId: args.threadId,
      userId: user.authUserId,
      status: 'initializing',
      model: args.model,
      systemPrompt: args.systemPrompt,
      temperature: args.temperature,
      maxTokens: args.maxTokens,
      accumulatedTokens: [],
      currentTokenIndex: 0,
      startedAt: now,
      isContinued: false,
    })

    return { id: taskId, taskId: args.taskId }
  },
})

export const updateStatus = mutation({
  args: {
    taskId: v.string(),
    status: v.union(
      v.literal('initializing'),
      v.literal('streaming'),
      v.literal('completed'),
      v.literal('failed'),
      v.literal('disconnected')
    ),
    error: v.optional(
      v.object({
        message: v.string(),
        code: v.string(),
        retryable: v.boolean(),
      })
    ),
  },
  handler: async (ctx, args) => {
    const task = await ctx.db
      .query('streamingTasks')
      .withIndex('by_task_id', (q) => q.eq('taskId', args.taskId))
      .first()

    if (!task) {
      throw new Error('Streaming task not found')
    }

    const updates: any = {
      status: args.status,
      lastClientSeenAt: Date.now(),
    }

    if (args.status === 'completed') {
      updates.completedAt = Date.now()
    }

    if (args.error) {
      updates.error = args.error
    }

    await ctx.db.patch(task._id, updates)

    return { success: true }
  },
})

export const appendToken = mutation({
  args: {
    taskId: v.string(),
    token: v.string(),
  },
  handler: async (ctx, args) => {
    const task = await ctx.db
      .query('streamingTasks')
      .withIndex('by_task_id', (q) => q.eq('taskId', args.taskId))
      .first()

    if (!task) {
      throw new Error('Streaming task not found')
    }

    const updatedTokens = [...task.accumulatedTokens, args.token]

    await ctx.db.patch(task._id, {
      accumulatedTokens: updatedTokens,
      currentTokenIndex: updatedTokens.length,
      lastTokenAt: Date.now(),
      lastClientSeenAt: Date.now(),
    })

    return {
      success: true,
      tokenIndex: updatedTokens.length - 1,
      totalTokens: updatedTokens.length,
    }
  },
})

export const getByTaskId = query({
  args: { taskId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('streamingTasks')
      .withIndex('by_task_id', (q) => q.eq('taskId', args.taskId))
      .first()
  },
})

export const getActiveByUser = query({
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
      .query('streamingTasks')
      .withIndex('by_user_active', (q) =>
        q.eq('userId', user.authUserId).eq('status', 'streaming')
      )
      .collect()
  },
})

export const cleanup = mutation({
  args: { olderThanMinutes: v.number() },
  handler: async (ctx, args) => {
    const cutoff = Date.now() - args.olderThanMinutes * 60 * 1000

    const oldTasks = await ctx.db
      .query('streamingTasks')
      .filter((q) => q.lt(q.field('startedAt'), cutoff))
      .collect()

    for (const task of oldTasks) {
      await ctx.db.delete(task._id)
    }

    return { cleaned: oldTasks.length }
  },
})
