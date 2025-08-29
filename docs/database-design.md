# Database Design - Hybrid PostgreSQL + Convex Architecture

## Overview

T3Chat uses a hybrid database approach that combines PostgreSQL's reliability for critical business data with Convex's real-time capabilities for chat interactions.

## Database Separation Strategy

### PostgreSQL (via Drizzle) - Business Logic
**Location**: `t3chat/db/schema.ts`
**Responsibilities**:
- User authentication and sessions
- Subscription and billing data
- Rate limiting and usage tracking
- API key management (Pro feature)
- Audit logs and compliance data

### Convex - Chat & Real-time Data  
**Location**: `t3chat/convex/schema.ts`
**Responsibilities**:
- Chat threads and messages
- Real-time message streaming
- AI model configurations
- User preferences and settings
- File attachments and media

## Detailed Schema Design

### PostgreSQL Schema (Critical Business Data)

#### Users Table (Enhanced from existing)
```sql
-- Extends existing Better Auth user table
ALTER TABLE user ADD COLUMN tier VARCHAR(20) DEFAULT 'Free';
ALTER TABLE user ADD COLUMN credits_purchased INTEGER DEFAULT 0;
ALTER TABLE user ADD COLUMN last_seen_at TIMESTAMP;
```

#### Rate Limits Table
```sql
-- Reference: zeronsh/src/lib/constants.ts
CREATE TABLE rate_limits (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
    
    -- Credit tracking by tier
    anonymous_credits_used INTEGER DEFAULT 0,
    free_credits_used INTEGER DEFAULT 0,
    pro_credits_used INTEGER DEFAULT 0,
    
    -- Tool usage limits
    search_calls_used INTEGER DEFAULT 0,
    research_calls_used INTEGER DEFAULT 0,
    
    -- Reset timing
    period_start TIMESTAMP NOT NULL DEFAULT NOW(),
    resets_at TIMESTAMP NOT NULL,
    
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

#### Usage Tracking Table
```sql
-- Detailed usage analytics
CREATE TABLE usage_logs (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
    
    -- Usage type and details
    usage_type VARCHAR(50) NOT NULL, -- 'message', 'search', 'research', 'file_upload'
    model_used VARCHAR(100),
    credits_consumed INTEGER DEFAULT 0,
    
    -- Request details
    tokens_used INTEGER,
    request_duration_ms INTEGER,
    success BOOLEAN DEFAULT true,
    
    -- Context
    thread_id TEXT, -- References Convex thread
    session_id TEXT,
    
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_usage_logs_user_created ON usage_logs(user_id, created_at);
CREATE INDEX idx_usage_logs_type_created ON usage_logs(usage_type, created_at);
```

#### API Keys Table (Pro Feature)
```sql
-- Reference: zeronsh Pro features
CREATE TABLE api_keys (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
    
    -- Key management
    key_name VARCHAR(100) NOT NULL,
    provider VARCHAR(50) NOT NULL, -- 'openai', 'anthropic', 'google'
    encrypted_key TEXT NOT NULL,
    key_hint VARCHAR(10) NOT NULL, -- Last 4 chars for display
    
    -- Validation status
    is_valid BOOLEAN DEFAULT false,
    last_validated_at TIMESTAMP,
    validation_error TEXT,
    
    -- Usage tracking
    request_count INTEGER DEFAULT 0,
    last_used_at TIMESTAMP,
    
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_api_keys_user ON api_keys(user_id);
```

### Convex Schema (Chat & Real-time Data)

#### Enhanced Threads Table
```typescript
// Reference: zeronsh/src/database/app-schema.ts:22-36
threads: defineTable({
  threadId: v.string(), // UUID for external references
  userId: v.string(), // References PostgreSQL user.id
  title: v.string(),
  model: v.string(), // Primary model for this thread
  
  // Streaming status - CRITICAL for UI state
  generationStatus: v.union(
    v.literal('idle'),
    v.literal('generating'), // Shows loading in sidebar
    v.literal('completed'),
    v.literal('failed'),
    v.literal('cancelled')
  ),
  
  // Stream management
  activeStreamId: v.optional(v.string()),
  resumableStreamContext: v.optional(v.any()), // Stream resumption data
  
  // Thread metadata
  lastMessageAt: v.number(),
  pinned: v.boolean(),
  visibility: v.union(
    v.literal('visible'),
    v.literal('archived'), 
    v.literal('deleted')
  ),
  branchParent: v.optional(v.string()), // Conversation branching
  userSetTitle: v.boolean(), // vs auto-generated
  
  // Analytics
  totalTokensUsed: v.number(),
  messageCount: v.number(),
  
  createdAt: v.number(),
  updatedAt: v.number(),
})
.index('by_user', ['userId'])
.index('by_user_visible', ['userId', 'visibility'])
.index('by_thread_id', ['threadId'])
.index('by_generation_status', ['userId', 'generationStatus'])
```

#### Enhanced Messages Table
```typescript
// Reference: zeronsh/src/database/app-schema.ts:7-18
messages: defineTable({
  threadId: v.string(),
  userId: v.string(),
  role: v.union(
    v.literal('user'),
    v.literal('assistant'),
    v.literal('system'),
    v.literal('tool') // For tool responses
  ),
  
  // Content with streaming support
  content: v.string(), // Final complete content
  streamingContent: v.optional(v.array(v.string())), // Partial tokens
  
  // Streaming state
  isStreaming: v.boolean(),
  streamToken: v.optional(v.string()), // For stream continuation
  
  // Message metadata
  model: v.optional(v.string()),
  temperature: v.optional(v.float64()),
  maxTokens: v.optional(v.number()),
  
  // Usage statistics (from AI SDK)
  usage: v.optional(v.object({
    promptTokens: v.number(),
    completionTokens: v.number(),
    totalTokens: v.number(),
  })),
  
  // Finish reason
  finishReason: v.optional(v.union(
    v.literal('stop'),
    v.literal('length'),
    v.literal('content_filter'),
    v.literal('error')
  )),
  
  // File attachments
  attachments: v.optional(v.array(v.object({
    type: v.literal('file'),
    url: v.string(),
    filename: v.string(),
    mediaType: v.string(),
    size: v.optional(v.number())
  }))),
  
  // Tool usage
  toolCalls: v.optional(v.array(v.object({
    toolName: v.string(),
    arguments: v.any(),
    result: v.optional(v.any())
  }))),
  
  createdAt: v.number(),
  updatedAt: v.number(),
})
.index('by_thread', ['threadId', 'createdAt'])
.index('by_streaming', ['isStreaming'])
```

#### User Preferences Table
```typescript
// Reference: zeronsh/src/database/app-schema.ts:74-97
userPreferences: defineTable({
  userId: v.string(), // References PostgreSQL user.id
  
  // Model preferences - Reference: zeronsh settings
  currentModel: v.string(),
  pinnedModels: v.array(v.string()),
  enabledModels: v.array(v.string()),
  
  // Customization - Reference: zeronsh/src/database/app-schema.ts:82-86
  displayName: v.optional(v.string()),
  biography: v.optional(v.string()),
  instructions: v.optional(v.string()), // Custom system prompt
  
  // UI preferences
  theme: v.union(v.literal('light'), v.literal('dark'), v.literal('system')),
  boringTheme: v.boolean(), // Disable pink theme
  hidePersonalInfo: v.boolean(),
  disableThematicBreaks: v.boolean(),
  statsForNerds: v.boolean(), // Show token counts
  
  // Behavior options
  disableExternalLinkWarning: v.boolean(),
  invertSendBehavior: v.boolean(), // Enter vs Shift+Enter
  
  // Fonts
  mainTextFont: v.optional(v.string()),
  codeFont: v.optional(v.string()),
  
  // Keyboard shortcuts
  shortcuts: v.object({
    search: v.string(), // Default: "cmd+k"  
    newChat: v.string(), // Default: "cmd+shift+o"
    toggleSidebar: v.string(), // Default: "cmd+b"
  }),
  
  createdAt: v.number(),
  updatedAt: v.number(),
})
.index('by_user', ['userId'])
```

#### Streaming Tasks Table
```typescript
// Manages active AI streaming sessions
streamingTasks: defineTable({
  taskId: v.string(), // Unique stream identifier
  threadId: v.string(),
  messageId: v.id('messages'),
  userId: v.string(),
  
  // Stream state
  status: v.union(
    v.literal('initializing'),
    v.literal('streaming'), 
    v.literal('completed'),
    v.literal('failed'),
    v.literal('paused') // For resumable streams
  ),
  
  // AI configuration
  model: v.string(),
  systemPrompt: v.optional(v.string()),
  temperature: v.optional(v.float64()),
  maxTokens: v.optional(v.number()),
  
  // Stream data
  accumulatedTokens: v.array(v.string()),
  currentPosition: v.number(), // For resumption
  
  // Error handling
  error: v.optional(v.object({
    message: v.string(),
    code: v.string(),
    retryable: v.boolean(),
  })),
  
  // Timing
  startedAt: v.number(),
  lastTokenAt: v.optional(v.number()),
  completedAt: v.optional(v.number()),
  
  // Resumption support
  resumeToken: v.optional(v.string()),
  canResume: v.boolean(),
})
.index('by_task_id', ['taskId'])
.index('by_thread', ['threadId'])
.index('by_status', ['status'])
```

## Data Synchronization Strategy

### User Creation Flow
1. User registers via Better Auth → PostgreSQL user record created
2. Database hook in `t3chat/lib/auth.ts:52-74` triggers
3. Convex user preferences record created via `syncUserToConvex()`
4. Initial rate limits established in PostgreSQL

### Anonymous User Linking
**Reference**: `zeronsh/lib/auth.ts` anonymous plugin
```typescript
// When anonymous user creates account
anonymous({
  onLinkAccount: async ({ anonymousUser, newUser }) => {
    // Transfer Convex data from anonymous to authenticated user
    await convex.patch(threadId, { userId: newUser.id });
    await convex.patch(messageId, { userId: newUser.id }); 
  }
})
```

### Real-time Synchronization
- **PostgreSQL changes**: Use database hooks to update Convex when needed
- **Convex changes**: Real-time by default, no manual sync required
- **Cross-database queries**: Fetch from PostgreSQL, enrich with Convex data

## Migration Strategy

### From Current t3chat Schema
1. Enhance existing PostgreSQL user table with tier and credits columns
2. Create new rate_limits, usage_logs, and api_keys tables
3. Implement Convex schema with full chat functionality
4. Update `syncUserToConvex()` to create user preferences

### From zeronsh Features
1. **Models**: Migrate model definitions to Convex `availableModels` table
2. **Settings**: Map zeronsh settings to `userPreferences` table
3. **Usage**: Transfer usage logic to hybrid PostgreSQL/Convex approach
4. **Tools**: Adapt tool system to work with Convex state management

## Performance Optimizations

### PostgreSQL Optimizations
- Compound indexes on frequently queried columns
- Partitioning usage_logs by date for analytics
- Connection pooling for high concurrent usage

### Convex Optimizations  
- Use indexes for complex queries
- Minimize unnecessary real-time subscriptions
- Batch operations where possible

## Backup & Recovery
- **PostgreSQL**: Traditional backup strategies (pg_dump, WAL archiving)
- **Convex**: Built-in backup and point-in-time recovery
- **Cross-database consistency**: Implement reconciliation jobs

## Security Considerations
- **API Keys**: AES-256 encryption for stored keys
- **Cross-database queries**: Validate user permissions at both levels
- **Anonymous users**: Data isolation and cleanup policies
- **Rate limiting**: Prevent abuse across both databases