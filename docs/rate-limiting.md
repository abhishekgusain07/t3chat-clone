# Rate Limiting Architecture

## Overview

T3Chat implements a sophisticated credit-based rate limiting system that provides different usage tiers for Anonymous, Free, and Pro users. The system prevents abuse while encouraging user engagement and subscription upgrades.

## Rate Limiting Strategy

### Credit-Based System
**Reference**: `zeronsh/src/lib/constants.ts`, `zeronsh/src/ai/service.ts:379-413`

T3Chat uses a multi-dimensional rate limiting approach:

```typescript
// t3chat/lib/rate-limiting/types.ts
export interface UserLimits {
  CREDITS: number;        // General AI usage credits
  SEARCH: number;         // Web search tool calls  
  RESEARCH: number;       // Research tool calls
  FILE_UPLOADS: number;   // File attachment limit
}

export type UserTier = 'Anonymous' | 'Free' | 'Pro' | 'Enterprise';

export const TIER_LIMITS: Record<UserTier, UserLimits> = {
  Anonymous: {
    CREDITS: 10,
    SEARCH: 5,
    RESEARCH: 0,
    FILE_UPLOADS: 3
  },
  Free: {
    CREDITS: 20,
    SEARCH: 5,
    RESEARCH: 0,
    FILE_UPLOADS: 5
  },
  Pro: {
    CREDITS: 200,
    SEARCH: 50,
    RESEARCH: 5,
    FILE_UPLOADS: 50
  },
  Enterprise: {
    CREDITS: 1000,
    SEARCH: 200,
    RESEARCH: 20,
    FILE_UPLOADS: 200
  }
};
```

### Model-Based Credit Consumption
```typescript
// t3chat/lib/rate-limiting/credits.ts
export interface ModelCreditCost {
  baseCredits: number;        // Base cost per message
  tokensPerCredit: number;    // Additional tokens per credit
  toolMultiplier: number;     // Multiplier when using tools
}

export const MODEL_CREDIT_COSTS: Record<string, ModelCreditCost> = {
  'gpt-4o-mini': {
    baseCredits: 1,
    tokensPerCredit: 10000,
    toolMultiplier: 1.5
  },
  'gpt-4o': {
    baseCredits: 3,
    tokensPerCredit: 3000,
    toolMultiplier: 2.0
  },
  'claude-4-sonnet': {
    baseCredits: 4,
    tokensPerCredit: 2500,
    toolMultiplier: 2.0
  },
  'gemini-2.5-pro': {
    baseCredits: 3,
    tokensPerCredit: 3500,
    toolMultiplier: 1.8
  },
  'deepseek-v3.1': {
    baseCredits: 2,
    tokensPerCredit: 5000,
    toolMultiplier: 1.5
  }
};

export function calculateCreditCost(
  model: string,
  tokenCount: number,
  toolsUsed: string[] = []
): number {
  const modelCost = MODEL_CREDIT_COSTS[model] || MODEL_CREDIT_COSTS['gpt-4o-mini'];
  
  let credits = modelCost.baseCredits;
  
  // Add token-based costs
  if (tokenCount > modelCost.tokensPerCredit) {
    const additionalTokens = tokenCount - modelCost.tokensPerCredit;
    credits += Math.ceil(additionalTokens / modelCost.tokensPerCredit);
  }
  
  // Apply tool multiplier
  if (toolsUsed.length > 0) {
    credits = Math.ceil(credits * modelCost.toolMultiplier);
  }
  
  return credits;
}
```

## Rate Limiting Implementation

### PostgreSQL Rate Limit Tracking
```sql
-- t3chat/db/schema.ts (Enhanced)
export const rateLimits = pgTable('rate_limits', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  
  -- Credit tracking by usage type
  creditsUsed: integer('credits_used').default(0),
  searchCallsUsed: integer('search_calls_used').default(0),
  researchCallsUsed: integer('research_calls_used').default(0),
  fileUploadsUsed: integer('file_uploads_used').default(0),
  
  -- Reset timing (24-hour rolling window)
  periodStart: timestamp('period_start').notNull().defaultNow(),
  resetsAt: timestamp('resets_at').notNull(),
  
  -- Tier-specific tracking
  currentTier: text('current_tier').notNull().default('Free'),
  
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

-- Indexes for performance
CREATE INDEX idx_rate_limits_user_resets ON rate_limits(user_id, resets_at);
CREATE INDEX idx_rate_limits_tier ON rate_limits(current_tier);
```

### Rate Limit Service
```typescript
// t3chat/lib/rate-limiting/service.ts
export class RateLimitService {
  static async checkRateLimit(
    userId: string,
    action: RateLimitAction,
    metadata?: RateLimitMetadata
  ): Promise<RateLimitResult> {
    const userTier = await this.getUserTier(userId);
    const limits = TIER_LIMITS[userTier];
    const usage = await this.getCurrentUsage(userId);
    
    // Check if rate limit period has expired
    if (usage.resetsAt <= new Date()) {
      await this.resetRateLimits(userId);
      usage = await this.getCurrentUsage(userId);
    }
    
    return this.validateAction(action, usage, limits, metadata);
  }
  
  static async validateAction(
    action: RateLimitAction,
    usage: RateLimitUsage,
    limits: UserLimits,
    metadata?: RateLimitMetadata
  ): Promise<RateLimitResult> {
    switch (action) {
      case 'message':
        const requiredCredits = metadata?.model 
          ? calculateCreditCost(
              metadata.model, 
              metadata.estimatedTokens || 1000,
              metadata.tools || []
            )
          : 1;
          
        if (usage.creditsUsed + requiredCredits > limits.CREDITS) {
          return {
            allowed: false,
            reason: 'Credit limit exceeded',
            remainingCredits: Math.max(0, limits.CREDITS - usage.creditsUsed),
            resetsAt: usage.resetsAt,
            upgradeRequired: limits.CREDITS < TIER_LIMITS.Pro.CREDITS
          };
        }
        
        return { 
          allowed: true, 
          creditsRequired: requiredCredits,
          remainingCredits: limits.CREDITS - usage.creditsUsed - requiredCredits
        };
        
      case 'search':
        if (usage.searchCallsUsed >= limits.SEARCH) {
          return {
            allowed: false,
            reason: 'Search limit exceeded',
            remainingCalls: 0,
            resetsAt: usage.resetsAt,
            upgradeRequired: limits.SEARCH < TIER_LIMITS.Pro.SEARCH
          };
        }
        
        return { 
          allowed: true,
          remainingCalls: limits.SEARCH - usage.searchCallsUsed
        };
        
      case 'research':
        if (limits.RESEARCH === 0) {
          return {
            allowed: false,
            reason: 'Research requires Pro subscription',
            upgradeRequired: true
          };
        }
        
        if (usage.researchCallsUsed >= limits.RESEARCH) {
          return {
            allowed: false,
            reason: 'Research limit exceeded', 
            resetsAt: usage.resetsAt,
            upgradeRequired: false
          };
        }
        
        return { 
          allowed: true,
          remainingCalls: limits.RESEARCH - usage.researchCallsUsed
        };
        
      case 'file_upload':
        if (usage.fileUploadsUsed >= limits.FILE_UPLOADS) {
          return {
            allowed: false,
            reason: 'File upload limit exceeded',
            resetsAt: usage.resetsAt,
            upgradeRequired: limits.FILE_UPLOADS < TIER_LIMITS.Pro.FILE_UPLOADS
          };
        }
        
        return { 
          allowed: true,
          remainingUploads: limits.FILE_UPLOADS - usage.fileUploadsUsed
        };
        
      default:
        return { allowed: false, reason: 'Unknown action' };
    }
  }
  
  static async incrementUsage(
    userId: string,
    action: RateLimitAction,
    amount: number = 1
  ): Promise<void> {
    const field = this.getUsageField(action);
    
    await db
      .update(rateLimits)
      .set({
        [field]: sql`${rateLimits[field]} + ${amount}`,
        updatedAt: new Date()
      })
      .where(eq(rateLimits.userId, userId));
      
    // Log usage for analytics
    await this.logUsage(userId, action, amount);
  }
}
```

### Real-time Rate Limit Validation
```typescript
// t3chat/app/api/chat/[threadId]/stream/route.ts
export async function POST(request: Request, { params }: { params: { threadId: string } }) {
  const session = await auth();
  if (!session?.user) {
    return new Response('Unauthorized', { status: 401 });
  }
  
  const { message, model, tools = [] } = await request.json();
  
  // Pre-validate rate limits before starting AI stream
  const rateLimitCheck = await RateLimitService.checkRateLimit(
    session.user.id,
    'message',
    {
      model,
      tools,
      estimatedTokens: message.length * 4 // Rough token estimate
    }
  );
  
  if (!rateLimitCheck.allowed) {
    return NextResponse.json(
      {
        error: rateLimitCheck.reason,
        upgradeRequired: rateLimitCheck.upgradeRequired,
        resetsAt: rateLimitCheck.resetsAt
      },
      { status: 429 } // Too Many Requests
    );
  }
  
  // Reserve credits optimistically
  await RateLimitService.incrementUsage(
    session.user.id, 
    'message', 
    rateLimitCheck.creditsRequired || 1
  );
  
  try {
    const stream = await createAIStream({
      userId: session.user.id,
      threadId: params.threadId,
      model,
      message,
      tools,
      onFinish: async (finalMessage) => {
        // Adjust credits based on actual token usage
        const actualCredits = calculateCreditCost(
          model,
          finalMessage.usage.totalTokens,
          tools
        );
        
        const creditDiff = actualCredits - (rateLimitCheck.creditsRequired || 1);
        if (creditDiff !== 0) {
          await RateLimitService.incrementUsage(
            session.user.id,
            'message',
            creditDiff
          );
        }
      }
    });
    
    return new Response(stream);
  } catch (error) {
    // Refund credits on error
    await RateLimitService.incrementUsage(
      session.user.id,
      'message',
      -(rateLimitCheck.creditsRequired || 1)
    );
    
    throw error;
  }
}
```

## Frontend Rate Limit Integration

### Rate Limit Context
```typescript
// t3chat/contexts/RateLimitContext.tsx
interface RateLimitContextType {
  limits: UserLimits;
  usage: RateLimitUsage;
  checkAction: (action: RateLimitAction, metadata?: any) => Promise<RateLimitResult>;
  refreshLimits: () => Promise<void>;
}

export function RateLimitProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuthState();
  const [limits, setLimits] = useState<UserLimits>(TIER_LIMITS.Anonymous);
  const [usage, setUsage] = useState<RateLimitUsage | null>(null);
  
  useEffect(() => {
    if (user) {
      fetchRateLimits();
    }
  }, [user]);
  
  const fetchRateLimits = async () => {
    try {
      const response = await fetch('/api/rate-limits');
      const data = await response.json();
      setLimits(data.limits);
      setUsage(data.usage);
    } catch (error) {
      console.error('Failed to fetch rate limits:', error);
    }
  };
  
  const checkAction = async (action: RateLimitAction, metadata?: any) => {
    const response = await fetch('/api/rate-limits/check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, metadata })
    });
    
    return await response.json();
  };
  
  return (
    <RateLimitContext.Provider value={{
      limits,
      usage,
      checkAction,
      refreshLimits: fetchRateLimits
    }}>
      {children}
    </RateLimitContext.Provider>
  );
}
```

### Usage Display Components
```typescript
// t3chat/components/ui/UsageIndicator.tsx
export function UsageIndicator({ 
  type, 
  className 
}: { 
  type: 'credits' | 'search' | 'research',
  className?: string 
}) {
  const { limits, usage } = useRateLimit();
  
  if (!usage) return null;
  
  const getUsageInfo = () => {
    switch (type) {
      case 'credits':
        return {
          used: usage.creditsUsed,
          total: limits.CREDITS,
          label: 'Credits',
          color: usage.creditsUsed / limits.CREDITS > 0.8 ? 'red' : 'blue'
        };
      case 'search':
        return {
          used: usage.searchCallsUsed,
          total: limits.SEARCH,
          label: 'Searches',
          color: usage.searchCallsUsed / limits.SEARCH > 0.8 ? 'red' : 'green'
        };
      case 'research':
        return {
          used: usage.researchCallsUsed,
          total: limits.RESEARCH,
          label: 'Research',
          color: limits.RESEARCH === 0 ? 'gray' : 'purple'
        };
    }
  };
  
  const info = getUsageInfo();
  const percentage = info.total > 0 ? (info.used / info.total) * 100 : 0;
  
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="flex-1">
        <div className="flex justify-between text-xs mb-1">
          <span>{info.label}</span>
          <span>{info.used}/{info.total}</span>
        </div>
        
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className={cn(
              "h-2 rounded-full transition-all",
              info.color === 'red' ? 'bg-red-500' :
              info.color === 'blue' ? 'bg-blue-500' :
              info.color === 'green' ? 'bg-green-500' :
              info.color === 'purple' ? 'bg-purple-500' :
              'bg-gray-400'
            )}
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>
    </div>
  );
}
```

### Rate Limit Blocking UI
```typescript
// t3chat/components/ui/RateLimitGate.tsx
interface RateLimitGateProps {
  action: RateLimitAction;
  metadata?: any;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function RateLimitGate({ 
  action, 
  metadata, 
  children, 
  fallback 
}: RateLimitGateProps) {
  const { checkAction } = useRateLimit();
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [limitInfo, setLimitInfo] = useState<RateLimitResult | null>(null);
  
  useEffect(() => {
    checkAction(action, metadata).then(result => {
      setAllowed(result.allowed);
      setLimitInfo(result);
    });
  }, [action, metadata]);
  
  if (allowed === null) {
    return <Skeleton className="h-10 w-full" />;
  }
  
  if (!allowed) {
    return fallback || (
      <RateLimitExceededMessage 
        reason={limitInfo?.reason}
        upgradeRequired={limitInfo?.upgradeRequired}
        resetsAt={limitInfo?.resetsAt}
      />
    );
  }
  
  return <>{children}</>;
}

function RateLimitExceededMessage({ 
  reason, 
  upgradeRequired, 
  resetsAt 
}: {
  reason?: string;
  upgradeRequired?: boolean;
  resetsAt?: Date;
}) {
  const router = useRouter();
  
  return (
    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
      <div className="flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
        
        <div className="flex-1">
          <h3 className="font-medium text-red-900 mb-1">
            {reason || 'Rate limit exceeded'}
          </h3>
          
          {resetsAt && (
            <p className="text-red-700 text-sm mb-3">
              Limits reset in <TimeUntil date={resetsAt} />
            </p>
          )}
          
          {upgradeRequired && (
            <div className="flex gap-2">
              <button
                onClick={() => router.push('/pricing')}
                className="bg-red-600 text-white px-3 py-2 rounded text-sm hover:bg-red-700"
              >
                Upgrade to Pro
              </button>
              
              <button
                onClick={() => router.push('/sign-up')}
                className="bg-gray-600 text-white px-3 py-2 rounded text-sm hover:bg-gray-700"
              >
                Create Account
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
```

## Tool-Specific Rate Limiting

### Search Tool Rate Limiting
```typescript
// t3chat/lib/ai/tools/search-tool.ts
export function createSearchTool(): Tool {
  return {
    name: 'search',
    description: 'Search the web for current information',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query' }
      },
      required: ['query']
    },
    handler: async (params, context) => {
      // Check search rate limits
      const rateLimitCheck = await RateLimitService.checkRateLimit(
        context.userId,
        'search'
      );
      
      if (!rateLimitCheck.allowed) {
        throw new Error(`Search limit exceeded: ${rateLimitCheck.reason}`);
      }
      
      try {
        // Perform search
        const results = await exa.search(params.query, {
          numResults: 5,
          type: 'search'
        });
        
        // Increment usage on success
        await RateLimitService.incrementUsage(context.userId, 'search', 1);
        
        return { results };
      } catch (error) {
        // Don't increment usage on error
        throw error;
      }
    }
  };
}
```

### Research Tool Rate Limiting
```typescript
// t3chat/lib/ai/tools/research-tool.ts
export function createResearchTool(): Tool {
  return {
    name: 'research',
    description: 'Deep research on a topic with multiple sources',
    parameters: {
      type: 'object',
      properties: {
        topic: { type: 'string', description: 'Research topic' }
      },
      required: ['topic']
    },
    handler: async (params, context) => {
      // Research tool requires Pro subscription
      const rateLimitCheck = await RateLimitService.checkRateLimit(
        context.userId,
        'research'
      );
      
      if (!rateLimitCheck.allowed) {
        if (rateLimitCheck.upgradeRequired) {
          throw new Error('Research requires Pro subscription');
        }
        throw new Error(`Research limit exceeded: ${rateLimitCheck.reason}`);
      }
      
      // Expensive research operation
      const research = await conductDeepResearch(params.topic);
      
      // Increment usage
      await RateLimitService.incrementUsage(context.userId, 'research', 1);
      
      return research;
    }
  };
}
```

## Administrative Rate Limiting

### Admin Override System
```typescript
// t3chat/lib/rate-limiting/admin.ts
export class AdminRateLimitService extends RateLimitService {
  static async grantBonusCredits(
    userId: string, 
    credits: number, 
    reason: string
  ): Promise<void> {
    await db.insert(usageLogs).values({
      id: nanoid(),
      userId,
      usageType: 'bonus_credits',
      creditsConsumed: -credits, // Negative = credit grant
      success: true,
      sessionId: null,
      createdAt: new Date()
    });
    
    // Update rate limits
    await db
      .update(rateLimits)
      .set({
        creditsUsed: sql`${rateLimits.creditsUsed} - ${credits}`,
        updatedAt: new Date()
      })
      .where(eq(rateLimits.userId, userId));
      
    console.log(`✅ Granted ${credits} credits to user ${userId}: ${reason}`);
  }
  
  static async temporaryUpgrade(
    userId: string,
    tier: UserTier,
    durationHours: number
  ): Promise<void> {
    const expiresAt = new Date(Date.now() + durationHours * 60 * 60 * 1000);
    
    await db.insert(temporaryUpgrades).values({
      id: nanoid(),
      userId,
      tier,
      expiresAt,
      createdAt: new Date()
    });
    
    console.log(`✅ Temporary ${tier} upgrade for user ${userId} until ${expiresAt}`);
  }
}
```

## Analytics & Monitoring

### Usage Analytics
```typescript
// t3chat/lib/analytics/rate-limiting.ts
export async function getRateLimitAnalytics(
  startDate: Date,
  endDate: Date
): Promise<RateLimitAnalytics> {
  const usageLogs = await db
    .select({
      usageType: schema.usageLogs.usageType,
      creditsConsumed: schema.usageLogs.creditsConsumed,
      modelUsed: schema.usageLogs.modelUsed,
      success: schema.usageLogs.success,
      userId: schema.usageLogs.userId,
      createdAt: schema.usageLogs.createdAt
    })
    .from(schema.usageLogs)
    .where(
      and(
        gte(schema.usageLogs.createdAt, startDate),
        lte(schema.usageLogs.createdAt, endDate)
      )
    );
    
  return {
    totalRequests: usageLogs.length,
    totalCreditsConsumed: usageLogs.reduce((sum, log) => sum + log.creditsConsumed, 0),
    successRate: usageLogs.filter(log => log.success).length / usageLogs.length,
    topModels: getTopModels(usageLogs),
    rateLimitHits: usageLogs.filter(log => !log.success).length,
    averageCreditsPerUser: calculateAverageCreditsPerUser(usageLogs)
  };
}
```

## Testing Rate Limiting

### Unit Tests
```typescript
// t3chat/test/rate-limiting.test.ts
describe('Rate Limiting', () => {
  it('should enforce anonymous user limits', async () => {
    const anonymousUser = await createAnonymousUser();
    
    // Use up all anonymous credits (10)
    for (let i = 0; i < 10; i++) {
      await RateLimitService.incrementUsage(anonymousUser.id, 'message', 1);
    }
    
    // Next request should be blocked
    const result = await RateLimitService.checkRateLimit(
      anonymousUser.id,
      'message'
    );
    
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('Credit limit exceeded');
    expect(result.upgradeRequired).toBe(true);
  });
  
  it('should allow Pro users higher limits', async () => {
    const proUser = await createProUser();
    
    // Pro users get 200 credits
    const result = await RateLimitService.checkRateLimit(
      proUser.id,
      'message',
      { model: 'gpt-4o', estimatedTokens: 5000 }
    );
    
    expect(result.allowed).toBe(true);
    expect(result.remainingCredits).toBe(197); // 200 - 3 credits for GPT-4o
  });
  
  it('should reset limits after 24 hours', async () => {
    const user = await createFreeUser();
    
    // Exhaust limits
    await RateLimitService.incrementUsage(user.id, 'message', 20);
    
    // Should be blocked
    let result = await RateLimitService.checkRateLimit(user.id, 'message');
    expect(result.allowed).toBe(false);
    
    // Fast-forward 24 hours
    jest.advanceTimersByTime(24 * 60 * 60 * 1000);
    
    // Should be allowed again
    result = await RateLimitService.checkRateLimit(user.id, 'message');
    expect(result.allowed).toBe(true);
  });
});
```

## Rate Limiting Checklist

- ✅ **Tier-based limits**: Different limits for Anonymous, Free, Pro users
- ✅ **Credit system**: Model-based credit consumption with token counting
- ✅ **Tool rate limiting**: Separate limits for search and research tools
- ✅ **Real-time validation**: Check limits before processing requests
- ✅ **Usage tracking**: Detailed logging for analytics and billing
- ✅ **Reset mechanism**: 24-hour rolling window limit resets
- ✅ **Frontend integration**: UI components showing usage and limits
- ✅ **Error handling**: Graceful degradation when limits are exceeded
- ✅ **Admin overrides**: Bonus credits and temporary upgrades
- ✅ **Analytics**: Usage patterns and optimization insights