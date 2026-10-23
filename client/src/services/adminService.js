import api from './api'

export const adminService = {
  getDashboard: () => api.get('/admin/dashboard'),

  getAnalytics: (params) => api.get('/admin/analytics', { params }),

  getComplaints: (params) => api.get('/admin/complaints', { params }),

  getComplaintDetail: (id) => api.get(`/admin/complaints/${id}`),

  updateStatus: (id, data) => api.patch(`/admin/complaints/${id}/status`, data),

  getMapData: (params) => api.get('/admin/map', { params }),

  getReports: (params) => api.get('/admin/reports', { params }),

  getExportUrl: (params) => {
    const query = new URLSearchParams(params).toString()
    const base = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'
    return `${base}/admin/reports/export?${query}`
  },

  getDuplicates: (params) => api.get('/admin/duplicates', { params }),
}
