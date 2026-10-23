import React, { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { Eye, EyeOff, Mail, Lock, Shield, MapPin, CheckCircle, ArrowRight } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { getErrorMessage } from '../../utils/helpers'

// ── Animated map background (pure CSS/SVG — no external API) ─────────────────
function MapPreview() {
  return (
    <div className="relative w-full h-64 rounded-2xl overflow-hidden mt-8"
      style={{ background: '#0f2535' }}>
      {/* SVG mock map */}
      <svg width="100%" height="100%" viewBox="0 0 480 260" xmlns="http://www.w3.org/2000/svg">
        {/* Grid roads */}
        <line x1="0" y1="80"  x2="480" y2="80"  stroke="#1a3a50" strokeWidth="8" />
        <line x1="0" y1="160" x2="480" y2="160" stroke="#1a3a50" strokeWidth="8" />
        <line x1="120" y1="0" x2="120" y2="260" stroke="#1a3a50" strokeWidth="8" />
        <line x1="280" y1="0" x2="280" y2="260" stroke="#1a3a50" strokeWidth="8" />
        <line x1="400" y1="0" x2="400" y2="260" stroke="#1a3a50" strokeWidth="6" />
        {/* Diagonal road */}
        <path d="M 0 200 Q 140 130 280 100 Q 380 75 480 60"
          stroke="#22c55e" strokeWidth="4" fill="none" strokeDasharray="6,3" opacity="0.8" />
        {/* City blocks */}
        <rect x="130" y="10"  width="140" height="60" fill="#132d40" rx="4" />
        <rect x="130" y="90"  width="140" height="60" fill="#132d40" rx="4" />
        <rect x="10"  y="90"  width="100" height="60" fill="#132d40" rx="4" />
        <rect x="290" y="10"  width="100" height="60" fill="#132d40" rx="4" />
        <rect x="290" y="90"  width="100" height="60" fill="#132d40" rx="4" />
        <rect x="10"  y="170" width="100" height="80" fill="#132d40" rx="4" />
        <rect x="130" y="170" width="140" height="80" fill="#132d40" rx="4" />
        <rect x="290" y="170" width="100" height="80" fill="#132d40" rx="4" />
        <rect x="410" y="90"  width="60"  height="60" fill="#132d40" rx="4" />
        {/* Labels */}
        <text x="155" y="48"  fill="#1d4e6e" fontSize="9" fontFamily="monospace">CIVIC CENTER</text>
        <text x="30"  y="128" fill="#1d4e6e" fontSize="9" fontFamily="monospace">WARD 5A</text>
        <text x="305" y="128" fill="#1d4e6e" fontSize="9" fontFamily="monospace">RIVER VIEW</text>
        {/* GPS coordinate */}
        <text x="10" y="22" fill="#22c55e" fontSize="8" fontFamily="monospace" opacity="0.7">19.8762° N · 75.3433° E</text>
        {/* Green marker */}
        <circle cx="210" cy="108" r="10" fill="#22c55e" opacity="0.9" />
        <circle cx="210" cy="108" r="6"  fill="white" />
        <circle cx="210" cy="108" r="3"  fill="#22c55e" />
        {/* Pulse ring */}
        <circle cx="210" cy="108" r="18" fill="none" stroke="#22c55e" strokeWidth="2" opacity="0.3" />
        {/* Yellow dot */}
        <circle cx="140" cy="148" r="5" fill="#f59e0b" />
        <circle cx="140" cy="148" r="9" fill="none" stroke="#f59e0b" strokeWidth="1.5" opacity="0.4" />
      </svg>

      {/* Pothole reported card */}
      <div className="absolute bottom-3 left-3 bg-[#0d2033] border border-[#1e4060] rounded-xl px-3 py-2 flex items-center gap-2 shadow-lg">
        <div className="w-7 h-7 bg-[#22c55e]/20 rounded-lg flex items-center justify-center">
          <MapPin className="w-3.5 h-3.5 text-[#22c55e]" />
        </div>
        <div>
          <p className="text-white text-xs font-semibold">Pothole reported</p>
          <p className="text-[#22c55e] text-[10px] flex items-center gap-1">
            <CheckCircle className="w-2.5 h-2.5" /> Location verified
          </p>
        </div>
        <div className="ml-4 text-right">
          <p className="text-[#4a8fa8] text-[9px] font-mono">RDR-2041</p>
        </div>
      </div>
    </div>
  )
}

export default function Login() {
  const { login }  = useAuth()
  const navigate   = useNavigate()
  const location   = useLocation()
  const from       = location.state?.from?.pathname || null

  // Tab: 'citizen' | 'admin'
  const [tab, setTab]         = useState('citizen')
  const [email, setEmail]     = useState('')
  const [password, setPassword] = useState('')
  const [showPwd, setShowPwd] = useState(false)
  const [remember, setRemember] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

  // Pre-fill demo creds when tab changes
  const switchTab = (t) => {
    setTab(t)
    setError('')
    if (t === 'admin') {
      setEmail('admin@roaddamage.local')
      setPassword('Admin@12345')
    } else {
      setEmail('citizen@roaddamage.local')
      setPassword('Citizen@12345')
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(''); setLoading(true)
    try {
      const user = await login(email, password)
      if (from) return navigate(from, { replace: true })
      navigate(user.role === 'admin' ? '/admin/dashboard' : '/dashboard', { replace: true })
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>

      {/* ── LEFT PANEL — dark with map ───────────────────────────────────── */}
      <div className="hidden lg:flex flex-col w-[52%] flex-shrink-0 p-10"
        style={{ background: 'linear-gradient(160deg, #0a1f30 0%, #0d2a3d 60%, #091820 100%)' }}>

        {/* Logo */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #22c55e, #16a34a)' }}>
              <MapPin className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="text-white font-bold text-base">RoadCare </span>
              <span className="font-bold text-base" style={{ color: '#22c55e' }}>GIS</span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border"
            style={{ borderColor: '#1e4060', background: '#0d2235' }}>
            <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            <span className="text-[10px] font-semibold tracking-widest uppercase"
              style={{ color: '#94a3b8' }}>Smart City Initiative</span>
          </div>
        </div>

        {/* Hero text */}
        <div className="mt-16">
          <p className="text-xs font-bold tracking-widest uppercase mb-4" style={{ color: '#22c55e' }}>
            Community-Powered Road Intelligence
          </p>
          <h1 className="text-5xl font-black leading-tight text-white mb-5">
            Better roads start<br />with you.
          </h1>
          <p className="text-sm leading-relaxed" style={{ color: '#7aabb8', maxWidth: 380 }}>
            Report road damage, <span style={{ color: '#22c55e' }}>pinpoint problem</span> areas,
            and help build safer streets for everyone in Chhatrapati Sambhajinagar.
          </p>
        </div>

        {/* Map preview */}
        <MapPreview />

        {/* Stats row */}
        <div className="flex items-center gap-6 mt-8">
          {[
            { value: '10+', label: 'Reports filed' },
            { value: '3',   label: 'Active zones'  },
            { value: 'AI',  label: 'Powered'        },
          ].map(({ value, label }) => (
            <div key={label}>
              <p className="text-xl font-black text-white">{value}</p>
              <p className="text-xs" style={{ color: '#4a7a8a' }}>{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── RIGHT PANEL — white form ─────────────────────────────────────── */}
      <div className="flex-1 flex items-center justify-center bg-white px-8 py-12">
        <div className="w-full max-w-sm">

          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-2 mb-10 justify-center">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg,#22c55e,#16a34a)' }}>
              <MapPin className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-gray-900">RoadCare GIS</span>
          </div>

          {/* Header */}
          <p className="text-xs font-bold tracking-widest uppercase mb-3" style={{ color: '#22c55e' }}>
            Secure Account Access
          </p>
          <h2 className="text-3xl font-black text-gray-900 mb-1">Welcome back</h2>
          <p className="text-sm text-gray-400 mb-7">Sign in to your RoadCare account.</p>

          {/* Tab switcher */}
          <div className="flex rounded-xl border border-gray-200 p-1 mb-7 bg-gray-50">
            {[
              { key: 'citizen', label: 'Citizen' },
              { key: 'admin',   label: 'Municipal Admin' },
            ].map(({ key, label }) => (
              <button
                key={key}
                onClick={() => switchTab(key)}
                className="flex-1 py-2 rounded-lg text-sm font-semibold transition-all duration-200"
                style={tab === key
                  ? { background: 'white', color: '#0f172a', boxShadow: '0 1px 6px rgba(0,0,0,0.1)' }
                  : { color: '#94a3b8' }
                }
              >
                {label}
              </button>
            ))}
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 mb-5 text-sm">
              <Shield className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Email address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-300" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                  className="w-full pl-10 pr-4 py-3 rounded-xl border text-sm transition-all outline-none"
                  style={{
                    borderColor: '#e2e8f0',
                    background: '#f8fafc',
                    color: '#0f172a',
                  }}
                  onFocus={(e) => { e.target.style.borderColor = '#22c55e'; e.target.style.boxShadow = '0 0 0 3px rgba(34,197,94,0.1)' }}
                  onBlur={(e)  => { e.target.style.borderColor = '#e2e8f0'; e.target.style.boxShadow = 'none' }}
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-300" />
                <input
                  type={showPwd ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  className="w-full pl-10 pr-10 py-3 rounded-xl border text-sm transition-all outline-none"
                  style={{
                    borderColor: '#e2e8f0',
                    background: '#f8fafc',
                    color: '#0f172a',
                  }}
                  onFocus={(e) => { e.target.style.borderColor = '#22c55e'; e.target.style.boxShadow = '0 0 0 3px rgba(34,197,94,0.1)' }}
                  onBlur={(e)  => { e.target.style.borderColor = '#e2e8f0'; e.target.style.boxShadow = 'none' }}
                />
                <button
                  type="button"
                  onClick={() => setShowPwd(!showPwd)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500 transition-colors"
                >
                  {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Remember + Forgot */}
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  className="w-4 h-4 rounded accent-green-500"
                />
                <span className="text-sm text-gray-600">Remember me</span>
              </label>
              <button type="button" className="text-sm font-semibold hover:underline"
                style={{ color: '#22c55e' }}>
                Forgot password?
              </button>
            </div>

            {/* Sign in button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-xl text-white font-bold text-sm flex items-center justify-center gap-2 transition-all duration-200 disabled:opacity-60"
              style={{
                background: loading ? '#16a34a' : 'linear-gradient(90deg, #22c55e 0%, #16a34a 100%)',
                boxShadow: '0 4px 20px rgba(34,197,94,0.35)',
              }}
              onMouseEnter={(e) => { if (!loading) e.target.style.boxShadow = '0 6px 28px rgba(34,197,94,0.5)' }}
              onMouseLeave={(e) => { e.target.style.boxShadow = '0 4px 20px rgba(34,197,94,0.35)' }}
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Signing in…
                </>
              ) : (
                <>Sign in <ArrowRight className="w-4 h-4" /></>
              )}
            </button>
          </form>

          {/* Security note */}
          <div className="flex items-center justify-center gap-1.5 mt-4">
            <Shield className="w-3 h-3 text-gray-300" />
            <p className="text-xs text-gray-300">Your account is protected with secure encryption</p>
          </div>

          {/* Register link */}
          <p className="text-center text-sm text-gray-400 mt-6">
            New to RoadCare?{' '}
            <Link to="/register" className="font-bold hover:underline" style={{ color: '#22c55e' }}>
              Create an account
            </Link>
          </p>

          {/* Demo hint */}
          <div className="mt-6 p-3.5 rounded-xl border text-xs"
            style={{ borderColor: '#e8f5e9', background: '#f0fdf4', color: '#166534' }}>
            <p className="font-bold mb-1.5">🔑 Demo — click a tab to auto-fill</p>
            <div className="space-y-0.5 text-green-700">
              <p>Citizen: citizen@roaddamage.local / Citizen@12345</p>
              <p>Admin: admin@roaddamage.local / Admin@12345</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
