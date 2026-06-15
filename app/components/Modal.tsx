'use client'

import { createPortal } from 'react-dom'

export default function Modal({ onClose, children }: {
  onClose: () => void
  children: React.ReactNode
}) {
  return createPortal(
    <div className="fixed inset-0 z-50 flex">
      {/* Dunkler Hintergrund rechts */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      {/* Panel von links */}
      <div className="relative z-10 h-full w-96 bg-white shadow-2xl flex flex-col animate-slide-in">
        {children}
      </div>
    </div>,
    document.body
  )
}