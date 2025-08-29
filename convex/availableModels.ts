import { v } from 'convex/values'
import { mutation, query } from './_generated/server'

export const getAll = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query('availableModels')
      .withIndex('by_enabled', (q) => q.eq('enabled', true))
      .collect()
  },
})

export const getByTier = query({
  args: {
    tier: v.union(v.literal('Free'), v.literal('Pro'), v.literal('Enterprise')),
  },
  handler: async (ctx, args) => {
    const models = await ctx.db
      .query('availableModels')
      .withIndex('by_enabled', (q) => q.eq('enabled', true))
      .collect()

    // Filter models based on tier hierarchy
    return models.filter((model) => {
      if (args.tier === 'Enterprise') return true
      if (args.tier === 'Pro') return model.requiredTier !== 'Enterprise'
      return model.requiredTier === 'Free'
    })
  },
})

export const seed = mutation({
  args: {},
  handler: async (ctx) => {
    // Check if models already exist
    const existing = await ctx.db.query('availableModels').first()
    if (existing) {
      return { message: 'Models already seeded' }
    }

    const now = Date.now()
    const defaultModels = [
      {
        modelId: 'gpt-4o',
        provider: 'OpenAI',
        displayName: 'GPT-4o',
        description: 'Most capable GPT-4 model with vision support',
        contextLength: 128000,
        maxOutputTokens: 4096,
        supportsVision: true,
        supportsTools: true,
        supportsContinuation: true,
        requiredTier: 'Free' as const,
        isThinking: false,
        isReasoning: false,
        isBeta: false,
        isNew: false,
        creditsPerMessage: 2,
        enabled: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        modelId: 'gpt-4o-mini',
        provider: 'OpenAI',
        displayName: 'GPT-4o Mini',
        description: 'Fast and efficient GPT-4 model',
        contextLength: 128000,
        maxOutputTokens: 16384,
        supportsVision: true,
        supportsTools: true,
        supportsContinuation: true,
        requiredTier: 'Free' as const,
        isThinking: false,
        isReasoning: false,
        isBeta: false,
        isNew: false,
        creditsPerMessage: 1,
        enabled: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        modelId: 'claude-3-5-sonnet-20241022',
        provider: 'Anthropic',
        displayName: 'Claude 3.5 Sonnet',
        description: "Anthropic's most capable model",
        contextLength: 200000,
        maxOutputTokens: 8192,
        supportsVision: true,
        supportsTools: true,
        supportsContinuation: true,
        requiredTier: 'Pro' as const,
        isThinking: false,
        isReasoning: false,
        isBeta: false,
        isNew: false,
        creditsPerMessage: 3,
        enabled: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        modelId: 'gemini-2.0-flash-exp',
        provider: 'Google',
        displayName: 'Gemini 2.0 Flash',
        description: "Google's latest experimental model",
        contextLength: 1000000,
        maxOutputTokens: 8192,
        supportsVision: true,
        supportsTools: true,
        supportsContinuation: true,
        requiredTier: 'Pro' as const,
        isThinking: false,
        isReasoning: false,
        isBeta: true,
        isNew: true,
        creditsPerMessage: 3,
        enabled: true,
        createdAt: now,
        updatedAt: now,
      },
    ]

    for (const model of defaultModels) {
      await ctx.db.insert('availableModels', model)
    }

    return { message: `Seeded ${defaultModels.length} models` }
  },
})
