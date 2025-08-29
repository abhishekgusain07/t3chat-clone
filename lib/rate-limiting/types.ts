// Rate Limiting Types and Constants for T3Chat
// Reference: zeronsh/src/lib/constants.ts for tier system

import { z } from 'zod'

// User Tier System
export type UserTier = 'Anonymous' | 'Free' | 'Pro' | 'Enterprise'

// Rate Limit Actions
export type RateLimitAction = 'message' | 'search' | 'research' | 'file_upload'

// User Limits Configuration
export interface UserLimits {
  CREDITS: number // General AI usage credits
  SEARCH: number // Web search tool calls
  RESEARCH: number // Research tool calls
  FILE_UPLOADS: number // File attachment limit
}

// Tier-based limits with progressive enhancement
export const TIER_LIMITS: Record<UserTier, UserLimits> = {
  Anonymous: {
    CREDITS: 10,
    SEARCH: 5,
    RESEARCH: 0,
    FILE_UPLOADS: 3,
  },
  Free: {
    CREDITS: 20,
    SEARCH: 5,
    RESEARCH: 0,
    FILE_UPLOADS: 5,
  },
  Pro: {
    CREDITS: 200,
    SEARCH: 50,
    RESEARCH: 5,
    FILE_UPLOADS: 50,
  },
  Enterprise: {
    CREDITS: 1000,
    SEARCH: 200,
    RESEARCH: 20,
    FILE_UPLOADS: 200,
  },
}

// Rate Limit Usage Tracking
export interface RateLimitUsage {
  creditsUsed: number
  searchCallsUsed: number
  researchCallsUsed: number
  fileUploadsUsed: number
  currentTier: UserTier
  periodStart: Date
  resetsAt: Date
}

// Rate Limit Check Result
export interface RateLimitResult {
  allowed: boolean
  reason?: string
  creditsRequired?: number
  remainingCredits?: number
  remainingCalls?: number
  remainingUploads?: number
  resetsAt?: Date
  upgradeRequired?: boolean
  tierInfo?: {
    current: UserTier
    recommended?: UserTier
  }
}

// Rate Limit Metadata for Validation
export interface RateLimitMetadata {
  model?: string
  estimatedTokens?: number
  tools?: string[]
  fileSize?: number
  searchQuery?: string
}

// Validation Schemas
export const RateLimitActionSchema = z.enum([
  'message',
  'search',
  'research',
  'file_upload',
])

export const RateLimitMetadataSchema = z
  .object({
    model: z.string().optional(),
    estimatedTokens: z.number().min(0).optional(),
    tools: z.array(z.string()).optional(),
    fileSize: z.number().min(0).optional(),
    searchQuery: z.string().optional(),
  })
  .optional()

export const RateLimitCheckRequestSchema = z.object({
  action: RateLimitActionSchema,
  metadata: RateLimitMetadataSchema,
})

// Error Types
export class RateLimitError extends Error {
  constructor(
    message: string,
    public code: string,
    public upgradeRequired = false,
    public resetsAt?: Date
  ) {
    super(message)
    this.name = 'RateLimitError'
  }
}

// Rate Limit Period Configuration
export const RATE_LIMIT_PERIOD_HOURS = 24
export const RATE_LIMIT_RESET_BUFFER_MINUTES = 5 // Extra time to prevent race conditions

// Usage Log Types
export type UsageType =
  | 'message'
  | 'search'
  | 'research'
  | 'file_upload'
  | 'bonus_credits'

export interface UsageLogEntry {
  id: string
  userId: string
  usageType: UsageType
  creditsConsumed: number
  modelUsed?: string
  success: boolean
  errorMessage?: string
  metadata?: Record<string, any>
  sessionId?: string
  createdAt: Date
}
