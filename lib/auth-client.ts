import { createAuthClient } from 'better-auth/react'
import {
  anonymousClient,
  emailOTPClient,
  magicLinkClient,
  organizationClient,
} from 'better-auth/client/plugins'
import { polarClient } from '@polar-sh/better-auth'

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_APP_URL,
  plugins: [
    organizationClient(),
    polarClient(),
    magicLinkClient(),
    anonymousClient(),
    emailOTPClient(),
  ],
})
