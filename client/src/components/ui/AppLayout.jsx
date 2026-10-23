import React, { useState } from 'react'
import Sidebar from './Sidebar'
import TopBar  from './TopBar'

export default function AppLayout({ children }) {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar collapsed={collapsed} setCollapsed={setCollapsed} />

      {/* Main area shifts right to clear the sidebar */}
      <div className={`flex-1 flex flex-col transition-all duration-300 ${collapsed ? 'lg:pl-[72px]' : 'lg:pl-64'}`}>
        <TopBar collapsed={collapsed} />

        {/* Page content — padded below the fixed TopBar */}
        <main className="flex-1 pt-16 min-h-screen">
          <div className="p-6 max-w-[1400px] mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
