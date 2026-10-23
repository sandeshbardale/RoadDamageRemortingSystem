import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, MapPin, User, Building2, Calendar, CheckCircle,
  Brain, Wrench, ZoomIn, X
} from 'lucide-react'
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet'
import L from 'leaflet'
import { adminService } from '../../services/adminService'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import ErrorAlert from '../../components/ui/ErrorAlert'
import StatusBadge from '../../components/ui/StatusBadge'
import { formatDateTime, CATEGORY_LABELS, STATUS_LABELS, getErrorMessage, resolveImageUrl } from '../../utils/helpers'

delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

const STATUSES = ['REPORTED','RECEIVED','IN_PROGRESS','RESOLVED','CLOSED']

// Severity colour helper
const severityColor = (s) => {
  if (!s) return 'bg-gray-100 text-gray-600'
  const v = s.toLowerCase()
  if (v.includes('critical')) return 'bg-red-100 text-red-700 border border-red-200'
  if (v.includes('high'))     return 'bg-orange-100 text-orange-700 border border-orange-200'
  if (v.includes('medium'))   return 'bg-yellow-100 text-yellow-700 border border-yellow-200'
  return 'bg-green-100 text-green-700 border border-green-200'
}

export default function AdminComplaintDetail() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [complaint, setComplaint] = useState(null)
  const [history,   setHistory]   = useState([])
  const [loading,   setLoading]   = useState(true)
  const [updating,  setUpdating]  = useState(false)
  const [error,     setError]     = useState('')
  const [successMsg,setSuccessMsg]= useState('')
  const [newStatus, setNewStatus] = useState('')
  const [comment,   setComment]   = useState('')
  const [imgZoom,   setImgZoom]   = useState(false)  // full-screen image

  const load = async () => {
    try {
      const res = await adminService.getComplaintDetail(id)
      setComplaint(res.data.data.complaint)
      setHistory(res.data.data.history)
      setNewStatus(res.data.data.complaint.status)
    } catch (err) { setError(getErrorMessage(err)) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [id])

  const handleStatusUpdate = async () => {
    if (newStatus === complaint.status) return setError('Please select a different status.')
    setUpdating(true); setError(''); setSuccessMsg('')
    try {
      await adminService.updateStatus(id, { status: newStatus, comment })
      setSuccessMsg(`Status updated to ${STATUS_LABELS[newStatus]}.`)
      setComment('')
      await load()
    } catch (err) { setError(getErrorMessage(err)) }
    finally { setUpdating(false) }
  }

  if (loading) return <LoadingSpinner message="Loading complaint…" />

  const ai = complaint?.aiAnalysis
  const hasImage = complaint?.image?.url && complaint.image.url.length > 0
  const imageUrl = hasImage ? resolveImageUrl(complaint.image.url) : null

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">

      {/* ── Full-screen image zoom overlay ─────────────────────────────── */}
      {imgZoom && hasImage && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setImgZoom(false)}>
          <button className="absolute top-4 right-4 text-white hover:text-red-400">
            <X className="w-8 h-8" />
          </button>
          <img src={imageUrl} alt="Damage full"
            className="max-w-full max-h-full object-contain rounded-xl"
            onClick={(e) => e.stopPropagation()} />
        </div>
      )}

      {/* Back */}
      <button onClick={() => navigate('/admin/complaints')}
        className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to Complaints
      </button>

      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <p className="text-xs text-gray-400 mb-1 uppercase tracking-wide">Complaint ID</p>
          <h1 className="text-2xl font-bold font-mono text-primary-700">{complaint?.complaintId}</h1>
          <p className="text-sm text-gray-500 mt-1">{CATEGORY_LABELS[complaint?.damageCategory]}</p>
        </div>
        {complaint && <StatusBadge status={complaint.status} />}
      </div>

      {/* ── Prominent Citizen Banner ── */}
      {complaint?.citizenId && (
        <div className="flex items-center gap-4 rounded-2xl p-4"
          style={{ background:'linear-gradient(135deg,#eef2ff,#f0fdf4)', border:'1px solid #c7d2fe' }}>
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-white text-2xl font-black flex-shrink-0 shadow-md"
            style={{ background:'linear-gradient(135deg,#6366f1,#4f46e5)' }}>
            {complaint.citizenId.name?.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-widest mb-0.5" style={{ color:'#6366f1' }}>Reported By</p>
            <p className="text-xl font-black text-gray-900 leading-tight">{complaint.citizenId.name}</p>
            <div className="flex flex-wrap items-center gap-4 mt-1">
              {complaint.citizenId.email && (
                <p className="text-xs text-gray-500">✉️ {complaint.citizenId.email}</p>
              )}
              {complaint.citizenId.phone && (
                <p className="text-xs text-gray-500">📞 {complaint.citizenId.phone}</p>
              )}
            </div>
          </div>
          <div className="hidden sm:block text-right flex-shrink-0">
            <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-0.5">Filed on</p>
            <p className="text-sm font-bold text-gray-700">{formatDateTime(complaint?.createdAt)}</p>
          </div>
        </div>
      )}

      <ErrorAlert message={error} onDismiss={() => setError('')} />
      {successMsg && (
        <div className="flex items-center gap-2 bg-green-50 border border-green-200 text-green-800 rounded-xl p-3 text-sm">
          <CheckCircle className="w-4 h-4" /> {successMsg}
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        {/* ── LEFT ── */}
        <div className="lg:col-span-2 space-y-6">

          {/* Damage Photo */}
          <div className="card">
            <h2 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
              📷 Damage Photo
            </h2>
            {hasImage ? (
              <div className="relative group cursor-pointer" onClick={() => setImgZoom(true)}>
                <img
                  src={imageUrl}
                  alt="Road damage"
                  className="w-full rounded-xl object-cover max-h-72 border border-gray-100"
                  onError={(e) => { e.target.style.display='none'; e.target.nextSibling.style.display='flex' }}
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all rounded-xl flex items-center justify-center">
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 rounded-full p-2">
                    <ZoomIn className="w-5 h-5 text-gray-700" />
                  </div>
                </div>
                <div style={{display:'none'}} className="w-full h-48 bg-gray-100 rounded-xl items-center justify-center text-gray-400 text-sm flex-col gap-2">
                  <span className="text-3xl">📷</span>
                  <span>Image could not be loaded</span>
                </div>
              </div>
            ) : (
              <div className="w-full h-48 bg-gray-50 border-2 border-dashed border-gray-200 rounded-xl flex flex-col items-center justify-center text-gray-400">
                <span className="text-3xl mb-2">📷</span>
                <p className="text-sm">No photo attached</p>
                <p className="text-xs mt-1 text-gray-300">Cloudinary not configured or no image uploaded</p>
              </div>
            )}
          </div>

          {/* ── Gemini AI Analysis ─────────────────────────────────────── */}
          {ai?.available ? (
            <div className="card border-l-4 border-purple-400">
              <h2 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <Brain className="w-5 h-5 text-purple-500" />
                AI Damage Analysis
                <span className="ml-auto text-xs bg-purple-100 text-purple-600 px-2 py-0.5 rounded-full font-normal">
                  Powered by Gemini
                </span>
              </h2>
              <div className="grid sm:grid-cols-2 gap-3">
                {/* Severity */}
                {ai.severity && (
                  <div className={`rounded-xl p-3 ${severityColor(ai.severity)}`}>
                    <p className="text-xs font-semibold uppercase tracking-wide opacity-70 mb-1">Severity</p>
                    <p className="font-bold text-sm">{ai.severity}</p>
                  </div>
                )}
                {/* Damage Type */}
                {ai.damageType && (
                  <div className="rounded-xl p-3 bg-blue-50 border border-blue-100">
                    <p className="text-xs font-semibold uppercase tracking-wide text-blue-500 mb-1">Damage Type</p>
                    <p className="text-sm text-blue-800 font-medium">{ai.damageType}</p>
                  </div>
                )}
                {/* Estimated Size */}
                {ai.estimatedSize && (
                  <div className="rounded-xl p-3 bg-gray-50 border border-gray-200">
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">Estimated Size</p>
                    <p className="text-sm text-gray-800">{ai.estimatedSize}</p>
                  </div>
                )}
                {/* Safety Risk */}
                {ai.safetyRisk && (
                  <div className={`rounded-xl p-3 ${ai.safetyRisk.toLowerCase().includes('yes') ? 'bg-red-50 border border-red-200' : 'bg-green-50 border border-green-200'}`}>
                    <p className={`text-xs font-semibold uppercase tracking-wide mb-1 ${ai.safetyRisk.toLowerCase().includes('yes') ? 'text-red-500' : 'text-green-500'}`}>
                      Safety Risk
                    </p>
                    <p className={`text-sm font-medium ${ai.safetyRisk.toLowerCase().includes('yes') ? 'text-red-800' : 'text-green-800'}`}>
                      {ai.safetyRisk}
                    </p>
                  </div>
                )}
                {/* Recommended Action */}
                {ai.recommendedAction && (
                  <div className="sm:col-span-2 rounded-xl p-3 bg-amber-50 border border-amber-200">
                    <p className="text-xs font-semibold uppercase tracking-wide text-amber-600 mb-1 flex items-center gap-1">
                      <Wrench className="w-3 h-3" /> Recommended Action
                    </p>
                    <p className="text-sm text-amber-900">{ai.recommendedAction}</p>
                  </div>
                )}
                {/* Additional Notes */}
                {ai.additionalNotes && (
                  <div className="sm:col-span-2 rounded-xl p-3 bg-gray-50 border border-gray-100">
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">Additional Notes</p>
                    <p className="text-sm text-gray-700">{ai.additionalNotes}</p>
                  </div>
                )}
              </div>
              {ai.analyzedAt && (
                <p className="text-xs text-gray-400 mt-3">Analyzed: {new Date(ai.analyzedAt).toLocaleString()}</p>
              )}
            </div>
          ) : (
            <div className="card border border-dashed border-purple-200 bg-purple-50/30">
              <div className="flex items-center gap-3 text-purple-400">
                <Brain className="w-5 h-5" />
                <div>
                  <p className="text-sm font-medium text-purple-600">AI Analysis not available</p>
                  <p className="text-xs text-purple-400 mt-0.5">
                    {ai?.message || 'Add GEMINI_API_KEY to server/.env and upload an image to enable AI analysis.'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Location map */}
          {complaint?.location?.coordinates && (
            <div className="card">
              <h2 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                <MapPin className="w-4 h-4 text-primary-500" /> Location on Map
              </h2>
              <div style={{ height: 240 }} className="rounded-xl overflow-hidden border border-gray-100">
                <MapContainer
                  center={[complaint.location.coordinates[1], complaint.location.coordinates[0]]}
                  zoom={15} style={{ height:'100%', width:'100%' }} scrollWheelZoom={false}
                >
                  <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' />
                  <CircleMarker
                    center={[complaint.location.coordinates[1], complaint.location.coordinates[0]]}
                    radius={10} pathOptions={{ color:'#ef4444', fillColor:'#ef4444', fillOpacity:0.8 }}
                  >
                    <Popup>{complaint.complaintId}</Popup>
                  </CircleMarker>
                </MapContainer>
              </div>
              <p className="text-xs text-gray-400 font-mono mt-2">
                {complaint.location.coordinates[1]?.toFixed(6)}, {complaint.location.coordinates[0]?.toFixed(6)}
              </p>
            </div>
          )}

          {/* Details */}
          <div className="card grid sm:grid-cols-2 gap-5">
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Citizen</p>
              <p className="font-semibold text-gray-800">{complaint?.citizenId?.name}</p>
              <p className="text-xs text-gray-500">{complaint?.citizenId?.email}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Municipal Corporation</p>
              <p className="font-semibold text-gray-800">{complaint?.municipalCorporationId?.name || 'Unassigned'}</p>
              <span className={`text-xs font-medium ${complaint?.assignmentStatus === 'ASSIGNED' ? 'text-green-600' : 'text-yellow-600'}`}>
                {complaint?.assignmentStatus}
              </span>
            </div>
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Address</p>
              <p className="text-sm text-gray-700 leading-relaxed">{complaint?.address?.formatted || '—'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Reported On</p>
              <p className="text-sm text-gray-700">{formatDateTime(complaint?.createdAt)}</p>
            </div>
            {complaint?.description && (
              <div className="sm:col-span-2">
                <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Description</p>
                <p className="text-sm text-gray-700 leading-relaxed">{complaint.description}</p>
              </div>
            )}
            {complaint?.isDuplicate && (
              <div className="sm:col-span-2 bg-yellow-50 border border-yellow-200 rounded-xl p-3 text-sm text-yellow-800">
                ⚠️ Duplicate — {complaint.duplicateDistance}m from{' '}
                <span className="font-mono font-semibold">
                  {complaint.duplicateOf?.complaintId || 'original'}
                </span>
              </div>
            )}
          </div>

          {/* Status history */}
          <div className="card">
            <h2 className="font-semibold text-gray-800 mb-5">Status History</h2>
            <div className="space-y-4">
              {history.map((h) => (
                <div key={h._id} className="flex gap-4">
                  <div className="w-6 h-6 rounded-full bg-primary-100 border-2 border-primary-400 flex-shrink-0 flex items-center justify-center">
                    <div className="w-2 h-2 rounded-full bg-primary-500" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-800">
                      {h.previousStatus ? `${STATUS_LABELS[h.previousStatus]} → ` : ''}
                      <span className="text-primary-700">{STATUS_LABELS[h.newStatus]}</span>
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      by {h.changedBy?.name} · {formatDateTime(h.createdAt)}
                    </p>
                    {h.comment && <p className="text-xs text-gray-500 italic mt-0.5">"{h.comment}"</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── RIGHT: Status update panel ── */}
        <div className="space-y-4">
          <div className="card">
            <h2 className="font-semibold text-gray-800 mb-4">Update Status</h2>
            <div className="space-y-2">
              {STATUSES.map((s) => (
                <label key={s} className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all
                  ${newStatus === s ? 'border-primary-500 bg-primary-50' : 'border-gray-100 hover:border-gray-300'}`}>
                  <input type="radio" name="status" value={s}
                    checked={newStatus === s} onChange={() => setNewStatus(s)}
                    className="text-primary-600" />
                  <span className="text-sm font-medium text-gray-700">{STATUS_LABELS[s]}</span>
                  {complaint?.status === s && (
                    <span className="ml-auto text-xs text-primary-500 font-medium">Current</span>
                  )}
                </label>
              ))}
            </div>
            <textarea
              value={comment} onChange={(e) => setComment(e.target.value)}
              rows={3} placeholder="Add a comment (optional)…"
              className="input-field resize-none mt-4 text-sm" maxLength={500}
            />
            <button
              onClick={handleStatusUpdate}
              disabled={updating || newStatus === complaint?.status}
              className="btn-primary w-full mt-3"
            >
              {updating ? 'Updating…' : 'Update Status'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
