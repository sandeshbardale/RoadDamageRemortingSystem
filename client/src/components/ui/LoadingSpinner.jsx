import React from 'react'

export default function LoadingSpinner({ message = 'Loading…', fullPage = false }) {
  const spinner = (
    <div className="flex flex-col items-center gap-3">
      <div className="w-10 h-10 rounded-full border-4 border-primary-100 border-t-primary-600 animate-spin" />
      <p className="text-sm text-gray-400 font-medium">{message}</p>
    </div>
  )

  if (fullPage) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        {spinner}
      </div>
    )
  }
  return (
    <div className="flex items-center justify-center py-16">
      {spinner}
    </div>
  )
}
