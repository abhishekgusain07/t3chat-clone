'use client'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Rocket, Sparkles, Headset, Info, Copy } from 'lucide-react'

export default function SubscriptionSettings() {
  return (
    <div className="mt-4 space-y-8">
      {/* Upgrade Section */}
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between">
          <h2 className="text-center text-2xl font-bold md:text-left">
            Upgrade to Pro
          </h2>
          <div className="mt-2 flex flex-col items-center justify-center text-right md:mt-0 md:flex-row md:items-center md:justify-center md:text-right">
            <div className="text-xl font-bold md:text-3xl">
              $8{' '}
              <span className="text-lg text-secondary-foreground">/month</span>
            </div>
          </div>
        </div>

        {/* Features */}
        <div className="grid gap-3 md:grid-cols-3">
          <Card className="flex flex-col items-start px-6 py-4">
            <div className="mb-2 flex items-center">
              <Rocket className="mr-2 h-5 w-5 text-primary" />
              <span className="text-base font-semibold">
                Access to All Models
              </span>
            </div>
            <p className="text-sm text-muted-foreground/80">
              Get access to our full suite of models including Claude,
              o3-mini-high, and more!
            </p>
          </Card>

          <Card className="flex flex-col items-start px-6 py-4">
            <div className="mb-2 flex items-center">
              <Sparkles className="mr-2 h-5 w-5 text-primary" />
              <span className="text-base font-semibold">Generous Limits</span>
            </div>
            <p className="text-sm text-muted-foreground/80">
              Receive <b>1500 standard credits</b> per month, plus{' '}
              <b>100 premium credits</b> per month.
            </p>
          </Card>

          <Card className="flex flex-col items-start px-6 py-4">
            <div className="mb-2 flex items-center">
              <Headset className="mr-2 h-5 w-5 text-primary" />
              <span className="text-base font-semibold">Priority Support</span>
            </div>
            <p className="text-sm text-muted-foreground/80">
              Get faster responses and dedicated assistance whenever you need
              help!
            </p>
          </Card>
        </div>

        {/* Upgrade Button */}
        <div className="flex flex-col gap-4 md:flex-row">
          <Button className="w-full md:w-64">Upgrade Now</Button>
        </div>

        <p className="text-sm text-muted-foreground/60">
          <span className="mx-0.5 text-base font-medium">*</span> Premium
          credits are used for GPT Image Gen, o3, Claude Sonnet, Gemini, and
          more. Additional Premium credits can be purchased separately for $8
          per 100.
        </p>
      </div>

      {/* Billing Preferences */}
      <div className="mt-8 space-y-6">
        <h2 className="text-2xl font-bold">Billing Preferences</h2>
        <div className="flex items-center justify-between gap-x-1">
          <div className="space-y-0.5">
            <label className="text-base font-medium">Email me receipts</label>
            <p className="text-sm text-muted-foreground">
              Send receipts to your account email when a payment succeeds.
            </p>
          </div>
          <Switch />
        </div>
      </div>

      {/* Message Usage (mobile fallback card) */}
      <Card className="space-y-6 md:hidden">
        <div className="grid w-full min-w-0 grid-rows-[auto] space-y-6">
          <div className="flex flex-row justify-between sm:flex-col lg:flex-row lg:items-center lg:gap-x-4">
            <span className="text-sm font-semibold">Message Usage</span>
            <div className="text-xs text-muted-foreground">
              <p>Resets tomorrow at 5:29 AM</p>
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
            <Info className="mr-1 inline-flex size-3 shrink-0 -mt-0.5" />
            Each tool call consumes an additional standard credit.
          </i>
        </div>
      </Card>

      {/* Danger Zone */}
      <div className="!mt-20">
        <div className="w-fit space-y-2">
          <h2 className="text-2xl font-bold">Danger Zone</h2>
          <div className="space-y-6">
            <p className="px-px py-1.5 text-sm text-muted-foreground/80">
              Permanently delete your account and all associated data.
            </p>
            <div className="flex flex-row gap-2">
              <Button variant="destructive">Delete Account</Button>
            </div>
          </div>
        </div>
      </div>

      {/* Support Section (mobile only) */}
      <div className="mt-8 block md:hidden">
        <div className="w-fit space-y-2">
          <h2 className="text-2xl font-bold">Support Information</h2>
          <div className="space-y-2">
            <p className="px-px py-1.5 text-sm text-muted-foreground/80">
              Your user ID may be requested by our support team to help resolve
              issues.
            </p>
            <Button variant="outline" className="flex items-center gap-2">
              <span>Copy User ID</span>
              <Copy className="h-4 w-4 text-muted-foreground" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
