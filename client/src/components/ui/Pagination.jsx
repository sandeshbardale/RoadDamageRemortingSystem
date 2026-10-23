import React from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

export default function Pagination({ page, pages, onPage }) {
  if (pages <= 1) return null
  const range = []
  for (let i = Math.max(1, page - 2); i <= Math.min(pages, page + 2); i++) range.push(i)

  return (
    <div className="flex items-center justify-center gap-1 mt-4">
      <button
        onClick={() => onPage(page - 1)}
        disabled={page === 1}
        className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>
      {range[0] > 1 && <><button onClick={() => onPage(1)} className="px-3 py-1 rounded-lg text-sm hover:bg-gray-100">1</button><span className="text-gray-400 text-sm">…</span></>}
      {range.map((p) => (
        <button
          key={p}
          onClick={() => onPage(p)}
          className={`px-3 py-1 rounded-lg text-sm font-medium ${p === page ? 'bg-primary-600 text-white' : 'hover:bg-gray-100 text-gray-700'}`}
        >
          {p}
        </button>
      ))}
      {range[range.length - 1] < pages && <><span className="text-gray-400 text-sm">…</span><button onClick={() => onPage(pages)} className="px-3 py-1 rounded-lg text-sm hover:bg-gray-100">{pages}</button></>}
      <button
        onClick={() => onPage(page + 1)}
        disabled={page === pages}
        className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  )
}
