# Convex User Sync Setup Guide

This guide explains how to set up and test the user sync functionality between Better Auth and Convex.

## Environment Variables Required

Add these environment variables to your `.env.local` file:

```bash
# Convex Configuration
CONVEX_URL="https://your-deployment-name.convex.cloud"
# Optional: For authenticated mutations (if needed)
CONVEX_DEPLOY_KEY="your-convex-deploy-key"
```

To find your Convex URL:
1. Run `npx convex dev` in your project
2. Your deployment URL will be shown in the console
3. It should look like: `https://happy-animal-123.convex.cloud`

## Setup Steps

### 1. Initialize Convex (if not done already)
```bash
npx convex dev
```

This will:
- Generate the Convex API from your schema
- Start the development server
- Show your deployment URL

### 2. Deploy Your Schema and Functions
The schema and mutation functions are already created in:
- `convex/schema.ts` - Defines the users table
- `convex/users.ts` - Contains the `syncUser` mutation

### 3. Test the Setup

#### Option A: Test with a new user signup
1. Start your Next.js application: `npm run dev`
2. Navigate to your signup/login page
3. Sign up with a new Google account or email
4. Check your console logs for sync messages:
   ```
   🎯 Better Auth user created, syncing to Convex: user@example.com
   🔄 Syncing user to Convex: user@example.com  
   ✅ Successfully synced user to Convex: created user user@example.com
   ✅ User sync to Convex successful: created
   ```

#### Option B: Test the sync function directly
You can test the Convex mutation directly in the Convex dashboard:
1. Open your Convex dashboard
2. Go to the Functions tab
3. Find `users:syncUser` 
4. Test it with sample data:
   ```json
   {
     "authUserId": "test-123",
     "name": "Test User", 
     "email": "test@example.com",
     "emailVerified": true,
     "authCreatedAt": 1640995200000,
     "authUpdatedAt": 1640995200000
   }
   ```

### 4. Verify Data in Convex
1. Open Convex dashboard
2. Go to Data tab
3. Check the `users` table
4. Verify your synced user data appears

## How It Works

1. **User signs up** via Better Auth (Google OAuth, email, etc.)
2. **Better Auth creates user** in PostgreSQL database
3. **Database hook triggers** after user creation (`databaseHooks.user.create.after`)
4. **Sync function calls** Convex HTTP API to create/update user
5. **Convex mutation** (`syncUser`) handles the upsert logic
6. **User data synced** to Convex for use in chat/conversation features

## Troubleshooting

### Common Issues:

1. **"CONVEX_URL environment variable not set"**
   - Make sure you have `CONVEX_URL` in your `.env.local`
   - Restart your Next.js server after adding env vars

2. **HTTP 404 errors calling Convex**
   - Verify your `CONVEX_URL` is correct
   - Make sure `npx convex dev` is running
   - Check that your functions are deployed

3. **Sync fails but user creation succeeds**
   - This is expected behavior - user registration won't be blocked
   - Check console logs for specific error messages
   - Verify Convex is running and accessible

4. **Users not appearing in Convex dashboard**
   - Check if the mutation was called successfully in logs
   - Verify the `users` table exists in your Convex schema
   - Refresh the Convex dashboard

### Debug Mode:
Enable detailed logging by checking your Next.js console and Convex function logs in the dashboard.