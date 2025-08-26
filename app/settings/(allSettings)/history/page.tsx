'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Card } from '@/components/ui/card'

interface HistoryItem {
  id: string
  title: string
  createdAt: string
  selected?: boolean
}

const dummyHistory: HistoryItem[] = [
  {
    id: '1',
    title: 'Restore Desktop to Original State',
    createdAt: '25/8/2025, 9:11:25 PM',
  },
  { id: '2', title: 'Greeting Title', createdAt: '23/8/2025, 8:07:00 PM' },
  { id: '3', title: 'New Conversation', createdAt: '23/8/2025, 8:00:25 PM' },
  {
    id: '4',
    title: 'Black Hole Existence Inquiry',
    createdAt: '14/8/2025, 10:17:23 AM',
  },
]

export default function HistoryAndSync() {
  const [history, setHistory] = useState<HistoryItem[]>(dummyHistory)

  const toggleSelect = (id: string) => {
    setHistory((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, selected: !item.selected } : item
      )
    )
  }

  const selectAll = () => {
    setHistory((prev) => prev.map((item) => ({ ...item, selected: true })))
  }

  const clearSelection = () => {
    setHistory((prev) => prev.map((item) => ({ ...item, selected: false })))
  }

  return (
    <div className="mt-2 space-y-12">
      <section className="space-y-2">
        <h2 className="text-2xl font-bold">Message History</h2>
        <div className="space-y-6">
          <p className="text-muted-foreground/80 text-sm">
            Save your history as JSON, or import someone else's. Importing will
            NOT delete existing messages
          </p>

          <div className="space-y-2">
            <div className="mb-2 flex h-10 items-end justify-between gap-2">
              <div className="flex items-center gap-4">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 px-4 text-xs flex items-center gap-2.5"
                  onClick={selectAll}
                >
                  <div className="size-4 shrink-0 rounded-sm border border-input brightness-75 dark:brightness-200" />
                  <span className="hidden md:inline text-sm">Select All</span>
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 px-3 text-sm invisible"
                  onClick={clearSelection}
                >
                  Clear <span className="hidden md:inline">Selection</span>
                </Button>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 px-3 text-xs"
                  disabled
                >
                  Export
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  className="h-8 px-3 text-xs"
                  disabled
                >
                  Delete
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 px-3 text-xs"
                >
                  Import
                </Button>
              </div>
            </div>

            <ul
              className="w-full divide-y overflow-y-scroll rounded border"
              style={{ maxHeight: '15rem', minHeight: '15rem' }}
            >
              {history.map((item) => (
                <li
                  key={item.id}
                  className="grid cursor-pointer grid-cols-[auto_1fr_auto_auto] items-center gap-3 px-4 py-2 hover:bg-muted/50"
                  style={{ minHeight: '2.5rem' }}
                  onClick={() => toggleSelect(item.id)}
                >
                  <Checkbox
                    checked={item.selected}
                    onCheckedChange={() => toggleSelect(item.id)}
                  />
                  <span className="truncate">{item.title}</span>
                  <span className="w-8" />
                  <span className="w-[24ch] select-none text-right text-xs text-muted-foreground">
                    {item.createdAt}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="w-fit space-y-2 border-0 border-muted-foreground/10">
        <h2 className="text-2xl font-bold">Danger Zone</h2>
        <div className="space-y-2">
          <p className="px-px py-1.5 text-sm text-muted-foreground/80">
            If your chats from before June 1st are missing, click this to bring
            them back. Contact support if you have issues.
          </p>
          <div className="flex flex-row gap-2">
            <Button variant="destructive" className="px-4 py-2 h-9">
              Restore old chats
            </Button>
          </div>
        </div>

        <div className="space-y-2 pt-6">
          <p className="px-px py-1.5 text-sm text-muted-foreground/80">
            Permanently delete your history from both your local device and our
            servers.
            <span className="mx-0.5 text-base font-medium">*</span>
          </p>
          <div className="flex flex-row gap-2">
            <Button className="px-4 py-2 h-9 border border-red-800/20 bg-red-800/80 hover:bg-red-600 text-destructive-foreground">
              Delete Chat History
            </Button>
          </div>
        </div>
      </section>

      <p className="text-sm text-muted-foreground/40">
        <span className="mx-0.5 text-base font-medium">*</span>
        The retention policies of our LLM hosting partners may vary.
      </p>
    </div>
  )
}
