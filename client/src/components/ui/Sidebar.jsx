import React, { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, FileText, Map, BarChart2,
  Plus, LogOut, MapPin, ChevronLeft, ChevronRight,
  Bell, FileBarChart, Menu, X, Shield
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useNotifications } from '../../context/NotificationContext'

const ADMIN_NAV = [
  { label:'Dashboard',  icon:LayoutDashboard, to:'/admin/dashboard'  },
  { label:'Complaints', icon:FileText,         to:'/admin/complaints' },
  { label:'GIS Map',    icon:Map,              to:'/admin/map'        },
  { label:'Analytics',  icon:BarChart2,        to:'/admin/analytics'  },
  { label:'Reports',    icon:FileBarChart,     to:'/admin/reports'    },
]

// Citizen nav — matches the design image exactly
const CITIZEN_NAV = [
  { label:'Overview',       icon:LayoutDashboard, to:'/dashboard'     },
  { label:'Report damage',  icon:Plus,            to:'/report'        },
  { label:'My complaints',  icon:FileText,        to:'/my-complaints', badge:true },
  { label:'Public GIS map', icon:Map,             to:'/map'           },
]

export default function Sidebar({ collapsed, setCollapsed }) {
  const { user, logout, isAdmin } = useAuth()
  const { unreadCount }           = useNotifications()
  const location  = useLocation()
  const navigate  = useNavigate()
  const [mobileOpen, setMobileOpen] = useState(false)

  const nav     = isAdmin ? ADMIN_NAV : CITIZEN_NAV
  const isActive = (to) => location.pathname === to || location.pathname.startsWith(to + '/')

  const handleLogout = async () => { await logout(); navigate('/login') }

  const NavItem = ({ label, icon: Icon, to, badge }) => {
    const active = isActive(to)
    return (
      <Link to={to} onClick={() => setMobileOpen(false)}
        className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150
          ${active
            ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/40'
            : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}>
        <Icon className="w-[18px] h-[18px] flex-shrink-0" />
        {!collapsed && <span className="flex-1 text-[13px]">{label}</span>}
        {!collapsed && badge && unreadCount > 0 && (
          <span className="bg-indigo-500 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </Link>
    )
  }

  return (
    <>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-40 bg-black/60" onClick={() => setMobileOpen(false)} />
      )}

      {/* Mobile toggle */}
      <button onClick={() => setMobileOpen(!mobileOpen)}
        className="lg:hidden fixed top-3 left-3 z-50 w-10 h-10 rounded-xl flex items-center justify-center shadow-lg"
        style={{ background:'#0f172a' }}>
        {mobileOpen ? <X className="w-5 h-5 text-white" /> : <Menu className="w-5 h-5 text-white" />}
      </button>

      {/* Sidebar */}
      <aside className={`fixed top-0 left-0 h-screen z-40 flex flex-col transition-all duration-300
        ${collapsed ? 'w-[72px]' : 'w-[220px]'}
        ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
        style={{ background:'#0d1b2a' }}>

        {/* ── Logo ── */}
        <div className="flex items-center gap-2.5 px-4 py-5"
          style={{ borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background:'linear-gradient(135deg,#6366f1,#4f46e5)' }}>
            <MapPin className="w-4.5 h-4.5 text-white w-[18px] h-[18px]" />
          </div>
          {!collapsed && (
            <div>
              <p className="text-white font-extrabold text-sm leading-tight">
                RoadCare <span style={{ color:'#818cf8' }}>GIS</span>
              </p>
            </div>
          )}
        </div>

        {/* ── Citizen portal badge ── */}
        {!collapsed && !isAdmin && (
          <div className="mx-3 mt-4 rounded-xl p-3" style={{ background:'rgba(99,102,241,0.12)', border:'1px solid rgba(99,102,241,0.2)' }}>
            <p className="text-[9px] font-bold uppercase tracking-widest mb-0.5" style={{ color:'#818cf8' }}>Citizen Portal</p>
            <p className="text-white text-xs font-semibold leading-tight">CSN Municipal Corporation</p>
          </div>
        )}

        {/* ── Nav section ── */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
          {!collapsed && (
            <p className="text-[10px] font-bold uppercase tracking-widest px-3 mb-2" style={{ color:'#334155' }}>
              Workspace
            </p>
          )}
          {nav.map((item) => <NavItem key={item.to} {...item} />)}
        </nav>

        {/* ── Help card (citizen only, not collapsed) ── */}
        {!collapsed && !isAdmin && (
          <div className="mx-3 mb-3 rounded-xl p-4" style={{ background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.07)' }}>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background:'rgba(99,102,241,0.2)' }}>
                <Shield className="w-3.5 h-3.5" style={{ color:'#818cf8' }} />
              </div>
              <p className="text-white text-xs font-bold">Need assistance?</p>
            </div>
            <p className="text-[11px] leading-relaxed mb-2" style={{ color:'#64748b' }}>
              Call the civic helpline at <span style={{ color:'#94a3b8' }}>1800-233-7000</span>
            </p>
            <a href="#" className="text-xs font-semibold flex items-center gap-1" style={{ color:'#818cf8' }}>
              Visit help centre →
            </a>
          </div>
        )}

        {/* ── Sign out ── */}
        <div className="px-3 pb-5" style={{ borderTop:'1px solid rgba(255,255,255,0.06)', paddingTop:12 }}>
          <button onClick={handleLogout}
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm transition-all"
            style={{ color:'#475569' }}
            onMouseEnter={(e) => e.currentTarget.style.color = '#f87171'}
            onMouseLeave={(e) => e.currentTarget.style.color = '#475569'}>
            <LogOut className="w-[18px] h-[18px] flex-shrink-0" />
            {!collapsed && <span className="text-[13px] font-medium">Sign out</span>}
          </button>
        </div>

        {/* Collapse toggle (desktop) */}
        <button onClick={() => setCollapsed(!collapsed)}
          className="hidden lg:flex absolute -right-3 top-20 w-6 h-6 rounded-full items-center justify-center transition-colors"
          style={{ background:'#0d1b2a', border:'1px solid rgba(255,255,255,0.1)', color:'#475569' }}
          onMouseEnter={(e) => e.currentTarget.style.color = '#fff'}
          onMouseLeave={(e) => e.currentTarget.style.color = '#475569'}>
          {collapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
        </button>
      </aside>
    </>
  )
}
