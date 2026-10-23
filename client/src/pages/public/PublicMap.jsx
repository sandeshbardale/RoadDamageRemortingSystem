import React, { useEffect, useState } from 'react'
import { complaintService } from '../../services/complaintService'
import ComplaintMap from '../../components/map/ComplaintMap'
import ErrorAlert from '../../components/ui/ErrorAlert'
import { getErrorMessage, CATEGORY_LABELS } from '../../utils/helpers'

export default function PublicMap() {
  const [complaints, setComplaints] = useState([])
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState('')
  const [filters, setFilters]       = useState({ status: '', damageCategory: '' })

  const load = async () => {
    setLoading(true); setError('')
    try {
      const params = {}
      if (filters.status)         params.status         = filters.status
      if (filters.damageCategory) params.damageCategory = filters.damageCategory
      const res = await complaintService.getMapData(params)
      setComplaints(res.data.data.complaints)
    } catch (err) { setError(getErrorMessage(err)) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [filters])

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Road Damage Map</h1>
        <p className="text-sm text-gray-500 mt-1">
          Public view of reported road damage. Click a marker for details.
          Map data © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer" className="underline">OpenStreetMap</a> contributors.
        </p>
      </div>

      <div className="card flex flex-wrap gap-3 items-center">
        <select value={filters.status} onChange={(e) => setFilters(f => ({ ...f, status: e.target.value }))}
          className="input-field w-auto text-sm">
          <option value="">All Statuses</option>
          {['REPORTED','RECEIVED','IN_PROGRESS','RESOLVED','CLOSED'].map((s) => (
            <option key={s} value={s}>{s.replace('_',' ')}</option>
          ))}
        </select>
        <select value={filters.damageCategory} onChange={(e) => setFilters(f => ({ ...f, damageCategory: e.target.value }))}
          className="input-field w-auto text-sm">
          <option value="">All Categories</option>
          {Object.entries(CATEGORY_LABELS).map(([v,l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <span className="text-sm text-gray-500">{complaints.length} complaints shown</span>
      </div>

      {/* Colour legend */}
      <div className="card flex flex-wrap gap-4">
        {[
          { label:'Pothole', color:'#ef4444' }, { label:'Crack', color:'#f97316' },
          { label:'Edge Failure', color:'#eab308' }, { label:'Waterlogging', color:'#3b82f6' },
          { label:'Surface Damage', color:'#8b5cf6' }, { label:'Other', color:'#6b7280' },
        ].map(({ label, color }) => (
          <div key={label} className="flex items-center gap-2 text-sm">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
            <span className="text-gray-600">{label}</span>
          </div>
        ))}
      </div>

      <ErrorAlert message={error} />
      <ComplaintMap complaints={complaints} loading={loading} height={500} />
    </div>
  )
}
