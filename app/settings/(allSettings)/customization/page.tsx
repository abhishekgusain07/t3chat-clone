'use client'

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Command, CommandInput, CommandList } from '@/components/ui/command'
import { Plus, X } from 'lucide-react'

interface CustomizationSettings {
  name: string
  occupation: string
  traits: string[]
  additionalInfo: string
  disableExternalLinkWarning: boolean
  invertSendBehavior: boolean
  boringTheme: boolean
  hidePersonalInfo: boolean
  disableThematicBreaks: boolean
  statsForNerds: boolean
  mainTextFont: string
  codeFont: string
}

const defaultTraits = [
  'friendly',
  'witty',
  'concise',
  'curious',
  'empathetic',
  'creative',
  'patient',
]

const fontOptions = [
  { value: 'inter', label: 'Inter' },
  { value: 'system', label: 'System UI' },
  { value: 'roboto', label: 'Roboto' },
  { value: 'opensans', label: 'Open Sans' },
  { value: 'lato', label: 'Lato' },
]

const codeFontOptions = [
  { value: 'jetbrains-mono', label: 'JetBrains Mono' },
  { value: 'fira-code', label: 'Fira Code' },
  { value: 'source-code-pro', label: 'Source Code Pro' },
  { value: 'monaco', label: 'Monaco' },
  { value: 'consolas', label: 'Consolas' },
]

export default function T3ChatCustomization() {
  const [settings, setSettings] = useState<CustomizationSettings>({
    name: '',
    occupation: '',
    traits: [],
    additionalInfo: '',
    disableExternalLinkWarning: false,
    invertSendBehavior: false,
    boringTheme: true,
    hidePersonalInfo: false,
    disableThematicBreaks: false,
    statsForNerds: false,
    mainTextFont: '',
    codeFont: '',
  })

  const [currentTrait, setCurrentTrait] = useState('')

  const addTrait = (trait: string) => {
    if (
      trait.trim() &&
      !settings.traits.includes(trait.trim()) &&
      settings.traits.length < 50
    ) {
      setSettings((prev) => ({
        ...prev,
        traits: [...prev.traits, trait.trim()],
      }))
    }
  }

  const removeTrait = (traitToRemove: string) => {
    setSettings((prev) => ({
      ...prev,
      traits: prev.traits.filter((trait) => trait !== traitToRemove),
    }))
  }

  const handleTraitInput = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault()
      addTrait(currentTrait)
      setCurrentTrait('')
    }
  }

  const handleSavePreferences = () => {
    console.log('Saving preferences:', settings)
    // Implement save logic here
  }

  const handleLoadLegacyData = () => {
    console.log('Loading legacy data...')
    // Implement load legacy data logic here
  }

  return (
    <div className="mt-2 space-y-12">
      {/* Customization Section */}
      <div className="space-y-6">
        <h2 className="text-2xl font-bold">Customize T3 Chat</h2>

        <form className="grid gap-6 py-2">
          {/* Name Input */}
          <div className="relative grid gap-2">
            <Label className="text-base font-medium">
              What should T3 Chat call you?
            </Label>
            <Input
              placeholder="Enter your name"
              maxLength={50}
              value={settings.name}
              onChange={(e) =>
                setSettings((prev) => ({ ...prev, name: e.target.value }))
              }
            />
            <span className="pointer-events-none absolute bottom-2 right-2 text-xs font-normal text-muted-foreground">
              {settings.name.length}/50
            </span>
          </div>

          {/* Occupation Input */}
          <div className="relative grid gap-2">
            <Label className="text-base font-medium">What do you do?</Label>
            <Input
              placeholder="Engineer, student, etc."
              maxLength={100}
              value={settings.occupation}
              onChange={(e) =>
                setSettings((prev) => ({ ...prev, occupation: e.target.value }))
              }
            />
            <span className="pointer-events-none absolute bottom-2 right-2 text-xs font-normal text-muted-foreground">
              {settings.occupation.length}/100
            </span>
          </div>

          {/* Traits Input */}
          <div className="grid gap-2">
            <div className="flex items-center gap-2">
              <Label className="text-base font-medium">
                What traits should T3 Chat have?
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  (up to 50, max 100 chars each)
                </span>
              </Label>
            </div>

            <div className="relative">
              <Command className="h-full flex-col text-popover-foreground relative flex w-full overflow-visible rounded-md border border-input bg-transparent px-3 py-2 text-base shadow-sm">
                <CommandInput
                  placeholder="Type a trait and press Enter or Tab..."
                  value={currentTrait}
                  onValueChange={setCurrentTrait}
                  onKeyDown={handleTraitInput}
                  maxLength={100}
                  className="flex w-full rounded-md bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                />
                <CommandList />
              </Command>
              <span className="pointer-events-none absolute bottom-2 right-2 text-xs font-normal text-muted-foreground">
                {settings.traits.length}/50
              </span>
            </div>

            {/* Default Traits */}
            <div className="mb-2 flex flex-wrap gap-2">
              {defaultTraits.map((trait) => (
                <Badge
                  key={trait}
                  variant="secondary"
                  className="flex select-none items-center gap-1 text-xs font-medium cursor-pointer hover:bg-secondary/80"
                  onClick={() => addTrait(trait)}
                >
                  {trait}
                  <Plus className="h-4 w-4" />
                </Badge>
              ))}
            </div>

            {/* Selected Traits */}
            {settings.traits.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {settings.traits.map((trait) => (
                  <Badge
                    key={trait}
                    variant="default"
                    className="flex items-center gap-1 text-xs font-medium"
                  >
                    {trait}
                    <X
                      className="h-3 w-3 cursor-pointer"
                      onClick={() => removeTrait(trait)}
                    />
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Additional Info */}
          <div className="relative grid gap-2">
            <div className="flex items-center gap-2">
              <Label className="text-base font-medium">
                Anything else T3 Chat should know about you?
              </Label>
            </div>
            <Textarea
              placeholder="Interests, values, or preferences to keep in mind"
              maxLength={3000}
              className="min-h-[100px]"
              value={settings.additionalInfo}
              onChange={(e) =>
                setSettings((prev) => ({
                  ...prev,
                  additionalInfo: e.target.value,
                }))
              }
            />
            <span className="pointer-events-none absolute bottom-2 right-2 text-xs font-normal text-muted-foreground">
              {settings.additionalInfo.length}/3000
            </span>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-row items-center gap-2 justify-between">
            <Button
              variant="outline"
              type="button"
              onClick={handleLoadLegacyData}
            >
              Load Legacy Data
            </Button>
            <Button
              type="button"
              className="bg-primary hover:bg-pink-600/90"
              disabled={!settings.name.trim()}
              onClick={handleSavePreferences}
            >
              Save Preferences
            </Button>
          </div>
        </form>
      </div>

      {/* Behavior Options */}
      <div className="space-y-6">
        <h2 className="text-2xl font-bold">Behavior Options</h2>
        <div className="space-y-6 py-2">
          <div className="flex items-center justify-between gap-x-1">
            <div className="space-y-0.5">
              <Label className="text-base font-medium">
                Disable External Link Warning
              </Label>
              <p className="text-sm text-muted-foreground">
                Skip the confirmation dialog when clicking external links. Note:
                We cannot guarantee the safety of external links, use this
                option at your own risk.
              </p>
            </div>
            <Switch
              checked={settings.disableExternalLinkWarning}
              onCheckedChange={(checked) =>
                setSettings((prev) => ({
                  ...prev,
                  disableExternalLinkWarning: checked,
                }))
              }
            />
          </div>

          <div className="flex items-center justify-between gap-x-1">
            <div className="space-y-0.5">
              <Label className="text-base font-medium">
                Invert Send/New Line Behavior
              </Label>
              <p className="text-sm text-muted-foreground">
                When enabled, use Enter for newlines, and Shift/Ctrl/⌘ + Enter
                to send messages
              </p>
              <p className="text-sm text-muted-foreground">
                When disabled, use Enter to send and Shift + Enter for new
                lines.
              </p>
            </div>
            <Switch
              checked={settings.invertSendBehavior}
              onCheckedChange={(checked) =>
                setSettings((prev) => ({
                  ...prev,
                  invertSendBehavior: checked,
                }))
              }
            />
          </div>
        </div>

        {/* Visual Options */}
        <h2 className="text-2xl font-bold">Visual Options</h2>
        <div className="space-y-6 py-2">
          <div className="flex items-center justify-between gap-x-1">
            <div className="space-y-0.5">
              <Label className="text-base font-medium">Boring Theme</Label>
              <p className="text-sm text-muted-foreground">
                If you think the pink is too much, turn this on to tone it down.
              </p>
            </div>
            <Switch
              checked={settings.boringTheme}
              onCheckedChange={(checked) =>
                setSettings((prev) => ({ ...prev, boringTheme: checked }))
              }
            />
          </div>

          <div className="flex items-center justify-between gap-x-1">
            <div className="space-y-0.5">
              <Label className="text-base font-medium">
                Hide Personal Information
              </Label>
              <p className="text-sm text-muted-foreground">
                Hides your name and email from the UI.
              </p>
            </div>
            <Switch
              checked={settings.hidePersonalInfo}
              onCheckedChange={(checked) =>
                setSettings((prev) => ({ ...prev, hidePersonalInfo: checked }))
              }
            />
          </div>

          <div className="flex items-center justify-between gap-x-1">
            <div className="space-y-0.5">
              <Label className="text-base font-medium">
                Disable Thematic Breaks
              </Label>
              <p className="text-sm text-muted-foreground">
                Hides horizontal lines in chat messages. (Some browsers have
                trouble rendering these, turn off if you have bugs with
                duplicated lines)
              </p>
            </div>
            <Switch
              checked={settings.disableThematicBreaks}
              onCheckedChange={(checked) =>
                setSettings((prev) => ({
                  ...prev,
                  disableThematicBreaks: checked,
                }))
              }
            />
          </div>

          <div className="flex items-center justify-between gap-x-1">
            <div className="space-y-0.5">
              <Label className="text-base font-medium">Stats for Nerds</Label>
              <p className="text-sm text-muted-foreground">
                Enables more insights into message stats including tokens per
                second, time to first token, and estimated tokens in the
                message.
              </p>
            </div>
            <Switch
              checked={settings.statsForNerds}
              onCheckedChange={(checked) =>
                setSettings((prev) => ({ ...prev, statsForNerds: checked }))
              }
            />
          </div>

          {/* Font Selection */}
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <div className="space-y-0.5">
                    <Label className="text-base font-medium">
                      Main Text Font
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Used in general text throughout the app.
                    </p>
                  </div>
                  <Select
                    value={settings.mainTextFont}
                    onValueChange={(value) =>
                      setSettings((prev) => ({ ...prev, mainTextFont: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select font" />
                    </SelectTrigger>
                    <SelectContent>
                      {fontOptions.map((font) => (
                        <SelectItem key={font.value} value={font.value}>
                          {font.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <div className="space-y-0.5">
                    <Label className="text-base font-medium">Code Font</Label>
                    <p className="text-sm text-muted-foreground">
                      Used in code blocks and inline code in chat messages.
                    </p>
                  </div>
                  <Select
                    value={settings.codeFont}
                    onValueChange={(value) =>
                      setSettings((prev) => ({ ...prev, codeFont: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select font" />
                    </SelectTrigger>
                    <SelectContent>
                      {codeFontOptions.map((font) => (
                        <SelectItem key={font.value} value={font.value}>
                          {font.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Font Preview */}
              <div>
                <h1 className="text-base font-medium">Fonts Preview</h1>
                <div className="rounded-lg border border-dashed border-input p-4">
                  <div className="prose prose-pink max-w-none dark:prose-invert prose-pre:m-0 prose-pre:bg-transparent prose-pre:p-0">
                    <div className="flex justify-end">
                      <div className="group relative inline-block max-w-[80%] break-words rounded-xl border border-secondary/50 bg-secondary/50 px-4 py-3 text-left">
                        Can you write me a simple hello world program?
                      </div>
                    </div>
                    <div className="mb-2 mt-4">
                      <div className="max-w-[80%]">Sure, here you go:</div>
                    </div>
                    <div className="relative flex w-full flex-col pt-9">
                      <div className="absolute inset-x-0 top-0 flex h-9 items-center rounded-t bg-secondary px-4 py-2 text-sm text-secondary-foreground">
                        <span className="font-mono">typescript</span>
                      </div>
                      <div className="bg-chat-accent text-sm font-[450] text-secondary-foreground rounded-b border border-t-0">
                        <pre className="px-4 py-4 overflow-auto text-sm">
                          <code>{`function greet(name: string) {
  console.log(\`Hello, \${name}!\`);
  return true;
}`}</code>
                        </pre>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
