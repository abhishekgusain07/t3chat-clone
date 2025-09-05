'use client'

import { useParams } from 'next/navigation'
import ChatInterface from '@/components/chat/ChatInterface'

export default function ChatPage() {
  const params = useParams()
  const threadId = params.threadId as string

  return <ChatInterface threadId={threadId} />
}
