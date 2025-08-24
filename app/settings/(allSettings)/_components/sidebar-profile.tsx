'use client'

import Image from 'next/image'

export default function SidebarProfile() {
  return (
    <div className="hidden flex-shrink-0 flex-grow-0 space-y-8 md:block md:max-w-[25%] lg:max-w-[30%]">
      {/* Profile Section */}
      <div className="relative text-center">
        <Image
          alt="Profile picture"
          src="/profile.webp"
          width={160}
          height={160}
          className="mx-auto rounded-full transition-opacity duration-200"
        />
        <h1 className="mt-4 text-2xl font-bold transition-opacity duration-200">
          Dummy User
        </h1>

        <p
          className="perspective-1000 group relative h-6 cursor-pointer break-all text-muted-foreground"
          role="button"
          tabIndex={0}
          aria-label="Copy user ID to clipboard"
        >
          <span className="absolute inset-0 truncate transition-transform duration-300 [backface-visibility:hidden] [transform-style:preserve-3d] group-hover:[transform:rotateX(180deg)]">
            dummy@example.com
          </span>
          <span className="absolute inset-0 transition-transform duration-300 [backface-visibility:hidden] [transform-style:preserve-3d] [transform:rotateX(180deg)] group-hover:[transform:rotateX(0deg)]">
            <span className="flex h-6 items-center justify-center gap-2 text-sm">
              <span className="flex items-center gap-2">
                Copy User ID
                <span className="inline-flex h-4 w-4 items-center justify-center">
                  📋
                </span>
              </span>
            </span>
          </span>
        </p>

        <span className="mt-2 inline-flex items-center rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground">
          Free Plan
        </span>
      </div>

      {/* Usage Section */}
      <div className="rounded-lg bg-card p-4">
        <div className="grid w-full min-w-0 grid-rows-[auto] space-y-6">
          <div className="flex flex-row justify-between sm:flex-col sm:justify-between lg:flex-row lg:items-center lg:gap-x-4">
            <span className="text-sm font-semibold lg:whitespace-nowrap">
              Message Usage
            </span>
            <div className="text-xs text-muted-foreground">
              <p>Resets tomorrow at 5:00 AM</p>
            </div>
          </div>

          <div className="space-y-6">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium">Standard</h3>
                <span className="text-sm text-muted-foreground">4/20</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: '20%' }}
                ></div>
              </div>
              <p className="text-sm text-muted-foreground">
                16 messages remaining
              </p>
            </div>
          </div>

          <i className="mt-4 block w-0 min-w-full text-xs text-muted-foreground/80">
            ℹ️ Each tool call consumes an additional standard credit.
          </i>
        </div>
      </div>

      {/* Keyboard Shortcuts Section */}
      <div className="space-y-6 rounded-lg bg-card p-4">
        <span className="text-sm font-semibold">Keyboard Shortcuts</span>
        <div className="grid gap-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Search</span>
            <div className="flex gap-1">
              <kbd className="rounded bg-background px-2 py-1 font-sans text-sm">
                ⌘
              </kbd>
              <kbd className="rounded bg-background px-2 py-1 font-sans text-sm">
                K
              </kbd>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">New Chat</span>
            <div className="flex gap-1">
              <kbd className="rounded bg-background px-2 py-1 font-sans text-sm">
                ⌘
              </kbd>
              <kbd className="rounded bg-background px-2 py-1 font-sans text-sm">
                Shift
              </kbd>
              <kbd className="rounded bg-background px-2 py-1 font-sans text-sm">
                O
              </kbd>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Toggle Sidebar</span>
            <div className="flex gap-1">
              <kbd className="rounded bg-background px-2 py-1 font-sans text-sm">
                ⌘
              </kbd>
              <kbd className="rounded bg-background px-2 py-1 font-sans text-sm">
                B
              </kbd>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
