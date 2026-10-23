import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, PieChart, Pie, Cell,
  ResponsiveContainer, Legend, CartesianGrid
} from 'recharts'
import {
  FileText, CheckCircle, Clock, AlertTriangle, Copy,
  TrendingUp, Users, ArrowRight, MapPin
} from 'lucide-react'
import { adminService } from '../../services/adminService'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import ErrorAlert from '../../components/ui/ErrorAlert'
import StatusBadge from '../../components/ui/StatusBadge'
import { formatDate, formatMonth, getErrorMessage, CATEGORY_LABELS, CATEGORY_COLORS } from '../../utils/helpers'

const STATUS_PIE_COLORS = ['#6366f1','#f59e0b','#f97316','#22c55e','#64748b']

const StatCard = ({ label, value, icon: Icon, iconBg, iconColor, trend }) => (
  <div className="stat-card">
    <div className={`stat-icon ${iconBg}`}>
      <Icon className={`w-5 h-5 ${iconColor}`} />
    </div>
    <div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <p className="text-xs text-gray-500 mt-0.5">{label}</p>
    </div>
  </div>
)

export default function AdminDashboard() {
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')

  useEffect(() => {
    adminService.getDashboard()
      .then((r) => setData(r.data.data))
      .catch((e) => setError(getErrorMessage(e)))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <LoadingSpinner message="Loading dashboard…" />

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">Live overview from MongoDB aggregations</p>
        </div>
        <Link to="/admin/complaints" className="btn-primary text-sm">
          View All Complaints <ArrowRight className="w-4 h-4" />
        </Link>
      </div>

      <ErrorAlert message={error} />

      {data && (
        <>
          {/* KPI row */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            <StatCard label="Total"       value={data.totalComplaints} icon={FileText}      iconBg="bg-slate-100"   iconColor="text-slate-600" />
            <StatCard label="Reported"    value={data.reported}        icon={AlertTriangle}  iconBg="bg-blue-50"     iconColor="text-blue-600"  />
            <StatCard label="Received"    value={data.received}        icon={Clock}          iconBg="bg-amber-50"    iconColor="text-amber-600" />
            <StatCard label="In Progress" value={data.inProgress}      icon={TrendingUp}     iconBg="bg-orange-50"   iconColor="text-orange-600"/>
            <StatCard label="Resolved"    value={data.resolved}        icon={CheckCircle}    iconBg="bg-green-50"    iconColor="text-green-600" />
            <StatCard label="Duplicates"  value={data.duplicates}      icon={Copy}           iconBg="bg-purple-50"   iconColor="text-purple-600"/>
          </div>

          {/* Charts */}
          <div className="grid lg:grid-cols-2 gap-6">
            {/* Monthly bar chart */}
            <div className="card">
              <h2 className="font-semibold text-gray-800 mb-1">Monthly Complaints</h2>
              <p className="text-xs text-gray-400 mb-5">Last 12 months</p>
              {data.monthlyStats?.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={data.monthlyStats.map((m) => ({ month: formatMonth(m.month), count: m.count }))} barSize={24}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="month" tick={{ fontSize: 11, fill:'#94a3b8' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill:'#94a3b8' }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip contentStyle={{ borderRadius:12, border:'none', boxShadow:'0 4px 24px rgba(0,0,0,0.08)', fontSize:12 }} />
                    <Bar dataKey="count" fill="#6366f1" radius={[6,6,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : <p className="text-gray-300 text-sm text-center py-12">No data yet.</p>}
            </div>

            {/* Category pie */}
            <div className="card">
              <h2 className="font-semibold text-gray-800 mb-1">Damage Categories</h2>
              <p className="text-xs text-gray-400 mb-5">Distribution by type</p>
              {data.categoryStats?.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={data.categoryStats.map((c) => ({ name: CATEGORY_LABELS[c.category] || c.category, value: c.count }))}
                      cx="50%" cy="50%" outerRadius={80} innerRadius={40} dataKey="value" paddingAngle={3}>
                      {data.categoryStats.map((c, i) => (
                        <Cell key={i} fill={CATEGORY_COLORS[c.category] || '#6b7280'} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius:12, border:'none', boxShadow:'0 4px 24px rgba(0,0,0,0.08)', fontSize:12 }} />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize:11 }} />
                  </PieChart>
                </ResponsiveContainer>
              ) : <p className="text-gray-300 text-sm text-center py-12">No data yet.</p>}
            </div>
          </div>

          {/* Recent complaints */}
          <div className="card">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="font-semibold text-gray-800">Recent Complaints</h2>
                <p className="text-xs text-gray-400 mt-0.5">Latest 5 submissions</p>
              </div>
              <Link to="/admin/complaints" className="text-xs text-primary-600 font-semibold hover:underline flex items-center gap-1">
                See all <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
            {data.recentComplaints?.length === 0 ? (
              <p className="text-gray-300 text-sm text-center py-8">No complaints yet.</p>
            ) : (
              <div className="divide-y divide-gray-50">
                {data.recentComplaints.map((c) => (
                  <Link to={`/admin/complaints/${c._id}`} key={c._id}
                    className="flex items-center gap-4 py-3 hover:bg-gray-50 rounded-xl px-2 -mx-2 transition-colors group">
                    <div className="w-9 h-9 bg-primary-50 rounded-xl flex items-center justify-center flex-shrink-0">
                      <MapPin className="w-4 h-4 text-primary-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800 font-mono">{c.complaintId}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{CATEGORY_LABELS[c.damageCategory]} · {c.address?.city || '—'}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <StatusBadge status={c.status} />
                      <p className="text-xs text-gray-300 hidden sm:block">{formatDate(c.createdAt)}</p>
                      <ArrowRight className="w-4 h-4 text-gray-200 group-hover:text-gray-400 transition-colors" />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
