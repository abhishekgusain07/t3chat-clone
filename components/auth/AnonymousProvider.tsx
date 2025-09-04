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

  const createAnonymousSession = async (maxRetries = 3): Promise<boolean> => {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(
          `🔄 Creating anonymous session (attempt ${attempt}/${maxRetries})`
        )

        const result = await authClient.signIn.anonymous()

        if (result?.data?.user) {
          console.log('✅ Anonymous session created:', {
            userId: result.data.user.id,
            isAnonymous: result.data.user.isAnonymous,
          })

          // Verify session persistence with retries
          const isVerified = await verifySession(5)
          if (isVerified) {
            return true
          }

          console.warn('⚠️ Session created but verification failed')
        } else if (result?.error) {
          console.error(`❌ Anonymous session creation failed:`, result.error)
        } else {
          console.warn(
            '⚠️ Anonymous session creation returned no data:',
            result
          )
        }

        // Exponential backoff
        if (attempt < maxRetries) {
          const delay = Math.pow(2, attempt) * 1000
          console.log(`⏳ Retrying in ${delay}ms...`)
          await sleep(delay)
        }
      } catch (error) {
        console.error(
          `❌ Error creating anonymous session (attempt ${attempt}):`,
          error
        )
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

      console.log('🔄 No existing session, creating anonymous session...')

      // Create anonymous session with retries
      const success = await createAnonymousSession()

      if (success) {
        setIsSessionReady(true)
        console.log('🎉 Anonymous session initialization complete')
      } else {
        const error =
          'Failed to create anonymous session after multiple attempts'
        console.error('❌', error)
        setSessionError(error)
        // Set ready to true anyway to not block the app
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
    setIsSessionReady(false)
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
