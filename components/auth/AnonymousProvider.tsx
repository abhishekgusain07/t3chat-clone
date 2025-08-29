'use client'

import { useEffect } from 'react'
import { authClient } from '@/lib/auth-client'

interface AnonymousProviderProps {
  children: React.ReactNode
}

/**
 * Automatically creates anonymous sessions for unauthenticated users
 * Enables instant chat access without registration (like zeronsh)
 */
export function AnonymousProvider({ children }: AnonymousProviderProps) {
  useEffect(() => {
    const initializeAnonymousUser = async () => {
      try {
        // Check if user already has a session
        const session = await authClient.getSession()

        if (!session) {
          console.log('🔄 No session found, creating anonymous user session')

          // Create anonymous session for instant chat access
          await authClient.signIn.anonymous()

          console.log('✅ Anonymous session created successfully')
        } else {
          console.log(
            `✅ Session exists: ${session.user.isAnonymous ? 'anonymous' : 'authenticated'} user`
          )
        }
      } catch (error) {
        console.error('❌ Failed to initialize anonymous session:', error)
        // Don't prevent app from loading if anonymous session creation fails
      }
    }

    initializeAnonymousUser()
  }, [])

  // Provider doesn't render anything - it just ensures anonymous sessions exist
  return <>{children}</>
}
