'use client'

import { cn } from '@/lib/utils'
import Markdown from 'react-markdown'
import { Badge } from '@/components/ui/badge'

interface StreamingMessageProps {
  message: {
    _id: string
    role: 'user' | 'assistant' | 'system' | 'tool'
    content: string
    isStreaming: boolean
    model?: string
    usage?: {
      promptTokens: number
      completionTokens: number
      totalTokens: number
    }
    finishReason?: 'stop' | 'length' | 'content_filter' | 'error'
    attachments?: Array<{
      type: 'file'
      url: string
      filename: string
      mediaType: string
      size?: number
    }>
  }
  showStats?: boolean
}

export function StreamingMessage({
  message,
  showStats = false,
}: StreamingMessageProps) {
  const isUser = message.role === 'user'

  return (
    <div className={cn('flex', isUser ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'max-w-[65%] px-3 py-1.5 text-sm shadow-sm relative',
          isUser
            ? 'bg-[#0B93F6] text-white rounded-2xl rounded-br-sm'
            : 'bg-[#E9E9EB] text-black rounded-2xl rounded-bl-sm'
        )}
      >
        {/* Message content */}
        <div className="prose-sm prose-p:my-0.5 prose-li:my-0.5 prose-ul:my-1 prose-ol:my-1">
          <Markdown>{message.content}</Markdown>
        </div>

        {/* Streaming indicator */}
        {message.isStreaming && (
          <div className="flex items-center gap-1 mt-1">
            <div className="flex gap-1">
              <div className="w-1 h-1 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
              <div className="w-1 h-1 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
              <div className="w-1 h-1 bg-gray-400 rounded-full animate-bounce"></div>
            </div>
            <span className="text-xs text-gray-500 ml-1">Generating...</span>
          </div>
        )}

        {/* File attachments */}
        {message.attachments && message.attachments.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {message.attachments.map((attachment, index) => (
              <Badge key={index} variant="outline" className="text-xs">
                {attachment.filename}
              </Badge>
            ))}
          </div>
        )}

        {/* Message metadata */}
        {!isUser && (
          <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
            {message.model && (
              <Badge variant="secondary" className="text-xs">
                {message.model}
              </Badge>
            )}

            {showStats && message.usage && (
              <span>{message.usage.totalTokens} tokens</span>
            )}

            {message.finishReason && message.finishReason !== 'stop' && (
              <Badge
                variant={
                  message.finishReason === 'error' ? 'destructive' : 'outline'
                }
                className="text-xs"
              >
                {message.finishReason}
              </Badge>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
