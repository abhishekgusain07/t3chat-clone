'use client'

import { useQuery } from 'convex/react'
import { api } from '../../convex/_generated/api'
import { useRouter, useParams } from 'next/navigation'
import { nanoid } from 'nanoid'
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { PlusIcon, MessageSquareIcon } from 'lucide-react'

export function ChatSidebar() {
  const router = useRouter()
  const params = useParams()
  const currentThreadId = params.threadId as string

  const threads = useQuery(api.threads.getByUser)

  const handleNewChat = () => {
    const newThreadId = nanoid()
    router.push(`/chat/${newThreadId}`)
  }

  const handleThreadSelect = (threadId: string) => {
    router.push(`/chat/${threadId}`)
  }

  return (
    <Sidebar>
      <SidebarHeader>
        <div className="flex items-center justify-between p-2">
          <h2 className="text-lg font-semibold">T3Chat</h2>
          <Button
            onClick={handleNewChat}
            size="sm"
            variant="outline"
            className="h-8 w-8 p-0"
          >
            <PlusIcon className="h-4 w-4" />
          </Button>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Conversations</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {threads?.map((thread) => (
                <SidebarMenuItem key={thread._id}>
                  <SidebarMenuButton
                    onClick={() => handleThreadSelect(thread.threadId)}
                    isActive={currentThreadId === thread.threadId}
                    className="w-full justify-start"
                  >
                    <MessageSquareIcon className="h-4 w-4" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="truncate text-sm">{thread.title}</span>
                        <div className="flex items-center gap-1 ml-2">
                          {thread.generationStatus === 'generating' && (
                            <Badge variant="secondary" className="text-xs">
                              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                            </Badge>
                          )}
                          {thread.pinned && (
                            <span className="text-yellow-500 text-xs">📌</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
                        <span>{thread.messageCount} messages</span>
                        {thread.model && (
                          <Badge variant="outline" className="text-xs">
                            {thread.model}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}

              {threads?.length === 0 && (
                <div className="text-center text-gray-500 text-sm py-8 px-4">
                  <MessageSquareIcon className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No conversations yet.</p>
                  <p className="text-xs mt-1">Click + to start chatting!</p>
                </div>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  )
}
