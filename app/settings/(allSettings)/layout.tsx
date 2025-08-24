import React from 'react'
import SettingsHeader from './_components/settings-header'
import SidebarProfile from './_components/sidebar-profile'
import SettingsTabs from './_components/settings-tab'

const SettingsLayout = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="mx-auto flex max-w-[75rem] flex-col overflow-y-auto px-4 pb-24 pt-safe-offset-6 md:px-6 lg:px-8">
      <SettingsHeader />
      <div className="flex flex-grow flex-col gap-4 md:flex-row">
        <SidebarProfile />
        <div className="md:w-3/4 md:pl-12 lg:w-auto lg:max-w-[70%]">
          <SettingsTabs />
          {children}
        </div>
      </div>
    </div>
  )
}
export default SettingsLayout
