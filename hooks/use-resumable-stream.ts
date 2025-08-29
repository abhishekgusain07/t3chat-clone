'use client'

import { useEffect, useState, useCallback } from 'react'
import { useConvex } from 'convex/react'
import { api } from '../convex/_generated/api'

interface UseResumableStreamProps {
  threadId: string
  onStreamComplete?: () => void
}

export function useResumableStream({
  threadId,
  onStreamComplete,
}: UseResumableStreamProps) {
  const convex = useConvex()
  const [isStreaming, setIsStreaming] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<
    'connected' | 'disconnected' | 'reconnecting'
  >('connected')

  const resumeStream = useCallback(
    async (taskId: string) => {
      setIsStreaming(true)
      setConnectionStatus('reconnecting')

      try {
        const response = await fetch(
          `/api/chat/${threadId}/resume?taskId=${taskId}`
        )

        if (!response.ok) {
          throw new Error('Failed to resume stream')
        }

        setConnectionStatus('connected')

        const reader = response.body?.getReader()
        if (!reader) throw new Error('No response body')

        let messageContent = ''

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
                  messageContent += data.textDelta
                  // Content updates happen through Convex real-time subscriptions
                } else if (data.type === 'finish') {
                  setIsStreaming(false)
                  onStreamComplete?.()
                  break
                }
              } catch (e) {
                console.error('Error parsing stream data:', e)
              }
            }
          }
        }
      } catch (error) {
        console.error('Stream resume error:', error)
        setConnectionStatus('disconnected')
      } finally {
        setIsStreaming(false)
      }
    },
    [threadId, onStreamComplete]
  )

  // Check for active streaming tasks on mount/thread change
  useEffect(() => {
    const checkForActiveStreams = async () => {
      try {
        const activeTasks = await convex.query(
          api.streamingTasks.getActiveByUser,
          {}
        )
        const threadTask = activeTasks.find(
          (task) => task.threadId === threadId
        )

        if (
          threadTask &&
          (threadTask.status === 'streaming' ||
            threadTask.status === 'disconnected')
        ) {
          console.log('Found active stream, resuming...', threadTask.taskId)
          await resumeStream(threadTask.taskId)
        }
      } catch (error) {
        console.error('Failed to check for active streams:', error)
      }
    }

    checkForActiveStreams()
  }, [threadId, resumeStream, convex])

  return {
    isStreaming,
    connectionStatus,
    resumeStream,
  }
}
