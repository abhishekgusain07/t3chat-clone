import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    // Better Auth user fields
    authUserId: v.string(), // Maps to Better Auth user.id
    name: v.string(),
    email: v.string(), 
    emailVerified: v.boolean(),
    image: v.optional(v.string()),
    // Timestamps
    authCreatedAt: v.number(), // Store as timestamp for Better Auth compatibility
    authUpdatedAt: v.number(),
  })
    .index("by_auth_user_id", ["authUserId"]) // For efficient lookups by Better Auth ID
    .index("by_email", ["email"]), // For efficient email lookups

  // Add other tables for your chat/conversation features as needed
  // conversations: defineTable({...}),
  // messages: defineTable({...}),
});