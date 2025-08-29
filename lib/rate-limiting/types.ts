// Rate Limiting Types for T3Chat

export type UserTier = 'Anonymous' | 'Free' | 'Pro' | 'Enterprise'

export interface UserLimits {
  CREDITS: number
  SEARCH: number
  RESEARCH: number
  FILE_UPLOADS: number
}

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

export interface RateLimitUsage {
  creditsUsed: number
  searchCallsUsed: number
  researchCallsUsed: number
  fileUploadsUsed: number
  periodStart: Date
  resetsAt: Date
  currentTier: UserTier
}

export type RateLimitAction = 'message' | 'search' | 'research' | 'file_upload'

export interface RateLimitResult {
  allowed: boolean
  reason?: string
  remainingCredits?: number
  remainingCalls?: number
  remainingUploads?: number
  resetsAt?: Date
  upgradeRequired?: boolean
  creditsRequired?: number
}

export interface RateLimitMetadata {
  model?: string
  tools?: string[]
  estimatedTokens?: number
}
