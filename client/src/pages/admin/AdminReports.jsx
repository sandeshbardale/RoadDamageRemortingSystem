import React, { useEffect, useState } from 'react'
import { Download } from 'lucide-react'
import { adminService } from '../../services/adminService'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import ErrorAlert from '../../components/ui/ErrorAlert'
import StatusBadge from '../../components/ui/StatusBadge'
import { formatDate, getErrorMessage, CATEGORY_LABELS } from '../../utils/helpers'

export default function AdminReports() {
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')
  const [filters, setFilters] = useState({ status: '', damageCategory: '', from: '', to: '' })

  const load = async () => {
    setLoading(true); setError('')
    try {
      const params = {}
      if (filters.status)         params.status         = filters.status
      if (filters.damageCategory) params.damageCategory = filters.damageCategory
      if (filters.from)           params.from           = filters.from
      if (filters.to)             params.to             = filters.to
      const res = await adminService.getReports(params)
      setData(res.data.data)
    } catch (err) { setError(getErrorMessage(err)) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const set = (e) => setFilters((f) => ({ ...f, [e.target.name]: e.target.value }))

  const exportUrl = adminService.getExportUrl({
    status: filters.status, damageCategory: filters.damageCategory,
    from: filters.from, to: filters.to,
  })

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
          <p className="text-sm text-gray-500 mt-1">Generate and export complaint reports from MongoDB.</p>
        </div>
        <a href={exportUrl} target="_blank" rel="noreferrer"
          className="btn-primary flex items-center gap-2 text-sm">
          <Download className="w-4 h-4" /> Export CSV
        </a>
      </div>

      {/* Filters */}
      <div className="card flex flex-wrap gap-3 items-end">
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
        <button onClick={load} className="btn-primary text-sm">Generate Report</button>
      </div>

      <ErrorAlert message={error} />
      {loading ? <LoadingSpinner message="Generating report…" /> : data && (
        <>
          {/* Summary */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="card text-center">
              <p className="text-2xl font-bold text-primary-700">{data.summary.total}</p>
              <p className="text-xs text-gray-500 mt-1">Total Complaints</p>
            </div>
            {data.statusStats.slice(0,3).map((s) => (
              <div key={s.status} className="card text-center">
                <p className="text-2xl font-bold text-gray-800">{s.count}</p>
                <p className="text-xs text-gray-500 mt-1">{s.status.replace('_',' ')}</p>
              </div>
            ))}
          </div>

          {/* Category breakdown */}
          <div className="card">
            <h2 className="font-semibold text-gray-800 mb-4">Category Breakdown</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {data.categoryStats.map((c) => (
                <div key={c.category} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <span className="text-sm text-gray-700">{CATEGORY_LABELS[c.category]}</span>
                  <span className="font-bold text-gray-900">{c.count}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Complaints table */}
          {data.complaints?.length > 0 && (
            <div className="card overflow-hidden p-0">
              <div className="px-6 py-4 border-b border-gray-100">
                <h2 className="font-semibold text-gray-800">Complaint Records ({data.complaints.length})</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      {['ID','Citizen','Category','City','Status','Date'].map((h) => (
                        <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {data.complaints.slice(0, 100).map((c) => (
                      <tr key={c._id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-mono text-xs text-primary-700">{c.complaintId}</td>
                        <td className="px-4 py-3 text-gray-700">{c.citizenId?.name}</td>
                        <td className="px-4 py-3">{CATEGORY_LABELS[c.damageCategory]}</td>
                        <td className="px-4 py-3 text-gray-500">{c.address?.city || '—'}</td>
                        <td className="px-4 py-3"><StatusBadge status={c.status} /></td>
                        <td className="px-4 py-3 text-gray-500">{formatDate(c.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {data.complaints.length > 100 && (
                  <p className="text-xs text-gray-400 text-center py-3">Showing first 100 rows. Use CSV export for full data.</p>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
