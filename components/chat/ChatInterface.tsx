'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useConvex, useMutation, useQuery } from 'convex/react'
import { api } from '../../convex/_generated/api'
import { ModelSelector } from '@/components/chat/ModelSelector'
import { StreamingMessage } from '@/components/chat/StreamingMessage'
import { useRouter } from 'next/navigation'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { Separator } from '@/components/ui/separator'
import { useSession } from '@/components/auth/AnonymousProvider'
import { nanoid } from 'nanoid'

interface ChatInterfaceProps {
  threadId?: string
}

export default function ChatInterface({ threadId }: ChatInterfaceProps) {
  const router = useRouter()
  const { isSessionReady, sessionError, refreshSession } = useSession()

  const convex = useConvex()
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [selectedModel, setSelectedModel] = useState('gpt-4o')
  const [userTier, setUserTier] = useState<
    'Anonymous' | 'Free' | 'Pro' | 'Enterprise'
  >('Free')
  const [tierFetchAttempted, setTierFetchAttempted] = useState(false)

  const createThread = useMutation(api.threads.create)
  const createMessage = useMutation(api.messages.create)
  const messages = useQuery(
    api.messages.getByThread,
    threadId ? { threadId } : 'skip'
  )
  const userPreferences = useQuery(api.userPreferences.get)

  // Fetch user tier after session is ready
  useEffect(() => {
    const fetchUserTier = async (retryCount = 0) => {
      const maxRetries = 3

      try {
        console.log(`🔍 Fetching user tier (attempt ${retryCount + 1})...`)

        const response = await fetch('/api/rate-limits')
        if (response.ok) {
          const data = await response.json()
          setUserTier(data.tier)
          setTierFetchAttempted(true)
          console.log('✅ User tier fetched successfully:', data.tier)
        } else {
          const errorData = await response.json().catch(() => ({
            error: 'Unknown error',
            retry: false,
          }))

          console.warn('⚠️ Failed to fetch user tier:', {
            status: response.status,
            statusText: response.statusText,
            error: errorData.error,
            code: errorData.code,
          })

          if (
            response.status === 401 &&
            errorData.retry &&
            retryCount < maxRetries
          ) {
            const delay = Math.min(2000 * Math.pow(1.5, retryCount), 10000)
            console.log(
              `🔄 Session invalid, retrying in ${delay}ms... (${errorData.details})`
            )
            setTimeout(() => fetchUserTier(retryCount + 1), delay)
            return
          }

          console.log(
            '🔄 Setting default tier to Anonymous due to auth failure'
          )
          setUserTier('Anonymous')
          setTierFetchAttempted(true)
        }
      } catch (error) {
        console.error('❌ Failed to fetch user tier:', error)
        if (retryCount < maxRetries) {
          const delay = Math.min(1000 * Math.pow(2, retryCount), 8000)
          console.log(`🔄 Network error, retrying in ${delay}ms...`)
          setTimeout(() => fetchUserTier(retryCount + 1), delay)
          return
        }
        console.warn('❌ All retries exhausted, defaulting to Anonymous tier')
        setUserTier('Anonymous')
        setTierFetchAttempted(true)
      }
    }

    if (isSessionReady && !tierFetchAttempted) {
      setTimeout(() => fetchUserTier(), 500)
    }
  }, [isSessionReady, tierFetchAttempted])

  // Update selected model from preferences
  useEffect(() => {
    if (userPreferences?.currentlySelectedModel) {
      setSelectedModel(userPreferences.currentlySelectedModel)
    }
  }, [userPreferences])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return

    if (!isSessionReady) {
      console.log('⏳ Waiting for session to be ready...')
      alert('Please wait, establishing connection...')
      return
    }

    const userMessage = input.trim()
    setIsLoading(true)

    try {
      // Check rate limits with retry logic
      let rateLimitAllowed = true
      let rateLimitReason = ''

      const checkRateLimitWithRetry = async (
        retryCount = 0
      ): Promise<boolean> => {
        try {
          console.log(`🔍 Checking rate limits (attempt ${retryCount + 1})...`)

          const rateLimitCheck = await fetch('/api/rate-limits/check', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'message',
              metadata: {
                model: selectedModel,
                estimatedTokens: userMessage.length / 4,
                tools: ['web_search_preview'],
              },
            }),
          })

          if (rateLimitCheck.ok) {
            const rateLimitResult = await rateLimitCheck.json()
            if (!rateLimitResult.allowed) {
              rateLimitAllowed = false
              rateLimitReason = rateLimitResult.reason || 'Rate limit exceeded'
            }
            return true
          }

          if (rateLimitCheck.status === 401) {
            const errorData = await rateLimitCheck.json().catch(() => ({
              error: 'Unknown error',
              retry: false,
            }))

            if (errorData.retry && retryCount < 2) {
              console.log(
                `🔄 401 error during rate limit check, refreshing session and retrying...`
              )
              console.log(`   Details: ${errorData.details}`)
              await refreshSession()
              await new Promise((resolve) => setTimeout(resolve, 1500))
              return checkRateLimitWithRetry(retryCount + 1)
            } else {
              console.warn(
                '⚠️ Rate limit check failed - session issue not retryable:',
                {
                  status: rateLimitCheck.status,
                  error: errorData.error,
                  code: errorData.code,
                }
              )
              return true
            }
          } else {
            const errorData = await rateLimitCheck
              .json()
              .catch(() => ({ error: 'Unknown error' }))
            console.warn('⚠️ Rate limit check failed:', {
              status: rateLimitCheck.status,
              statusText: rateLimitCheck.statusText,
              error: errorData.error,
            })
            return true
          }
        } catch (error) {
          console.error('❌ Rate limit check error:', error)
          if (retryCount < 1) {
            console.log('🔄 Retrying rate limit check...')
            await new Promise((resolve) => setTimeout(resolve, 1000))
            return checkRateLimitWithRetry(retryCount + 1)
          }
          return true
        }
      }

      const rateLimitCheckSuccess = await checkRateLimitWithRetry()
      if (!rateLimitCheckSuccess || !rateLimitAllowed) {
        alert(
          `Cannot send message: ${rateLimitReason || 'Rate limit check failed'}`
        )
        return
      }

      // Determine the actual thread ID to use
      let actualThreadId = threadId

      // If no threadId provided (index page), generate one and navigate
      if (!threadId) {
        actualThreadId = nanoid()
        // Navigate to the specific thread - use replace: false to push new URL
        router.push(`/chat/${actualThreadId}`)
      }

      setInput('')

      // Create thread if it doesn't exist
      let thread = null
      try {
        thread = await convex.query(api.threads.getById, {
          threadId: actualThreadId!,
        })
      } catch (error) {
        console.log(
          'Thread not found or not accessible, will create new one:',
          error
        )
      }

      if (!thread) {
        await createThread({
          threadId: actualThreadId!,
          title:
            userMessage.slice(0, 50) + (userMessage.length > 50 ? '...' : ''),
          model: selectedModel,
        })
      }

      // Add user message to Convex
      await createMessage({
        threadId: actualThreadId!,
        role: 'user',
        content: userMessage,
        model: selectedModel,
      })

      // Stream AI response
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [
            ...(messages || []).map((msg) => ({
              role: msg.role,
              content: msg.content,
            })),
            { role: 'user', content: userMessage },
          ],
          model: selectedModel,
          threadId: actualThreadId,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        if (response.status === 429) {
          alert(`Rate limit exceeded: ${errorData.error}`)
          return
        }
        throw new Error(errorData.error || 'Failed to send message')
      }

      // Handle streaming response
      const reader = response.body?.getReader()
      if (!reader) throw new Error('No response body')

      let assistantContent = ''

      // Create assistant message for streaming
      const assistantMessageResult = await createMessage({
        threadId: actualThreadId!,
        role: 'assistant',
        content: '',
        model: selectedModel,
      })
      const assistantMessageId = assistantMessageResult.id

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = new TextDecoder().decode(value)
        const lines = chunk.split('\n').filter((line) => line.trim())

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6))
              if (data.type === 'text-delta') {
                assistantContent += data.textDelta
                await convex.mutation(api.messages.updateStreaming, {
                  messageId: assistantMessageId,
                  content: assistantContent,
                  isComplete: false,
                })
              } else if (data.type === 'finish') {
                await convex.mutation(api.messages.updateStreaming, {
                  messageId: assistantMessageId,
                  content: assistantContent,
                  isComplete: true,
                  finishReason: data.finishReason,
                  usage: data.usage,
                })
              }
            } catch (e) {
              console.error('Error parsing stream data:', e)
            }
          }
        }
      }
    } catch (error) {
      console.error('Chat error:', error)
      alert('Failed to send message. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="flex h-14 items-center gap-4 border-b bg-background px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 h-4" />
        <div className="flex items-center justify-between w-full">
          <h1 className="text-lg font-semibold">Chat</h1>
          <ModelSelector
            selectedModel={selectedModel}
            onModelChange={setSelectedModel}
            userTier={userTier}
          />
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {!isSessionReady ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-4"></div>
            <h2 className="text-xl font-semibold mb-2">
              Establishing connection...
            </h2>
            <p className="text-gray-600 mb-4">
              Setting up your anonymous session for secure chatting.
            </p>
            {sessionError && (
              <div className="text-red-600 text-sm mt-2">
                {sessionError}
                <button
                  onClick={refreshSession}
                  className="ml-2 underline hover:no-underline"
                >
                  Retry
                </button>
              </div>
            )}
          </div>
        ) : (
          <>
            {(messages || []).map((message) => (
              <StreamingMessage
                key={message._id}
                message={message}
                showStats={userPreferences?.statsForNerds}
              />
            ))}

            {(!messages || messages.length === 0) && (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <h2 className="text-xl font-semibold mb-2">
                  Start a conversation
                </h2>
                <p className="text-gray-600 mb-4">
                  Send your first message to begin chatting.
                </p>
              </div>
            )}
          </>
        )}
      </div>

      {/* Input */}
      <div className="border-t bg-background p-4">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <Input
            className="flex-1"
            value={input}
            placeholder={
              !isSessionReady
                ? 'Establishing connection...'
                : 'Type your message...'
            }
            onChange={(e) => setInput(e.target.value)}
            disabled={isLoading || !isSessionReady}
          />
          <Button
            type="submit"
            disabled={isLoading || !input.trim() || !isSessionReady}
          >
            {!isSessionReady
              ? 'Connecting...'
              : isLoading
                ? 'Sending...'
                : 'Send'}
          </Button>
        </form>
      </div>
    </div>
  )
}
