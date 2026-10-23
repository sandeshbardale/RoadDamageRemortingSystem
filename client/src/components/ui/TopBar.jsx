import React from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Bell, ChevronRight, ChevronDown } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useNotifications } from '../../context/NotificationContext'

const ROUTE_LABELS = {
  '/dashboard':        'Overview',
  '/report':           'Report damage',
  '/my-complaints':    'My complaints',
  '/map':              'Public GIS map',
  '/notifications':    'Notifications',
  '/admin/dashboard':  'Overview',
  '/admin/complaints': 'Complaints',
  '/admin/map':        'GIS Map',
  '/admin/analytics':  'Analytics',
  '/admin/reports':    'Reports',
}

export default function TopBar({ collapsed }) {
  const { user, isAdmin } = useAuth()
  const { unreadCount }   = useNotifications()
  const location          = useLocation()

  const pageLabel  = ROUTE_LABELS[location.pathname] || 'Overview'
  const initials   = user?.name?.split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase() || 'U'
  const notifPath  = isAdmin ? '/admin/notifications' : '/notifications'

  return (
    <header className={`fixed top-0 right-0 z-30 h-16 flex items-center justify-between px-6
      bg-white transition-all duration-300
      ${collapsed ? 'left-[72px]' : 'left-[220px]'}
      max-lg:left-0`}
      style={{ borderBottom:'1px solid #f1f5f9' }}>

      {/* Breadcrumb */}
      <nav className="hidden sm:flex items-center gap-2 text-sm ml-8 lg:ml-0">
        <span className="font-medium" style={{ color:'#94a3b8' }}>
          {isAdmin ? 'RoadCare GIS' : 'RoadCare GIS'}
        </span>
        <ChevronRight className="w-3.5 h-3.5" style={{ color:'#cbd5e1' }} />
        <span className="font-bold text-gray-900">{pageLabel}</span>
      </nav>

      {/* Mobile title */}
      <p className="sm:hidden font-bold text-gray-900 ml-12">{pageLabel}</p>

      {/* Right */}
      <div className="flex items-center gap-3 ml-auto">
        {/* Bell */}
        <Link to={notifPath}
          className="relative w-9 h-9 flex items-center justify-center rounded-xl transition-colors hover:bg-gray-50"
          style={{ border:'1px solid #f1f5f9' }}>
          <Bell className="w-[18px] h-[18px]" style={{ color:'#64748b' }} />
          {unreadCount > 0 && (
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-red-500" />
          )}
        </Link>

        {/* User chip */}
        <div className="flex items-center gap-2.5 pl-3 cursor-pointer group"
          style={{ borderLeft:'1px solid #f1f5f9' }}>
          <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
            style={{ background:'linear-gradient(135deg,#6366f1,#4f46e5)' }}>
            {initials}
          </div>
          <div className="hidden sm:block">
            <p className="text-sm font-bold text-gray-900 leading-tight">{user?.name}</p>
            <p className="text-[11px]" style={{ color:'#94a3b8' }}>
              {isAdmin ? 'Admin account' : 'Citizen account'}
            </p>
          </div>
          <ChevronDown className="w-3.5 h-3.5 hidden sm:block" style={{ color:'#cbd5e1' }} />
        </div>
      </div>
    </header>
  )
}
