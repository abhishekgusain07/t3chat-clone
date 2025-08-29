import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { ConvexHttpClient } from 'convex/browser'
import { api } from '@/convex/_generated/api'

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!)

export async function GET(
  req: NextRequest,
  { params }: { params: { threadId: string } }
) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    })

    if (!session?.user) {
      return new Response('Unauthorized', { status: 401 })
    }

    const { threadId } = params
    const { searchParams } = new URL(req.url)
    const taskId = searchParams.get('taskId')

    if (!taskId) {
      return NextResponse.json({ error: 'Task ID required' }, { status: 400 })
    }

    // Get the streaming task
    const task = await convex.query(api.streamingTasks.getByTaskId, { taskId })

    if (!task) {
      return NextResponse.json(
        { error: 'Streaming task not found' },
        { status: 404 }
      )
    }

    if (task.userId !== session.user.id) {
      return NextResponse.json(
        { error: 'Unauthorized access to task' },
        { status: 403 }
      )
    }

    // Check if task is resumable
    if (task.status === 'completed') {
      return NextResponse.json({
        message: 'Stream already completed',
        accumulatedTokens: task.accumulatedTokens,
      })
    }

    if (task.status === 'failed') {
      return NextResponse.json(
        { error: 'Stream failed and cannot be resumed' },
        { status: 400 }
      )
    }

    // Update task status to indicate client reconnection
    await convex.mutation(api.streamingTasks.updateStatus, {
      taskId,
      status: 'streaming',
    })

    // Create a stream of accumulated tokens from the resume point
    const stream = new ReadableStream({
      start(controller) {
        let tokenIndex = task.currentTokenIndex

        const sendTokens = () => {
          const tokensToSend = task.accumulatedTokens.slice(tokenIndex)

          for (const token of tokensToSend) {
            const data = JSON.stringify({
              type: 'text-delta',
              textDelta: token,
            })
            controller.enqueue(`data: ${data}\n\n`)
          }

          if (task.status === 'completed') {
            const finishData = JSON.stringify({
              type: 'finish',
              finishReason: 'stop',
            })
            controller.enqueue(`data: ${finishData}\n\n`)
            controller.close()
          } else {
            // Continue polling for new tokens
            setTimeout(sendTokens, 100)
          }
        }

        sendTokens()
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    })
  } catch (error) {
    console.error('Resume stream error:', error)
    return new Response('Internal server error', { status: 500 })
  }
}
