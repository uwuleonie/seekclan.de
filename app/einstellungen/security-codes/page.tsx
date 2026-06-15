'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '../../lib/auth-context'
import Link from 'next/link'

export default function SecurityCodesPage() {
  const { user, loading } = useAuth()
  const [codes, setCodes] = useState<string[]>([])
  const [usedCount, setUsedCount] = useState(0)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [showCodes, setShowCodes] = useState(false)
  const [password, setPassword] = useState('')

  const fetchCodes = async () => {
    const res = await fetch('/api/settings/security-codes')
    const data = await res.json()
    if (res.ok) setUsedCount(data.used_count)
  }

  useEffect(() => {
    if (user) fetchCodes()
  }, [user])

  const handleGenerate = async () => {
    setGenerating(true); setError(''); setSuccess('')
    try {
      const res = await fetch('/api/settings/security-codes/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      const data = await res.json()
      if (!res.ok) setError(data.error || 'Fehler')
      else {
        setCodes(data.codes)
        setSuccess('Neue Security Codes generiert! Speichere sie sicher ab.')
        setShowCodes(true)
        setPassword('')
        fetchCodes()
      }
    } catch { setError('Ein Fehler ist aufgetreten') }
    setGenerating(false)
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--background)', color: 'var(--foreground)' }}>Laden...</div>

  if (!user) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--background)' }}>
      <div className="text-center">
        <p className="mb-4" style={{ color: 'var(--muted)' }}>Du musst eingeloggt sein.</p>
        <Link href="/login" className="btn-gradient text-white px-6 py-3 rounded-xl">Einloggen</Link>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen" style={{ background: 'var(--background)' }}>
      <div className="max-w-2xl mx-auto px-8 py-10">
        <Link href="/einstellungen" className="text-sm flex items-center gap-1 mb-8 hover:opacity-70" style={{ color: 'var(--muted)' }}>← Zurück zu Einstellungen</Link>

        <h1 className="text-3xl font-bold mb-2" style={{ color: 'var(--foreground)' }}>Security Codes</h1>
        <p className="mb-8" style={{ color: 'var(--muted)' }}>Nutze diese Codes um dein Passwort zurückzusetzen. Jeder Code kann nur einmal verwendet werden.</p>

        {error && <p className="text-red-500 text-sm mb-4 px-4 py-2 rounded-xl" style={{ background: 'rgba(239,68,68,0.1)' }}>{error}</p>}
        {success && <p className="text-green-500 text-sm mb-4 px-4 py-2 rounded-xl" style={{ background: 'rgba(34,197,94,0.1)' }}>{success}</p>}

        {/* Status */}
        <div className="card rounded-2xl p-6 mb-4">
          <h2 className="font-bold text-lg mb-4" style={{ color: 'var(--foreground)' }}>Status</h2>
          <div className="flex gap-4">
            <div className="flex-1 rounded-xl p-4 text-center" style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)' }}>
              <p className="text-2xl font-bold text-green-500">{8 - usedCount}</p>
              <p className="text-green-500 text-sm mt-1">Verfügbar</p>
            </div>
            <div className="flex-1 rounded-xl p-4 text-center" style={{ background: 'var(--muted-bg)', border: '1px solid var(--card-border)' }}>
              <p className="text-2xl font-bold" style={{ color: 'var(--muted)' }}>{usedCount}</p>
              <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>Verwendet</p>
            </div>
          </div>
        </div>

        {/* Neue Codes */}
        <div className="card rounded-2xl p-6 mb-4">
          <h2 className="font-bold text-lg mb-2" style={{ color: 'var(--foreground)' }}>Neue Codes generieren</h2>
          <p className="text-sm mb-4" style={{ color: 'var(--muted)' }}>⚠️ Alle alten Codes werden ungültig wenn du neue generierst!</p>
          <label className="text-sm font-medium block mb-1" style={{ color: 'var(--muted)' }}>Passwort zur Bestätigung</label>
          <input value={password} onChange={e => setPassword(e.target.value)} type="password"
            className="w-full rounded-xl px-4 py-2.5 mb-4 text-sm outline-none"
            style={{ background: 'var(--muted-bg)', border: '1px solid var(--card-border)', color: 'var(--foreground)' }} />
          <button onClick={handleGenerate} disabled={generating || !password}
            className="btn-gradient text-white px-6 py-2.5 rounded-xl text-sm font-medium disabled:opacity-50">
            {generating ? 'Generieren...' : '🔄 Neue Codes generieren'}
          </button>
        </div>

        {/* Codes anzeigen */}
        {showCodes && codes.length > 0 && (
          <div className="card rounded-2xl p-6" style={{ border: '1px solid rgba(234,179,8,0.4)' }}>
            <h2 className="font-bold text-lg mb-2" style={{ color: 'var(--foreground)' }}>🔑 Deine neuen Codes</h2>
            <p className="text-yellow-500 text-sm mb-4">Speichere diese Codes sicher ab – sie werden nur einmal angezeigt!</p>
            <div className="grid grid-cols-2 gap-2 mb-4">
              {codes.map((code, i) => (
                <div key={i} className="rounded-xl px-4 py-3 text-sm font-mono text-center font-bold tracking-wider"
                  style={{ background: 'var(--muted-bg)', border: '1px solid var(--card-border)', color: 'var(--foreground)' }}>
                  {code}
                </div>
              ))}
            </div>
            <button onClick={() => { navigator.clipboard.writeText(codes.join('\n')); setSuccess('Codes kopiert!') }}
              className="btn-gradient text-white px-4 py-2 rounded-xl text-sm font-medium">
              📋 Alle kopieren
            </button>
          </div>
        )}
      </div>
    </div>
  )
}