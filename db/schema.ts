import {
  boolean,
  integer,
  pgTable,
  text,
  timestamp,
  index,
} from 'drizzle-orm/pg-core'

// Better Auth Tables
export const user = pgTable('user', {
  id: text('id').primaryKey(),
  name: text('name'), // Nullable for anonymous users
  email: text('email').unique(), // Nullable for anonymous users, but still unique when provided
  emailVerified: boolean('emailVerified').notNull().default(false),
  image: text('image'),
  isAnonymous: boolean('is_anonymous'),
  tier: text('tier').notNull().default('Free'), // 'Anonymous', 'Free', 'Pro', 'Enterprise'
  creditsPurchased: integer('credits_purchased').notNull().default(0),
  lastSeenAt: timestamp('last_seen_at'),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
})

export const session = pgTable('session', {
  id: text('id').primaryKey(),
  expiresAt: timestamp('expiresAt').notNull(),
  token: text('token').notNull().unique(),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
  ipAddress: text('ipAddress'),
  userAgent: text('userAgent'),
  userId: text('userId')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  activeOrganizationId: text('active_organization_id'),
})

export const account = pgTable('account', {
  id: text('id').primaryKey(),
  accountId: text('account_id').notNull(),
  providerId: text('provider_id').notNull(),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  idToken: text('id_token'),
  accessTokenExpiresAt: timestamp('access_token_expires_at'),
  refreshTokenExpiresAt: timestamp('refresh_token_expires_at'),
  scope: text('scope'),
  password: text('password'),
  createdAt: timestamp('created_at').notNull(),
  updatedAt: timestamp('updated_at').notNull(),
})

export const verification = pgTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').$defaultFn(
    () => /* @__PURE__ */ new Date()
  ),
  updatedAt: timestamp('updated_at').$defaultFn(
    () => /* @__PURE__ */ new Date()
  ),
})

export const organization = pgTable('organization', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').unique(),
  logo: text('logo'),
  createdAt: timestamp('created_at').notNull(),
  metadata: text('metadata'),
})

export const member = pgTable('member', {
  id: text('id').primaryKey(),
  organizationId: text('organization_id')
    .notNull()
    .references(() => organization.id, { onDelete: 'cascade' }),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  role: text('role').default('member').notNull(),
  createdAt: timestamp('created_at').notNull(),
})

export const invitation = pgTable('invitation', {
  id: text('id').primaryKey(),
  organizationId: text('organization_id')
    .notNull()
    .references(() => organization.id, { onDelete: 'cascade' }),
  email: text('email').notNull(),
  role: text('role'),
  status: text('status').default('pending').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  inviterId: text('inviter_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
})

export const jwks = pgTable('jwks', {
  id: text('id').primaryKey(),
  publicKey: text('public_key').notNull(),
  privateKey: text('private_key').notNull(),
  createdAt: timestamp('created_at').notNull(),
})

// Subscription table for Polar webhook data
export const subscription = pgTable('subscription', {
  id: text('id').primaryKey(),
  createdAt: timestamp('createdAt').notNull(),
  modifiedAt: timestamp('modifiedAt'),
  amount: integer('amount').notNull(),
  currency: text('currency').notNull(),
  recurringInterval: text('recurringInterval').notNull(),
  status: text('status').notNull(),
  currentPeriodStart: timestamp('currentPeriodStart').notNull(),
  currentPeriodEnd: timestamp('currentPeriodEnd').notNull(),
  cancelAtPeriodEnd: boolean('cancelAtPeriodEnd').notNull().default(false),
  canceledAt: timestamp('canceledAt'),
  startedAt: timestamp('startedAt').notNull(),
  endsAt: timestamp('endsAt'),
  endedAt: timestamp('endedAt'),
  customerId: text('customerId').notNull(),
  productId: text('productId').notNull(),
  discountId: text('discountId'),
  checkoutId: text('checkoutId').notNull(),
  customerCancellationReason: text('customerCancellationReason'),
  customerCancellationComment: text('customerCancellationComment'),
  metadata: text('metadata'), // JSON string
  customFieldData: text('customFieldData'), // JSON string
  userId: text('userId').references(() => user.id),
})

// Rate Limiting Tables for T3Chat AI Features
export const rateLimits = pgTable(
  'rate_limits',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),

    // Credit tracking by usage type
    creditsUsed: integer('credits_used').notNull().default(0),
    searchCallsUsed: integer('search_calls_used').notNull().default(0),
    researchCallsUsed: integer('research_calls_used').notNull().default(0),
    fileUploadsUsed: integer('file_uploads_used').notNull().default(0),

    // Reset timing (24-hour rolling window)
    periodStart: timestamp('period_start').notNull().defaultNow(),
    resetsAt: timestamp('resets_at').notNull(),

    // Tier-specific tracking
    currentTier: text('current_tier').notNull().default('Free'),

    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    userResetsIdx: index('idx_rate_limits_user_resets').on(
      table.userId,
      table.resetsAt
    ),
    tierIdx: index('idx_rate_limits_tier').on(table.currentTier),
  })
)

// Usage Tracking for Analytics and Billing
export const usageLogs = pgTable(
  'usage_logs',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),

    // Usage type and details
    usageType: text('usage_type').notNull(), // 'message', 'search', 'research', 'file_upload', 'bonus_credits'
    modelUsed: text('model_used'),
    creditsConsumed: integer('credits_consumed').notNull().default(0),

    // Request details
    tokensUsed: integer('tokens_used'),
    requestDurationMs: integer('request_duration_ms'),
    success: boolean('success').notNull().default(true),

    // Context
    threadId: text('thread_id'), // References Convex thread
    sessionId: text('session_id'),

    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => ({
    userCreatedIdx: index('idx_usage_logs_user_created').on(
      table.userId,
      table.createdAt
    ),
    typeCreatedIdx: index('idx_usage_logs_type_created').on(
      table.usageType,
      table.createdAt
    ),
  })
)

// API Keys for Pro Users (Own AI Provider Keys)
export const apiKeys = pgTable(
  'api_keys',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),

    // Key management
    keyName: text('key_name').notNull(),
    provider: text('provider').notNull(), // 'openai', 'anthropic', 'google', 'deepseek'
    encryptedKey: text('encrypted_key').notNull(),
    keyHint: text('key_hint').notNull(), // Last 4 chars for display

    // Validation status
    isValid: boolean('is_valid').notNull().default(false),
    lastValidatedAt: timestamp('last_validated_at'),
    validationError: text('validation_error'),

    // Usage tracking
    requestCount: integer('request_count').notNull().default(0),
    lastUsedAt: timestamp('last_used_at'),

    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    userIdx: index('idx_api_keys_user').on(table.userId),
    providerIdx: index('idx_api_keys_provider').on(table.provider),
  })
)

// Temporary Upgrades for Admin Override
export const temporaryUpgrades = pgTable(
  'temporary_upgrades',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),

    // Upgrade details
    tier: text('tier').notNull(), // 'Pro', 'Enterprise'
    reason: text('reason'),

    // Timing
    expiresAt: timestamp('expires_at').notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => ({
    userExpiresIdx: index('idx_temp_upgrades_user_expires').on(
      table.userId,
      table.expiresAt
    ),
  })
)
