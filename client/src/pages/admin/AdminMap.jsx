import React, { useEffect, useState, useCallback } from 'react'
import { adminService } from '../../services/adminService'
import ComplaintMap from '../../components/map/ComplaintMap'
import ErrorAlert from '../../components/ui/ErrorAlert'
import { getErrorMessage, CATEGORY_LABELS } from '../../utils/helpers'

export default function AdminMap() {
  const [complaints, setComplaints] = useState([])
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState('')
  const [filters, setFilters]       = useState({ status: '', damageCategory: '', from: '', to: '' })

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const params = {}
      if (filters.status)         params.status         = filters.status
      if (filters.damageCategory) params.damageCategory = filters.damageCategory
      if (filters.from)           params.from           = filters.from
      if (filters.to)             params.to             = filters.to
      const res = await adminService.getMapData(params)
      setComplaints(res.data.data.complaints)
    } catch (err) { setError(getErrorMessage(err)) }
    finally { setLoading(false) }
  }, [filters])

  useEffect(() => { load() }, [load])

  const set = (e) => setFilters((f) => ({ ...f, [e.target.name]: e.target.value }))

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">GIS Map</h1>
        <p className="text-sm text-gray-500 mt-1">
          All complaint locations from MongoDB with real GPS coordinates. Map tiles by{' '}
          <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer" className="underline">OpenStreetMap</a>.
        </p>
      </div>

      {/* Filters */}
      <div className="card flex flex-wrap gap-3">
        <select name="status" value={filters.status} onChange={set} className="input-field w-auto text-sm">
          <option value="">All Statuses</option>
          {['REPORTED','RECEIVED','IN_PROGRESS','RESOLVED','CLOSED'].map((s) => (
            <option key={s} value={s}>{s.replace('_',' ')}</option>
          ))}
        </select>
        <select name="damageCategory" value={filters.damageCategory} onChange={set} className="input-field w-auto text-sm">
          <option value="">All Categories</option>
          {Object.entries(CATEGORY_LABELS).map(([v,l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <input type="date" name="from" value={filters.from} onChange={set} className="input-field w-auto text-sm" />
        <input type="date" name="to"   value={filters.to}   onChange={set} className="input-field w-auto text-sm" />
        <span className="text-sm text-gray-500 self-center">{complaints.length} complaints shown</span>
      </div>

      <ErrorAlert message={error} />

      {/* Legend */}
      <div className="card flex flex-wrap gap-4">
        {[
          { label:'Pothole', color:'#ef4444' },
          { label:'Crack', color:'#f97316' },
          { label:'Edge Failure', color:'#eab308' },
          { label:'Waterlogging', color:'#3b82f6' },
          { label:'Surface Damage', color:'#8b5cf6' },
          { label:'Other', color:'#6b7280' },
        ].map(({ label, color }) => (
          <div key={label} className="flex items-center gap-2 text-sm">
            <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
            <span className="text-gray-600">{label}</span>
          </div>
        ))}
      </div>

      <ComplaintMap complaints={complaints} loading={loading} height={520} showImage />
    </div>
  )
}
