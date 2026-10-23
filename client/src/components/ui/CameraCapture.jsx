import React, { useRef, useState, useEffect, useCallback } from 'react'
import { Camera, X, RotateCcw, Check, FlipHorizontal } from 'lucide-react'

/**
 * CameraCapture
 * Opens a live camera stream via getUserMedia, lets the user snap a photo,
 * and returns a File object — no file picker dialog at all.
 *
 * Props:
 *   onCapture(file, previewUrl) — called when the user confirms the shot
 *   onClose()                   — called when the user dismisses the camera
 */
export default function CameraCapture({ onCapture, onClose }) {
  const videoRef    = useRef(null)
  const canvasRef   = useRef(null)
  const streamRef   = useRef(null)

  const [phase, setPhase]         = useState('loading')   // loading | live | preview | error
  const [previewUrl, setPreviewUrl] = useState(null)
  const [capturedBlob, setCapturedBlob] = useState(null)
  const [facingMode, setFacingMode]     = useState('environment') // environment = rear, user = front
  const [errorMsg, setErrorMsg]         = useState('')

  // ── Start camera stream ───────────────────────────────────────────────────
  const startCamera = useCallback(async (facing = facingMode) => {
    // Stop any existing stream first
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
    setPhase('loading')
    setErrorMsg('')

    try {
      const constraints = {
        video: {
          facingMode: facing,
          width:  { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      }
      const stream = await navigator.mediaDevices.getUserMedia(constraints)
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.play()
      }
      setPhase('live')
    } catch (err) {
      let msg = 'Camera access denied or not available.'
      if (err.name === 'NotAllowedError')  msg = 'Camera permission denied. Please allow camera access in your browser settings.'
      if (err.name === 'NotFoundError')    msg = 'No camera found on this device.'
      if (err.name === 'NotReadableError') msg = 'Camera is already in use by another app.'
      if (err.name === 'OverconstrainedError') {
        // Try without facingMode constraint
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
          streamRef.current = stream
          if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.play() }
          setPhase('live')
          return
        } catch {}
      }
      setErrorMsg(msg)
      setPhase('error')
    }
  }, [facingMode])

  // Start on mount
  useEffect(() => {
    startCamera(facingMode)
    return () => {
      // Cleanup: stop stream when component unmounts
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop())
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Snap photo from video frame ───────────────────────────────────────────
  const takeSnapshot = useCallback(() => {
    const video  = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return

    canvas.width  = video.videoWidth  || 1280
    canvas.height = video.videoHeight || 720
    const ctx = canvas.getContext('2d')
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

    canvas.toBlob(blob => {
      if (!blob) return
      setCapturedBlob(blob)
      setPreviewUrl(URL.createObjectURL(blob))
      setPhase('preview')
      // Pause stream — no need to keep it running during preview
      if (streamRef.current) streamRef.current.getTracks().forEach(t => { t.enabled = false })
    }, 'image/jpeg', 0.92)
  }, [])

  // ── Retake — discard preview, restart stream ──────────────────────────────
  const retake = useCallback(() => {
    setPreviewUrl(null)
    setCapturedBlob(null)
    if (streamRef.current) streamRef.current.getTracks().forEach(t => { t.enabled = true })
    setPhase('live')
  }, [])

  // ── Flip camera (front/rear) ──────────────────────────────────────────────
  const flipCamera = useCallback(() => {
    const next = facingMode === 'environment' ? 'user' : 'environment'
    setFacingMode(next)
    startCamera(next)
  }, [facingMode, startCamera])

  // ── Confirm — convert blob to File and return to parent ───────────────────
  const confirmPhoto = useCallback(() => {
    if (!capturedBlob) return
    const fileName = `damage-${Date.now()}.jpg`
    const file = new File([capturedBlob], fileName, { type: 'image/jpeg' })
    onCapture(file, previewUrl)
  }, [capturedBlob, previewUrl, onCapture])

  // ── Dismiss ───────────────────────────────────────────────────────────────
  const handleClose = useCallback(() => {
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop())
    onClose()
  }, [onClose])

  return (
    /* Full-screen overlay */
    <div className="fixed inset-0 z-50 bg-black flex flex-col">

      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-black/80 flex-shrink-0">
        <span className="text-white font-semibold text-sm">
          {phase === 'preview' ? 'Preview — Keep this photo?' : 'Take a Photo'}
        </span>
        <button onClick={handleClose} className="text-white p-1 hover:text-red-400 transition-colors">
          <X className="w-6 h-6" />
        </button>
      </div>

      {/* Camera / Preview area */}
      <div className="flex-1 relative overflow-hidden bg-black flex items-center justify-center">

        {/* Loading */}
        {phase === 'loading' && (
          <div className="text-center text-white space-y-3">
            <div className="w-12 h-12 border-4 border-white/30 border-t-white rounded-full animate-spin mx-auto" />
            <p className="text-sm text-white/70">Starting camera…</p>
          </div>
        )}

        {/* Error */}
        {phase === 'error' && (
          <div className="text-center text-white px-6 space-y-4 max-w-sm">
            <Camera className="w-14 h-14 text-red-400 mx-auto" />
            <p className="font-semibold">Camera unavailable</p>
            <p className="text-sm text-white/70">{errorMsg}</p>
            <button onClick={handleClose} className="btn-primary w-full">Close</button>
          </div>
        )}

        {/* Live video */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={`w-full h-full object-cover ${phase !== 'live' ? 'hidden' : ''}`}
        />

        {/* Snapshot preview */}
        {phase === 'preview' && previewUrl && (
          <img
            src={previewUrl}
            alt="Captured"
            className="w-full h-full object-contain"
          />
        )}

        {/* Flip camera button (only while live) */}
        {phase === 'live' && (
          <button
            onClick={flipCamera}
            className="absolute top-3 right-3 bg-black/50 text-white p-2.5 rounded-full hover:bg-black/70 transition-colors"
            title="Flip camera"
          >
            <FlipHorizontal className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Hidden canvas for snapshot */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Bottom controls */}
      <div className="flex-shrink-0 bg-black/90 py-5 px-8 flex items-center justify-center gap-8">

        {phase === 'live' && (
          /* Shutter button */
          <button
            onClick={takeSnapshot}
            className="w-18 h-18 rounded-full bg-white hover:bg-gray-100 active:scale-95
              transition-all shadow-xl flex items-center justify-center"
            style={{ width: 72, height: 72 }}
            title="Take photo"
          >
            <div className="w-14 h-14 rounded-full bg-white border-4 border-gray-300" />
          </button>
        )}

        {phase === 'preview' && (
          <>
            {/* Retake */}
            <button
              onClick={retake}
              className="flex flex-col items-center gap-1 text-white hover:text-yellow-300 transition-colors"
            >
              <div className="w-14 h-14 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors">
                <RotateCcw className="w-6 h-6" />
              </div>
              <span className="text-xs">Retake</span>
            </button>

            {/* Use photo */}
            <button
              onClick={confirmPhoto}
              className="flex flex-col items-center gap-1 text-white hover:text-green-300 transition-colors"
            >
              <div className="w-14 h-14 rounded-full bg-green-500 hover:bg-green-400 flex items-center justify-center transition-colors shadow-lg">
                <Check className="w-7 h-7 text-white" />
              </div>
              <span className="text-xs">Use Photo</span>
            </button>
          </>
        )}

      </div>
    </div>
  )
}
