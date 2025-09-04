import { db } from '@/db/drizzle'
import {
  account,
  session,
  subscription,
  user,
  verification,
  rateLimits,
  usageLogs,
} from '@/db/schema'
import { ConvexHttpClient } from 'convex/browser'
import { api } from '@/convex/_generated/api'
import { eq } from 'drizzle-orm'
import { checkout, polar, portal, usage, webhooks } from '@polar-sh/better-auth'
import { Polar } from '@polar-sh/sdk'
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { nextCookies } from 'better-auth/next-js'
import { syncUserToConvex } from './convex-sync'
import {
  anonymous,
  emailOTP,
  jwt,
  magicLink,
  organization,
} from 'better-auth/plugins'
import { resend } from './resend'
import MagicLinkEmail from '@/emails/magicLink'

// Utility function to safely parse dates
function safeParseDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null
  if (value instanceof Date) return value
  return new Date(value)
}

const polarClient = new Polar({
  accessToken: process.env.POLAR_ACCESS_TOKEN,
  server: 'sandbox',
})

export const auth = betterAuth({
  trustedOrigins: [`${process.env.NEXT_PUBLIC_APP_URL}`],
  allowedDevOrigins: [`${process.env.NEXT_PUBLIC_APP_URL}`],
  cookieCache: {
    enabled: true,
    maxAge: 5 * 60, // Cache duration in seconds
  },
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema: {
      user,
      session,
      account,
      verification,
      subscription,
    },
  }),
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    },
  },
  // Database hooks for syncing user data to Convex
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          console.log(
            '🎯 Better Auth user created, syncing to Convex:',
            user.email
          )

          // Sync user to Convex database
          const syncResult = await syncUserToConvex(user)

          if (syncResult) {
            console.log(
              `✅ User sync to Convex successful: ${syncResult.action}`
            )
          } else {
            console.error('❌ Failed to sync user to Convex')
            // Note: We don't throw an error here to avoid breaking user registration
            // The user registration should succeed even if Convex sync fails
          }
        },
      },
    },
  },
  plugins: [
    organization(),
    jwt(),
    magicLink({
      sendMagicLink: async ({ email, token, url }) => {
        console.log({
          email,
          token,
          url,
        })

        await resend.emails.send({
          from: 'Better-chat <no-reply@abhishekgusain.com>',
          to: email,
          subject: 'Your magic link',
          react: MagicLinkEmail({ url }),
        })
      },
    }),
    anonymous({
      onLinkAccount: async ({ anonymousUser, newUser }) => {
        console.log(
          `🔗 Linking anonymous user ${anonymousUser.user.id} to authenticated user ${newUser.user.id}`
        )

        try {
          // Transfer Convex data from anonymous to authenticated user
          const convexClient = new ConvexHttpClient(
            process.env.NEXT_PUBLIC_CONVEX_URL!
          )

          await convexClient.mutation(api.auth.linkAnonymousAccount, {
            anonymousUserId: anonymousUser.user.id,
            authenticatedUserId: newUser.user.id,
          })

          // Transfer PostgreSQL data (rate limits, usage logs)
          await db
            .update(rateLimits)
            .set({ userId: newUser.user.id })
            .where(eq(rateLimits.userId, anonymousUser.user.id))

          await db
            .update(usageLogs)
            .set({ userId: newUser.user.id })
            .where(eq(usageLogs.userId, anonymousUser.user.id))

          console.log(
            `✅ Successfully linked anonymous account to authenticated user`
          )
        } catch (error) {
          console.error(`❌ Failed to link anonymous account:`, error)
          // Don't throw - allow the auth process to continue
        }
      },
    }),
    polar({
      client: polarClient,
      createCustomerOnSignUp: false,
      use: [
        checkout({
          products: [
            {
              productId:
                process.env.NEXT_PUBLIC_STARTER_TIER ||
                (() => {
                  throw new Error(
                    'NEXT_PUBLIC_STARTER_TIER environment variable is required'
                  )
                })(),
              slug:
                process.env.NEXT_PUBLIC_STARTER_SLUG ||
                (() => {
                  throw new Error(
                    'NEXT_PUBLIC_STARTER_SLUG environment variable is required'
                  )
                })(),
            },
          ],
          successUrl: `${process.env.NEXT_PUBLIC_APP_URL}/${process.env.POLAR_SUCCESS_URL}`,
          authenticatedUsersOnly: true,
        }),
        portal(),
        usage(),
        webhooks({
          secret:
            process.env.POLAR_WEBHOOK_SECRET ||
            (() => {
              throw new Error(
                'POLAR_WEBHOOK_SECRET environment variable is required'
              )
            })(),
          onPayload: async ({ data, type }) => {
            if (
              type === 'subscription.created' ||
              type === 'subscription.active' ||
              type === 'subscription.canceled' ||
              type === 'subscription.revoked' ||
              type === 'subscription.uncanceled' ||
              type === 'subscription.updated'
            ) {
              console.log('🎯 Processing subscription webhook:', type)
              console.log('📦 Payload data:', JSON.stringify(data, null, 2))

              try {
                // STEP 1: Extract user ID from customer data
                const userId = data.customer?.externalId
                // STEP 2: Build subscription data
                const subscriptionData = {
                  id: data.id,
                  createdAt: new Date(data.createdAt),
                  modifiedAt: safeParseDate(data.modifiedAt),
                  amount: data.amount,
                  currency: data.currency,
                  recurringInterval: data.recurringInterval,
                  status: data.status,
                  currentPeriodStart:
                    safeParseDate(data.currentPeriodStart) || new Date(),
                  currentPeriodEnd:
                    safeParseDate(data.currentPeriodEnd) || new Date(),
                  cancelAtPeriodEnd: data.cancelAtPeriodEnd || false,
                  canceledAt: safeParseDate(data.canceledAt),
                  startedAt: safeParseDate(data.startedAt) || new Date(),
                  endsAt: safeParseDate(data.endsAt),
                  endedAt: safeParseDate(data.endedAt),
                  customerId: data.customerId,
                  productId: data.productId,
                  discountId: data.discountId || null,
                  checkoutId: data.checkoutId || '',
                  customerCancellationReason:
                    data.customerCancellationReason || null,
                  customerCancellationComment:
                    data.customerCancellationComment || null,
                  metadata: data.metadata
                    ? JSON.stringify(data.metadata)
                    : null,
                  customFieldData: data.customFieldData
                    ? JSON.stringify(data.customFieldData)
                    : null,
                  userId: userId as string | null,
                }

                console.log('💾 Final subscription data:', {
                  id: subscriptionData.id,
                  status: subscriptionData.status,
                  userId: subscriptionData.userId,
                  amount: subscriptionData.amount,
                })

                // STEP 3: Use Drizzle's onConflictDoUpdate for proper upsert
                await db
                  .insert(subscription)
                  .values(subscriptionData)
                  .onConflictDoUpdate({
                    target: subscription.id,
                    set: {
                      modifiedAt: subscriptionData.modifiedAt || new Date(),
                      amount: subscriptionData.amount,
                      currency: subscriptionData.currency,
                      recurringInterval: subscriptionData.recurringInterval,
                      status: subscriptionData.status,
                      currentPeriodStart: subscriptionData.currentPeriodStart,
                      currentPeriodEnd: subscriptionData.currentPeriodEnd,
                      cancelAtPeriodEnd: subscriptionData.cancelAtPeriodEnd,
                      canceledAt: subscriptionData.canceledAt,
                      startedAt: subscriptionData.startedAt,
                      endsAt: subscriptionData.endsAt,
                      endedAt: subscriptionData.endedAt,
                      customerId: subscriptionData.customerId,
                      productId: subscriptionData.productId,
                      discountId: subscriptionData.discountId,
                      checkoutId: subscriptionData.checkoutId,
                      customerCancellationReason:
                        subscriptionData.customerCancellationReason,
                      customerCancellationComment:
                        subscriptionData.customerCancellationComment,
                      metadata: subscriptionData.metadata,
                      customFieldData: subscriptionData.customFieldData,
                      userId: subscriptionData.userId,
                    },
                  })

                console.log('✅ Upserted subscription:', data.id)
              } catch (error) {
                console.error(
                  '💥 Error processing subscription webhook:',
                  error
                )
                // Don't throw - let webhook succeed to avoid retries
              }
            }
          },
        }),
      ],
    }),
    nextCookies(),
  ],
})
