import React, { useState, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Camera, Upload, X, AlertTriangle, CheckCircle,
  Brain, Loader, Sparkles, ShieldAlert, Wrench
} from 'lucide-react'
import { complaintService } from '../../services/complaintService'
import LocationPicker from '../../components/map/LocationPicker'
import CameraCapture from '../../components/ui/CameraCapture'
import ErrorAlert from '../../components/ui/ErrorAlert'
import { getErrorMessage, CATEGORY_LABELS, resolveImageUrl } from '../../utils/helpers'
import { getCurrentPosition, reverseGeocode } from '../../services/mapService'

const CATEGORIES = Object.entries(CATEGORY_LABELS)
const MAX_SIZE   = 5 * 1024 * 1024

// Severity colour
const SEV_COLOR = { Critical:'#ef4444', High:'#f97316', Medium:'#f59e0b', Low:'#22c55e' }

export default function ReportComplaint() {
  const navigate  = useNavigate()
  const uploadRef = useRef(null)

  const [step, setStep]           = useState(1)
  const [showCamera, setShowCamera] = useState(false)
  const [form, setForm]           = useState({
    damageCategory:'', customDamageType:'', description:'',
    image:null, imagePreview:null, imageSource:null,
  })
  const [aiResult, setAiResult]       = useState(null)   // Gemini detection result
  const [aiLoading, setAiLoading]     = useState(false)  // analysing indicator
  const [location, setLocation]       = useState(null)
  const [duplicate, setDuplicate]     = useState(null)
  const [loading, setLoading]         = useState(false)
  const [checkingDup, setCheckingDup] = useState(false)
  const [error, setError]             = useState('')
  const [submitted, setSubmitted]     = useState(null)
  const [captureLoading, setCaptureLoading] = useState(false)

  // ── Send image to backend for AI detection ────────────────────────────────
  const runAiDetection = useCallback(async (file) => {
    setAiLoading(true)
    setAiResult(null)
    try {
      const fd = new FormData()
      fd.append('image', file)
      fd.append('damageCategory', 'OTHER')  // let AI decide
      fd.append('latitude', '19.8762')
      fd.append('longitude', '75.3433')
      fd.append('description', 'AI pre-analysis only')
      // We use a dedicated preview endpoint — or just submit and parse the AI result
      // Since we don't have a separate endpoint, we'll call /api/complaints/analyze
      // Instead, we'll parse the response from a lightweight endpoint
      // For now, we embed a simple client-side simulation by calling the real endpoint
      // after the user submits — this is handled in handleSubmit
      // Here we show a "will be analysed on submit" UI
      setAiResult({ pending:true })
    } catch {}
    finally { setAiLoading(false) }
  }, [])

  // ── Handle file from gallery/upload ──────────────────────────────────────
  const processFile = useCallback(async (file, source) => {
    if (!file) return
    if (!file.type.match(/^image\/(jpeg|jpg|png|webp)$/i)) {
      setError('Only JPG, PNG, and WEBP images are allowed.'); return
    }
    if (file.size > MAX_SIZE) {
      setError('Image must be under 5 MB.'); return
    }
    setError('')
    setForm(f => ({ ...f, image:file, imagePreview:URL.createObjectURL(file), imageSource:source }))
    setAiResult({ pending:true }) // show "AI will analyse on submit"

    setCaptureLoading(true)
    getCurrentPosition()
      .then(async (pos) => {
        const addr = await reverseGeocode(pos.latitude, pos.longitude)
        setLocation({ latitude: pos.latitude, longitude: pos.longitude, address: addr })
      })
      .catch(() => {})
      .finally(() => setCaptureLoading(false))
  }, [])

  // Proactively fetch live location on component mount so it is ready immediately
  useEffect(() => {
    getCurrentPosition()
      .then(async (pos) => {
        const addr = await reverseGeocode(pos.latitude, pos.longitude)
        setLocation((prev) => prev || { latitude: pos.latitude, longitude: pos.longitude, address: addr })
      })
      .catch(() => {})
  }, [])

  const handleCameraCapture = useCallback(async (file, previewUrl) => {
    setShowCamera(false); setError('')
    setForm(f => ({ ...f, image:file, imagePreview:previewUrl, imageSource:'camera' }))
    setAiResult({ pending:true })
    setCaptureLoading(true)
    try {
      const pos  = await getCurrentPosition()
      const addr = await reverseGeocode(pos.latitude, pos.longitude)
      setLocation({ latitude:pos.latitude, longitude:pos.longitude, address:addr })
    } catch {}
    finally { setCaptureLoading(false) }
  }, [])

  const handleUploadChange = (e) => processFile(e.target.files?.[0], 'upload')

  const removeImage = () => {
    setForm(f => ({ ...f, image:null, imagePreview:null, imageSource:null }))
    setAiResult(null)
    const upl = document.getElementById('upload-input')
    if (upl) upl.value = ''
  }

  const handleLocationChange = useCallback((loc) => setLocation(loc), [])

  const checkDuplicate = async () => {
    if (!location || !form.damageCategory) return
    setCheckingDup(true); setDuplicate(null)
    try {
      const res = await complaintService.checkDuplicate({
        latitude: location.latitude, longitude: location.longitude,
        damageCategory: form.damageCategory, description: form.description,
      })
      setDuplicate(res.data.data)
    } catch {}
    setCheckingDup(false)
  }

  const handleSubmit = async () => {
    setError('')
    if (!form.damageCategory) return setError('Please select a damage category.')
    if (!location)             return setError('Please select a location on the map.')
    setLoading(true)
    try {
      const fd = new FormData()
      fd.append('damageCategory', form.damageCategory)
      fd.append('description',    form.description)
      fd.append('latitude',       location.latitude)
      fd.append('longitude',      location.longitude)
      if (form.damageCategory === 'OTHER' && form.customDamageType)
        fd.append('customDamageType', form.customDamageType)
      if (form.image) fd.append('image', form.image)

      const res = await complaintService.create(fd)
      const { complaint } = res.data.data
      const ai = res.data.data.aiAnalysis

      // If AI detected a different category, update the submitted data
      if (ai?.available && ai.detectedCategory) {
        complaint._aiDetected = ai
      }
      setSubmitted(complaint)
      setAiResult(ai?.available ? ai : null)
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || 'Failed to submit complaint.'
      const code = err?.response?.data?.code
      // Image rejection — show prominent error and go back to Step 1
      if (code === 'INVALID_IMAGE_CONTENT') {
        setError(msg)
        setStep(1)           // take user back to photo step
        removeImage()        // clear the rejected image
        setAiResult(null)
      } else {
        setError(msg)
      }
    } finally {
      setLoading(false)
    }
  }

  // ── SUCCESS SCREEN ────────────────────────────────────────────────────────
  if (submitted) {
    const ai = submitted._aiDetected || aiResult
    return (
      <div className="max-w-lg mx-auto px-4 py-12 text-center space-y-5">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-2xl mb-2">
          <CheckCircle className="w-8 h-8 text-green-600" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Complaint Submitted!</h2>
          <p className="text-gray-400 text-sm mt-1">Your complaint ID</p>
          <p className="text-2xl font-black font-mono text-indigo-600 mt-1">{submitted.complaintId}</p>
        </div>

        {/* AI result on success */}
        {ai?.available && (
          <div className="text-left rounded-2xl p-4 space-y-3"
            style={{ background:'linear-gradient(135deg,#f0f4ff,#f8f0ff)', border:'1px solid #e0e7ff' }}>
            <div className="flex items-center gap-2">
              <Brain className="w-5 h-5 text-indigo-500" />
              <span className="font-bold text-indigo-700 text-sm">Gemini AI Analysis</span>
              <span className="text-[10px] bg-indigo-100 text-indigo-600 px-2 py-0.5 rounded-full font-bold ml-auto">
                {ai.confidence} confidence
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-white rounded-xl p-3">
                <p className="text-gray-400 mb-0.5">Detected</p>
                <p className="font-bold text-gray-800">{ai.damageLabel || CATEGORY_LABELS[ai.detectedCategory]}</p>
              </div>
              <div className="bg-white rounded-xl p-3" style={{ borderLeft:`3px solid ${SEV_COLOR[ai.severity]||'#6366f1'}` }}>
                <p className="text-gray-400 mb-0.5">Severity</p>
                <p className="font-bold" style={{ color: SEV_COLOR[ai.severity]||'#6366f1' }}>{ai.severity}</p>
              </div>
              {ai.recommendedAction && (
                <div className="col-span-2 bg-white rounded-xl p-3">
                  <p className="text-gray-400 mb-0.5">Recommended Action</p>
                  <p className="font-semibold text-gray-800">{ai.recommendedAction}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {submitted.isDuplicate && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-amber-800 text-sm text-left">
            ⚠️ Similar report exists within {submitted.duplicateDistance}m — flagged as duplicate for admin tracking.
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
          <button onClick={() => navigate(`/complaints/${submitted._id}`)} className="btn-primary">View Complaint</button>
          <button onClick={() => navigate('/my-complaints')} className="btn-secondary">My Complaints</button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto py-4 space-y-5">
      {showCamera && <CameraCapture onCapture={handleCameraCapture} onClose={() => setShowCamera(false)} />}

      {/* Header */}
      <div>
        <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color:'#6366f1' }}>Report Damage</p>
        <h1 className="text-2xl font-black text-gray-900">Report Road Damage</h1>
        <p className="text-sm text-gray-400 mt-0.5">AI will automatically identify the damage type from your photo.</p>
      </div>

      {/* Steps */}
      <div className="flex items-center gap-2">
        {['Photo & Type','Location','Review & Submit'].map((label,i) => (
          <React.Fragment key={label}>
            <div className={`flex items-center gap-1.5 ${i+1===step?'text-indigo-700':i+1<step?'text-green-600':'text-gray-300'}`}>
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold
                ${i+1===step?'bg-indigo-600 text-white':i+1<step?'bg-green-500 text-white':'bg-gray-100 text-gray-400'}`}>
                {i+1<step?'✓':i+1}
              </div>
              <span className="text-xs font-medium hidden sm:block">{label}</span>
            </div>
            {i<2 && <div className={`flex-1 h-px ${i+1<step?'bg-green-300':'bg-gray-100'}`}/>}
          </React.Fragment>
        ))}
      </div>

      <ErrorAlert message={error} onDismiss={() => setError('')} />

      {/* ── STEP 1 ───────────────────────────────────────────────────────── */}
      {step === 1 && (
        <div className="bg-white rounded-2xl p-6 space-y-5" style={{ border:'1px solid #f1f5f9' }}>

          {/* Image rejection notice */}
          {error && error.includes('Invalid image') && (
            <div className="rounded-2xl p-4 space-y-2"
              style={{ background:'#fef2f2', border:'2px solid #fecaca' }}>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-red-100 rounded-xl flex items-center justify-center flex-shrink-0">
                  <X className="w-4 h-4 text-red-500" />
                </div>
                <p className="font-bold text-red-700 text-sm">Image Rejected by AI</p>
              </div>
              <p className="text-red-600 text-xs leading-relaxed">{error}</p>
              <p className="text-red-400 text-xs font-semibold">
                📸 Please take or upload a clear photo of the road damage (pothole, crack, waterlogging, etc.)
              </p>
            </div>
          )}

          {/* Photo upload */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              📷 Photo of Damage
              <span className="text-gray-400 font-normal ml-1.5 text-xs">— AI will detect damage type</span>
            </label>

            {form.imagePreview ? (
              <div className="space-y-3">
                <div className="relative">
                  <img src={form.imagePreview} alt="preview"
                    className="w-full max-h-52 object-cover rounded-xl border border-gray-100" />
                  <button onClick={removeImage}
                    className="absolute top-2 right-2 w-7 h-7 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center shadow-md">
                    <X className="w-3.5 h-3.5" />
                  </button>
                  <div className="absolute bottom-2 left-2 bg-black/60 text-white text-xs px-2 py-1 rounded-lg flex items-center gap-1">
                    {form.imageSource==='camera'?'📷 Camera':'📁 Uploaded'}
                    {captureLoading && <span className="animate-pulse"> · Getting location…</span>}
                  </div>
                </div>

                {/* AI detection banner */}
                {aiResult?.pending && (
                  <div className="flex items-center gap-3 rounded-xl px-4 py-3"
                    style={{ background:'linear-gradient(90deg,#eef2ff,#f0fdf4)', border:'1px solid #c7d2fe' }}>
                    <Sparkles className="w-4 h-4 text-indigo-500 animate-pulse flex-shrink-0" />
                    <div>
                      <p className="text-xs font-bold text-indigo-700">Gemini AI ready</p>
                      <p className="text-xs text-indigo-500">Will automatically detect damage type when you submit.</p>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {/* Camera */}
                <button type="button" onClick={() => setShowCamera(true)}
                  className="flex flex-col items-center gap-3 p-5 rounded-xl cursor-pointer group transition-all active:scale-95"
                  style={{ border:'2px dashed #a5b4fc', background:'#eef2ff' }}>
                  <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background:'#c7d2fe' }}>
                    <Camera className="w-6 h-6 text-indigo-700" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-bold text-indigo-700">Take Photo</p>
                    <p className="text-xs text-indigo-400 mt-0.5">Opens camera</p>
                    <p className="text-[10px] text-indigo-300 mt-1">AI + GPS auto-capture</p>
                  </div>
                </button>

                {/* Upload */}
                <label htmlFor="upload-input"
                  className="flex flex-col items-center gap-3 p-5 rounded-xl cursor-pointer group transition-all active:scale-95"
                  style={{ border:'2px dashed #e2e8f0', background:'#f8fafc' }}>
                  <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background:'#e2e8f0' }}>
                    <Upload className="w-6 h-6 text-slate-500" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-bold text-slate-700">Upload Photo</p>
                    <p className="text-xs text-slate-400 mt-0.5">Gallery or files</p>
                    <p className="text-[10px] text-slate-300 mt-1">JPG · PNG · WEBP · 5MB</p>
                  </div>
                </label>
                <input id="upload-input" ref={uploadRef} type="file"
                  accept="image/jpeg,image/jpg,image/png,image/webp"
                  className="hidden" onChange={handleUploadChange} />
              </div>
            )}
          </div>

          {/* Damage category */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-semibold text-gray-700">
                Damage Category <span className="text-red-400">*</span>
              </label>
              {form.image && (
                <span className="text-[10px] flex items-center gap-1 font-semibold" style={{ color:'#6366f1' }}>
                  <Brain className="w-3 h-3" /> AI will auto-detect on submit
                </span>
              )}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {CATEGORIES.map(([val,label]) => (
                <button key={val} type="button"
                  onClick={() => setForm(f => ({ ...f, damageCategory:val }))}
                  className="p-3 rounded-xl border-2 text-sm font-semibold transition-all text-left"
                  style={form.damageCategory===val
                    ? { borderColor:'#6366f1', background:'#eef2ff', color:'#4338ca' }
                    : { borderColor:'#f1f5f9', background:'#fafafa', color:'#64748b' }}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          {form.damageCategory === 'OTHER' && (
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Specify Type</label>
              <input name="customDamageType" value={form.customDamageType}
                onChange={e => setForm(f => ({ ...f, customDamageType:e.target.value }))}
                className="input-field" placeholder="e.g. Missing manhole cover" />
            </div>
          )}

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              Description <span className="text-gray-300 font-normal">(optional)</span>
            </label>
            <textarea name="description" value={form.description}
              onChange={e => setForm(f => ({ ...f, description:e.target.value }))}
              rows={3} className="input-field resize-none"
              placeholder="Describe the damage — size, severity, location landmarks…" maxLength={1000} />
            <p className="text-xs text-gray-300 text-right mt-0.5">{form.description.length}/1000</p>
          </div>

          <button
            onClick={() => {
              if (!form.damageCategory) { setError('Please select a damage category.'); return }
              setError(''); setStep(2)
            }}
            className="w-full py-3 rounded-xl text-white font-bold text-sm transition-all"
            style={{ background:'linear-gradient(90deg,#6366f1,#4f46e5)', boxShadow:'0 4px 16px rgba(99,102,241,0.3)' }}>
            Next: Select Location →
          </button>
        </div>
      )}

      {/* ── STEP 2 ───────────────────────────────────────────────────────── */}
      {step === 2 && (
        <div className="bg-white rounded-2xl p-6 space-y-4" style={{ border:'1px solid #f1f5f9' }}>
          <div>
            <h2 className="font-bold text-gray-900">Select Location</h2>
            <p className="text-xs text-gray-400 mt-0.5">Allow location access for GPS auto-detection.</p>
          </div>
          <LocationPicker value={location} onChange={handleLocationChange} />

          {location && (
            <div className="pt-1">
              <button type="button" onClick={checkDuplicate} disabled={checkingDup}
                className="btn-secondary text-sm gap-2">
                {checkingDup ? <><Loader className="w-3.5 h-3.5 animate-spin" /> Checking…</> : '🔍 Check for Duplicate Reports Nearby'}
              </button>
              {duplicate?.isDuplicate && (
                <div className="mt-3 rounded-xl p-4 text-sm space-y-1"
                  style={{ background:'#fffbeb', border:'1px solid #fde68a' }}>
                  <p className="font-bold text-amber-800 flex items-center gap-1">
                    <AlertTriangle className="w-4 h-4" /> Similar report already exists!
                  </p>
                  <p className="text-amber-700">
                    Complaint <strong>{duplicate.complaint.complaintId}</strong> was filed{' '}
                    <strong>{duplicate.distance}m</strong> away.
                    {duplicate.aiReason && <span className="text-amber-600 text-xs block mt-0.5">🤖 {duplicate.aiReason}</span>}
                  </p>
                  <p className="text-amber-600 text-xs">You can still submit — it will be flagged as duplicate.</p>
                </div>
              )}
              {duplicate?.isDuplicate === false && (
                <p className="mt-2 text-green-700 text-sm flex items-center gap-1 font-semibold">
                  <CheckCircle className="w-4 h-4" /> No duplicates found nearby.
                  {duplicate.aiOverride && <span className="text-xs text-green-500 font-normal ml-1">(AI verified)</span>}
                </p>
              )}
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button onClick={() => setStep(1)} className="btn-secondary flex-1">← Back</button>
            <button
              onClick={() => {
                if (!location) { setError('Please select a location.'); return }
                setError(''); setStep(3)
              }}
              className="flex-1 py-2.5 rounded-xl text-white font-bold text-sm transition-all"
              style={{ background:'linear-gradient(90deg,#6366f1,#4f46e5)' }}>
              Review & Submit →
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 3 ───────────────────────────────────────────────────────── */}
      {step === 3 && (
        <div className="bg-white rounded-2xl p-6 space-y-4" style={{ border:'1px solid #f1f5f9' }}>
          <h2 className="font-bold text-gray-900">Review Your Report</h2>

          {form.imagePreview && (
            <img src={form.imagePreview} alt="Damage"
              className="w-full max-h-44 object-cover rounded-xl border border-gray-100" />
          )}

          {/* AI banner on review */}
          {form.image && (
            <div className="flex items-center gap-3 rounded-xl px-4 py-3"
              style={{ background:'linear-gradient(90deg,#eef2ff,#f0fdf4)', border:'1px solid #c7d2fe' }}>
              <Brain className="w-4 h-4 text-indigo-500 animate-pulse flex-shrink-0" />
              <div>
                <p className="text-xs font-bold text-indigo-700">Gemini AI will analyse your photo on submit</p>
                <p className="text-xs text-indigo-400">Automatically detects damage type, severity and recommended action.</p>
              </div>
            </div>
          )}

          <div className="grid sm:grid-cols-2 gap-3 text-sm">
            <div className="rounded-xl p-3" style={{ background:'#f8fafc' }}>
              <p className="text-xs text-gray-400 mb-0.5">Damage Category</p>
              <p className="font-bold text-gray-900">{CATEGORY_LABELS[form.damageCategory]}</p>
            </div>
            <div className="rounded-xl p-3" style={{ background:'#f8fafc' }}>
              <p className="text-xs text-gray-400 mb-0.5">Coordinates</p>
              <p className="font-mono text-xs text-gray-700">
                {location?.latitude?.toFixed(5)}, {location?.longitude?.toFixed(5)}
              </p>
            </div>
            {location?.address && (
              <div className="sm:col-span-2 rounded-xl p-3" style={{ background:'#f8fafc' }}>
                <p className="text-xs text-gray-400 mb-0.5">Address</p>
                <p className="text-xs text-gray-700">{location.address.formatted}</p>
              </div>
            )}
            {form.description && (
              <div className="sm:col-span-2 rounded-xl p-3" style={{ background:'#f8fafc' }}>
                <p className="text-xs text-gray-400 mb-0.5">Description</p>
                <p className="text-sm text-gray-700">{form.description}</p>
              </div>
            )}
          </div>

          <div className="flex gap-3 pt-1">
            <button onClick={() => setStep(2)} className="btn-secondary flex-1">← Back</button>
            <button onClick={handleSubmit} disabled={loading}
              className="flex-1 py-3 rounded-xl text-white font-bold text-sm flex items-center justify-center gap-2 transition-all"
              style={{ background:'linear-gradient(90deg,#6366f1,#4f46e5)', boxShadow:'0 4px 16px rgba(99,102,241,0.3)' }}>
              {loading ? (
                <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Submitting + AI…</>
              ) : (
                <><Sparkles className="w-4 h-4" /> Submit & Analyse</>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
