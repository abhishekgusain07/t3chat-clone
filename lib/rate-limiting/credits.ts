// Credit Calculation System for T3Chat
// Reference: zeronsh/src/ai/service.ts credit calculation patterns

export interface ModelCreditCost {
  baseCredits: number // Base cost per message
  tokensPerCredit: number // Additional tokens per credit
  toolMultiplier: number // Multiplier when using tools
}

/**
 * Model credit costs based on computational complexity and API costs
 * Reference: zeronsh model seeding files for cost structure
 */
export const MODEL_CREDIT_COSTS: Record<string, ModelCreditCost> = {
  // OpenAI Models
  'gpt-4o-mini': {
    baseCredits: 1,
    tokensPerCredit: 10000,
    toolMultiplier: 1.5,
  },
  'gpt-4o': {
    baseCredits: 3,
    tokensPerCredit: 3000,
    toolMultiplier: 2.0,
  },
  'gpt-4-turbo': {
    baseCredits: 2,
    tokensPerCredit: 5000,
    toolMultiplier: 1.8,
  },

  // Anthropic Claude Models
  'claude-4-sonnet': {
    baseCredits: 4,
    tokensPerCredit: 2500,
    toolMultiplier: 2.0,
  },
  'claude-3.5-sonnet': {
    baseCredits: 3,
    tokensPerCredit: 3000,
    toolMultiplier: 1.8,
  },
  'claude-3-haiku': {
    baseCredits: 1,
    tokensPerCredit: 12000,
    toolMultiplier: 1.4,
  },

  // Google Gemini Models
  'gemini-2.5-pro': {
    baseCredits: 3,
    tokensPerCredit: 3500,
    toolMultiplier: 1.8,
  },
  'gemini-2.5-flash': {
    baseCredits: 2,
    tokensPerCredit: 5000,
    toolMultiplier: 1.5,
  },
  'gemini-2.0-flash': {
    baseCredits: 2,
    tokensPerCredit: 4500,
    toolMultiplier: 1.5,
  },

  // DeepSeek Models
  'deepseek-v3.1': {
    baseCredits: 2,
    tokensPerCredit: 5000,
    toolMultiplier: 1.5,
  },
  'deepseek-coder': {
    baseCredits: 1,
    tokensPerCredit: 8000,
    toolMultiplier: 1.4,
  },

  // Other Models
  'mistral-large': {
    baseCredits: 2,
    tokensPerCredit: 4000,
    toolMultiplier: 1.6,
  },
  'llama-3.1-70b': {
    baseCredits: 2,
    tokensPerCredit: 6000,
    toolMultiplier: 1.5,
  },
}

/**
 * Tool-specific credit costs
 */
export const TOOL_CREDIT_COSTS: Record<string, number> = {
  search: 1, // Web search via Exa
  research: 3, // Deep research with multiple queries
  file_analysis: 2, // File processing and analysis
  image_analysis: 2, // Vision model usage
}

/**
 * Calculate credit cost for an AI request
 * Handles edge cases and provides accurate cost estimation
 */
export function calculateCreditCost(
  model: string,
  estimatedTokens: number = 1000,
  toolsUsed: string[] = []
): number {
  // Get model cost configuration, fallback to gpt-4o-mini if unknown
  const modelCost =
    MODEL_CREDIT_COSTS[model] || MODEL_CREDIT_COSTS['gpt-4o-mini']

  // Start with base credits
  let totalCredits = modelCost.baseCredits

  // Add token-based costs if exceeding free tier
  if (estimatedTokens > modelCost.tokensPerCredit) {
    const additionalTokens = estimatedTokens - modelCost.tokensPerCredit
    const additionalCredits = Math.ceil(
      additionalTokens / modelCost.tokensPerCredit
    )
    totalCredits += additionalCredits
  }

  // Add tool costs
  let toolCredits = 0
  for (const tool of toolsUsed) {
    toolCredits += TOOL_CREDIT_COSTS[tool] || 1 // Default 1 credit for unknown tools
  }

  // Apply tool multiplier to total cost if tools are used
  if (toolsUsed.length > 0) {
    totalCredits = Math.ceil(totalCredits * modelCost.toolMultiplier)
    totalCredits += toolCredits
  }

  // Minimum 1 credit per request
  return Math.max(1, totalCredits)
}

/**
 * Estimate token count from text content
 * Rough estimation: 1 token ≈ 4 characters for most models
 */
export function estimateTokenCount(text: string): number {
  if (!text) return 0

  // Basic token estimation (more sophisticated tokenizers exist but this is sufficient)
  const roughTokens = Math.ceil(text.length / 4)

  // Add buffer for system prompts and formatting
  const bufferTokens = Math.ceil(roughTokens * 0.1)

  return roughTokens + bufferTokens
}

/**
 * Get credit cost preview for UI display
 */
export function getCreditCostPreview(
  model: string,
  messageText: string,
  toolsSelected: string[] = []
): {
  estimatedTokens: number
  estimatedCredits: number
  breakdown: {
    baseCredits: number
    tokenCredits: number
    toolCredits: number
    multiplierApplied: boolean
  }
} {
  const estimatedTokens = estimateTokenCount(messageText)
  const modelCost =
    MODEL_CREDIT_COSTS[model] || MODEL_CREDIT_COSTS['gpt-4o-mini']

  let baseCredits = modelCost.baseCredits
  let tokenCredits = 0
  let toolCredits = 0

  // Calculate token-based credits
  if (estimatedTokens > modelCost.tokensPerCredit) {
    const additionalTokens = estimatedTokens - modelCost.tokensPerCredit
    tokenCredits = Math.ceil(additionalTokens / modelCost.tokensPerCredit)
  }

  // Calculate tool credits
  for (const tool of toolsSelected) {
    toolCredits += TOOL_CREDIT_COSTS[tool] || 1
  }

  // Calculate total with multiplier
  const multiplierApplied = toolsSelected.length > 0
  let totalCredits = baseCredits + tokenCredits

  if (multiplierApplied) {
    totalCredits = Math.ceil(totalCredits * modelCost.toolMultiplier)
    totalCredits += toolCredits
  }

  return {
    estimatedTokens,
    estimatedCredits: Math.max(1, totalCredits),
    breakdown: {
      baseCredits,
      tokenCredits,
      toolCredits,
      multiplierApplied,
    },
  }
}
