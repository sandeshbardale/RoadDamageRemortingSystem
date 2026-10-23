import React, { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Plus, ArrowRight, MapPin, CheckCircle, Clock,
  ChevronRight, AlertTriangle, TrendingUp
} from 'lucide-react'
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet'
import L from 'leaflet'
import { useAuth } from '../../context/AuthContext'
import { complaintService } from '../../services/complaintService'
import { notificationService } from '../../services/notificationService'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import WelcomeModal from '../../components/ui/WelcomeModal'
import { formatDate, CATEGORY_LABELS, CATEGORY_COLORS, resolveImageUrl } from '../../utils/helpers'

// Fix Leaflet icons
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl:'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

// ── Greeting based on time ─────────────────────────────────────────────────
const getGreeting = () => {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

// ── Status config ──────────────────────────────────────────────────────────
const STATUS_CFG = {
  REPORTED:    { label:'Under review',  dot:'#f59e0b', bar:'#f59e0b', pct: 25 },
  RECEIVED:    { label:'Acknowledged',  dot:'#6366f1', bar:'#6366f1', pct: 40 },
  IN_PROGRESS: { label:'Work assigned', dot:'#6366f1', bar:'#6366f1', pct: 72 },
  RESOLVED:    { label:'Resolved',      dot:'#22c55e', bar:'#22c55e', pct:100 },
  CLOSED:      { label:'Closed',        dot:'#94a3b8', bar:'#94a3b8', pct:100 },
}

// ── Stat card ──────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, pct, accent, icon: Icon, iconBg, miniBar }) {
  return (
    <div className="bg-white rounded-2xl p-5 flex flex-col justify-between relative overflow-hidden"
      style={{ border:'1px solid #f1f5f9', minHeight:120 }}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-medium mb-1" style={{ color:'#94a3b8' }}>{label}</p>
          <p className="text-3xl font-black text-gray-900">{value}</p>
          {sub && <p className="text-[11px] mt-1" style={{ color:'#94a3b8' }}>{sub}</p>}
        </div>
        <div className="flex flex-col items-end gap-1">
          {pct !== undefined && (
            <span className="text-xs font-bold" style={{ color: accent }}>{pct}%</span>
          )}
          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: iconBg }}>
            <Icon className="w-4 h-4" style={{ color: accent }} />
          </div>
        </div>
      </div>
      {/* Mini bar chart decoration */}
      {miniBar && (
        <div className="absolute bottom-0 right-0 flex items-end gap-0.5 p-2 opacity-30">
          {[30,50,40,70,55,80,65].map((h,i) => (
            <div key={i} className="w-1.5 rounded-t" style={{ height: h*0.4, background: accent }} />
          ))}
        </div>
      )}
      {/* Bottom accent bar */}
      <div className="absolute bottom-0 left-0 right-0 h-1 rounded-b-2xl" style={{ background: accent }} />
    </div>
  )
}

// ── Activity row ────────────────────────────────────────────────────────────
function ActivityRow({ complaint }) {
  const navigate   = useNavigate()
  const cfg        = STATUS_CFG[complaint.status] || STATUS_CFG.REPORTED
  const category   = CATEGORY_LABELS[complaint.damageCategory] || complaint.damageCategory

  return (
    <div
      onClick={() => navigate(`/complaints/${complaint._id}`)}
      className="flex items-center gap-4 px-4 py-3.5 rounded-xl cursor-pointer transition-all hover:bg-gray-50 group"
      style={{ border:'1px solid #f8fafc' }}>
      {/* Icon */}
      <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ background: cfg.dot + '18', border:`1.5px solid ${cfg.dot}30` }}>
        <MapPin className="w-4 h-4" style={{ color: cfg.dot }} />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <p className="text-sm font-bold text-gray-900 truncate">{category}</p>
          <span className="text-[10px] font-mono" style={{ color:'#94a3b8' }}>
            #{complaint.complaintId?.replace('RDR-2026-','RC-')}
          </span>
        </div>
        <p className="text-xs truncate mb-2" style={{ color:'#94a3b8' }}>
          📍 {complaint.address?.road ? `${complaint.address.road}, ` : ''}{complaint.address?.area || complaint.address?.city || 'Chhatrapati Sambhajinagar'}
        </p>
        {/* Progress bar */}
        <div className="flex items-center gap-2">
          <div className="flex-1 h-1 rounded-full" style={{ background:'#f1f5f9' }}>
            <div className="h-1 rounded-full transition-all" style={{ width:`${cfg.pct}%`, background: cfg.bar }} />
          </div>
          <span className="text-[10px] font-bold" style={{ color:'#94a3b8' }}>{cfg.pct}%</span>
        </div>
      </div>

      {/* Right */}
      <div className="flex flex-col items-end gap-2 flex-shrink-0">
        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full"
          style={{ background: cfg.dot + '15', color: cfg.dot }}>
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: cfg.dot }} />
          {cfg.label}
        </span>
        <p className="text-[11px]" style={{ color:'#cbd5e1' }}>{formatDate(complaint.createdAt)}</p>
      </div>

      <ChevronRight className="w-4 h-4 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color:'#cbd5e1' }} />
    </div>
  )
}

export default function CitizenDashboard() {
  const { user }   = useAuth()
  const [complaints,    setComplaints]    = useState([])
  const [nearbyComplaints, setNearby]     = useState([])
  const [total,         setTotal]         = useState(0)
  const [loading,       setLoading]       = useState(true)

  // Welcome modal
  const welcomeKey   = `welcomed_${user?._id}`
  const [showWelcome, setShowWelcome] = useState(() => !localStorage.getItem(welcomeKey))
  const [displayName, setDisplayName] = useState(user?.name?.split(' ')[0] || '')

  const handleWelcomeConfirm = (name) => {
    setDisplayName(name.split(' ')[0])
    localStorage.setItem(welcomeKey, '1')
    setShowWelcome(false)
  }

  useEffect(() => {
    const load = async () => {
      try {
        const [cRes] = await Promise.all([
          complaintService.getMy({ limit:5, page:1 }),
        ])
        setComplaints(cRes.data.data.complaints)
        setTotal(cRes.data.data.pagination.total)

        // Load nearby (default CSN coords)
        try {
          const nRes = await complaintService.getNearby({ latitude:19.8762, longitude:75.3433, radius:5000 })
          setNearby(nRes.data.data.complaints || [])
        } catch {}
      } catch {}
      finally { setLoading(false) }
    }
    load()
  }, [])

  if (loading) return <LoadingSpinner message="Loading your dashboard…" />

  const firstName   = displayName || user?.name?.split(' ')[0] || user?.name || 'there'
  const resolved    = complaints.filter(c => c.status === 'RESOLVED').length
  const inProgress  = complaints.filter(c => c.status === 'IN_PROGRESS').length
  const underReview = complaints.filter(c => ['REPORTED','RECEIVED'].includes(c.status)).length
  const resRate     = total > 0 ? Math.round((resolved / total) * 100) : 0

  // Map center — use first nearby complaint or default CSN
  const mapCenter = nearbyComplaints.length > 0
    ? [nearbyComplaints[0].location.coordinates[1], nearbyComplaints[0].location.coordinates[0]]
    : [19.8762, 75.3433]

  return (
    <div className="space-y-5">
      {showWelcome && <WelcomeModal currentName={user?.name} onConfirm={handleWelcomeConfirm} />}

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color:'#6366f1' }}>
            Citizen Dashboard
          </p>
          <h1 className="text-3xl font-black text-gray-900">
            {getGreeting()}, {firstName}.
          </h1>
          <p className="text-sm mt-1" style={{ color:'#94a3b8' }}>
            Here's what's happening with your road reports in{' '}
            <span style={{ color:'#6366f1', fontWeight:600 }}>Chhatrapati Sambhajinagar.</span>
          </p>
        </div>
        <Link to="/report"
          className="flex items-center gap-2 text-sm font-bold text-white px-5 py-3 rounded-xl flex-shrink-0 shadow-lg transition-all hover:shadow-xl"
          style={{ background:'linear-gradient(135deg,#6366f1,#4f46e5)', boxShadow:'0 4px 20px rgba(99,102,241,0.4)' }}>
          <Plus className="w-4 h-4" /> Report road damage
        </Link>
      </div>

      {/* ── 4 Stat cards ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total reports"   value={total}
          sub={`+${Math.min(total,2)} this month`}
          accent="#6366f1" iconBg="#eef2ff"
          icon={AlertTriangle} miniBar
        />
        <StatCard
          label="Under review"   value={underReview}
          pct={25} sub="Awaiting verification"
          accent="#f59e0b" iconBg="#fffbeb"
          icon={Clock}
        />
        <StatCard
          label="In progress"    value={inProgress}
          pct={33} sub="Repairs underway"
          accent="#6366f1" iconBg="#eef2ff"
          icon={TrendingUp}
        />
        <StatCard
          label="Resolved"       value={resolved}
          pct={resRate} sub={`${resRate}% resolution rate`}
          accent="#22c55e" iconBg="#f0fdf4"
          icon={CheckCircle}
        />
      </div>

      {/* ── Bottom two-column grid ────────────────────────────────────── */}
      <div className="grid lg:grid-cols-[1fr_340px] gap-5">

        {/* Recent activity */}
        <div className="bg-white rounded-2xl overflow-hidden" style={{ border:'1px solid #f1f5f9' }}>
          <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom:'1px solid #f8fafc' }}>
            <div>
              <h2 className="font-bold text-gray-900">Recent activity</h2>
              <p className="text-xs mt-0.5" style={{ color:'#94a3b8' }}>Track the progress of your latest reports</p>
            </div>
            <Link to="/my-complaints"
              className="flex items-center gap-1.5 text-xs font-bold transition-colors hover:opacity-80"
              style={{ color:'#6366f1' }}>
              View all <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="divide-y divide-gray-50 px-2 py-2">
            {complaints.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-3xl mb-3">🛣️</p>
                <p className="text-sm font-medium text-gray-400 mb-3">No complaints yet.</p>
                <Link to="/report" className="text-xs font-bold" style={{ color:'#6366f1' }}>
                  Report your first road damage →
                </Link>
              </div>
            ) : (
              complaints.map((c) => <ActivityRow key={c._id} complaint={c} />)
            )}
          </div>
        </div>

        {/* Nearby reports map */}
        <div className="bg-white rounded-2xl overflow-hidden flex flex-col" style={{ border:'1px solid #f1f5f9' }}>
          <div className="flex items-center justify-between px-4 py-4" style={{ borderBottom:'1px solid #f8fafc' }}>
            <div>
              <h2 className="font-bold text-gray-900">Nearby reports</h2>
              <p className="text-xs mt-0.5" style={{ color:'#94a3b8' }}>Live reports within 5 km</p>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full"
              style={{ background:'#f0fdf4', border:'1px solid #bbf7d0' }}>
              <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              <span className="text-[10px] font-bold text-green-700">Live</span>
            </div>
          </div>

          {/* Map */}
          <div className="flex-1" style={{ height: 260 }}>
            <MapContainer center={mapCenter} zoom={13}
              style={{ height:'100%', width:'100%' }}
              scrollWheelZoom={false} zoomControl={false}>
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              />
              {nearbyComplaints.slice(0,20).map((c) => {
                const [lon,lat] = c.location.coordinates
                const color = CATEGORY_COLORS[c.damageCategory] || '#6366f1'
                return (
                  <CircleMarker key={c._id} center={[lat,lon]} radius={7}
                    pathOptions={{ color:'white', fillColor:color, fillOpacity:1, weight:2 }}>
                    <Popup>
                      <p className="font-bold text-xs">{c.complaintId}</p>
                      <p className="text-xs">{CATEGORY_LABELS[c.damageCategory]}</p>
                    </Popup>
                  </CircleMarker>
                )
              })}
            </MapContainer>
          </div>

          {/* Map footer */}
          <div className="px-4 py-3 flex items-center justify-between" style={{ borderTop:'1px solid #f8fafc' }}>
            <div className="flex items-center gap-3 text-[11px]" style={{ color:'#94a3b8' }}>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-orange-400 inline-block" />
                {nearbyComplaints.filter(c => c.status !== 'RESOLVED').length} open
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-green-400 inline-block" />
                {nearbyComplaints.filter(c => c.status === 'RESOLVED').length} in repair
              </span>
            </div>
            <Link to="/map"
              className="flex items-center gap-1 text-xs font-bold transition-colors hover:opacity-80"
              style={{ color:'#6366f1' }}>
              Open map <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
