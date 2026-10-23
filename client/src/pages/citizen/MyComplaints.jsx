import React, { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle } from 'lucide-react'
import { complaintService } from '../../services/complaintService'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import ErrorAlert from '../../components/ui/ErrorAlert'
import StatusBadge from '../../components/ui/StatusBadge'
import Pagination from '../../components/ui/Pagination'
import { formatDate, getErrorMessage, CATEGORY_LABELS, resolveImageUrl } from '../../utils/helpers'

export default function MyComplaints() {
  const [complaints, setComplaints] = useState([])
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 })
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState('')
  const [filters, setFilters]       = useState({ status: '', damageCategory: '', page: 1 })

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const params = { ...filters, limit: 10 }
      Object.keys(params).forEach((k) => { if (!params[k]) delete params[k] })
      const res = await complaintService.getMy(params)
      setComplaints(res.data.data.complaints)
      setPagination(res.data.data.pagination)
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [filters])

  useEffect(() => { load() }, [load])

  const handleFilter = (e) => setFilters({ ...filters, [e.target.name]: e.target.value, page: 1 })

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold text-gray-900">My Complaints</h1>
        <Link to="/report" className="btn-primary text-sm">+ New Report</Link>
      </div>

      {/* Filters */}
      <div className="card mb-6 flex flex-wrap gap-3">
        <select name="status" value={filters.status} onChange={handleFilter} className="input-field w-auto text-sm">
          <option value="">All Statuses</option>
          {['REPORTED','RECEIVED','IN_PROGRESS','RESOLVED','CLOSED'].map((s) => (
            <option key={s} value={s}>{s.replace('_', ' ')}</option>
          ))}
        </select>
        <select name="damageCategory" value={filters.damageCategory} onChange={handleFilter} className="input-field w-auto text-sm">
          <option value="">All Categories</option>
          {Object.entries(CATEGORY_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </div>

      <ErrorAlert message={error} />

      {loading ? <LoadingSpinner message="Loading complaints…" /> : (
        <>
          {complaints.length === 0 ? (
            <div className="text-center py-16 card">
              <AlertTriangle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No complaints found.</p>
              <Link to="/report" className="text-primary-600 text-sm hover:underline mt-2 inline-block">Report road damage</Link>
            </div>
          ) : (
            <>
              {/* Table on md+, cards on mobile */}
              <div className="hidden md:block card overflow-hidden p-0">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      {['Complaint ID','Category','Location','Status','Date','Action'].map((h) => (
                        <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {complaints.map((c) => (
                      <tr key={c._id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 font-mono text-xs text-primary-700">{c.complaintId}</td>
                        <td className="px-4 py-3">{CATEGORY_LABELS[c.damageCategory]}</td>
                        <td className="px-4 py-3 text-gray-500 max-w-xs truncate">{c.address?.city || '—'}</td>
                        <td className="px-4 py-3"><StatusBadge status={c.status} /></td>
                        <td className="px-4 py-3 text-gray-500">{formatDate(c.createdAt)}</td>
                        <td className="px-4 py-3">
                          <Link to={`/complaints/${c._id}`} className="text-primary-600 hover:underline text-xs font-medium">View</Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="md:hidden space-y-3">
                {complaints.map((c) => (
                  <Link to={`/complaints/${c._id}`} key={c._id} className="card block hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between gap-3">
                      {c.image?.url ? (
                        <img src={resolveImageUrl(c.image.url)} alt=""
                          className="w-14 h-14 rounded-xl object-cover flex-shrink-0 border border-gray-100"
                          onError={(e) => { e.target.style.display='none' }} />
                      ) : null}
                      <div className="flex-1 min-w-0">
                        <p className="font-mono text-xs text-primary-700 font-semibold">{c.complaintId}</p>
                        <p className="text-sm text-gray-700 mt-0.5">{CATEGORY_LABELS[c.damageCategory]}</p>
                        <p className="text-xs text-gray-500 truncate">{c.address?.city || '—'}</p>
                        <p className="text-xs text-gray-400 mt-1">{formatDate(c.createdAt)}</p>
                      </div>
                      <StatusBadge status={c.status} />
                    </div>
                  </Link>
                ))}
              </div>

              <Pagination
                page={pagination.page}
                pages={pagination.pages}
                onPage={(p) => setFilters({ ...filters, page: p })}
              />
              <p className="text-xs text-gray-400 text-center mt-2">{pagination.total} total complaints</p>
            </>
          )}
        </>
      )}
    </div>
  )
}
