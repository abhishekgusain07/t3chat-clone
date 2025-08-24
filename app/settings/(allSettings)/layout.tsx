import React from 'react'
import SettingsHeader from '../_components/settings-header'

const SettingsLayout = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="mx-auto flex max-w-[75rem] flex-col overflow-y-auto px-4 pb-24 pt-safe-offset-6 md:px-6 lg:px-8">
      <SettingsHeader />
      {children}
    </div>
  )
}
export default SettingsLayout
