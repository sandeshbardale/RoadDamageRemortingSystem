import React, { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { Search, Download, ArrowRight, Filter } from 'lucide-react'
import { adminService } from '../../services/adminService'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import ErrorAlert from '../../components/ui/ErrorAlert'
import StatusBadge from '../../components/ui/StatusBadge'
import Pagination from '../../components/ui/Pagination'
import { formatDate, getErrorMessage, CATEGORY_LABELS, resolveImageUrl } from '../../utils/helpers'

const CATEGORY_EMOJI = { POTHOLE:'🕳️', CRACK:'🔓', WATERLOGGING:'💧', EDGE_FAILURE:'⚠️', SURFACE_DAMAGE:'🛤️', OTHER:'🚧' }

function ImageThumb({ url, category }) {
  const [err, setErr] = useState(false)
  const full = resolveImageUrl(url)
  if (!full || err) {
    return <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center text-base flex-shrink-0">{CATEGORY_EMOJI[category]||'🚧'}</div>
  }
  return <img src={full} alt="" className="w-10 h-10 rounded-xl object-cover flex-shrink-0 border border-gray-100" onError={() => setErr(true)} />
}

export default function AdminComplaints() {
  const [complaints, setComplaints] = useState([])
  const [pagination, setPagination] = useState({ page:1, pages:1, total:0 })
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [filters, setFilters]       = useState({ search:'', status:'', damageCategory:'', from:'', to:'', page:1, limit:10 })

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const params = { ...filters }
      Object.keys(params).forEach((k) => { if (!params[k]) delete params[k] })
      const res = await adminService.getComplaints(params)
      setComplaints(res.data.data.complaints)
      setPagination(res.data.data.pagination)
    } catch (e) { setError(getErrorMessage(e)) }
    finally { setLoading(false) }
  }, [filters])

  useEffect(() => { load() }, [load])
  const set = (e) => setFilters(f => ({ ...f, [e.target.name]: e.target.value, page:1 }))

  return (
    <div className="space-y-5">
      <div className="page-header">
        <div>
          <h1 className="page-title">Complaints</h1>
          <p className="page-subtitle">{pagination.total} total records</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowFilters(!showFilters)} className="btn-secondary text-sm">
            <Filter className="w-4 h-4" /> Filters
          </button>
          <a href={adminService.getExportUrl({ status:filters.status, damageCategory:filters.damageCategory, from:filters.from, to:filters.to })}
            target="_blank" rel="noreferrer" className="btn-secondary text-sm">
            <Download className="w-4 h-4" /> Export
          </a>
        </div>
      </div>

      {/* Search + filters */}
      <div className="card p-4 space-y-3">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-300" />
          <input name="search" value={filters.search} onChange={set}
            placeholder="Search by ID, city, road…"
            className="input-field pl-10 text-sm" />
        </div>
        {showFilters && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
            <select name="status" value={filters.status} onChange={set} className="input-field text-sm">
              <option value="">All Statuses</option>
              {['REPORTED','RECEIVED','IN_PROGRESS','RESOLVED','CLOSED'].map(s => <option key={s} value={s}>{s.replace('_',' ')}</option>)}
            </select>
            <select name="damageCategory" value={filters.damageCategory} onChange={set} className="input-field text-sm">
              <option value="">All Categories</option>
              {Object.entries(CATEGORY_LABELS).map(([v,l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            <input type="date" name="from" value={filters.from} onChange={set} className="input-field text-sm" />
            <input type="date" name="to"   value={filters.to}   onChange={set} className="input-field text-sm" />
          </div>
        )}
      </div>

      <ErrorAlert message={error} />

      {loading ? <LoadingSpinner message="Loading complaints…" /> : complaints.length === 0 ? (
        <div className="card text-center py-16 text-gray-300">
          <p className="text-4xl mb-3">📋</p>
          <p className="font-medium text-gray-400">No complaints match your filters.</p>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block card overflow-hidden p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  {['','ID','Citizen','Category','Location','Status','Date',''].map((h,i) => (
                    <th key={i} className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {complaints.map((c) => (
                  <tr key={c._id} className="hover:bg-gray-50/50 transition-colors group">
                    <td className="px-3 py-3 w-12"><ImageThumb url={c.image?.url} category={c.damageCategory} /></td>
                    <td className="px-4 py-3 font-mono text-xs text-primary-600 font-semibold whitespace-nowrap">{c.complaintId}</td>
                    <td className="px-4 py-3">
                      {/* Prominent citizen name with avatar */}
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0"
                          style={{ background:'linear-gradient(135deg,#6366f1,#4f46e5)' }}>
                          {c.citizenId?.name?.charAt(0).toUpperCase() || '?'}
                        </div>
                        <div>
                          <p className="font-bold text-gray-900 text-xs leading-tight">{c.citizenId?.name || '—'}</p>
                          <p className="text-gray-400 text-[10px]">{c.citizenId?.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-700 text-xs whitespace-nowrap">{CATEGORY_EMOJI[c.damageCategory]} {CATEGORY_LABELS[c.damageCategory]}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs max-w-[120px] truncate">{c.address?.city || '—'}</td>
                    <td className="px-4 py-3"><StatusBadge status={c.status} /></td>
                    <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">{formatDate(c.createdAt)}</td>
                    <td className="px-4 py-3">
                      <Link to={`/admin/complaints/${c._id}`}
                        className="flex items-center gap-1 text-xs text-primary-600 font-semibold opacity-0 group-hover:opacity-100 transition-opacity">
                        View <ArrowRight className="w-3 h-3" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {complaints.map((c) => (
              <Link to={`/admin/complaints/${c._id}`} key={c._id} className="card-sm flex items-center gap-3 hover:shadow-md transition-shadow">
                <ImageThumb url={c.image?.url} category={c.damageCategory} />
                <div className="flex-1 min-w-0">
                  <p className="font-mono text-xs text-primary-600 font-bold">{c.complaintId}</p>
                  <p className="text-sm text-gray-700 font-semibold">{CATEGORY_LABELS[c.damageCategory]}</p>
                  {/* Citizen name chip */}
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <div className="w-4 h-4 rounded-full flex items-center justify-center text-white text-[8px] font-bold"
                      style={{ background:'#6366f1' }}>
                      {c.citizenId?.name?.charAt(0) || '?'}
                    </div>
                    <p className="text-xs font-semibold text-gray-700">{c.citizenId?.name || '—'}</p>
                    <span className="text-gray-300 text-xs">·</span>
                    <p className="text-xs text-gray-400 truncate">{c.address?.city || 'CSN'}</p>
                  </div>
                </div>
                <StatusBadge status={c.status} />
              </Link>
            ))}
          </div>

          <Pagination page={pagination.page} pages={pagination.pages} onPage={(p) => setFilters(f => ({ ...f, page:p }))} />
        </>
      )}
    </div>
  )
}
