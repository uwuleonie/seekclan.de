'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useAuth } from '../lib/auth-context'

export default function VerifyAccountPage() {
  const { user, loading, refresh } = useAuth()
  const [code, setCode] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const handleLink = async () => {
    setSaving(true); setError(''); setSuccess('')
    try {
      const res = await fetch('/api/minecraft/link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error || 'Fehler')
      } else {
        setSuccess(`Erfolgreich mit ${json.minecraft_username} verknüpft! 🎉`)
        setCode('')
        refresh()
      }
    } catch {
      setError('Fehler')
    }
    setSaving(false)
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-12" style={{ color: 'var(--foreground)' }}>
      <p className="text-sm font-semibold mb-2" style={{
        background: 'linear-gradient(135deg, #4F46E5, #7C3AED, #C026D3)',
        WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent',
        letterSpacing: '0.05em',
      }}>
        ACCOUNT VERKNÜPFEN
      </p>
      <h1 className="text-3xl font-bold mb-3">Minecraft mit deinem Account verbinden</h1>
      <p className="mb-10" style={{ color: 'var(--muted)' }}>
        Erst mit verknüpftem Minecraft-Account kannst du Grundstücke claimen, dein Inventar einsehen und am Tippspiel teilnehmen. Das Verknüpfen dauert weniger als eine Minute.
      </p>

      <div className="space-y-4 mb-10">
        <div className="card rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-2">
            <span className="flex items-center justify-center w-8 h-8 rounded-full font-bold text-sm flex-shrink-0"
              style={{ background: 'linear-gradient(135deg, #4F46E5, #7C3AED, #C026D3)', color: 'white' }}>1</span>
            <h2 className="font-bold">Auf seekclan.de gehen!</h2>
          </div>
          <p className="text-sm" style={{ color: 'var(--muted)' }}>
            Noch nicht verbunden? Schau dir die <Link href="/join-server" className="underline">Anleitung zum Server-Beitritt</Link> an. Bist du schon auf dem Server, geht's direkt weiter.
          </p>
        </div>

        <div className="card rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-2">
            <span className="flex items-center justify-center w-8 h-8 rounded-full font-bold text-sm flex-shrink-0"
              style={{ background: 'linear-gradient(135deg, #4F46E5, #7C3AED, #C026D3)', color: 'white' }}>2</span>
            <h2 className="font-bold">Befehl im Minecraft-Chat eingeben</h2>
          </div>
          <p className="text-sm mb-3" style={{ color: 'var(--muted)' }}>
            Öffne im Spiel den Chat (Taste <code className="px-1.5 py-0.5 rounded" style={{ background: 'var(--muted-bg)' }}>T</code>) und tippe:
          </p>
          <div className="px-4 py-2.5 rounded-lg" style={{ background: 'var(--muted-bg)' }}>
            <code className="font-bold" style={{ color: 'var(--foreground)' }}>/link</code>
          </div>
        </div>

        <div className="card rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-2">
            <span className="flex items-center justify-center w-8 h-8 rounded-full font-bold text-sm flex-shrink-0"
              style={{ background: 'linear-gradient(135deg, #4F46E5, #7C3AED, #C026D3)', color: 'white' }}>3</span>
            <h2 className="font-bold">Code aus dem Chat kopieren</h2>
          </div>
          <p className="text-sm" style={{ color: 'var(--muted)' }}>
            Der Server antwortet im Chat mit einem 8-stelligen Code (z. B. <code className="px-1.5 py-0.5 rounded" style={{ background: 'var(--muted-bg)' }}>A1B2C3D4</code>). Der Code ist nur einige Minuten gültig — falls er abläuft, gib einfach erneut <code className="px-1.5 py-0.5 rounded" style={{ background: 'var(--muted-bg)' }}>/link</code> ein.
          </p>
        </div>

        <div className="card rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-2">
            <span className="flex items-center justify-center w-8 h-8 rounded-full font-bold text-sm flex-shrink-0"
              style={{ background: 'linear-gradient(135deg, #4F46E5, #7C3AED, #C026D3)', color: 'white' }}>4</span>
            <h2 className="font-bold">Code hier eingeben</h2>
          </div>

          {loading ? (
            <p className="text-sm" style={{ color: 'var(--muted)' }}>Lädt...</p>
          ) : !user ? (
            <div>
              <p className="text-sm mb-3" style={{ color: 'var(--muted)' }}>
                Du musst zuerst mit deinem Website-Account eingeloggt sein, bevor du einen Minecraft-Account verknüpfen kannst.
              </p>
              <Link href="/login" className="text-sm font-medium" style={{
                background: 'linear-gradient(135deg, #4F46E5, #7C3AED, #C026D3)',
                WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent',
              }}>
                Jetzt einloggen →
              </Link>
            </div>
          ) : user.minecraft_uuid ? (
            <p className="text-sm font-medium" style={{ color: '#16A34A' }}>
              ✅ Dein Account ist bereits mit Minecraft verknüpft.
            </p>
          ) : (
            <div>
              <p className="text-sm mb-3" style={{ color: 'var(--muted)' }}>
                Gib den 8-stelligen Code aus dem Chat ein:
              </p>
              <div className="flex gap-2 mb-2">
                <input
                  value={code}
                  onChange={e => setCode(e.target.value.toUpperCase())}
                  maxLength={8}
                  placeholder="XXXXXXXX"
                  className="flex-1 rounded-xl px-4 py-2.5 text-sm outline-none font-mono"
                  style={{ background: 'var(--muted-bg)', border: '1px solid var(--card-border)', color: 'var(--foreground)' }}
                />
                <button
                  onClick={handleLink}
                  disabled={saving || code.length < 6}
                  className="btn-gradient text-white px-6 py-2.5 rounded-xl text-sm font-medium disabled:opacity-50"
                >
                  Verknüpfen
                </button>
              </div>
              {error && <p className="text-sm" style={{ color: '#EF4444' }}>{error}</p>}
              {success && <p className="text-sm" style={{ color: '#16A34A' }}>{success}</p>}
            </div>
          )}
        </div>
      </div>

      <div className="rounded-2xl p-8 text-center" style={{ background: 'linear-gradient(135deg, #4F46E5, #7C3AED, #C026D3)' }}>
        <p className="text-white font-bold mb-1">Code kommt nicht an oder funktioniert nicht?</p>
        <p className="text-white/80 text-sm mb-4">Auf unserem Discord hilft dir die Community gerne weiter.</p>
        <a href="/discord" target="_blank" rel="noopener noreferrer" className="inline-block bg-white px-6 py-2.5 rounded-full font-medium text-sm" style={{ color: '#4F46E5' }}>
          Discord beitreten
        </a>
      </div>
    </div>
  )
}