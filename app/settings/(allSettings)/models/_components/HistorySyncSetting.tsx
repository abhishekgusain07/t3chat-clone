// components/HistorySyncSettings.tsx
'use client' // This might be needed if you're using Next.js App Router and client-side hooks

import React, { useState } from 'react' // Assuming you have a toast component from shadcn
import { Input } from '@/components/ui/input'

// --- DUMMY DATA ---
interface SyncStatus {
  isEnabled: boolean
  lastSynced: Date | null
  syncedMessagesCount: number
  syncedChatsCount: number
}

interface LocalHistory {
  messagesCount: number
  chatsCount: number
  lastUpdated: Date
}

const DUMMY_SYNC_STATUS: SyncStatus = {
  isEnabled: true, // Initially enabled
  lastSynced: new Date(Date.now() - 60 * 60 * 24 * 30 * 2 * 1000), // 2 months ago
  syncedMessagesCount: 12345,
  syncedChatsCount: 123,
}

const DUMMY_LOCAL_HISTORY: LocalHistory = {
  messagesCount: 54321,
  chatsCount: 456,
  lastUpdated: new Date(), // Now
}
// --- END DUMMY DATA ---

export const HistorySyncSettings: React.FC = () => {
  const { toast } = useToast()
  const [syncEnabled, setSyncEnabled] = useState(DUMMY_SYNC_STATUS.isEnabled)
  const [exportFileName, setExportFileName] = useState('t3_chat_export')
  const [isExporting, setIsExporting] = useState(false)

  // Handlers for dummy actions
  const handleSyncToggle = (checked: boolean) => {
    setSyncEnabled(checked)
    if (checked) {
      toast({
        title: 'Sync Enabled',
        description: 'Your chat history will now sync automatically.',
      })
    } else {
      toast({
        title: 'Sync Disabled',
        description: 'Your chat history will no longer sync.',
      })
    }
    // In a real app, you'd call a Convex mutation here to update user settings
    // await convex.mutation('user.setSyncSetting', { enabled: checked });
  }

  const handleExportLocalHistory = async () => {
    setIsExporting(true)
    toast({
      title: 'Exporting History',
      description: 'Preparing your local chat history for download...',
    })
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 2000))
    console.log(`Exporting local history to ${exportFileName}.json`)
    toast({
      title: 'Export Complete',
      description: `Your local history has been exported as "${exportFileName}.json".`,
      variant: 'success', // Assuming you have a 'success' variant for toast
    })
    setIsExporting(false)
    // In a real app, this would trigger a download
  }

  const handleSyncNow = async () => {
    toast({
      title: 'Syncing History',
      description: 'Initiating a manual sync of your chat history...',
    })
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 2000))
    console.log('Manually syncing history...')
    toast({
      title: 'Sync Complete',
      description: 'Your chat history has been synced successfully.',
      variant: 'success',
    })
    // In a real app, you'd call a Convex mutation to trigger a sync
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">History & Sync</h2>
        <p className="text-muted-foreground">
          Manage how your chat history is stored and synced.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Sync Settings */}
        <div className="md:col-span-2 lg:col-span-1">
          <Card className="rounded-xl">
            <CardHeader>
              <CardTitle className="text-xl">Cloud Sync</CardTitle>
              <CardDescription>
                Sync your chat history across devices using your cloud account.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between space-x-2">
                <Label
                  htmlFor="cloud-sync"
                  className="cursor-pointer text-base"
                >
                  Enable Cloud Sync
                </Label>
                <Switch
                  id="cloud-sync"
                  checked={syncEnabled}
                  onCheckedChange={handleSyncToggle}
                  aria-label="Toggle cloud sync"
                />
              </div>
              {syncEnabled && (
                <p className="mt-4 text-sm text-muted-foreground">
                  Last synced: {DUMMY_SYNC_STATUS.lastSynced?.toLocaleString()}
                </p>
              )}
            </CardContent>
            {syncEnabled && (
              <CardFooter>
                <Button onClick={handleSyncNow} className="w-full">
                  Sync Now
                </Button>
              </CardFooter>
            )}
          </Card>
        </div>

        {/* Sync History Card */}
        <DataDisplayCard
          title="Synced History"
          description="View and manage the chat history stored in the cloud."
          dataCount={DUMMY_SYNC_STATUS.syncedMessagesCount}
          dataLabel="messages"
          buttonText="View Synced History"
          onButtonClick={() => {
            toast({
              title: 'Not Implemented',
              description: 'Viewing synced history is not yet implemented.',
            })
          }}
        />

        {/* Local History Card */}
        <DataDisplayCard
          title="Local History"
          description="Manage chat history stored directly on this device."
          dataCount={DUMMY_LOCAL_HISTORY.messagesCount}
          dataLabel="messages"
          buttonText="Clear Local History"
          onButtonClick={() => {
            toast({
              title: 'Not Implemented',
              description: 'Clearing local history is not yet implemented.',
            })
          }}
        />
      </div>

      {/* Data Export Section */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <div className="md:col-span-2 lg:col-span-1">
          <Card className="rounded-xl">
            <CardHeader>
              <CardTitle className="text-xl">Export Data</CardTitle>
              <CardDescription>
                Download a copy of your chat history.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="export-filename">File Name</Label>
                <Input
                  id="export-filename"
                  value={exportFileName}
                  onChange={(e) => setExportFileName(e.target.value)}
                  placeholder="e.g., my_chat_data"
                  className="rounded-lg"
                />
                <p className="text-sm text-muted-foreground">
                  Your data will be exported as `{exportFileName}.json`
                </p>
              </div>
            </CardContent>
            <CardFooter>
              <Button
                onClick={handleExportLocalHistory}
                disabled={isExporting}
                className="w-full"
              >
                {isExporting ? 'Exporting...' : 'Export Local History'}
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  )
}
