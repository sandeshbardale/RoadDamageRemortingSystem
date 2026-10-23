import React, { useState, useEffect, useRef, useCallback } from 'react'
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet'
import L from 'leaflet'
import { MapPin, Navigation, Loader, AlertCircle, PenLine, CheckCircle2 } from 'lucide-react'
import { getCurrentPosition, reverseGeocode } from '../../services/mapService'

// Fix Leaflet default icon for Vite
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

function MapClickHandler({ onLocationSelect }) {
  useMapEvents({ click(e) { onLocationSelect(e.latlng.lat, e.latlng.lng) } })
  return null
}

function MapCentrer({ lat, lng }) {
  const map = useMap()
  useEffect(() => { if (lat && lng) map.setView([lat, lng], map.getZoom()) }, [lat, lng])
  return null
}

// ─── Manual address form shown when GPS is denied ─────────────────────────────
function ManualAddressForm({ onSubmit }) {
  const [form, setForm] = useState({
    houseNo: '', street: '', area: '', city: '', state: '', postcode: ''
  })
  const set = (e) => setForm(f => ({ ...f, [e.target.name]: e.target.value }))

  const handleSubmit = (e) => {
    e.preventDefault()
    const { houseNo, street, area, city, state, postcode } = form
    if (!city.trim()) return
    const formatted = [houseNo, street, area, city, state, postcode].filter(Boolean).join(', ')
    onSubmit({
      formatted,
      road: street,
      area,
      city,
      state,
      postcode,
      isManual: true,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 bg-amber-50 border border-amber-200 rounded-xl p-4">
      <p className="text-sm font-semibold text-amber-800 flex items-center gap-2">
        <PenLine className="w-4 h-4" /> Enter Address Manually
      </p>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs text-gray-600 block mb-1">House / Flat No.</label>
          <input name="houseNo" value={form.houseNo} onChange={set} className="input-field text-sm" placeholder="e.g. 42B" />
        </div>
        <div>
          <label className="text-xs text-gray-600 block mb-1">Street / Road *</label>
          <input name="street" value={form.street} onChange={set} className="input-field text-sm" placeholder="e.g. MG Road" required />
        </div>
        <div>
          <label className="text-xs text-gray-600 block mb-1">Area / Locality</label>
          <input name="area" value={form.area} onChange={set} className="input-field text-sm" placeholder="e.g. Shivajinagar" />
        </div>
        <div>
          <label className="text-xs text-gray-600 block mb-1">City *</label>
          <input name="city" value={form.city} onChange={set} className="input-field text-sm" placeholder="e.g. Pune" required />
        </div>
        <div>
          <label className="text-xs text-gray-600 block mb-1">State</label>
          <input name="state" value={form.state} onChange={set} className="input-field text-sm" placeholder="e.g. Maharashtra" />
        </div>
        <div>
          <label className="text-xs text-gray-600 block mb-1">Pincode</label>
          <input name="postcode" value={form.postcode} onChange={set} className="input-field text-sm" placeholder="e.g. 411001" />
        </div>
      </div>
      <p className="text-xs text-amber-700">
        💡 You can also click on the map below to pin the exact damage location.
      </p>
      <button type="submit" className="btn-primary w-full text-sm">
        Confirm Address
      </button>
    </form>
  )
}

// ─── Main LocationPicker ──────────────────────────────────────────────────────
export default function LocationPicker({ value, onChange }) {
  const DEFAULT_LAT = 18.5204
  const DEFAULT_LNG = 73.8567

  const [lat, setLat]               = useState(value?.latitude  || DEFAULT_LAT)
  const [lng, setLng]               = useState(value?.longitude || DEFAULT_LNG)
  const [address, setAddress]       = useState(value?.address || null)
  const [gpsState, setGpsState]     = useState('idle') // idle | requesting | success | denied | unavailable
  const [gpsError, setGpsError]     = useState('')
  const [showManual, setShowManual] = useState(false)
  const [manualDone, setManualDone] = useState(false)
  const markerRef = useRef(null)

  // ── Auto-request GPS on first mount ────────────────────────────────────────
  useEffect(() => {
    requestGps()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const updateLocation = useCallback(async (newLat, newLng, existingAddr = null) => {
    setLat(newLat)
    setLng(newLng)
    const addr = existingAddr || await reverseGeocode(newLat, newLng)
    setAddress(addr)
    onChange({ latitude: newLat, longitude: newLng, address: addr })
  }, [onChange])

  const requestGps = async () => {
    setGpsState('requesting')
    setGpsError('')
    setShowManual(false)
    try {
      const pos = await getCurrentPosition()
      await updateLocation(pos.latitude, pos.longitude)
      setGpsState('success')
    } catch (err) {
      const msg = err.message || ''
      if (msg.includes('denied') || msg.includes('permission')) {
        setGpsState('denied')
        setShowManual(true)       // auto-show manual form when denied
      } else if (msg.includes('unavailable')) {
        setGpsState('unavailable')
        setShowManual(true)
      } else {
        setGpsState('denied')
        setShowManual(true)
      }
      setGpsError(err.message)
    }
  }

  const handleMapClick = useCallback((clickLat, clickLng) => {
    updateLocation(clickLat, clickLng)
    setManualDone(false)
  }, [updateLocation])

  const handleMarkerDrag = useCallback(async (e) => {
    const { lat: dLat, lng: dLng } = e.target.getLatLng()
    await updateLocation(dLat, dLng)
  }, [updateLocation])

  const handleManualAddress = (addr) => {
    // For manual address, keep map at default but store the address text
    setAddress(addr)
    setManualDone(true)
    setShowManual(false)
    // Notify parent — lat/lng stay at last known or default
    onChange({ latitude: lat, longitude: lng, address: addr })
  }

  return (
    <div className="space-y-3">

      {/* ── GPS status banner ─────────────────────────────────────────────── */}
      {gpsState === 'requesting' && (
        <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-xl p-3 text-blue-800 text-sm">
          <Loader className="w-4 h-4 animate-spin flex-shrink-0" />
          <span>Requesting your location — please allow access when your browser asks…</span>
        </div>
      )}

      {gpsState === 'success' && (
        <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl p-3 text-green-800 text-sm">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          <span>Current location captured. You can drag the marker to fine-tune.</span>
        </div>
      )}

      {(gpsState === 'denied' || gpsState === 'unavailable') && !manualDone && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-800 space-y-2">
          <p className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{gpsError}</span>
          </p>
          <p className="text-xs text-red-700 pl-6">
            Please enter your address manually below, or click on the map to pin the location.
          </p>
        </div>
      )}

      {manualDone && (
        <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl p-3 text-green-800 text-sm">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          <span>Address saved manually. You can also click the map to add a pin.</span>
          <button onClick={() => { setManualDone(false); setShowManual(true) }}
            className="ml-auto text-xs underline text-green-700">Edit</button>
        </div>
      )}

      {/* ── GPS / retry buttons ───────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={requestGps}
          disabled={gpsState === 'requesting'}
          className="flex items-center gap-2 btn-secondary text-sm"
        >
          {gpsState === 'requesting'
            ? <Loader className="w-4 h-4 animate-spin" />
            : <Navigation className="w-4 h-4 text-primary-600" />}
          {gpsState === 'requesting' ? 'Detecting…' : gpsState === 'success' ? 'Refresh Location' : 'Use My Current Location'}
        </button>

        {(gpsState === 'denied' || gpsState === 'unavailable') && !showManual && !manualDone && (
          <button
            type="button"
            onClick={() => setShowManual(true)}
            className="flex items-center gap-2 btn-secondary text-sm border-amber-300 text-amber-700 hover:bg-amber-50"
          >
            <PenLine className="w-4 h-4" /> Enter Address Manually
          </button>
        )}
      </div>

      {/* ── Manual address form ───────────────────────────────────────────── */}
      {showManual && <ManualAddressForm onSubmit={handleManualAddress} />}

      {/* ── Leaflet Map ───────────────────────────────────────────────────── */}
      <div className="rounded-xl overflow-hidden border border-gray-200 shadow-sm" style={{ height: '300px' }}>
        <MapContainer center={[lat, lng]} zoom={14} style={{ height: '100%', width: '100%' }} scrollWheelZoom>
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          />
          <MapClickHandler onLocationSelect={handleMapClick} />
          <MapCentrer lat={lat} lng={lng} />
          <Marker
            position={[lat, lng]}
            draggable
            ref={markerRef}
            eventHandlers={{ dragend: handleMarkerDrag }}
          />
        </MapContainer>
      </div>

      <p className="text-xs text-gray-500 flex items-center gap-1">
        <MapPin className="w-3 h-3" />
        Click the map or drag the pin to set the exact damage location.
      </p>

      {/* ── Coordinates ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-gray-500 block mb-1">Latitude</label>
          <input readOnly value={lat.toFixed(6)} className="input-field bg-gray-50 text-sm cursor-not-allowed" />
        </div>
        <div>
          <label className="text-xs text-gray-500 block mb-1">Longitude</label>
          <input readOnly value={lng.toFixed(6)} className="input-field bg-gray-50 text-sm cursor-not-allowed" />
        </div>
      </div>

      {/* ── Address display ───────────────────────────────────────────────── */}
      {address && (
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-sm">
          <p className="font-medium text-blue-800 mb-1 flex items-center gap-1">
            <MapPin className="w-3 h-3" />
            {address.isManual ? 'Manually Entered Address' : 'Detected Address'}
          </p>
          <p className="text-xs text-blue-700 leading-relaxed">{address.formatted}</p>
          {address.city && <p className="text-xs text-blue-600 mt-0.5">{[address.area, address.city, address.state, address.postcode].filter(Boolean).join(', ')}</p>}
        </div>
      )}
    </div>
  )
}
