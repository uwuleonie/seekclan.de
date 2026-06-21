'use client'

import { useState, useEffect } from 'react'

const CONSENT_COOKIE = 'cookie_consent'

type Consent = 'necessary' | 'all'

function getConsent(): Consent | null {
  if (typeof document === 'undefined') return null
  const match = document.cookie.match(new RegExp(`${CONSENT_COOKIE}=(necessary|all)`))
  return match ? (match[1] as Consent) : null
}

function setConsent(value: Consent) {
  const oneYear = 60 * 60 * 24 * 365
  document.cookie = `${CONSENT_COOKIE}=${value}; path=/; max-age=${oneYear}; SameSite=Lax`
}

const CATEGORIES = [
  {
    key: 'necessary',
    title: 'Notwendig',
    always: true,
    description: 'Erforderlich für den Betrieb der Website, z. B. um dich eingeloggt zu halten (session_token) und deine Cookie-Auswahl selbst zu speichern.',
  },
  {
    key: 'analytics',
    title: 'Analyse',
    always: false,
    description: 'Hilft uns zu verstehen, wie die Website genutzt wird (z. B. über Vercel Analytics), um sie zu verbessern.',
  },
]

export default function CookieBanner() {
  const [visible, setVisible] = useState(false)
  const [showDetails, setShowDetails] = useState(false)

  useEffect(() => {
    if (!getConsent()) setVisible(true)
  }, [])

  const accept = (value: Consent) => {
    setConsent(value)
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div className="fixed bottom-4 left-4 z-50 max-w-sm rounded-2xl shadow-2xl"
      style={{ background: 'var(--card)', border: '1px solid var(--card-border)' }}>
      <div className="p-4">
        <p className="text-sm font-bold mb-1" style={{ color: 'var(--foreground)' }}>🍪 Cookies</p>
        <p className="text-xs mb-3" style={{ color: 'var(--muted)' }}>
          Wir verwenden technisch notwendige Cookies für den Betrieb der Website. Mehr dazu in unserer{' '}
          <a href="/datenschutz" className="underline">Datenschutzerklärung</a>.
        </p>

        {showDetails && (
          <div className="space-y-2 mb-3">
            {CATEGORIES.map(cat => (
              <div key={cat.key} className="rounded-lg p-2" style={{ background: 'var(--muted-bg)' }}>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium" style={{ color: 'var(--foreground)' }}>{cat.title}</span>
                  <span className="text-xs" style={{ color: cat.always ? '#16A34A' : 'var(--muted)' }}>
                    {cat.always ? 'Immer aktiv' : 'Optional'}
                  </span>
                </div>
                <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>{cat.description}</p>
              </div>
            ))}
          </div>
        )}

        <button onClick={() => setShowDetails(prev => !prev)} className="text-xs underline mb-3 block" style={{ color: 'var(--muted)' }}>
          {showDetails ? 'Details ausblenden' : 'Details anzeigen'}
        </button>

        <div className="flex gap-2">
          <button onClick={() => accept('necessary')} className="flex-1 text-xs font-medium py-2 rounded-lg"
            style={{ background: 'var(--muted-bg)', border: '1px solid var(--card-border)', color: 'var(--foreground)' }}>
            Nur Notwendige
          </button>
          <button onClick={() => accept('all')} className="flex-1 text-xs font-medium py-2 rounded-lg"
            style={{ background: '#16A34A', color: 'white' }}>
            Alle akzeptieren
          </button>
        </div>
      </div>
    </div>
  )
}