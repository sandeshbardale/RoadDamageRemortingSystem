import React, { useState } from 'react'
import { MapPin, User, ArrowRight } from 'lucide-react'

/**
 * WelcomeModal — shown once on first login.
 * Asks for the citizen's preferred display name.
 * Stores it in localStorage so it only appears once.
 *
 * Props:
 *   currentName  — name from JWT/DB (pre-fills the input)
 *   onConfirm(name) — called when user confirms
 */
export default function WelcomeModal({ currentName, onConfirm }) {
  const [name, setName] = useState(currentName || '')
  const [error, setError] = useState('')

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!name.trim() || name.trim().length < 2) {
      setError('Please enter at least 2 characters.')
      return
    }
    onConfirm(name.trim())
  }

  return (
    /* Full-screen overlay */
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in">

        {/* Top banner */}
        <div className="bg-sidebar-bg px-8 pt-8 pb-6 text-center">
          <div className="w-16 h-16 bg-primary-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
            <MapPin className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-xl font-bold text-white">Welcome to</h2>
          <p className="text-primary-300 font-bold text-lg mt-0.5">Road Damage Reporter</p>
          <p className="text-slate-400 text-sm mt-2">
            Chhatrapati Sambhajinagar Municipal Corporation
          </p>
        </div>

        {/* Form */}
        <div className="px-8 py-7">
          <p className="text-gray-600 text-sm text-center mb-6 leading-relaxed">
            Before we begin, what should we call you?
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                Your Name
              </label>
              <div className="relative">
                <User className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-300" />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => { setName(e.target.value); setError('') }}
                  placeholder="e.g. Rahul Sharma"
                  className="input-field pl-10"
                  autoFocus
                  maxLength={60}
                />
              </div>
              {error && <p className="text-red-500 text-xs mt-1.5">{error}</p>}
            </div>

            <button type="submit" className="btn-primary w-full py-3 text-base">
              Get Started <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          <p className="text-center text-xs text-gray-300 mt-4">
            You can change your name anytime in your profile.
          </p>
        </div>
      </div>
    </div>
  )
}
