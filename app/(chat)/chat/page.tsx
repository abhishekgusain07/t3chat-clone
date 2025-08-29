'use client'

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { nanoid } from 'nanoid'

export default function ChatIndex() {
  const router = useRouter()

  useEffect(() => {
    // Redirect to new thread
    const newThreadId = nanoid()
    router.replace(`/chat/${newThreadId}`)
  }, [router])

  return null
}
