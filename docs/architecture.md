# T3Chat Architecture Overview

## Project Vision

T3Chat is a comprehensive AI chat application that enables users to interact with multiple AI providers (Claude, GPT, Gemini, etc.) through a unified interface. The application features real-time messaging, multi-modal input support, resumable streaming, anonymous user capabilities, and tier-based usage limits.

## Core Architecture Philosophy

### Hybrid Database Strategy
- **PostgreSQL + Drizzle**: Authentication, user management, subscriptions, and rate limiting
- **Convex**: Chat threads, messages, real-time updates, and AI-related data
- **Benefits**: Leverage Convex's built-in real-time capabilities while maintaining robust auth/billing infrastructure

### Technology Stack

#### Frontend
- **Next.js 14**: App router, server components, API routes
- **React 19**: Latest features and concurrent rendering
- **Tailwind CSS**: Utility-first styling with shadcn/ui components
- **Convex Client**: Real-time database synchronization

#### Backend
- **PostgreSQL**: Primary database for auth, billing, and rate limiting
- **Convex**: Real-time database for chat data and AI interactions
- **Better Auth**: Authentication with anonymous users, magic links, OAuth
- **Polar**: Payment processing and subscription management

#### AI Integration
- **Vercel AI SDK**: Streaming AI responses and tool integration
- **Multiple Providers**: OpenAI, Anthropic, Google, DeepSeek, etc.
- **Resumable Streams**: Connection recovery and stream continuation
- **Tool Support**: Web search, research tools, file analysis

## High-Level Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         Frontend (Next.js)                      │
├─────────────────────────────────────────────────────────────────┤
│  Chat Interface  │  Settings  │  Billing  │  Anonymous Support  │
└─────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                     API Layer (Next.js Routes)                  │
├─────────────────────────────────────────────────────────────────┤
│   Auth Routes   │   AI Streaming   │   File Upload   │   Tools  │
└─────────────────────────────────────────────────────────────────┘
                                  │
                    ┌─────────────┴─────────────┐
                    ▼                           ▼
┌──────────────────────────────┐    ┌──────────────────────────────┐
│      PostgreSQL + Drizzle    │    │         Convex Database      │
├──────────────────────────────┤    ├──────────────────────────────┤
│ • Users & Auth               │    │ • Threads & Messages         │
│ • Sessions & Accounts        │    │ • Real-time Updates          │
│ • Subscriptions & Billing    │    │ • AI Model Configurations    │
│ • Rate Limits & Usage        │    │ • Streaming Tasks            │
│ • API Keys (Pro feature)     │    │ • User Preferences           │
└──────────────────────────────┘    └──────────────────────────────┘
                                                  │
                                                  ▼
                                    ┌──────────────────────────────┐
                                    │       AI Providers           │
                                    ├──────────────────────────────┤
                                    │ • OpenAI GPT Models          │
                                    │ • Anthropic Claude           │
                                    │ • Google Gemini              │
                                    │ • DeepSeek Models            │
                                    │ • Other Providers            │
                                    └──────────────────────────────┘
```

## Data Flow Architecture

### Authentication & User Management
1. User signs in via Better Auth (Google OAuth, Magic Link, or Anonymous)
2. User record created in PostgreSQL
3. Database hook triggers Convex user synchronization
4. Session established with both databases

### Chat Message Flow
1. User sends message through Next.js frontend
2. Message stored in Convex (instant UI update)
3. API route validates permissions via PostgreSQL rate limits
4. AI provider streams response
5. Streaming tokens stored in Convex in real-time
6. Usage statistics updated in PostgreSQL

### Real-time Updates
- Convex handles all real-time synchronization automatically
- No need for manual WebSocket management or libraries like Zero/Rocicorp
- Optimistic updates for instant UI responsiveness

## Key Features Inherited from Zeronsh

### 1. Multi-Provider AI Integration
**Reference**: `zeronsh/src/ai/service.ts`, `zeronsh/src/ai/stream.ts`
- Unified interface for multiple AI providers
- Resumable streaming with connection recovery
- Tool integration (search, research, file analysis)

### 2. Anonymous User Support
**Reference**: `zeronsh/src/database/auth-schema.ts`, Better Auth anonymous plugin
- Users can chat without registration
- Option to link anonymous sessions to accounts
- Seamless migration of chat history

### 3. Tier-Based Rate Limiting
**Reference**: `zeronsh/src/lib/constants.ts`, `zeronsh/src/ai/service.ts:91-103`
- Anonymous: 10 credits
- Free: 20 credits  
- Pro: 200 credits
- Credit consumption based on model complexity

### 4. Multi-Modal Input Support
**Reference**: `zeronsh/src/components/thread/multi-modal-input.tsx`
- Text, images, PDFs, and document support
- Drag-and-drop file handling
- File preview and attachment management

### 5. Resumable AI Streaming
**Reference**: `zeronsh/src/ai/service.ts:212-243`, `zeronsh/src/routes/api.thread.$threadId.stream.ts`
- Stream interruption recovery
- Continue previous responses
- Connection state management

### 6. Advanced Settings & Customization
**Reference**: `zeronsh/src/database/app-schema.ts:98-116`
- Model preferences and pinning
- Custom instructions and biography
- Theme and appearance options
- Keyboard shortcuts customization

## Security & Privacy
- Better Auth handles secure authentication
- API keys encrypted at rest (Pro feature)
- Anonymous user data protection
- Rate limiting prevents abuse
- Polar handles PCI compliance for payments

## Scalability Considerations
- Convex auto-scales real-time features
- PostgreSQL for consistent auth/billing data
- Stateless API design for horizontal scaling
- CDN integration for static assets
- File storage via Convex or cloud providers

## Development Workflow
1. Database changes: Update both Drizzle and Convex schemas
2. Authentication: Handled via Better Auth with Polar integration
3. Chat features: Develop against Convex with real-time updates
4. AI integration: Use Vercel AI SDK with streaming support
5. Testing: Component tests with Convex local development

## Next Steps
See individual feature documentation for detailed implementation guides:
- [Database Design](./database-design.md)
- [AI Integration](./ai-integration.md)
- [Real-time Features](./realtime-features.md)
- [Authentication Flow](./authentication.md)
- [Rate Limiting](./rate-limiting.md)
- [Implementation Plan](./implementation-plan.md)