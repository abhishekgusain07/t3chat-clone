'use client'

import { useEffect, useState, createContext, useContext } from 'react'
import { authClient } from '@/lib/auth-client'

interface AnonymousProviderProps {
  children: React.ReactNode
}

interface SessionContextType {
  isSessionReady: boolean
  sessionError: string | null
  refreshSession: () => Promise<void>
}

const SessionContext = createContext<SessionContextType>({
  isSessionReady: false,
  sessionError: null,
  refreshSession: async () => {},
})

export const useSession = () => useContext(SessionContext)

/**
 * Automatically creates anonymous sessions for unauthenticated users
 * Enables instant chat access without registration (like zeronsh)
 */
export function AnonymousProvider({ children }: AnonymousProviderProps) {
  const [isSessionReady, setIsSessionReady] = useState(false)
  const [sessionError, setSessionError] = useState<string | null>(null)

  const sleep = (ms: number) =>
    new Promise((resolve) => setTimeout(resolve, ms))

  const verifySession = async (retries = 3): Promise<boolean> => {
    for (let i = 0; i < retries; i++) {
      try {
        // Add small delay before verification to allow persistence
        await sleep(200 * (i + 1))

        const session = await authClient.getSession()
        if (session?.data?.user?.id) {
          console.log(`✅ Session verified (attempt ${i + 1}):`, {
            userId: session.data.user.id,
            isAnonymous: session.data.user.isAnonymous,
          })
          return true
        }
        console.log(`⚠️ Session verification failed (attempt ${i + 1})`)
      } catch (error) {
        console.warn(`❌ Session verification error (attempt ${i + 1}):`, error)
      }
    }
    return false
  }

  const checkSessionStatus = async (maxRetries = 3): Promise<boolean> => {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(
          `🔄 Checking session status (attempt ${attempt}/${maxRetries})`
        )

        // Check if session exists - server will create anonymous session if needed
        const session = await authClient.getSession()

        if (session?.data?.user?.id) {
          console.log('✅ Session verified:', {
            userId: session.data.user.id,
            isAnonymous: session.data.user.isAnonymous,
          })
          return true
        }

        // Try to trigger session creation by calling a protected endpoint
        // This will cause the server to create an anonymous session
        console.log('🔄 No session found, triggering server-side creation...')

        try {
          const response = await fetch('/api/rate-limits')
          if (response.ok || response.status === 401) {
            // Even a 401 response means the server processed the request
            // Wait a moment for session to be created, then check again
            await sleep(500)

            const sessionCheck = await authClient.getSession()
            if (sessionCheck?.data?.user?.id) {
              console.log('✅ Session created via server:', {
                userId: sessionCheck.data.user.id,
                isAnonymous: sessionCheck.data.user.isAnonymous,
              })
              return true
            }
          }
        } catch (fetchError) {
          console.warn('⚠️ Server session trigger failed:', fetchError)
        }

        // Exponential backoff
        if (attempt < maxRetries) {
          const delay = Math.pow(2, attempt) * 1000
          console.log(`⏳ Retrying session check in ${delay}ms...`)
          await sleep(delay)
        }
      } catch (error) {
        console.error(`❌ Error checking session (attempt ${attempt}):`, error)
        if (attempt < maxRetries) {
          await sleep(Math.pow(2, attempt) * 1000)
        }
      }
    }
    return false
  }

  const initializeSession = async () => {
    try {
      setSessionError(null)

      // Check for existing session
      const existingSession = await authClient.getSession()

      if (existingSession?.data?.user?.id) {
        console.log('🔍 Existing session found:', {
          userId: existingSession.data.user.id,
          isAnonymous: existingSession.data.user.isAnonymous,
        })
        setIsSessionReady(true)
        return
      }

      console.log('🔄 No existing session, checking/creating session...')

      // Check session status and trigger server-side creation if needed
      const success = await checkSessionStatus()

      if (success) {
        setIsSessionReady(true)
        console.log('🎉 Session initialization complete')
      } else {
        const error =
          'Failed to establish session after multiple attempts. The server-side session creation may be having issues.'
        console.error('❌', error)
        setSessionError(error)
        // Set ready to true anyway to not block the app, but with error state
        setIsSessionReady(true)
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'
      console.error('❌ Session initialization failed:', errorMessage)
      setSessionError(errorMessage)
      // Set ready to true anyway to not block the app
      setIsSessionReady(true)
    }
  }

  const refreshSession = async () => {
    console.log('🔄 Refreshing session...')
    setIsSessionReady(false)
    setSessionError(null)
    await initializeSession()
  }

  useEffect(() => {
    initializeSession()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <SessionContext.Provider
      value={{ isSessionReady, sessionError, refreshSession }}
    >
      {children}
    </SessionContext.Provider>
  )
}
