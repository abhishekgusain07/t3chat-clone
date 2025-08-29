'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useConvex, useMutation, useQuery } from 'convex/react'
import { api } from '../../../../convex/_generated/api'
import { ModelSelector } from '@/components/chat/ModelSelector'
import { StreamingMessage } from '@/components/chat/StreamingMessage'
import { useParams } from 'next/navigation'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { Separator } from '@/components/ui/separator'

export default function ChatPage() {
  const params = useParams()
  const threadId = params.threadId as string

  const convex = useConvex()
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [selectedModel, setSelectedModel] = useState('gpt-4o')
  const [userTier, setUserTier] = useState<
    'Anonymous' | 'Free' | 'Pro' | 'Enterprise'
  >('Free')

  const createThread = useMutation(api.threads.create)
  const createMessage = useMutation(api.messages.create)
  const messages = useQuery(api.messages.getByThread, { threadId })
  const userPreferences = useQuery(api.userPreferences.get)

  // Fetch user tier
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
      const thread = await convex.query(api.threads.getById, { threadId })
      if (!thread) {
        await createThread({
          threadId,
          title:
            userMessage.slice(0, 50) + (userMessage.length > 50 ? '...' : ''),
          model: selectedModel,
        })
      }

      // Add user message to Convex
      await createMessage({
        threadId,
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
          threadId,
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
        threadId,
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
        {(messages || []).map((message) => (
          <StreamingMessage
            key={message._id}
            message={message}
            showStats={userPreferences?.statsForNerds}
          />
        ))}

        {messages?.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <h2 className="text-xl font-semibold mb-2">Start a conversation</h2>
            <p className="text-gray-600 mb-4">
              Send your first message to begin chatting.
            </p>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="border-t bg-background p-4">
        <form onSubmit={handleSubmit} className="flex gap-2">
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
        </form>
      </div>
    </div>
  )
}
