import React from 'react'
import { Link } from 'react-router-dom'
import { MapPin, Shield, BarChart2, Bell, ArrowRight, Map } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'

export default function Home() {
  const { isAuthenticated, isAdmin } = useAuth()

  return (
    <div className="min-h-screen bg-slate-50">
      {/* ── Top nav ────────────────────────────────────────────────────────── */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-primary-600 rounded-xl flex items-center justify-center">
              <MapPin className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-gray-900 text-sm">Road Damage Reporter</span>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/map" className="text-sm text-gray-500 hover:text-gray-800 font-medium hidden sm:block">Public Map</Link>
            {isAuthenticated ? (
              <Link to={isAdmin ? '/admin/dashboard' : '/dashboard'} className="btn-primary text-sm">
                Go to Dashboard
              </Link>
            ) : (
              <>
                <Link to="/login" className="text-sm text-gray-600 font-medium hover:text-primary-600">Login</Link>
                <Link to="/register" className="btn-primary text-sm">Get Started</Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-6 pt-20 pb-16 text-center">
        <div className="inline-flex items-center gap-2 bg-primary-50 text-primary-700 text-xs font-semibold px-3 py-1.5 rounded-full border border-primary-100 mb-6">
          <MapPin className="w-3 h-3" /> Chhatrapati Sambhajinagar Municipal Corporation
        </div>
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-gray-900 leading-tight mb-6">
          Report Road Damage.<br />
          <span className="text-primary-600">Track Every Fix.</span>
        </h1>
        <p className="text-gray-500 text-lg max-w-2xl mx-auto mb-10">
          Use GPS to pin exact damage locations, upload photos for AI analysis, and track your complaint from submission to resolution.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          {isAuthenticated ? (
            <Link to={isAdmin ? '/admin/dashboard' : '/dashboard'} className="btn-primary px-8 py-3 text-base">
              Go to Dashboard <ArrowRight className="w-4 h-4" />
            </Link>
          ) : (
            <>
              <Link to="/register" className="btn-primary px-8 py-3 text-base">
                Start Reporting Free <ArrowRight className="w-4 h-4" />
              </Link>
              <Link to="/map" className="btn-secondary px-8 py-3 text-base">
                <Map className="w-4 h-4" /> View Live Map
              </Link>
            </>
          )}
        </div>
      </section>

      {/* ── Stats ─────────────────────────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-6 pb-16">
        <div className="bg-sidebar-bg rounded-3xl p-8 grid grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            { value:'10+', label:'Complaints Tracked' },
            { value:'3',   label:'Municipal Zones' },
            { value:'AI',  label:'Powered Analysis' },
            { value:'GPS', label:'Location Accuracy' },
          ].map(({ value, label }) => (
            <div key={label} className="text-center">
              <p className="text-3xl font-black text-white mb-1">{value}</p>
              <p className="text-slate-400 text-sm">{label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features ──────────────────────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-6 pb-20">
        <p className="text-center text-xs font-bold uppercase tracking-widest text-gray-400 mb-10">How it works</p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {[
            { icon:'📍', title:'GPS Location',     desc:'Automatically capture your exact coordinates using Browser Geolocation API.' },
            { icon:'📷', title:'Photo Capture',    desc:'Take a photo directly with your camera. AI analyses severity instantly.' },
            { icon:'🤖', title:'AI Analysis',      desc:'Gemini AI assesses damage severity, safety risk and repair urgency.' },
            { icon:'📊', title:'Track & Resolve',  desc:'Get real-time notifications as your complaint moves from Reported to Resolved.' },
          ].map(({ icon, title, desc }) => (
            <div key={title} className="bg-white rounded-2xl border border-gray-100 p-6 hover:shadow-md transition-shadow">
              <div className="text-3xl mb-4">{icon}</div>
              <h3 className="font-bold text-gray-800 mb-2">{title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA ───────────────────────────────────────────────────────────── */}
      {!isAuthenticated && (
        <section className="bg-primary-600 py-16 px-6 text-center">
          <h2 className="text-2xl font-bold text-white mb-3">Ready to make your city better?</h2>
          <p className="text-primary-200 text-sm mb-6">Create a free account and report your first road damage issue.</p>
          <Link to="/register" className="inline-flex items-center gap-2 bg-white text-primary-700 font-bold px-8 py-3 rounded-xl hover:bg-primary-50 transition-colors shadow-sm">
            Create Free Account <ArrowRight className="w-4 h-4" />
          </Link>
        </section>
      )}

      <footer className="text-center py-6 text-xs text-gray-400 bg-white border-t border-gray-100">
        © 2026 Road Damage Reporting System · Built with React, Node.js, MongoDB & Leaflet
      </footer>
    </div>
  )
}
