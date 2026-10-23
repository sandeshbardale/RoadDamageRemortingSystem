import React, { useEffect, useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LineChart, Line, CartesianGrid
} from 'recharts'
import { adminService } from '../../services/adminService'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import ErrorAlert from '../../components/ui/ErrorAlert'
import { formatMonth, getErrorMessage, CATEGORY_LABELS, CATEGORY_COLORS } from '../../utils/helpers'

const STATUS_COLORS = {
  REPORTED: '#3b82f6', RECEIVED: '#eab308', IN_PROGRESS: '#f97316', RESOLVED: '#22c55e', CLOSED: '#6b7280'
}

export default function AdminAnalytics() {
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')
  const [filters, setFilters] = useState({ from: '', to: '' })

  const load = async () => {
    setLoading(true); setError('')
    try {
      const params = {}
      if (filters.from) params.from = filters.from
      if (filters.to)   params.to   = filters.to
      const res = await adminService.getAnalytics(params)
      setData(res.data.data)
    } catch (err) { setError(getErrorMessage(err)) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [filters])

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
          <p className="text-sm text-gray-500 mt-1">MongoDB aggregation pipeline results.</p>
        </div>
        <div className="flex gap-3 items-center">
          <input type="date" value={filters.from} onChange={(e) => setFilters(f => ({ ...f, from: e.target.value }))}
            className="input-field text-sm w-auto" />
          <span className="text-gray-400 text-sm">to</span>
          <input type="date" value={filters.to} onChange={(e) => setFilters(f => ({ ...f, to: e.target.value }))}
            className="input-field text-sm w-auto" />
        </div>
      </div>

      <ErrorAlert message={error} />
      {loading ? <LoadingSpinner message="Running aggregations…" /> : data && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: 'Total Complaints', value: data.totalComplaints },
              { label: 'Resolution Rate', value: `${data.resolutionRate}%` },
              { label: 'Duplicates', value: data.duplicateCount },
              { label: 'Period', value: filters.from ? `${filters.from} → ${filters.to || 'now'}` : 'All time' },
            ].map(({ label, value }) => (
              <div key={label} className="card text-center">
                <p className="text-2xl font-bold text-primary-700">{value}</p>
                <p className="text-xs text-gray-500 mt-1">{label}</p>
              </div>
            ))}
          </div>

          <div className="grid lg:grid-cols-2 gap-6">
            {/* Monthly line chart */}
            <div className="card">
              <h2 className="font-semibold text-gray-800 mb-4">Monthly Trend</h2>
              {data.monthlyData?.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={data.monthlyData.map((m) => ({ month: formatMonth(m.month), count: m.count }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                    <Tooltip />
                    <Line type="monotone" dataKey="count" stroke="#3b82f6" strokeWidth={2} dot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              ) : <p className="text-gray-400 text-sm text-center py-10">No data for this period.</p>}
            </div>

            {/* Status doughnut */}
            <div className="card">
              <h2 className="font-semibold text-gray-800 mb-4">Status Distribution</h2>
              {data.statusDistribution?.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={data.statusDistribution.map((s) => ({ name: s.status.replace('_',' '), value: s.count }))}
                      cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value"
                    >
                      {data.statusDistribution.map((s, i) => (
                        <Cell key={i} fill={STATUS_COLORS[s.status] || '#6b7280'} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              ) : <p className="text-gray-400 text-sm text-center py-10">No data.</p>}
            </div>

            {/* Category bar */}
            <div className="card">
              <h2 className="font-semibold text-gray-800 mb-4">Damage Categories</h2>
              {data.categoryDistribution?.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={data.categoryDistribution.map((c) => ({ name: CATEGORY_LABELS[c.category] || c.category, count: c.count }))}>
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="count" radius={[4,4,0,0]}>
                      {data.categoryDistribution.map((c, i) => (
                        <Cell key={i} fill={CATEGORY_COLORS[c.category] || '#6b7280'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : <p className="text-gray-400 text-sm text-center py-10">No data.</p>}
            </div>

            {/* Municipal distribution */}
            <div className="card">
              <h2 className="font-semibold text-gray-800 mb-4">By Municipal Corporation</h2>
              {data.municipalDistribution?.length > 0 ? (
                <div className="space-y-3">
                  {data.municipalDistribution.slice(0,8).map((m, i) => {
                    const pct = data.totalComplaints > 0 ? Math.round((m.count / data.totalComplaints) * 100) : 0
                    return (
                      <div key={i} className="flex items-center gap-3">
                        <p className="text-sm text-gray-700 w-40 flex-shrink-0 truncate">{m.name}</p>
                        <div className="flex-1 bg-gray-100 rounded-full h-2">
                          <div className="bg-primary-500 h-2 rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                        <p className="text-xs text-gray-500 w-10 text-right">{m.count}</p>
                      </div>
                    )
                  })}
                </div>
              ) : <p className="text-gray-400 text-sm text-center py-10">No data.</p>}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
