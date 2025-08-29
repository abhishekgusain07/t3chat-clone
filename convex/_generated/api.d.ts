/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from 'convex/server'
import type * as auth from '../auth.js'
import type * as availableModels from '../availableModels.js'
import type * as messages from '../messages.js'
import type * as threads from '../threads.js'
import type * as userPreferences from '../userPreferences.js'
import type * as users from '../users.js'

/**
 * A utility for referencing Convex functions in your app's API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
declare const fullApi: ApiFromModules<{
  auth: typeof auth
  availableModels: typeof availableModels
  messages: typeof messages
  threads: typeof threads
  userPreferences: typeof userPreferences
  users: typeof users
}>
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, 'public'>
>
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, 'internal'>
>
