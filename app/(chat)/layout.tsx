'use client'

import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar'
import { ChatSidebar } from '@/components/chat/ChatSidebar'

export default function ChatLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <SidebarProvider>
      <ChatSidebar />
      <SidebarInset>{children}</SidebarInset>
    </SidebarProvider>
  )
}
