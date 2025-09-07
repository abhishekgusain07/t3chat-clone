'use client'

import { ThemeProvider as NextThemesProvider } from 'next-themes'
import { ConvexProvider } from 'convex/react'
import { ConvexReactClient } from 'convex/react'
import { AnonymousProvider } from './auth/AnonymousProvider'
import { authClient } from '@/lib/auth-client'

const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!, {
  fetchAccessToken: async ({ forceRefreshToken }) => {
    try {
      // Get the current session from Better Auth
      const session = await authClient.getSession()

      if (!session?.data?.user?.id) {
        // No authenticated user - return null to allow anonymous access
        return null
      }

      // Get JWT token from Better Auth using the /token endpoint
      const tokenResponse = await fetch('/api/auth/token')

      if (!tokenResponse.ok) {
        console.error('Failed to fetch JWT token:', tokenResponse.statusText)
        return null
      }

      const { token } = await tokenResponse.json()
      return token || null
    } catch (error) {
      console.error('Error fetching access token for Convex:', error)
      return null
    }
  },
})

type ThemeProviderProps = React.ComponentProps<typeof NextThemesProvider>

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>
}

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <ConvexProvider client={convex}>
      <AnonymousProvider>{children}</AnonymousProvider>
    </ConvexProvider>
  )
}
