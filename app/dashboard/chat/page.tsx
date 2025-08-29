'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import Markdown from 'react-markdown'
import { useConvex, useMutation, useQuery } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import { nanoid } from 'nanoid'
import { ModelSelector } from '@/components/chat/ModelSelector'
import { StreamingMessage } from '@/components/chat/StreamingMessage'
import { ThreadSidebar } from '@/components/chat/ThreadSidebar'
import { Id } from '@/convex/_generated/dataModel'

export default function Chat() {
  const convex = useConvex()
  const [input, setInput] = useState('')
  const [currentThreadId, setCurrentThreadId] = useState<string>(() => nanoid())
  const [isLoading, setIsLoading] = useState(false)
  const [selectedModel, setSelectedModel] = useState('gpt-4o')
  const [userTier, setUserTier] = useState<
    'Anonymous' | 'Free' | 'Pro' | 'Enterprise'
  >('Free')

  const createThread = useMutation(api.threads.create)
  const createMessage = useMutation(api.messages.create)
  const messages = useQuery(api.messages.getByThread, {
    threadId: currentThreadId,
  })
  const userPreferences = useQuery(api.userPreferences.get)

  // Fetch user tier from rate limits API
  useEffect(() => {
    const fetchUserTier = async () => {
      try {
        const response = await fetch('/api/rate-limits')
        if (response.ok) {
          const data = await response.json()
          setUserTier(data.tier)
        }
      } catch (error) {
        console.error('Failed to fetch user tier:', error)
      }
    }
    fetchUserTier()
  }, [])

  // Update selected model from preferences
  useEffect(() => {
    if (userPreferences?.currentlySelectedModel) {
      setSelectedModel(userPreferences.currentlySelectedModel)
    }
  }, [userPreferences])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return

    const userMessage = input.trim()
    // Use the selected model from state

    setIsLoading(true)

    try {
      // Check rate limits before processing
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

      if (!rateLimitCheck.ok) {
        const errorData = await rateLimitCheck.json()
        alert(`Rate limit exceeded: ${errorData.error}`)
        return
      }

      const rateLimitResult = await rateLimitCheck.json()
      if (!rateLimitResult.allowed) {
        alert(`Cannot send message: ${rateLimitResult.reason}`)
        return
      }

      setInput('')

      // Create thread if it doesn't exist
      const thread = await convex.query(api.threads.getById, {
        threadId: currentThreadId,
      })
      if (!thread) {
        await createThread({
          threadId: currentThreadId,
          title:
            userMessage.slice(0, 50) + (userMessage.length > 50 ? '...' : ''),
          model: selectedModel,
        })
      }

      // Add user message to Convex
      await createMessage({
        threadId: currentThreadId,
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
          model: userPreferences?.currentlySelectedModel || 'gpt-4o',
          threadId: currentThreadId,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        if (response.status === 429) {
          // Rate limit exceeded
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
      const assistantMessageId = await createMessage({
        threadId: currentThreadId,
        role: 'assistant',
        content: '',
        model: userPreferences?.currentlySelectedModel || 'gpt-4o',
      })

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
                // Update streaming content in real-time
                await convex.mutation(api.messages.updateStreaming, {
                  messageId: assistantMessageId,
                  content: assistantContent,
                  isComplete: false,
                })
              } else if (data.type === 'finish') {
                // Mark as complete
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

  const handleThreadSelect = (threadId: string) => {
    setCurrentThreadId(threadId)
  }

  const handleNewThread = () => {
    setInput('')
  }

  return (
    <div className="flex h-screen">
      <ThreadSidebar
        currentThreadId={currentThreadId}
        onThreadSelect={handleThreadSelect}
        onNewThread={handleNewThread}
      />

      <div className="flex-1 flex flex-col">
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {(messages || []).map((message) => (
            <StreamingMessage
              key={message._id}
              message={message}
              showStats={userPreferences?.statsForNerds}
            />
          ))}

          {messages?.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <h2 className="text-xl font-semibold mb-2">
                Start a conversation
              </h2>
              <p className="text-gray-600 mb-4">
                Choose a model below and send your first message.
              </p>
            </div>
          )}
        </div>

        <div className="border-t bg-white p-4">
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="flex items-center gap-2">
              <ModelSelector
                selectedModel={selectedModel}
                onModelChange={setSelectedModel}
                userTier={userTier}
              />
            </div>

            <div className="flex gap-2">
              <Input
                className="flex-1"
                value={input}
                placeholder="Type your message..."
                onChange={(e) => setInput(e.target.value)}
                disabled={isLoading}
              />
              <Button type="submit" disabled={isLoading || !input.trim()}>
                {isLoading ? 'Sending...' : 'Send'}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
