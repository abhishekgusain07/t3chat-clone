'use client'

import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

const SettingsTabs = () => {
  const pathname = usePathname()

  const tabs = [
    { value: 'subscription', label: 'Account', href: '/settings/subscription' },
    {
      value: 'customization',
      label: 'Customization',
      href: '/settings/customization',
    },
    { value: 'history', label: 'History & Sync', href: '/settings/history' },
    { value: 'models', label: 'Models', href: '/settings/models' },
    { value: 'api-keys', label: 'API Keys', href: '/settings/api-keys' },
    {
      value: 'attachments',
      label: 'Attachments',
      href: '/settings/attachments',
    },
    { value: 'contact', label: 'Contact Us', href: '/settings/contact' },
  ]

  return (
    <div className="space-y-6">
      <div className="inline-flex h-9 items-center gap-1 rounded-lg bg-secondary/80 p-1 text-secondary-foreground no-scrollbar -mx-0.5 w-full justify-start overflow-auto md:w-fit">
        {tabs.map((tab) => (
          <Link
            key={tab.value}
            href={tab.href}
            className={cn(
              'inline-flex items-center justify-center whitespace-nowrap rounded-md px-2.5 py-1 text-sm font-medium ring-offset-background transition-all hover:bg-sidebar-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
              pathname === tab.href
                ? 'bg-background text-foreground shadow'
                : 'text-secondary-foreground'
            )}
          >
            {tab.label}
          </Link>
        ))}
      </div>
    </div>
  )
}

export default SettingsTabs
