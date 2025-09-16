import React, { useEffect } from 'react'

export default function ErrorToast({ message, onClose, duration = 5000 }) {
  useEffect(() => {
    if (!message) return
    const t = setTimeout(() => onClose?.(), duration)
    return () => clearTimeout(t)
  }, [message, duration, onClose])

  if (!message) return null

  return (
    <div className="fixed top-4 right-4 z-50 max-w-sm">
      <div className="bg-red-100 border border-red-300 text-red-800 px-4 py-3 rounded shadow flex items-start gap-3">
        <span className="mt-0.5" aria-hidden>⚠️</span>
        <div className="text-sm pr-6">
          {message}
        </div>
        <button
          aria-label="Close error"
          className="ml-auto text-red-700 hover:text-red-900"
          onClick={onClose}
        >
          ✖
        </button>
      </div>
    </div>
  )
}
import React, { useEffect } from 'react'

export default function ErrorToast({ message, onClose, duration = 5000 }) {
  useEffect(() => {
    if (!message) return
    const t = setTimeout(() => onClose?.(), duration)
    return () => clearTimeout(t)
  }, [message, duration, onClose])

  if (!message) return null

  return (
    <div className="fixed top-4 right-4 z-50 max-w-sm">
      <div className="bg-red-100 border border-red-300 text-red-800 px-4 py-3 rounded shadow flex items-start gap-3">
        <span className="mt-0.5">⚠️</span>
        <div className="text-sm">
          {message}
        </div>
        <button
          aria-label="Close"
          className="ml-auto text-red-700 hover:text-red-900"
          onClick={onClose}
        >
          ✖
        </button>
      </div>
    </div>
  )
}
