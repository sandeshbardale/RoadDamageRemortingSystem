import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, MapPin, Calendar, Building2, Brain, Wrench } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { complaintService } from '../../services/complaintService'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import ErrorAlert from '../../components/ui/ErrorAlert'
import StatusBadge from '../../components/ui/StatusBadge'
import { formatDateTime, CATEGORY_LABELS, STATUS_LABELS, getErrorMessage, resolveImageUrl } from '../../utils/helpers'

const STATUS_ORDER = ['REPORTED', 'RECEIVED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']

const severityColor = (s) => {
  if (!s) return 'bg-gray-100 text-gray-600'
  const v = s.toLowerCase()
  if (v.includes('critical')) return 'bg-red-100 text-red-700'
  if (v.includes('high'))     return 'bg-orange-100 text-orange-700'
  if (v.includes('medium'))   return 'bg-yellow-100 text-yellow-700'
  return 'bg-green-100 text-green-700'
}

export default function ComplaintDetail() {
  const { id }    = useParams()
  const navigate  = useNavigate()
  const { isAdmin } = useAuth()

  const [complaint, setComplaint] = useState(null)
  const [history,   setHistory]   = useState([])
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState('')

  useEffect(() => {
    const load = async () => {
      try {
        const [cRes, hRes] = await Promise.all([
          complaintService.getById(id),
          complaintService.getStatusHistory(id),
        ])
        setComplaint(cRes.data.data.complaint)
        setHistory(hRes.data.data.history)
      } catch (err) { setError(getErrorMessage(err)) }
      finally { setLoading(false) }
    }
    load()
  }, [id])

  if (loading) return <LoadingSpinner message="Loading complaint…" />
  if (error)   return <div className="max-w-2xl mx-auto px-4 py-8"><ErrorAlert message={error} /></div>
  if (!complaint) return null

  const currentIdx = STATUS_ORDER.indexOf(complaint.status)
  const ai = complaint.aiAnalysis

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-5">

      <button onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      {/* ── Header card ────────────────────────────────────────────────────── */}
      <div className="card">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Complaint ID</p>
            <h1 className="text-lg font-bold font-mono text-primary-700">{complaint.complaintId}</h1>
            <p className="text-sm text-gray-500 mt-0.5">{CATEGORY_LABELS[complaint.damageCategory]}</p>
          </div>
          <StatusBadge status={complaint.status} />
        </div>
        {complaint.isDuplicate && (
          <div className="mt-3 bg-yellow-50 border border-yellow-200 rounded-xl p-3 text-yellow-800 text-sm">
            ⚠️ Duplicate report — {complaint.duplicateDistance}m from the original.
          </div>
        )}
      </div>

      {/* ── Photo ──────────────────────────────────────────────────────────── */}
      {complaint.image?.url && (
        <div className="card">
          <p className="text-sm font-semibold text-gray-700 mb-3">📷 Photo</p>
          <img
            src={resolveImageUrl(complaint.image.url)}
            alt="Damage"
            className="w-full rounded-xl object-cover max-h-64 border border-gray-100"
            onError={(e) => { e.target.style.display='none' }}
          />
        </div>
      )}

      {/* ── AI Analysis (citizen-friendly view) ───────────────────────────── */}
      {ai?.available && (
        <div className="card border-l-4 border-purple-400 bg-purple-50/30">
          <h2 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
            <Brain className="w-4 h-4 text-purple-500" />
            AI Assessment
            <span className="text-xs bg-purple-100 text-purple-600 px-2 py-0.5 rounded-full font-normal ml-auto">
              Gemini AI
            </span>
          </h2>
          <div className="space-y-2">
            {ai.severity && (
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-500 w-28 flex-shrink-0">Severity</span>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${severityColor(ai.severity)}`}>
                  {ai.severity}
                </span>
              </div>
            )}
            {ai.safetyRisk && (
              <div className="flex items-start gap-3">
                <span className="text-xs text-gray-500 w-28 flex-shrink-0">Safety Risk</span>
                <span className="text-xs text-gray-700">{ai.safetyRisk}</span>
              </div>
            )}
            {ai.recommendedAction && (
              <div className="flex items-start gap-3">
                <span className="text-xs text-gray-500 w-28 flex-shrink-0 flex items-center gap-1">
                  <Wrench className="w-3 h-3" /> Action
                </span>
                <span className="text-xs text-gray-700">{ai.recommendedAction}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Status timeline ────────────────────────────────────────────────── */}
      <div className="card">
        <h2 className="font-semibold text-gray-800 mb-5">Status Timeline</h2>
        <div className="relative">
          {STATUS_ORDER.map((status, i) => {
            const histEntry = history.find((h) => h.newStatus === status)
            const isDone    = i <= currentIdx
            const isCurrent = i === currentIdx
            return (
              <div key={status} className="flex gap-4 pb-5 last:pb-0 relative">
                {i < STATUS_ORDER.length - 1 && (
                  <div className={`absolute left-[11px] top-6 bottom-0 w-0.5 ${isDone && i < currentIdx ? 'bg-green-400' : 'bg-gray-100'}`} />
                )}
                <div className={`w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center border-2 relative z-10
                  ${isCurrent ? 'border-primary-500 bg-primary-100' : isDone ? 'border-green-500 bg-green-100' : 'border-gray-200 bg-white'}`}>
                  {isDone && !isCurrent && <div className="w-2 h-2 rounded-full bg-green-500" />}
                  {isCurrent            && <div className="w-2 h-2 rounded-full bg-primary-500" />}
                </div>
                <div className="flex-1 pt-0.5">
                  <p className={`text-sm font-medium ${isCurrent ? 'text-primary-700' : isDone ? 'text-gray-800' : 'text-gray-300'}`}>
                    {STATUS_LABELS[status]}
                  </p>
                  {histEntry && (
                    <p className="text-xs text-gray-400 mt-0.5">{formatDateTime(histEntry.createdAt)}</p>
                  )}
                  {histEntry?.comment && (
                    <p className="text-xs text-gray-500 italic mt-0.5">"{histEntry.comment}"</p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Details ────────────────────────────────────────────────────────── */}
      <div className="card space-y-4">
        <div className="flex items-start gap-3">
          <MapPin className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-xs text-gray-400 mb-0.5">Location</p>
            <p className="text-sm text-gray-700">{complaint.address?.formatted || '—'}</p>
            <p className="text-xs text-gray-300 font-mono mt-0.5">
              {complaint.location?.coordinates?.[1]?.toFixed(6)}, {complaint.location?.coordinates?.[0]?.toFixed(6)}
            </p>
          </div>
        </div>
        <div className="flex items-start gap-3">
          <Building2 className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-xs text-gray-400 mb-0.5">Municipal Corporation</p>
            <p className="text-sm text-gray-700">{complaint.municipalCorporationId?.name || 'Unassigned'}</p>
          </div>
        </div>
        <div className="flex items-start gap-3">
          <Calendar className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-xs text-gray-400 mb-0.5">Reported On</p>
            <p className="text-sm text-gray-700">{formatDateTime(complaint.createdAt)}</p>
          </div>
        </div>
        {complaint.description && (
          <div className="pt-2 border-t border-gray-50">
            <p className="text-xs text-gray-400 mb-1">Your Description</p>
            <p className="text-sm text-gray-700">{complaint.description}</p>
          </div>
        )}
      </div>

    </div>
  )
}
