import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Sync user from Better Auth to Convex database
export const syncUser = mutation({
  args: {
    authUserId: v.string(),
    name: v.string(), 
    email: v.string(),
    emailVerified: v.boolean(),
    image: v.optional(v.string()),
    authCreatedAt: v.number(),
    authUpdatedAt: v.number(),
  },
  handler: async (ctx, args) => {
    // Check if user already exists
    const existingUser = await ctx.db
      .query("users")
      .withIndex("by_auth_user_id", (q) => q.eq("authUserId", args.authUserId))
      .unique();

    if (existingUser) {
      // Update existing user
      await ctx.db.patch(existingUser._id, {
        name: args.name,
        email: args.email,
        emailVerified: args.emailVerified,
        image: args.image,
        authUpdatedAt: args.authUpdatedAt,
      });
      
      console.log(`Updated user in Convex: ${args.email}`);
      return { success: true, action: "updated", userId: existingUser._id };
    } else {
      // Create new user
      const userId = await ctx.db.insert("users", {
        authUserId: args.authUserId,
        name: args.name,
        email: args.email,
        emailVerified: args.emailVerified,
        image: args.image,
        authCreatedAt: args.authCreatedAt,
        authUpdatedAt: args.authUpdatedAt,
      });
      
      console.log(`Created new user in Convex: ${args.email}`);
      return { success: true, action: "created", userId };
    }
  },
});

// Get user by Better Auth ID
export const getUserByAuthId = query({
  args: { authUserId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("users")
      .withIndex("by_auth_user_id", (q) => q.eq("authUserId", args.authUserId))
      .unique();
  },
});

// Get user by email
export const getUserByEmail = query({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .unique();
  },
});