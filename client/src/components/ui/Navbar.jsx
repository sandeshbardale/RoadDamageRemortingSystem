import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Bell, Menu, X, MapPin, LogOut, User, LayoutDashboard } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useNotifications } from '../../context/NotificationContext'

export default function Navbar() {
  const { user, logout, isAdmin, isAuthenticated } = useAuth()
  const { unreadCount } = useNotifications()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 font-bold text-primary-700 text-lg">
            <MapPin className="w-6 h-6 text-primary-600" />
            <span className="hidden sm:block">Road Damage Reporter</span>
            <span className="sm:hidden">RDR</span>
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-6">
            <Link to="/map" className="text-gray-600 hover:text-primary-600 text-sm font-medium transition-colors">Public Map</Link>

            {isAuthenticated && !isAdmin && (
              <>
                <Link to="/dashboard" className="text-gray-600 hover:text-primary-600 text-sm font-medium">Dashboard</Link>
                <Link to="/report" className="text-gray-600 hover:text-primary-600 text-sm font-medium">Report Damage</Link>
                <Link to="/my-complaints" className="text-gray-600 hover:text-primary-600 text-sm font-medium">My Complaints</Link>
              </>
            )}

            {isAdmin && (
              <>
                <Link to="/admin/dashboard" className="text-gray-600 hover:text-primary-600 text-sm font-medium">Dashboard</Link>
                <Link to="/admin/complaints" className="text-gray-600 hover:text-primary-600 text-sm font-medium">Complaints</Link>
                <Link to="/admin/map" className="text-gray-600 hover:text-primary-600 text-sm font-medium">Map</Link>
                <Link to="/admin/analytics" className="text-gray-600 hover:text-primary-600 text-sm font-medium">Analytics</Link>
              </>
            )}
          </div>

          {/* Right side */}
          <div className="hidden md:flex items-center gap-3">
            {isAuthenticated ? (
              <>
                <Link to={isAdmin ? '/admin/notifications' : '/notifications'} className="relative p-2 text-gray-500 hover:text-primary-600">
                  <Bell className="w-5 h-5" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </Link>
                <div className="flex items-center gap-2 text-sm text-gray-700">
                  <User className="w-4 h-4" />
                  <span className="font-medium">{user?.name}</span>
                  {isAdmin && <span className="badge-reported">Admin</span>}
                </div>
                <button onClick={handleLogout} className="flex items-center gap-1 text-sm text-red-500 hover:text-red-700">
                  <LogOut className="w-4 h-4" />
                  Logout
                </button>
              </>
            ) : (
              <>
                <Link to="/login" className="text-sm text-gray-600 hover:text-primary-600 font-medium">Login</Link>
                <Link to="/register" className="btn-primary text-sm">Register</Link>
              </>
            )}
          </div>

          {/* Mobile menu button */}
          <button className="md:hidden p-2" onClick={() => setMenuOpen(!menuOpen)}>
            {menuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="md:hidden border-t border-gray-100 bg-white py-2 px-4 space-y-1">
          <Link to="/map" onClick={() => setMenuOpen(false)} className="block py-2 text-sm text-gray-600">Public Map</Link>
          {isAuthenticated && !isAdmin && (
            <>
              <Link to="/dashboard" onClick={() => setMenuOpen(false)} className="block py-2 text-sm text-gray-600">Dashboard</Link>
              <Link to="/report" onClick={() => setMenuOpen(false)} className="block py-2 text-sm text-gray-600">Report Damage</Link>
              <Link to="/my-complaints" onClick={() => setMenuOpen(false)} className="block py-2 text-sm text-gray-600">My Complaints</Link>
              <Link to="/notifications" onClick={() => setMenuOpen(false)} className="block py-2 text-sm text-gray-600">Notifications {unreadCount > 0 && `(${unreadCount})`}</Link>
            </>
          )}
          {isAdmin && (
            <>
              <Link to="/admin/dashboard" onClick={() => setMenuOpen(false)} className="block py-2 text-sm text-gray-600">Dashboard</Link>
              <Link to="/admin/complaints" onClick={() => setMenuOpen(false)} className="block py-2 text-sm text-gray-600">Complaints</Link>
              <Link to="/admin/map" onClick={() => setMenuOpen(false)} className="block py-2 text-sm text-gray-600">Map</Link>
              <Link to="/admin/analytics" onClick={() => setMenuOpen(false)} className="block py-2 text-sm text-gray-600">Analytics</Link>
            </>
          )}
          {isAuthenticated ? (
            <button onClick={handleLogout} className="block w-full text-left py-2 text-sm text-red-500">Logout</button>
          ) : (
            <>
              <Link to="/login" onClick={() => setMenuOpen(false)} className="block py-2 text-sm text-gray-600">Login</Link>
              <Link to="/register" onClick={() => setMenuOpen(false)} className="block py-2 text-sm text-gray-600">Register</Link>
            </>
          )}
        </div>
      )}
    </nav>
  )
}
