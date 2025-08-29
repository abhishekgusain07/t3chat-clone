# AI Integration Architecture

## Overview

T3Chat's AI integration provides a unified interface for multiple AI providers with streaming responses, tool support, and resumable connections. This document outlines the implementation strategy based on zeronsh's proven architecture.

## Architecture Components

### 1. AI Service Layer
**Reference**: `zeronsh/src/ai/service.ts`

The AI service layer manages the complete lifecycle of AI interactions:

```typescript
// t3chat/lib/ai/service.ts
export interface AIServiceContext {
  userId: string;
  threadId: string;
  model: string;
  isAnonymous: boolean;
  rateLimits: UserLimits;
  tools: string[]; // ['search', 'research', 'file-analysis']
}

export interface StreamingResponse {
  streamId: string;
  resumeToken: string;
  stream: ReadableStream<string>;
}
```

### 2. Multi-Provider Architecture
**Reference**: `zeronsh/src/ai/` directory structure

```typescript
// t3chat/lib/ai/providers/
interface AIProvider {
  name: string;
  models: ModelConfig[];
  createStream: (options: StreamOptions) => Promise<ReadableStream>;
  supports: {
    tools: boolean;
    vision: boolean;
    reasoning: boolean;
  };
}

// Provider implementations
export const providers = {
  openai: new OpenAIProvider(),
  anthropic: new AnthropicProvider(), 
  google: new GoogleProvider(),
  deepseek: new DeepSeekProvider(),
} as const;
```

### 3. Streaming Implementation
**Reference**: `zeronsh/src/ai/stream.ts`

The streaming system uses Vercel AI SDK with custom resumable stream handling:

```typescript
// t3chat/app/api/chat/[threadId]/stream/route.ts
export async function POST(
  request: Request,
  { params }: { params: { threadId: string } }
) {
  const session = await auth();
  const { message, model, tools } = await request.json();
  
  // 1. Validate permissions and rate limits (PostgreSQL)
  const rateLimits = await validateRateLimit(session.user.id, model);
  
  // 2. Create/update thread and message (Convex)
  const streamId = generateStreamId();
  await convex.patch(threadId, { 
    generationStatus: 'generating',
    activeStreamId: streamId 
  });
  
  // 3. Start AI stream with resumable context
  const stream = await createResumableAIStream({
    userId: session.user.id,
    threadId: params.threadId,
    streamId,
    model,
    message,
    tools,
    onToken: async (token) => {
      // Real-time token updates to Convex
      await convex.patch(messageId, {
        streamingContent: [...existing, token],
        isStreaming: true
      });
    },
    onFinish: async (finalMessage) => {
      // Complete the message and update usage
      await Promise.all([
        // Update Convex
        convex.patch(messageId, {
          content: finalMessage.content,
          isStreaming: false,
          usage: finalMessage.usage
        }),
        convex.patch(threadId, {
          generationStatus: 'completed',
          activeStreamId: undefined
        }),
        // Update PostgreSQL usage tracking
        incrementUsage(session.user.id, model, finalMessage.usage.totalTokens)
      ]);
    }
  });
  
  return new Response(stream);
}
```

## Resumable Streaming Implementation

### Stream State Management
**Reference**: `zeronsh/src/ai/service.ts:212-243`

```typescript
// t3chat/lib/ai/resumable-stream.ts
export class ResumableStreamManager {
  private streams = new Map<string, StreamContext>();
  
  async createStream(config: StreamConfig): Promise<ResumableStream> {
    const streamId = nanoid();
    const context = {
      streamId,
      threadId: config.threadId,
      userId: config.userId,
      tokens: [],
      position: 0,
      status: 'active'
    };
    
    // Store in Redis for persistence across server restarts
    await redis.set(`stream:${streamId}`, JSON.stringify(context), 'EX', 3600);
    
    const stream = new ReadableStream({
      start: (controller) => {
        this.streams.set(streamId, { ...context, controller });
      },
      cancel: () => {
        this.pauseStream(streamId);
      }
    });
    
    return {
      streamId,
      stream,
      resumeToken: this.generateResumeToken(context)
    };
  }
  
  async resumeStream(streamId: string, resumeToken: string): Promise<ReadableStream | null> {
    const context = await redis.get(`stream:${streamId}`);
    if (!context || !this.validateResumeToken(resumeToken, context)) {
      return null;
    }
    
    // Continue from last position
    return this.createContinuationStream(JSON.parse(context));
  }
}
```

### Resume API Endpoint
**Reference**: `zeronsh/src/routes/api.thread.$threadId.stream.ts`

```typescript
// t3chat/app/api/chat/[threadId]/resume/route.ts
export async function GET(
  request: Request,
  { params }: { params: { threadId: string } }
) {
  const session = await auth();
  const streamId = new URL(request.url).searchParams.get('streamId');
  const resumeToken = request.headers.get('X-Resume-Token');
  
  // Validate ownership and stream state
  const thread = await convex.query(api.threads.get, { threadId: params.threadId });
  if (thread.userId !== session.user.id || thread.activeStreamId !== streamId) {
    return new Response('Unauthorized', { status: 401 });
  }
  
  // Resume stream from last position
  const stream = await streamManager.resumeStream(streamId, resumeToken);
  if (!stream) {
    return new Response('Stream not found', { status: 404 });
  }
  
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    }
  });
}
```

## Tool Integration System

### Tool Architecture  
**Reference**: `zeronsh/src/ai/tools/index.ts`

```typescript
// t3chat/lib/ai/tools/index.ts
export interface ToolContext {
  userId: string;
  threadId: string;
  rateLimits: UserLimits;
  convex: ConvexClient;
}

export interface Tool {
  name: string;
  description: string;
  parameters: Record<string, any>;
  handler: (params: any, context: ToolContext) => Promise<any>;
  rateLimitCost: number;
}

export const tools: Record<string, Tool> = {
  search: createSearchTool(),
  research: createResearchTool(), 
  fileAnalysis: createFileAnalysisTool(),
};
```

### Search Tool Implementation
**Reference**: `zeronsh/src/ai/tools/search-tool.ts`

```typescript
// t3chat/lib/ai/tools/search-tool.ts
export function createSearchTool(): Tool {
  return {
    name: 'search',
    description: 'Search the web for current information',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query' },
        numResults: { type: 'number', default: 5 }
      },
      required: ['query']
    },
    rateLimitCost: 1, // 1 search credit
    handler: async (params, context) => {
      // Check search limits
      const usage = await getUsage(context.userId);
      const limits = getUserLimits(context.userId);
      
      if (usage.searchCalls >= limits.SEARCH) {
        throw new Error('Search limit exceeded');
      }
      
      // Perform search via Exa API
      const results = await exa.search(params.query, {
        numResults: params.numResults,
        type: 'search'
      });
      
      // Update usage tracking
      await incrementUsage(context.userId, 'search', 1);
      
      return {
        results: results.results.map(r => ({
          title: r.title,
          url: r.url,
          snippet: r.text?.slice(0, 200)
        }))
      };
    }
  };
}
```

## Model Configuration System

### Model Registry
**Reference**: `zeronsh/src/database/app-schema.ts:59-70`

```typescript
// Convex schema: availableModels table
export interface ModelConfig {
  id: string;
  name: string;
  provider: string;
  description: string;
  
  // Capabilities
  contextLength: number;
  maxOutputTokens: number;
  supportsVision: boolean;
  supportsTools: boolean;
  supportsContinuation: boolean;
  
  // Access control
  requiredTier: 'Free' | 'Pro' | 'Enterprise';
  creditsPerMessage: number;
  
  // UI metadata  
  icon: string;
  isNew: boolean;
  isBeta: boolean;
  enabled: boolean;
}
```

### Model Seeding
**Reference**: `zeronsh/drizzle/` migration files

```typescript
// t3chat/convex/seed.ts
export const defaultModels: ModelConfig[] = [
  {
    id: 'gpt-4o',
    name: 'GPT-4o',
    provider: 'openai',
    description: 'Most capable GPT-4 model with vision',
    contextLength: 128000,
    maxOutputTokens: 4096,
    supportsVision: true,
    supportsTools: true,
    supportsContinuation: true,
    requiredTier: 'Free',
    creditsPerMessage: 3,
    icon: 'openai',
    isNew: false,
    isBeta: false,
    enabled: true
  },
  {
    id: 'claude-4-sonnet',
    name: 'Claude 4 Sonnet', 
    provider: 'anthropic',
    description: 'Latest Claude model with advanced reasoning',
    contextLength: 200000,
    maxOutputTokens: 8192,
    supportsVision: true,
    supportsTools: true,
    supportsContinuation: true,
    requiredTier: 'Free',
    creditsPerMessage: 4,
    icon: 'anthropic',
    isNew: true,
    isBeta: false,
    enabled: true
  }
  // ... more models
];
```

## Rate Limiting Integration

### Credit System
**Reference**: `zeronsh/src/lib/constants.ts`, `zeronsh/src/ai/service.ts:91-103`

```typescript
// t3chat/lib/rate-limiting.ts
export interface UserLimits {
  CREDITS: number;
  SEARCH: number; 
  RESEARCH: number;
}

export async function getUserLimits(userId: string): Promise<UserLimits> {
  const user = await db.query.user.findFirst({
    where: eq(schema.user.id, userId),
    with: { subscription: true }
  });
  
  const isAnonymous = user?.isAnonymous ?? false;
  const isPro = user?.subscription?.status === 'active';
  
  if (isPro) return { CREDITS: 200, SEARCH: 50, RESEARCH: 5 };
  if (isAnonymous) return { CREDITS: 10, SEARCH: 5, RESEARCH: 0 };
  return { CREDITS: 20, SEARCH: 5, RESEARCH: 0 }; // Free tier
}

export async function checkRateLimit(
  userId: string, 
  model: string,
  toolsRequested: string[] = []
): Promise<{ allowed: boolean; reason?: string }> {
  const limits = await getUserLimits(userId);
  const usage = await getCurrentUsage(userId);
  const modelConfig = await getModelConfig(model);
  
  // Check credit limit
  const requiredCredits = modelConfig.creditsPerMessage + 
    toolsRequested.reduce((sum, tool) => sum + getToolCreditCost(tool), 0);
    
  if (usage.creditsUsed + requiredCredits > limits.CREDITS) {
    return { allowed: false, reason: 'Credit limit exceeded' };
  }
  
  // Check tool-specific limits
  for (const tool of toolsRequested) {
    const toolUsage = usage[`${tool}CallsUsed`] || 0;
    const toolLimit = limits[tool.toUpperCase()] || 0;
    
    if (toolUsage >= toolLimit) {
      return { allowed: false, reason: `${tool} limit exceeded` };
    }
  }
  
  return { allowed: true };
}
```

## Error Handling & Recovery

### Stream Error Handling
```typescript
export async function createResilientAIStream(config: StreamConfig) {
  let retryCount = 0;
  const maxRetries = 3;
  
  while (retryCount < maxRetries) {
    try {
      return await createAIStream(config);
    } catch (error) {
      retryCount++;
      
      if (retryCount >= maxRetries) {
        // Mark stream as failed in Convex
        await convex.patch(config.threadId, {
          generationStatus: 'failed',
          activeStreamId: undefined
        });
        
        throw error;
      }
      
      // Exponential backoff
      await sleep(Math.pow(2, retryCount) * 1000);
    }
  }
}
```

## Testing Strategy

### Unit Tests
- Mock AI providers for consistent testing
- Test rate limiting logic
- Validate stream resumption

### Integration Tests  
- End-to-end streaming scenarios
- Tool integration testing
- Error recovery testing

### Load Tests
- Concurrent stream handling
- Rate limit enforcement
- Database performance under load

## Monitoring & Observability

### Metrics to Track
- Response latency by provider
- Stream completion rates  
- Rate limit hit rates
- Tool usage patterns
- Error rates by model

### Logging Strategy
- Structured logging for all AI interactions
- Stream lifecycle events
- Rate limiting decisions
- Tool execution results

## Performance Optimizations

### Response Time
- Connection pooling for AI providers
- Intelligent model routing based on load
- Caching for repeated queries

### Resource Usage
- Stream cleanup and garbage collection
- Memory-efficient token buffering
- Database connection optimization

### Scalability
- Horizontal scaling of streaming endpoints
- Load balancing across AI providers
- Auto-scaling based on demand