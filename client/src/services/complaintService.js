import api from './api'

export const complaintService = {
  // Submit a new complaint (multipart/form-data)
  create: (formData) =>
    api.post('/complaints', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),

  // Check for duplicate before submitting
  checkDuplicate: (data) => api.post('/complaints/check-duplicate', data),

  // Get citizen's own complaints
  getMy: (params) => api.get('/complaints/my', { params }),

  // Get single complaint by MongoDB _id
  getById: (id) => api.get(`/complaints/${id}`),

  // Get status history for a complaint
  getStatusHistory: (id) => api.get(`/complaints/${id}/status-history`),

  // Get nearby complaints (public)
  getNearby: (params) => api.get('/complaints/nearby', { params }),

  // Get map data (public)
  getMapData: (params) => api.get('/complaints/map', { params }),
}
