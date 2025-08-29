# Real-time Features Architecture

## Overview

T3Chat leverages Convex's built-in real-time capabilities to provide instant UI updates, eliminating the need for manual WebSocket management or client-side synchronization libraries like Zero/Rocicorp used in zeronsh.

## Convex Real-time Advantages over Zero/Rocicorp

### zeronsh Approach (Zero/Rocicorp)
**Reference**: `zeronsh/package.json:41`, `zeronsh/src/zero/`

```typescript
// zeronsh manual synchronization
import { useZero } from '@rocicorp/zero/react';

const { messages, threads } = useZero({
  auth: { user: session.user.id },
  schema: zeroSchema,
});

// Manual state management and conflict resolution
```

### T3Chat Approach (Convex)
```typescript
// Automatic real-time synchronization
import { useQuery, useMutation } from 'convex/react';

const messages = useQuery(api.messages.getByThread, { threadId });
const addMessage = useMutation(api.messages.add);

// Zero configuration real-time updates
```

## Real-time Feature Implementation

### 1. Live Message Streaming
**Reference**: `zeronsh/src/components/thread/message/message-list.tsx`

```typescript
// t3chat/components/chat/MessageStream.tsx
export function MessageStream({ threadId }: { threadId: string }) {
  // Real-time message subscription
  const messages = useQuery(api.messages.getByThread, { threadId });
  const streamingMessage = useQuery(api.messages.getStreaming, { threadId });
  
  return (
    <div className="message-stream">
      {messages?.map(message => (
        <MessageBubble key={message._id} message={message} />
      ))}
      
      {streamingMessage?.isStreaming && (
        <StreamingMessageBubble 
          content={streamingMessage.streamingContent} 
          isComplete={false}
        />
      )}
    </div>
  );
}
```

### 2. Thread Sidebar Updates
**Reference**: `zeronsh/src/components/layout/app-sidebar.tsx`

```typescript
// t3chat/components/chat/ThreadSidebar.tsx
export function ThreadSidebar() {
  const threads = useQuery(api.threads.getByUser);
  const activeGenerations = useQuery(api.threads.getGenerating);
  
  return (
    <div className="thread-sidebar">
      {threads?.map(thread => (
        <ThreadItem 
          key={thread._id} 
          thread={thread}
          isGenerating={activeGenerations?.includes(thread._id)}
        />
      ))}
    </div>
  );
}
```

## Convex Queries for Real-time Features

### Thread Management Queries
```typescript
// t3chat/convex/threads.ts
export const getByUser = query({
  args: { userId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const userId = args.userId || identity?.subject;
    
    if (!userId) return [];
    
    return await ctx.db
      .query('threads')
      .withIndex('by_user_visible', q => 
        q.eq('userId', userId).eq('visibility', 'visible')
      )
      .order('desc')
      .take(50);
  }
});

export const getGenerating = query({
  args: { userId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const userId = args.userId || identity?.subject;
    
    if (!userId) return [];
    
    const generatingThreads = await ctx.db
      .query('threads')
      .withIndex('by_generation_status', q =>
        q.eq('userId', userId).eq('generationStatus', 'generating')
      )
      .collect();
      
    return generatingThreads.map(t => t._id);
  }
});
```

### Message Streaming Queries
```typescript  
// t3chat/convex/messages.ts
export const getByThread = query({
  args: { threadId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('messages')
      .withIndex('by_thread', q => q.eq('threadId', args.threadId))
      .order('asc')
      .collect();
  }
});

export const getStreaming = query({
  args: { threadId: v.string() },
  handler: async (ctx, args) => {
    const streamingMessage = await ctx.db
      .query('messages')
      .withIndex('by_thread', q => q.eq('threadId', args.threadId))
      .filter(q => q.eq(q.field('isStreaming'), true))
      .first();
      
    return streamingMessage;
  }
});

// Real-time token updates during streaming
export const updateStreamingContent = mutation({
  args: { 
    messageId: v.id('messages'),
    token: v.string() 
  },
  handler: async (ctx, args) => {
    const message = await ctx.db.get(args.messageId);
    if (!message) throw new Error('Message not found');
    
    const currentTokens = message.streamingContent || [];
    
    await ctx.db.patch(args.messageId, {
      streamingContent: [...currentTokens, args.token],
      updatedAt: Date.now()
    });
  }
});
```

## Optimistic Updates Implementation

### Message Sending with Optimistic UI
**Reference**: `zeronsh/src/components/thread/multi-modal-input.tsx`

```typescript
// t3chat/components/chat/ChatInput.tsx
export function ChatInput({ threadId }: { threadId: string }) {
  const sendMessage = useMutation(api.messages.send);
  const [optimisticMessage, setOptimisticMessage] = useState(null);
  
  const handleSend = async (content: string) => {
    // Optimistic update - show message immediately
    const tempMessage = {
      id: nanoid(),
      content,
      role: 'user',
      createdAt: Date.now(),
      isOptimistic: true
    };
    setOptimisticMessage(tempMessage);
    
    try {
      // Send to server
      await sendMessage({ threadId, content });
      setOptimisticMessage(null); // Remove optimistic message
    } catch (error) {
      // Handle error, revert optimistic update
      setOptimisticMessage(null);
      toast.error('Failed to send message');
    }
  };
  
  return (
    <form onSubmit={handleSend}>
      <textarea placeholder="Type a message..." />
      <button type="submit">Send</button>
    </form>
  );
}
```

### Thread Creation with Immediate Feedback
```typescript
// t3chat/components/chat/NewChatButton.tsx
export function NewChatButton() {
  const router = useRouter();
  const createThread = useMutation(api.threads.create);
  
  const handleNewChat = async () => {
    const tempThreadId = nanoid();
    
    // Navigate immediately for instant feedback
    router.push(`/chat/${tempThreadId}`);
    
    try {
      // Create actual thread
      const thread = await createThread({ 
        threadId: tempThreadId,
        title: 'New Chat'
      });
      
      // Update URL with real ID if different
      if (thread.threadId !== tempThreadId) {
        router.replace(`/chat/${thread.threadId}`);
      }
    } catch (error) {
      // Revert navigation on error
      router.push('/chat');
      toast.error('Failed to create chat');
    }
  };
  
  return (
    <button onClick={handleNewChat}>
      <Plus className="w-4 h-4" />
      New Chat
    </button>
  );
}
```

## Live Presence Indicators

### Typing Indicators
```typescript
// t3chat/convex/presence.ts
export const updateTyping = mutation({
  args: { 
    threadId: v.string(),
    isTyping: v.boolean() 
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error('Unauthorized');
    
    // Store typing status with expiration
    await ctx.db.insert('typingStatus', {
      userId: identity.subject,
      threadId: args.threadId,
      isTyping: args.isTyping,
      expiresAt: Date.now() + 10000 // 10 second timeout
    });
  }
});

export const getTypingUsers = query({
  args: { threadId: v.string() },
  handler: async (ctx, args) => {
    const now = Date.now();
    
    return await ctx.db
      .query('typingStatus')
      .withIndex('by_thread', q => q.eq('threadId', args.threadId))
      .filter(q => 
        q.and(
          q.eq(q.field('isTyping'), true),
          q.gt(q.field('expiresAt'), now)
        )
      )
      .collect();
  }
});
```

### Online Status
```typescript
// t3chat/hooks/usePresence.ts
export function usePresence(threadId: string) {
  const updatePresence = useMutation(api.presence.update);
  
  useEffect(() => {
    // Update presence every 30 seconds
    const interval = setInterval(() => {
      updatePresence({ 
        threadId,
        lastSeen: Date.now(),
        status: 'active'
      });
    }, 30000);
    
    return () => clearInterval(interval);
  }, [threadId]);
}
```

## Real-time Notifications

### In-App Notifications
```typescript
// t3chat/components/notifications/NotificationSystem.tsx
export function NotificationSystem() {
  const notifications = useQuery(api.notifications.getUnread);
  
  useEffect(() => {
    if (notifications?.length > 0) {
      notifications.forEach(notification => {
        toast(notification.message, {
          type: notification.type,
          duration: 5000
        });
      });
      
      // Mark as read
      markAsRead({ ids: notifications.map(n => n._id) });
    }
  }, [notifications]);
  
  return null; // Toast notifications handle display
}
```

### Browser Push Notifications  
```typescript
// t3chat/lib/push-notifications.ts
export async function setupPushNotifications(userId: string) {
  if ('serviceWorker' in navigator && 'PushManager' in window) {
    const registration = await navigator.serviceWorker.register('/sw.js');
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: process.env.NEXT_PUBLIC_VAPID_KEY
    });
    
    // Store subscription in Convex
    await convex.mutation(api.pushSubscriptions.create, {
      userId,
      subscription: JSON.stringify(subscription)
    });
  }
}
```

## Performance Optimizations

### Query Optimization
```typescript
// Efficient pagination for message history
export const getMessagesPaginated = query({
  args: { 
    threadId: v.string(),
    cursor: v.optional(v.string()),
    limit: v.optional(v.number())
  },
  handler: async (ctx, args) => {
    const limit = args.limit || 50;
    let query = ctx.db
      .query('messages')
      .withIndex('by_thread', q => q.eq('threadId', args.threadId));
    
    if (args.cursor) {
      query = query.filter(q => q.lt(q.field('_id'), args.cursor));
    }
    
    const messages = await query
      .order('desc')
      .take(limit + 1);
    
    const hasMore = messages.length > limit;
    const items = hasMore ? messages.slice(0, -1) : messages;
    
    return {
      messages: items,
      nextCursor: hasMore ? items[items.length - 1]._id : null,
      hasMore
    };
  }
});
```

### Selective Subscriptions
```typescript
// Only subscribe to active thread messages
export function useActiveThreadMessages(activeThreadId: string | null) {
  return useQuery(
    api.messages.getByThread, 
    activeThreadId ? { threadId: activeThreadId } : 'skip'
  );
}

// Subscribe to thread list but not all message details
export function useThreadList() {
  return useQuery(api.threads.getListView); // Returns minimal thread data
}
```

## Connection Management

### Automatic Reconnection
```typescript
// t3chat/components/providers/ConvexProvider.tsx
export function ConvexProvider({ children }: { children: React.ReactNode }) {
  return (
    <ConvexReactClient client={convex}>
      <ConvexAuthProvider>
        <ConnectionMonitor />
        {children}
      </ConvexAuthProvider>
    </ConvexReactClient>
  );
}

function ConnectionMonitor() {
  const connectionState = useConvexAuth();
  
  useEffect(() => {
    if (!connectionState.isAuthenticated && connectionState.isLoading === false) {
      // Handle connection loss
      toast.error('Connection lost. Attempting to reconnect...');
    }
  }, [connectionState]);
  
  return null;
}
```

### Offline Support
```typescript
// t3chat/hooks/useOfflineSupport.ts
export function useOfflineSupport() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);
  
  return isOnline;
}
```

## Testing Real-time Features

### Mock Real-time Updates
```typescript
// t3chat/test/mocks/convex.ts
export const mockConvexQueries = {
  'messages:getByThread': jest.fn(),
  'threads:getByUser': jest.fn(),
  'messages:getStreaming': jest.fn()
};

export function mockStreamingMessage(threadId: string, tokens: string[]) {
  mockConvexQueries['messages:getStreaming'].mockReturnValue({
    threadId,
    isStreaming: true,
    streamingContent: tokens
  });
}
```

### Integration Testing
```typescript
// t3chat/test/realtime.test.ts
describe('Real-time message streaming', () => {
  it('should update UI as tokens arrive', async () => {
    render(<MessageStream threadId="test-thread" />);
    
    // Simulate streaming tokens
    act(() => {
      mockStreamingMessage('test-thread', ['Hello']);
    });
    
    expect(screen.getByText('Hello')).toBeInTheDocument();
    
    act(() => {
      mockStreamingMessage('test-thread', ['Hello', ' World']);
    });
    
    expect(screen.getByText('Hello World')).toBeInTheDocument();
  });
});
```

## Migration from Zero/Rocicorp Pattern

### Replace Zero Hooks
```typescript
// Before (zeronsh pattern):
const { messages } = useZero({ 
  auth: { user: userId },
  schema: zeroSchema 
});

// After (T3Chat pattern):
const messages = useQuery(api.messages.getByThread, { threadId });
```

### Replace Manual Synchronization
```typescript
// Before (zeronsh pattern):  
await zero.mutate.messages.insert({
  id: nanoid(),
  content: 'Hello',
  threadId
});

// After (T3Chat pattern):
await addMessage({ 
  content: 'Hello',
  threadId 
});
```

## Real-time Feature Checklist

- ✅ **Live message streaming**: Tokens appear as they're generated
- ✅ **Thread sidebar updates**: New threads and status changes
- ✅ **Optimistic UI updates**: Instant feedback on user actions
- ✅ **Typing indicators**: Show when others are composing
- ✅ **Online presence**: User activity status
- ✅ **Push notifications**: Background message alerts
- ✅ **Connection management**: Auto-reconnection and offline support
- ✅ **Performance optimization**: Selective subscriptions and pagination