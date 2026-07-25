'use client'
import { useEffect, useState } from 'react'
import { CheckCircle, XCircle, X } from 'lucide-react'

export type ToastType = 'success' | 'error'

interface ToastProps {
  message: string
  type?: ToastType
  onClose: () => void
}

export function Toast({ message, type = 'success', onClose }: ToastProps) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true))
    const t = setTimeout(() => { setVisible(false); setTimeout(onClose, 300) }, 3000)
    return () => clearTimeout(t)
  }, [onClose])

  const isSuccess = type === 'success'

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center pointer-events-none">
      <div
        className="pointer-events-auto flex flex-col items-center gap-4 px-10 py-8 rounded-3xl shadow-2xl"
        style={{
          background: isSuccess
            ? 'linear-gradient(135deg,#14532d,#16a34a)'
            : 'linear-gradient(135deg,#7f1d1d,#dc2626)',
          border: `2px solid ${isSuccess ? '#22c55e' : '#ef4444'}`,
          minWidth: 280,
          maxWidth: 420,
          transform: visible ? 'scale(1) translateY(0)' : 'scale(0.85) translateY(20px)',
          opacity: visible ? 1 : 0,
          transition: 'all 0.28s cubic-bezier(0.34,1.56,0.64,1)',
          boxShadow: isSuccess
            ? '0 25px 60px rgba(22,163,74,0.45)'
            : '0 25px 60px rgba(220,38,38,0.45)',
        }}
      >
        <button
          onClick={() => { setVisible(false); setTimeout(onClose, 300) }}
          className="absolute top-3 right-3 w-7 h-7 rounded-full flex items-center justify-center"
          style={{ background: 'rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.8)' }}
        >
          <X size={14} />
        </button>
        {isSuccess
          ? <CheckCircle size={52} color="#bbf7d0" strokeWidth={1.5} />
          : <XCircle size={52} color="#fecaca" strokeWidth={1.5} />
        }
        <p className="text-center font-black text-white" style={{ fontSize: 18, lineHeight: 1.3 }}>
          {message}
        </p>
        <div
          className="h-1 rounded-full w-full"
          style={{
            background: 'rgba(255,255,255,0.25)',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <div style={{
            position: 'absolute', inset: 0,
            background: 'rgba(255,255,255,0.6)',
            animation: 'toast-bar 3s linear forwards',
          }} />
        </div>
      </div>
      <style>{`
        @keyframes toast-bar {
          from { transform: scaleX(1); transform-origin: left; }
          to   { transform: scaleX(0); transform-origin: left; }
        }
      `}</style>
    </div>
  )
}

export function useToast() {
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null)
  const show = (message: string, type: ToastType = 'success') => setToast({ message, type })
  const node = toast ? <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} /> : null
  return { show, node }
}
