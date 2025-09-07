import { auth } from './auth'
import { headers } from 'next/headers'
import { syncUserToConvex } from './convex-sync'

/**
 * Gets or creates a session for the current request
 * Automatically creates anonymous sessions for unauthenticated users
 * Based on the working pattern from the reference implementation
 */
export async function getOrCreateSession() {
  try {
    // Get request headers
    const headersList = await headers()

    // Try to get existing session
    const existingSession = await auth.api.getSession({
      headers: headersList,
    })

    if (existingSession?.user?.id) {
      return {
        success: true,
        session: existingSession,
        isNewSession: false,
      }
    }

    // No existing session, create anonymous session
    console.log('🔄 No existing session, creating anonymous session...')

    const anonymousResult = await auth.api.signInAnonymous({
      headers: headersList,
      returnHeaders: true,
    })

    if (anonymousResult?.response?.user) {
      const user = anonymousResult.response.user
      console.log('✅ Anonymous session created:', {
        userId: user.id,
        isAnonymous: (user as { isAnonymous?: boolean }).isAnonymous ?? true,
      })

      // Sync the new anonymous user to Convex
      try {
        console.log('🔄 Syncing new anonymous user to Convex...')
        const syncResult = await syncUserToConvex({
          id: user.id,
          name: user.name,
          email: user.email,
          emailVerified: user.emailVerified,
          image: user.image,
          isAnonymous: true,
          createdAt: new Date(user.createdAt),
          updatedAt: new Date(user.updatedAt),
        })

        if (syncResult) {
          console.log(
            `✅ Anonymous user synced to Convex: ${syncResult.action}`
          )
        } else {
          console.error('❌ Failed to sync anonymous user to Convex')
          // Don't fail the session creation, just log the error
        }
      } catch (error) {
        console.error('❌ Error syncing anonymous user to Convex:', error)
        // Don't fail the session creation, just log the error
      }

      // Return the session data in the same format as getSession
      return {
        success: true,
        session: anonymousResult.response,
        isNewSession: true,
        headers: anonymousResult.headers,
      }
    } else {
      console.error('❌ Failed to create anonymous session:', anonymousResult)
      return {
        success: false,
        error: 'Failed to create anonymous session',
        session: null,
      }
    }
  } catch (error) {
    console.error('❌ Session creation error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown session error',
      session: null,
    }
  }
}

/**
 * Middleware helper to ensure session exists
 * Returns session or creates anonymous session if needed
 */
export async function ensureSession() {
  const result = await getOrCreateSession()

  if (!result.success || !result.session) {
    throw new Error(result.error || 'Failed to establish session')
  }

  return result.session
}
