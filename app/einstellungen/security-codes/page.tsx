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
  const [confirmed, setConfirmed] = useState(false)

  const fetchCodes = async () => {
    const res = await fetch('/api/settings/security-codes')
    const data = await res.json()
    if (res.ok) {
      setUsedCount(data.used_count)
      setConfirmed(false)
    }
  }

  useEffect(() => {
    if (user) fetchCodes()
  }, [user])

  const handleGenerate = async () => {
    setGenerating(true)
    setError('')
    setSuccess('')
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
    } catch {
      setError('Ein Fehler ist aufgetreten')
    }
    setGenerating(false)
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-900">Laden...</div>

  if (!user) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <p className="text-gray-500 mb-4">Du musst eingeloggt sein.</p>
        <Link href="/login" className="btn-gradient text-white px-6 py-3 rounded-xl">Einloggen</Link>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-8 py-10">
        <Link href="/einstellungen" className="text-gray-500 text-sm flex items-center gap-1 mb-8 hover:text-gray-700">← Zurück zu Einstellungen</Link>

        <h1 className="text-3xl font-bold mb-2 text-gray-900">Security Codes</h1>
        <p className="text-gray-500 mb-8">Nutze diese Codes um dein Passwort zurückzusetzen falls du es vergisst. Jeder Code kann nur einmal verwendet werden.</p>

        {error && <p className="text-red-500 text-sm mb-4 bg-red-50 px-4 py-2 rounded-xl">{error}</p>}
        {success && <p className="text-green-600 text-sm mb-4 bg-green-50 px-4 py-2 rounded-xl">{success}</p>}

        {/* Status */}
        <div className="bg-white rounded-2xl p-6 shadow-sm mb-4">
          <h2 className="font-bold text-lg mb-4 text-gray-900">Status</h2>
          <div className="flex gap-4">
            <div className="flex-1 bg-green-50 border border-green-200 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-green-700">{8 - usedCount}</p>
              <p className="text-green-600 text-sm mt-1">Verfügbar</p>
            </div>
            <div className="flex-1 bg-gray-50 border border-gray-200 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-gray-500">{usedCount}</p>
              <p className="text-gray-400 text-sm mt-1">Verwendet</p>
            </div>
          </div>
        </div>

        {/* Neue Codes generieren */}
        <div className="bg-white rounded-2xl p-6 shadow-sm mb-4">
          <h2 className="font-bold text-lg mb-2 text-gray-900">Neue Codes generieren</h2>
          <p className="text-gray-500 text-sm mb-4">⚠️ Alle alten Codes werden ungültig wenn du neue generierst!</p>

          <label className="text-sm font-medium text-gray-700 block mb-1">Passwort zur Bestätigung</label>
          <input value={password} onChange={e => setPassword(e.target.value)} type="password"
            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 mb-4 text-sm text-gray-900 outline-none focus:border-purple-400" />

          <button onClick={handleGenerate} disabled={generating || !password}
            className="btn-gradient text-white px-6 py-2.5 rounded-xl text-sm font-medium disabled:opacity-50">
            {generating ? 'Generieren...' : '🔄 Neue Codes generieren'}
          </button>
        </div>

        {/* Codes anzeigen */}
        {showCodes && codes.length > 0 && (
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-yellow-200">
            <h2 className="font-bold text-lg mb-2 text-gray-900">🔑 Deine neuen Codes</h2>
            <p className="text-yellow-600 text-sm mb-4">Speichere diese Codes sicher ab – sie werden nur einmal angezeigt!</p>
            <div className="grid grid-cols-2 gap-2 mb-4">
              {codes.map((code, i) => (
                <div key={i} className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-mono text-center text-gray-900 font-bold tracking-wider">
                  {code}
                </div>
              ))}
            </div>
            <button onClick={() => {
              navigator.clipboard.writeText(codes.join('\n'))
              setSuccess('Codes in Zwischenablage kopiert!')
            }}
              className="btn-gradient text-white px-4 py-2 rounded-xl text-sm font-medium">
              📋 Alle kopieren
            </button>
          </div>
        )}
      </div>
    </div>
  )
}