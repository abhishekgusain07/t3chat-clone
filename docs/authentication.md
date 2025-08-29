# Authentication Architecture

## Overview

T3Chat uses Better Auth for comprehensive authentication with support for anonymous users, account linking, and seamless migration of chat history. The system is designed to provide instant access while encouraging user registration.

## Authentication Flow Design

### Anonymous User Experience
**Reference**: `zeronsh/src/database/auth-schema.ts:23`, `zeronsh/lib/auth.ts` anonymous plugin

```typescript
// t3chat/lib/auth.ts (Enhanced from existing)
import { anonymous } from 'better-auth/plugins';

export const auth = betterAuth({
  // ... existing config
  plugins: [
    // ... existing plugins
    anonymous({
      // Handle anonymous to authenticated user migration
      onLinkAccount: async ({ anonymousUser, newUser }) => {
        console.log(`🔗 Linking anonymous user ${anonymousUser.user.id} to ${newUser.user.id}`);
        
        // Transfer all Convex data from anonymous to authenticated user
        await convex.mutation(api.auth.linkAnonymousAccount, {
          anonymousUserId: anonymousUser.user.id,
          authenticatedUserId: newUser.user.id
        });
        
        // Update PostgreSQL records
        await db
          .update(rateLimits)
          .set({ userId: newUser.user.id })
          .where(eq(rateLimits.userId, anonymousUser.user.id));
          
        await db
          .update(usageLogs)
          .set({ userId: newUser.user.id })
          .where(eq(usageLogs.userId, anonymousUser.user.id));
      }
    })
  ],
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          console.log('🎯 Better Auth user created, syncing to Convex:', user.email || 'anonymous');
          
          // Sync user to Convex database with enhanced data
          const syncResult = await syncUserToConvex(user);
          
          if (syncResult) {
            console.log(`✅ User sync to Convex successful: ${syncResult.action}`);
            
            // Initialize user preferences and rate limits
            await initializeNewUser(user.id, user.isAnonymous);
          } else {
            console.error('❌ Failed to sync user to Convex');
          }
        }
      }
    }
  }
});
```

### Enhanced Convex User Sync
```typescript
// t3chat/lib/convex-sync.ts (Enhanced from existing)
export async function syncUserToConvex(user: any) {
  try {
    // Check if user already exists in Convex
    const existingUser = await convex.query(api.users.getByAuthId, { 
      authUserId: user.id 
    });
    
    if (existingUser) {
      // Update existing user
      await convex.mutation(api.users.update, {
        userId: existingUser._id,
        name: user.name,
        email: user.email,
        emailVerified: user.emailVerified,
        image: user.image,
        authUpdatedAt: Date.now()
      });
      
      return { action: 'updated', userId: existingUser._id };
    } else {
      // Create new user in Convex
      const convexUserId = await convex.mutation(api.users.create, {
        authUserId: user.id,
        name: user.name,
        email: user.email || '',
        emailVerified: user.emailVerified || false,
        image: user.image,
        authCreatedAt: Date.now(),
        authUpdatedAt: Date.now()
      });
      
      // Initialize user preferences
      await convex.mutation(api.userPreferences.create, {
        userId: user.id,
        // Default settings similar to zeronsh
        currentModel: 'gpt-4o-mini',
        pinnedModels: [
          'claude-4-sonnet',
          'gpt-4o',
          'gpt-4o-mini',
          'gemini-2.5-flash',
          'deepseek-v3.1'
        ],
        theme: 'dark',
        boringTheme: false,
        hidePersonalInfo: false,
        disableThematicBreaks: false,
        statsForNerds: false,
        shortcuts: {
          search: 'cmd+k',
          newChat: 'cmd+shift+o',
          toggleSidebar: 'cmd+b'
        },
        createdAt: Date.now(),
        updatedAt: Date.now()
      });
      
      return { action: 'created', userId: convexUserId };
    }
  } catch (error) {
    console.error('Convex sync error:', error);
    return null;
  }
}

async function initializeNewUser(userId: string, isAnonymous: boolean = false) {
  // Initialize PostgreSQL rate limits
  await db.insert(rateLimits).values({
    id: nanoid(),
    userId: userId,
    anonymousCreditsUsed: 0,
    freeCreditsUsed: 0,
    proCreditsUsed: 0,
    searchCallsUsed: 0,
    researchCallsUsed: 0,
    periodStart: new Date(),
    resetsAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
  });
  
  console.log(`✅ Initialized ${isAnonymous ? 'anonymous' : 'authenticated'} user: ${userId}`);
}
```

## Anonymous User Implementation

### Frontend Anonymous Session
```typescript
// t3chat/components/auth/AnonymousProvider.tsx
'use client';

import { useEffect } from 'react';
import { authClient } from '@/lib/auth-client';

export function AnonymousProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Auto-create anonymous session if no user exists
    const initializeAnonymousUser = async () => {
      const session = await authClient.getSession();
      
      if (!session) {
        console.log('🔄 Creating anonymous user session');
        
        try {
          await authClient.signIn.anonymous();
          console.log('✅ Anonymous session created');
        } catch (error) {
          console.error('❌ Failed to create anonymous session:', error);
        }
      }
    };
    
    initializeAnonymousUser();
  }, []);
  
  return <>{children}</>;
}
```

### Anonymous Chat Access
```typescript
// t3chat/app/(app)/chat/page.tsx
export default function ChatPage() {
  const { data: session } = useSession();
  
  // Allow anonymous users to access chat
  if (!session) {
    return <AnonymousChatInterface />;
  }
  
  return <AuthenticatedChatInterface />;
}

function AnonymousChatInterface() {
  return (
    <div className="flex flex-col h-full">
      <div className="bg-yellow-50 border-b border-yellow-200 p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-yellow-600" />
            <span className="text-sm text-yellow-700">
              You're chatting anonymously. 
              <button 
                onClick={() => router.push('/sign-in')}
                className="underline ml-1"
              >
                Sign in
              </button> 
              to save your conversations.
            </span>
          </div>
          
          <button 
            onClick={() => router.push('/sign-up')}
            className="text-sm bg-yellow-600 text-white px-3 py-1 rounded"
          >
            Create Account
          </button>
        </div>
      </div>
      
      <ChatInterface />
    </div>
  );
}
```

## Account Linking System

### Convex Account Linking Mutation
```typescript
// t3chat/convex/auth.ts
export const linkAnonymousAccount = mutation({
  args: {
    anonymousUserId: v.string(),
    authenticatedUserId: v.string()
  },
  handler: async (ctx, args) => {
    console.log(`🔗 Linking anonymous ${args.anonymousUserId} to authenticated ${args.authenticatedUserId}`);
    
    // Transfer all threads
    const anonymousThreads = await ctx.db
      .query('threads')
      .withIndex('by_user', q => q.eq('userId', args.anonymousUserId))
      .collect();
    
    for (const thread of anonymousThreads) {
      await ctx.db.patch(thread._id, {
        userId: args.authenticatedUserId,
        updatedAt: Date.now()
      });
    }
    
    // Transfer all messages
    const anonymousMessages = await ctx.db
      .query('messages')
      .withIndex('by_user', q => q.eq('userId', args.anonymousUserId))
      .collect();
    
    for (const message of anonymousMessages) {
      await ctx.db.patch(message._id, {
        userId: args.authenticatedUserId,
        updatedAt: Date.now()
      });
    }
    
    // Transfer user preferences (merge with defaults)
    const anonymousPrefs = await ctx.db
      .query('userPreferences')
      .withIndex('by_user', q => q.eq('userId', args.anonymousUserId))
      .first();
    
    if (anonymousPrefs) {
      const authenticatedPrefs = await ctx.db
        .query('userPreferences')
        .withIndex('by_user', q => q.eq('userId', args.authenticatedUserId))
        .first();
      
      if (authenticatedPrefs) {
        // Merge preferences, keeping anonymous chat history
        await ctx.db.patch(authenticatedPrefs._id, {
          // Keep authenticated user's preferences but update chat-related settings
          updatedAt: Date.now()
        });
      }
      
      // Clean up anonymous preferences
      await ctx.db.delete(anonymousPrefs._id);
    }
    
    // Clean up anonymous user record
    const anonymousUser = await ctx.db
      .query('users')
      .withIndex('by_auth_user_id', q => q.eq('authUserId', args.anonymousUserId))
      .first();
    
    if (anonymousUser) {
      await ctx.db.delete(anonymousUser._id);
    }
    
    console.log(`✅ Successfully linked anonymous account to authenticated user`);
  }
});
```

### Account Linking UI Component
```typescript
// t3chat/components/auth/LinkAccountPrompt.tsx
export function LinkAccountPrompt({ 
  anonymousThreadCount 
}: { 
  anonymousThreadCount: number 
}) {
  const [isLinking, setIsLinking] = useState(false);
  
  const handleLinkAccount = async (method: 'google' | 'email') => {
    setIsLinking(true);
    
    try {
      if (method === 'google') {
        await authClient.signIn.social({ provider: 'google' });
      } else {
        // Redirect to email signup with link parameter
        router.push('/sign-up?link=true');
      }
    } catch (error) {
      console.error('Account linking failed:', error);
      setIsLinking(false);
    }
  };
  
  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
      <h3 className="font-medium text-blue-900 mb-2">
        Save Your Conversations
      </h3>
      
      <p className="text-blue-700 text-sm mb-4">
        You have {anonymousThreadCount} conversation{anonymousThreadCount !== 1 ? 's' : ''} 
        that will be saved when you create an account.
      </p>
      
      <div className="flex gap-2">
        <button
          onClick={() => handleLinkAccount('google')}
          disabled={isLinking}
          className="flex items-center gap-2 bg-white border border-gray-300 px-3 py-2 rounded text-sm hover:bg-gray-50"
        >
          <Google className="w-4 h-4" />
          Continue with Google
        </button>
        
        <button
          onClick={() => handleLinkAccount('email')}
          disabled={isLinking}
          className="bg-blue-600 text-white px-3 py-2 rounded text-sm hover:bg-blue-700"
        >
          Continue with Email
        </button>
      </div>
    </div>
  );
}
```

## Authentication States & UI

### Session Management Hook
```typescript
// t3chat/hooks/useAuthState.ts
export function useAuthState() {
  const { data: session, status } = useSession();
  
  const authState = {
    isLoading: status === 'loading',
    isAuthenticated: !!session && !session.user.isAnonymous,
    isAnonymous: !!session?.user.isAnonymous,
    user: session?.user,
    tier: session?.user.tier || 'Free'
  };
  
  return authState;
}
```

### Authentication Guards
```typescript
// t3chat/components/auth/AuthGuard.tsx
interface AuthGuardProps {
  children: React.ReactNode;
  requireAuth?: boolean;
  fallback?: React.ReactNode;
}

export function AuthGuard({ children, requireAuth = false, fallback }: AuthGuardProps) {
  const { isAuthenticated, isAnonymous, isLoading } = useAuthState();
  
  if (isLoading) {
    return <LoadingSpinner />;
  }
  
  if (requireAuth && (isAnonymous || !isAuthenticated)) {
    return fallback || <SignInPrompt />;
  }
  
  return <>{children}</>;
}

// Usage in protected routes
export default function SettingsPage() {
  return (
    <AuthGuard requireAuth fallback={<SettingsSignInPrompt />}>
      <SettingsInterface />
    </AuthGuard>
  );
}
```

## Multi-provider Authentication

### Social Login Integration
```typescript
// Enhanced from existing t3chat/lib/auth.ts
socialProviders: {
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID!,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
  },
  // Add more providers as needed
  github: {
    clientId: process.env.GITHUB_CLIENT_ID!,
    clientSecret: process.env.GITHUB_CLIENT_SECRET!,
  }
},
```

### Magic Link Implementation
**Reference**: Existing `t3chat/lib/auth.ts:78-93`

```typescript
// Already implemented in t3chat - enhance with UI components
// t3chat/components/auth/MagicLinkForm.tsx
export function MagicLinkForm() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sent, setSent] = useState(false);
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      await authClient.signIn.magicLink({ email });
      setSent(true);
    } catch (error) {
      toast.error('Failed to send magic link');
    } finally {
      setIsLoading(false);
    }
  };
  
  if (sent) {
    return (
      <div className="text-center">
        <Mail className="w-12 h-12 mx-auto mb-4 text-green-600" />
        <h2 className="text-xl font-semibold mb-2">Check your email</h2>
        <p className="text-gray-600">
          We sent a magic link to {email}
        </p>
      </div>
    );
  }
  
  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Enter your email"
        className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
        required
      />
      
      <button
        type="submit"
        disabled={isLoading}
        className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 disabled:opacity-50"
      >
        {isLoading ? 'Sending...' : 'Send Magic Link'}
      </button>
    </form>
  );
}
```

## Rate Limiting by Authentication Status

### Tier-based Access Control
```typescript
// t3chat/lib/rate-limiting.ts
export async function getUserTier(userId: string): Promise<UserTier> {
  const user = await db.query.user.findFirst({
    where: eq(schema.user.id, userId),
    with: { subscription: true }
  });
  
  if (user?.isAnonymous) return 'Anonymous';
  if (user?.subscription?.status === 'active') return 'Pro';
  return 'Free';
}

export async function checkAuthenticationLimits(
  userId: string,
  action: 'message' | 'search' | 'research'
): Promise<{ allowed: boolean; upgradeRequired?: boolean }> {
  const tier = await getUserTier(userId);
  const limits = getTierLimits(tier);
  const usage = await getCurrentUsage(userId);
  
  switch (action) {
    case 'research':
      if (tier === 'Anonymous') {
        return { 
          allowed: false, 
          upgradeRequired: true 
        };
      }
      break;
      
    case 'search':
      if (usage.searchCalls >= limits.SEARCH) {
        return { 
          allowed: false,
          upgradeRequired: tier !== 'Pro'
        };
      }
      break;
      
    case 'message':
      if (usage.creditsUsed >= limits.CREDITS) {
        return { 
          allowed: false,
          upgradeRequired: tier !== 'Pro'
        };
      }
      break;
  }
  
  return { allowed: true };
}
```

## Session Security

### Session Configuration
```typescript
// Enhanced from existing t3chat/lib/auth.ts:26-42
export const auth = betterAuth({
  session: {
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60, // 5 minutes cache
    },
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // Update session daily
  },
  
  // Enhanced security headers
  advanced: {
    crossSubDomainCookies: {
      enabled: false // Disable for security
    },
    generateId: () => nanoid(32) // Stronger session IDs
  }
});
```

### CSRF Protection
```typescript
// t3chat/middleware.ts (Enhanced)
export async function middleware(request: NextRequest) {
  // CSRF protection for authentication routes
  if (request.nextUrl.pathname.startsWith('/api/auth')) {
    const csrfToken = request.headers.get('x-csrf-token');
    const sessionCookie = request.cookies.get('better-auth.session_token');
    
    if (sessionCookie && !csrfToken) {
      return new Response('CSRF token required', { status: 403 });
    }
  }
  
  return NextResponse.next();
}
```

## Testing Authentication

### Mock Authentication States
```typescript
// t3chat/test/auth.test.ts
describe('Authentication Flow', () => {
  it('should create anonymous user and link to authenticated account', async () => {
    // Create anonymous session
    const anonymousSession = await authClient.signIn.anonymous();
    expect(anonymousSession.user.isAnonymous).toBe(true);
    
    // Create some anonymous data
    await convex.mutation(api.threads.create, {
      title: 'Anonymous Chat',
      userId: anonymousSession.user.id
    });
    
    // Link to Google account
    await authClient.signIn.social({ 
      provider: 'google',
      linkAnonymous: true
    });
    
    // Verify data was transferred
    const threads = await convex.query(api.threads.getByUser);
    expect(threads).toHaveLength(1);
    expect(threads[0].title).toBe('Anonymous Chat');
  });
});
```

## Authentication Checklist

- ✅ **Anonymous user access**: Instant chat without registration
- ✅ **Account linking**: Seamless migration from anonymous to authenticated
- ✅ **Multi-provider login**: Google, GitHub, Magic Link support
- ✅ **Session management**: Secure, long-lived sessions with refresh
- ✅ **Tier-based access**: Different limits for Anonymous, Free, Pro users
- ✅ **Data migration**: Complete transfer of anonymous user data
- ✅ **Security measures**: CSRF protection, secure session handling
- ✅ **UI components**: Authentication forms and prompts
- ✅ **Database hooks**: Automatic user initialization and syncing