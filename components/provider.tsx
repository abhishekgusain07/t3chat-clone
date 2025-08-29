'use client'

import { ThemeProvider as NextThemesProvider } from 'next-themes'
import { ConvexProvider } from 'convex/react'
import { ConvexReactClient } from 'convex/react'
import { AnonymousProvider } from './auth/AnonymousProvider'

const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!)

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
