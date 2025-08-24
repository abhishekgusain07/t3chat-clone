import React from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

const SettingsTabs = () => {
  return (
    <div className="space-y-6">
      <Tabs defaultValue="account" className="space-y-6">
        <TabsList className="inline-flex h-9 items-center gap-1 rounded-lg bg-secondary/80 p-1 text-secondary-foreground no-scrollbar -mx-0.5 w-full justify-start overflow-auto md:w-fit">
          <TabsTrigger
            value="account"
            className="inline-flex items-center justify-center whitespace-nowrap rounded-md px-2.5 py-1 text-sm font-medium ring-offset-background transition-all hover:bg-sidebar-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow"
          >
            Account
          </TabsTrigger>
          <TabsTrigger
            value="customization"
            className="inline-flex items-center justify-center whitespace-nowrap rounded-md px-2.5 py-1 text-sm font-medium ring-offset-background transition-all hover:bg-sidebar-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow"
          >
            Customization
          </TabsTrigger>
          <TabsTrigger
            value="history"
            className="inline-flex items-center justify-center whitespace-nowrap rounded-md px-2.5 py-1 text-sm font-medium ring-offset-background transition-all hover:bg-sidebar-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow"
          >
            History & Sync
          </TabsTrigger>
          <TabsTrigger
            value="models"
            className="inline-flex items-center justify-center whitespace-nowrap rounded-md px-2.5 py-1 text-sm font-medium ring-offset-background transition-all hover:bg-sidebar-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow"
          >
            Models
          </TabsTrigger>
          <TabsTrigger
            value="api-keys"
            className="inline-flex items-center justify-center whitespace-nowrap rounded-md px-2.5 py-1 text-sm font-medium ring-offset-background transition-all hover:bg-sidebar-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow"
          >
            API Keys
          </TabsTrigger>
          <TabsTrigger
            value="attachments"
            className="inline-flex items-center justify-center whitespace-nowrap rounded-md px-2.5 py-1 text-sm font-medium ring-offset-background transition-all hover:bg-sidebar-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow"
          >
            Attachments
          </TabsTrigger>
          <TabsTrigger
            value="contact"
            className="inline-flex items-center justify-center whitespace-nowrap rounded-md px-2.5 py-1 text-sm font-medium ring-offset-background transition-all hover:bg-sidebar-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow"
          >
            Contact Us
          </TabsTrigger>
        </TabsList>

        <TabsContent value="account" className="mt-2 space-y-8">
          {/* Account content will go here */}
          <div className="space-y-6">
            <h2 className="text-2xl font-bold">Account Settings</h2>
            <p className="text-muted-foreground">
              Manage your account settings and preferences.
            </p>
          </div>
        </TabsContent>

        <TabsContent value="customization" className="mt-2 space-y-12">
          {/* Customization content will go here */}
          <div className="space-y-6">
            <h2 className="text-2xl font-bold">Customization</h2>
            <p className="text-muted-foreground">Customize your experience.</p>
          </div>
        </TabsContent>

        <TabsContent value="history" className="mt-2 space-y-12">
          {/* History & Sync content will go here */}
          <div className="space-y-6">
            <h2 className="text-2xl font-bold">Message History</h2>
            <p className="text-muted-foreground">
              Save your history as JSON, or import someone else's. Importing
              will NOT delete existing messages
            </p>
          </div>
        </TabsContent>

        <TabsContent value="models" className="mt-2 space-y-8">
          {/* Models content will go here */}
          <div className="space-y-6">
            <h2 className="text-2xl font-bold">Models</h2>
            <p className="text-muted-foreground">Configure your AI models.</p>
          </div>
        </TabsContent>

        <TabsContent value="api-keys" className="mt-2 space-y-8">
          {/* API Keys content will go here */}
          <div className="space-y-6">
            <h2 className="text-2xl font-bold">API Keys</h2>
            <p className="text-muted-foreground">Manage your API keys.</p>
          </div>
        </TabsContent>

        <TabsContent value="attachments" className="mt-2 space-y-8">
          {/* Attachments content will go here */}
          <div className="space-y-6">
            <h2 className="text-2xl font-bold">Attachments</h2>
            <p className="text-muted-foreground">
              Configure attachment settings.
            </p>
          </div>
        </TabsContent>

        <TabsContent value="contact" className="mt-2 space-y-8">
          {/* Contact content will go here */}
          <div className="space-y-6">
            <h2 className="text-2xl font-bold">Contact Us</h2>
            <p className="text-muted-foreground">
              Get in touch with our support team.
            </p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default SettingsTabs
