'use client'

import Link from 'next/link'

export default function HideNSeekPage() {
  return (
    <div className="min-h-screen" style={{ background: 'var(--background)' }}>
      <div className="max-w-2xl mx-auto px-8 py-16">
        <Link href="/" className="text-sm flex items-center gap-1 mb-8 hover:opacity-70" style={{ color: 'var(--muted)' }}>← Zurück zur Startseite</Link>

        <div className="card rounded-2xl p-12 text-center">
          <p className="text-5xl mb-4">🙈</p>
          <h1 className="text-2xl font-bold mb-3" style={{ color: 'var(--foreground)' }}>Hide&apos;n&apos;Seek</h1>
          <p className="mb-6" style={{ color: 'var(--muted)' }}>
            Dieser Bereich befindet sich aktuell noch im Aufbau. Schau bald wieder vorbei!
          </p>
          <span
            className="inline-block text-xs font-medium px-3 py-1.5 rounded-full text-white"
            style={{ background: 'linear-gradient(135deg, #4F46E5, #7C3AED, #C026D3)' }}
          >
            🚧 In Entwicklung
          </span>
        </div>
      </div>
    </div>
  )
}