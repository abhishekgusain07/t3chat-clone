#!/usr/bin/env tsx

// Quick script to seed available models in Convex
// Run with: npx tsx scripts/seed-models.ts

import { ConvexHttpClient } from 'convex/browser'
import { api } from '../convex/_generated/api'

async function seedModels() {
  const client = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!)

  try {
    const result = await client.mutation(api.availableModels.seed, {})
    console.log('✅ Models seeded:', result.message)
  } catch (error) {
    console.error('❌ Failed to seed models:', error)
  }
}

seedModels()
