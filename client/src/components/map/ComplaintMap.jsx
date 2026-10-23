import React, { useEffect, useState } from 'react'
import { MapContainer, TileLayer, Marker, Popup, CircleMarker } from 'react-leaflet'
import L from 'leaflet'
import { formatDate } from '../../utils/helpers'
import { CATEGORY_COLORS, STATUS_LABELS, CATEGORY_LABELS } from '../../utils/helpers'
import LoadingSpinner from '../ui/LoadingSpinner'

// Fix Leaflet icons
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

/**
 * ComplaintMap — displays complaints as coloured circle markers.
 * @prop {Array} complaints  - array of complaint objects
 * @prop {boolean} loading
 * @prop {number} height     - map height in px (default 500)
 * @prop {boolean} showImage - show thumbnail in popup
 */
export default function ComplaintMap({ complaints = [], loading = false, height = 500, showImage = false }) {
  const defaultCenter = [18.5204, 73.8567]

  // Compute map centre from complaints if available
  const centre = complaints.length > 0
    ? [complaints[0].location.coordinates[1], complaints[0].location.coordinates[0]]
    : defaultCenter

  if (loading) return <LoadingSpinner message="Loading map data…" />

  return (
    <div style={{ height: `${height}px` }} className="rounded-xl overflow-hidden border border-gray-200 shadow-sm">
      <MapContainer center={centre} zoom={12} style={{ height: '100%', width: '100%' }} scrollWheelZoom>
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />
        {complaints.map((c) => {
          const [lon, lat] = c.location.coordinates
          const color = CATEGORY_COLORS[c.damageCategory] || '#6b7280'
          return (
            <CircleMarker
              key={c._id || c.complaintId}
              center={[lat, lon]}
              radius={8}
              pathOptions={{ color, fillColor: color, fillOpacity: 0.8, weight: 2 }}
            >
              <Popup maxWidth={260}>
                <div className="text-sm space-y-1">
                  <p className="font-semibold text-gray-800">{c.complaintId}</p>
                  <p><span className="text-gray-500">Type:</span> {CATEGORY_LABELS[c.damageCategory] || c.damageCategory}</p>
                  <p><span className="text-gray-500">Status:</span> {STATUS_LABELS[c.status] || c.status}</p>
                  {c.address?.city && <p><span className="text-gray-500">City:</span> {c.address.city}</p>}
                  {c.address?.road && <p><span className="text-gray-500">Road:</span> {c.address.road}</p>}
                  <p><span className="text-gray-500">Reported:</span> {formatDate(c.createdAt)}</p>
                  {showImage && c.image?.url && (
                    <img
                      src={c.image.url}
                      alt="Damage"
                      className="w-full rounded mt-2 object-cover"
                      style={{ maxHeight: 120 }}
                    />
                  )}
                </div>
              </Popup>
            </CircleMarker>
          )
        })}
      </MapContainer>
    </div>
  )
}
