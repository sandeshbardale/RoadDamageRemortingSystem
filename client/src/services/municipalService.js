import api from './api'

export const municipalService = {
  getAll: () => api.get('/municipal'),
  getById: (id) => api.get(`/municipal/${id}`),
}
