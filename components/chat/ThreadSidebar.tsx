'use client'

import { useQuery, useMutation } from 'convex/react'
import { api } from '../../convex/_generated/api'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { nanoid } from 'nanoid'
import { Badge } from '@/components/ui/badge'

interface ThreadSidebarProps {
  currentThreadId: string
  onThreadSelect: (threadId: string) => void
  onNewThread: () => void
}

export function ThreadSidebar({
  currentThreadId,
  onThreadSelect,
  onNewThread,
}: ThreadSidebarProps) {
  const threads = useQuery(api.threads.getByUser)

  const handleThreadClick = (threadId: string) => {
    onThreadSelect(threadId)
  }

  const handleNewThread = () => {
    const newThreadId = nanoid()
    onThreadSelect(newThreadId)
    onNewThread()
  }

  return (
    <div className="w-64 border-r bg-gray-50 p-4 flex flex-col h-full">
      <div className="mb-4">
        <Button onClick={handleNewThread} className="w-full" size="sm">
          New Chat
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto space-y-2">
        {threads?.map((thread) => (
          <div
            key={thread._id}
            onClick={() => handleThreadClick(thread.threadId)}
            className={cn(
              'p-3 rounded-lg cursor-pointer transition-colors hover:bg-gray-100',
              currentThreadId === thread.threadId
                ? 'bg-blue-100 border border-blue-200'
                : 'bg-white border'
            )}
          >
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{thread.title}</p>
                <p className="text-xs text-gray-500">
                  {thread.messageCount} messages
                </p>
              </div>

              <div className="flex flex-col items-end gap-1">
                {thread.generationStatus === 'generating' && (
                  <Badge variant="secondary" className="text-xs">
                    Generating
                  </Badge>
                )}
                {thread.pinned && (
                  <span className="text-yellow-500 text-xs">📌</span>
                )}
              </div>
            </div>

            {thread.model && (
              <div className="mt-1">
                <Badge variant="outline" className="text-xs">
                  {thread.model}
                </Badge>
              </div>
            )}
          </div>
        ))}

        {threads?.length === 0 && (
          <div className="text-center text-gray-500 text-sm py-8">
            No conversations yet.
            <br />
            Start a new chat to begin!
          </div>
        )}
      </div>
    </div>
  )
}
