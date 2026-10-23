import React from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { NotificationProvider } from './context/NotificationContext'
import AppLayout    from './components/ui/AppLayout'
import LoadingSpinner from './components/ui/LoadingSpinner'

// Public pages
import Home      from './pages/public/Home'
import PublicMap from './pages/public/PublicMap'

// Auth pages
import Login    from './pages/auth/Login'
import Register from './pages/auth/Register'

// Citizen pages
import CitizenDashboard from './pages/citizen/CitizenDashboard'
import ReportComplaint  from './pages/citizen/ReportComplaint'
import MyComplaints     from './pages/citizen/MyComplaints'
import ComplaintDetail  from './pages/citizen/ComplaintDetail'
import Notifications    from './pages/citizen/Notifications'

// Admin pages
import AdminDashboard       from './pages/admin/AdminDashboard'
import AdminComplaints      from './pages/admin/AdminComplaints'
import AdminComplaintDetail from './pages/admin/AdminComplaintDetail'
import AdminMap             from './pages/admin/AdminMap'
import AdminAnalytics       from './pages/admin/AdminAnalytics'
import AdminReports         from './pages/admin/AdminReports'

// ── Route guards ──────────────────────────────────────────────────────────────
function RequireAuth({ children }) {
  const { isAuthenticated, loading } = useAuth()
  const location = useLocation()
  if (loading) return <LoadingSpinner fullPage message="Verifying session…" />
  if (!isAuthenticated) return <Navigate to="/login" state={{ from: location }} replace />
  return children
}

function RequireAdmin({ children }) {
  const { isAuthenticated, isAdmin, loading } = useAuth()
  const location = useLocation()
  if (loading) return <LoadingSpinner fullPage message="Verifying session…" />
  if (!isAuthenticated) return <Navigate to="/login" state={{ from: location }} replace />
  if (!isAdmin) return <Navigate to="/dashboard" replace />
  return children
}

function RequireCitizen({ children }) {
  const { isAuthenticated, isCitizen, loading } = useAuth()
  const location = useLocation()
  if (loading) return <LoadingSpinner fullPage message="Verifying session…" />
  if (!isAuthenticated) return <Navigate to="/login" state={{ from: location }} replace />
  if (!isCitizen) return <Navigate to="/admin/dashboard" replace />
  return children
}

function GuestOnly({ children }) {
  const { isAuthenticated, isAdmin, loading } = useAuth()
  if (loading) return <LoadingSpinner fullPage />
  if (isAuthenticated) return <Navigate to={isAdmin ? '/admin/dashboard' : '/dashboard'} replace />
  return children
}

// ── Wrap a page in the sidebar layout ────────────────────────────────────────
function WithLayout({ children }) {
  return <AppLayout>{children}</AppLayout>
}

function AppRoutes() {
  return (
    <Routes>
      {/* ── Public (no sidebar) ── */}
      <Route path="/"    element={<Home />} />
      <Route path="/map" element={
        <div className="min-h-screen bg-slate-50">
          <div className="pt-0">
            <PublicMap />
          </div>
        </div>
      } />

      {/* ── Auth (no sidebar) ── */}
      <Route path="/login"    element={<GuestOnly><Login /></GuestOnly>} />
      <Route path="/register" element={<GuestOnly><Register /></GuestOnly>} />

      {/* ── Citizen (with sidebar) ── */}
      <Route path="/dashboard"     element={<RequireCitizen><WithLayout><CitizenDashboard /></WithLayout></RequireCitizen>} />
      <Route path="/report"        element={<RequireCitizen><WithLayout><ReportComplaint /></WithLayout></RequireCitizen>} />
      <Route path="/my-complaints" element={<RequireCitizen><WithLayout><MyComplaints /></WithLayout></RequireCitizen>} />
      <Route path="/complaints/:id"element={<RequireAuth>   <WithLayout><ComplaintDetail /></WithLayout></RequireAuth>} />
      <Route path="/notifications" element={<RequireCitizen><WithLayout><Notifications /></WithLayout></RequireCitizen>} />

      {/* ── Admin (with sidebar) ── */}
      <Route path="/admin/dashboard"      element={<RequireAdmin><WithLayout><AdminDashboard /></WithLayout></RequireAdmin>} />
      <Route path="/admin/complaints"     element={<RequireAdmin><WithLayout><AdminComplaints /></WithLayout></RequireAdmin>} />
      <Route path="/admin/complaints/:id" element={<RequireAdmin><WithLayout><AdminComplaintDetail /></WithLayout></RequireAdmin>} />
      <Route path="/admin/map"            element={<RequireAdmin><WithLayout><AdminMap /></WithLayout></RequireAdmin>} />
      <Route path="/admin/analytics"      element={<RequireAdmin><WithLayout><AdminAnalytics /></WithLayout></RequireAdmin>} />
      <Route path="/admin/reports"        element={<RequireAdmin><WithLayout><AdminReports /></WithLayout></RequireAdmin>} />
      <Route path="/admin/notifications"  element={<RequireAdmin><WithLayout><Notifications /></WithLayout></RequireAdmin>} />

      {/* ── 404 ── */}
      <Route path="*" element={
        <div className="min-h-screen flex flex-col items-center justify-center text-center px-4 bg-slate-50">
          <p className="text-8xl font-black text-gray-100 mb-4">404</p>
          <p className="text-xl font-bold text-gray-700 mb-2">Page not found</p>
          <p className="text-gray-400 text-sm mb-6">The page you're looking for doesn't exist.</p>
          <a href="/" className="btn-primary">Go Home</a>
        </div>
      } />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <NotificationProvider>
          <AppRoutes />
        </NotificationProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
