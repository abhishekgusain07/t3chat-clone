import { auth } from './auth'
import { headers } from 'next/headers'

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
      console.log('✅ Anonymous session created:', {
        userId: anonymousResult.response.user.id,
        isAnonymous: (anonymousResult.response.user as any).isAnonymous ?? true,
      })

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
