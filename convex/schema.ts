import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'

export default defineSchema({
  users: defineTable({
    // Better Auth user fields (DO NOT MODIFY - managed by webhook)
    authUserId: v.string(), // Maps to Better Auth user.id
    name: v.string(),
    email: v.string(),
    emailVerified: v.boolean(),
    image: v.optional(v.string()),
    // Timestamps
    authCreatedAt: v.number(), // Store as timestamp for Better Auth compatibility
    authUpdatedAt: v.number(),
  })
    .index('by_auth_user_id', ['authUserId'])
    .index('by_email', ['email']),

  // User preferences and customization
  userPreferences: defineTable({
    userId: v.string(), // References users.authUserId

    // Customization fields (from settings page)
    displayName: v.optional(v.string()), // "What should T3 Chat call you?"
    occupation: v.optional(v.string()), // "What do you do?"
    traits: v.optional(v.array(v.string())), // personality traits
    additionalContext: v.optional(v.string()), // "Anything else T3 Chat should know?"

    // Behavior options
    disableExternalLinkWarning: v.boolean(),
    invertSendBehavior: v.boolean(), // Enter vs Shift+Enter

    // Visual options
    boringTheme: v.boolean(), // Disable pink theme
    hidePersonalInfo: v.boolean(), // Hide name/email from UI
    disableThematicBreaks: v.boolean(), // Disable horizontal lines
    statsForNerds: v.boolean(), // Show token stats
    mainTextFont: v.optional(v.string()),
    codeFont: v.optional(v.string()),

    // Model preferences
    currentlySelectedModel: v.string(), // Default model
    enabledModels: v.array(v.string()), // Models shown in selector

    // Keyboard shortcuts (customizable)
    shortcuts: v.object({
      search: v.string(), // Default: "cmd+k"
      newChat: v.string(), // Default: "cmd+shift+o"
      toggleSidebar: v.string(), // Default: "cmd+b"
    }),

    // Other preferences
    emailReceipts: v.boolean(), // Billing preferences
    latestTOSAcceptance: v.optional(v.number()),

    createdAt: v.number(),
    updatedAt: v.number(),
  }).index('by_user', ['userId']),

  // Thread management
  threads: defineTable({
    threadId: v.string(), // UUID
    userId: v.string(), // References users.authUserId
    title: v.string(),
    model: v.string(), // Model used for this thread

    // Generation status - CRITICAL for streaming state
    generationStatus: v.union(
      v.literal('idle'),
      v.literal('generating'), // Shows spinner in sidebar
      v.literal('completed'),
      v.literal('failed'),
      v.literal('cancelled')
    ),

    // SSE streaming task reference
    activeTaskId: v.optional(v.string()), // References streamingTasks._id

    // Metadata
    lastMessageAt: v.number(),
    pinned: v.boolean(),
    visibility: v.union(
      v.literal('visible'),
      v.literal('archived'),
      v.literal('deleted')
    ),
    branchParent: v.optional(v.string()), // For conversation branching
    userSetTitle: v.boolean(),

    // Token tracking
    totalTokensUsed: v.number(),
    messageCount: v.number(),

    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_user', ['userId'])
    .index('by_user_visible', ['userId', 'visibility'])
    .index('by_thread_id', ['threadId'])
    .index('by_generation_status', ['userId', 'generationStatus']),

  // Messages in threads
  messages: defineTable({
    threadId: v.string(),
    userId: v.string(),
    role: v.union(
      v.literal('user'),
      v.literal('assistant'),
      v.literal('system')
    ),

    // Content storage for streaming
    content: v.string(), // Final complete content
    streamingContent: v.optional(v.array(v.string())), // Tokens as they arrive

    // Streaming metadata - CRITICAL
    isStreaming: v.boolean(),
    streamingTaskId: v.optional(v.string()), // References streamingTasks._id

    // Usage stats (from SSE 'e:' message)
    usage: v.optional(
      v.object({
        promptTokens: v.number(),
        completionTokens: v.number(),
        totalTokens: v.number(),
      })
    ),

    // Finish reason (from SSE)
    finishReason: v.optional(
      v.union(
        v.literal('stop'),
        v.literal('length'),
        v.literal('content_filter'),
        v.literal('error')
      )
    ),

    model: v.optional(v.string()), // Model used for this message
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_thread', ['threadId', 'createdAt'])
    .index('by_streaming_task', ['streamingTaskId']),

  // SSE Streaming Tasks - Tracks Edge Function streaming jobs
  streamingTasks: defineTable({
    taskId: v.string(), // Unique task ID (e.g., "msg-eMoPJrYA2cldCgCrR4K8ZseW")
    threadId: v.string(),
    userId: v.string(),
    messageId: v.optional(v.id('messages')), // Created after first token

    // Streaming state
    status: v.union(
      v.literal('initializing'),
      v.literal('streaming'),
      v.literal('completed'),
      v.literal('failed'),
      v.literal('disconnected') // Client disconnected but task continues
    ),

    // Model configuration
    model: v.string(),
    systemPrompt: v.optional(v.string()),
    temperature: v.optional(v.float64()),
    maxTokens: v.optional(v.number()),

    // Token accumulation
    accumulatedTokens: v.array(v.string()), // All tokens received
    currentTokenIndex: v.number(), // For resumption

    // Error handling
    error: v.optional(
      v.object({
        message: v.string(),
        code: v.string(),
        retryable: v.boolean(),
      })
    ),

    // Timing
    startedAt: v.number(),
    lastTokenAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),

    // Connection tracking
    lastClientSeenAt: v.optional(v.number()), // Last time client was connected
    isContinued: v.boolean(), // If this continues a previous message
  })
    .index('by_task_id', ['taskId'])
    .index('by_thread', ['threadId'])
    .index('by_status', ['status'])
    .index('by_user_active', ['userId', 'status']),

  // Rate limiting
  rateLimits: defineTable({
    userId: v.string(),
    convexSessionId: v.string(),

    // Tier-based limits
    standard: v.object({
      remaining: v.number(),
      used: v.number(),
      max: v.number(), // 20 for free, more for paid
    }),
    premium: v.object({
      remaining: v.number(),
      used: v.number(),
      max: v.number(), // 1500 for pro tier
    }),
    purchased: v.object({
      remaining: v.number(),
      used: v.number(),
      max: v.number(), // Additional credits
    }),

    // Reset timing
    resetsAt: v.string(), // ISO 8601
    periodStart: v.number(),

    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_user', ['userId'])
    .index('by_session', ['convexSessionId']),

  // WebSocket sessions (for Convex real-time, not AI streaming)
  sessions: defineTable({
    sessionId: v.string(), // convex-session-id
    userId: v.string(),
    status: v.union(
      v.literal('active'),
      v.literal('idle'),
      v.literal('disconnected')
    ),
    connectionMode: v.union(
      v.literal('ws'), // WebSocket
      v.literal('lp') // Long polling fallback
    ),
    lastPingAt: v.number(),
    createdAt: v.number(),
    expiresAt: v.number(),
  })
    .index('by_session_id', ['sessionId'])
    .index('by_user', ['userId'])
    .index('by_expiry', ['expiresAt']),

  // User subscriptions
  subscriptions: defineTable({
    userId: v.string(),
    tier: v.union(v.literal('Free'), v.literal('Pro'), v.literal('Enterprise')),

    // Subscription details
    status: v.union(
      v.literal('active'),
      v.literal('trialing'),
      v.literal('cancelled'),
      v.literal('expired')
    ),

    // Payment info
    stripeCustomerId: v.optional(v.string()),
    stripeSubscriptionId: v.optional(v.string()),
    stripePriceId: v.optional(v.string()), // $8/month price ID

    // Billing cycle
    currentPeriodStart: v.number(),
    currentPeriodEnd: v.number(),
    cancelAtPeriodEnd: v.boolean(),

    // Credit tracking
    additionalCredits: v.number(), // $8 per 100 credits
    creditsUsedThisPeriod: v.number(),

    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_user', ['userId'])
    .index('by_stripe_customer', ['stripeCustomerId']),

  // Message history export/import
  messageHistory: defineTable({
    userId: v.string(),

    // Export records
    exportId: v.string(),
    exportFormat: v.union(
      v.literal('json'),
      v.literal('csv'),
      v.literal('markdown')
    ),
    exportedThreads: v.array(v.string()), // Thread IDs included
    exportedAt: v.number(),

    // Import records
    importId: v.optional(v.string()),
    importedFrom: v.optional(v.string()), // Source identifier
    importedAt: v.optional(v.number()),

    // File storage
    storageId: v.optional(v.string()), // Convex storage reference
    fileSize: v.number(),

    createdAt: v.number(),
  })
    .index('by_user', ['userId'])
    .index('by_export_id', ['exportId']),

  // Model availability and features
  availableModels: defineTable({
    modelId: v.string(), // e.g., "deepseek-v3.1"
    provider: v.string(), // "DeepSeek", "OpenAI", "Anthropic"
    displayName: v.string(), // "DeepSeek v3.1"
    description: v.string(),

    // Model capabilities
    contextLength: v.number(), // e.g., 671B parameters
    maxOutputTokens: v.number(),
    supportsVision: v.boolean(),
    supportsTools: v.boolean(),
    supportsContinuation: v.boolean(),

    // Tier requirements
    requiredTier: v.union(
      v.literal('Free'),
      v.literal('Pro'),
      v.literal('Enterprise')
    ),

    // Feature flags
    isThinking: v.boolean(), // Shows thinking indicator
    isReasoning: v.boolean(), // Special reasoning mode
    isBeta: v.boolean(),
    isNew: v.boolean(), // Show "NEW" badge

    // Cost tracking
    creditsPerMessage: v.number(), // How many credits it uses

    // Availability
    enabled: v.boolean(),
    deprecatedAt: v.optional(v.number()),

    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_provider', ['provider'])
    .index('by_tier', ['requiredTier'])
    .index('by_enabled', ['enabled']),

  // API Keys (Pro feature)
  apiKeys: defineTable({
    userId: v.string(),
    keyId: v.string(),

    // Encrypted storage
    encryptedKey: v.string(), // Encrypted API key
    keyHint: v.string(), // Last 4 characters for display

    // Provider info
    provider: v.string(), // "openai", "anthropic", etc.
    modelAccess: v.array(v.string()), // Which models this key enables

    // Validation
    isValid: v.boolean(),
    lastValidatedAt: v.optional(v.number()),
    validationError: v.optional(v.string()),

    // Usage tracking
    requestCount: v.number(),
    lastUsedAt: v.optional(v.number()),

    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_user', ['userId'])
    .index('by_key_id', ['keyId']),
})
