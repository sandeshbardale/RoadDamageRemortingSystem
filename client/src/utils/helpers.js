export const STATUS_LABELS = {
  REPORTED:    'Reported',
  RECEIVED:    'Received',
  IN_PROGRESS: 'In Progress',
  RESOLVED:    'Resolved',
  CLOSED:      'Closed',
}

export const CATEGORY_LABELS = {
  POTHOLE:       'Pothole',
  CRACK:         'Crack',
  EDGE_FAILURE:  'Edge Failure',
  WATERLOGGING:  'Waterlogging',
  SURFACE_DAMAGE:'Surface Damage',
  OTHER:         'Other',
}

export const STATUS_COLORS = {
  REPORTED:    'badge-reported',
  RECEIVED:    'badge-received',
  IN_PROGRESS: 'badge-in_progress',
  RESOLVED:    'badge-resolved',
  CLOSED:      'badge-closed',
}

export const CATEGORY_COLORS = {
  POTHOLE:        '#ef4444',
  CRACK:          '#f97316',
  EDGE_FAILURE:   '#eab308',
  WATERLOGGING:   '#3b82f6',
  SURFACE_DAMAGE: '#8b5cf6',
  OTHER:          '#6b7280',
}

export const formatDate = (dateStr) => {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
}

export const formatDateTime = (dateStr) => {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export const formatMonth = (ym) => {
  if (!ym) return ''
  const [year, month] = ym.split('-')
  return new Date(year, month - 1).toLocaleString('en-IN', { month: 'short', year: 'numeric' })
}

export const getErrorMessage = (err) => {
  return err?.response?.data?.message || err?.message || 'An unexpected error occurred.'
}

/**
 * Resolve an image URL to something the browser can load.
 * - /uploads/... → served via Vite proxy → http://localhost:5000/uploads/...
 * - http://... → already absolute, use as-is
 * - empty/null → null
 */
export const resolveImageUrl = (url) => {
  if (!url) return null
  // Already absolute (Cloudinary or external)
  if (url.startsWith('http://') || url.startsWith('https://')) return url
  // Local uploads path — use as relative URL so Vite proxy handles it
  if (url.startsWith('/uploads/')) return url
  return url
}
