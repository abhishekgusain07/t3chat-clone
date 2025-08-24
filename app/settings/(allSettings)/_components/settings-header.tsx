'use client'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Sun, Moon } from 'lucide-react'
import { useTheme } from 'next-themes'

const SettingsHeader = () => {
  const { theme, setTheme } = useTheme()

  return (
    <header className="flex items-center justify-between pb-8">
      {/* Back Button */}
      <Button
        variant="ghost"
        className="flex items-center gap-2 hover:bg-muted/40"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Chat
      </Button>

      <div className="flex flex-row items-center gap-2">
        {/* Theme Toggle */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="relative"
        >
          <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          <span className="sr-only">Toggle theme</span>
        </Button>

        {/* Sign Out */}
        <Button
          variant="ghost"
          className="flex items-center gap-2 hover:bg-muted/40"
        >
          <Sun className="h-4 w-4" />
          Sign out
        </Button>
      </div>
    </header>
  )
}

export default SettingsHeader
