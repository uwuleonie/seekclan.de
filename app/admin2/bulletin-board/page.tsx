'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '../../lib/auth-context'
import { hasWriteAccess } from '../layout'
import { usePathname } from 'next/navigation'

type Board = {
  id: number
  title: string
  bullets: string[] | string
}

export default function BulletinBoardPage() {
  const { user } = useAuth()
  const pathname = usePathname()
  const canWrite = hasWriteAccess(user?.clan_role, pathname)

  const [board, setBoard] = useState<Board | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [title, setTitle] = useState('')
  const [bullets, setBullets] = useState<string[]>(['', '', '', '', '', '', '', ''])

  const load = () => {
    setLoading(true)
    fetch('/api/admin2/bulletin-board')
      .then(r => r.json())
      .then(d => {
        if (d.board) {
          setBoard(d.board)
          setTitle(d.board.title)
          const b = typeof d.board.bullets === 'string' ? JSON.parse(d.board.bullets) : d.board.bullets
          setBullets([...b, '', '', '', '', '', '', '', ''].slice(0, 8))
        }
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => { if (user) load() }, [user])

  const save = async () => {
    setSaving(true); setError(''); setSuccess('')
    const res = await fetch('/api/admin2/bulletin-board', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, bullets: bullets.filter(b => b.trim()) }),
    })
    setSaving(false)
    if (!res.ok) { const d = await res.json().catch(() => ({})); setError(d.error || 'Fehler'); return }
    setSuccess('Gespeichert! Ingame /reloadbulletinboard ausführen.')
    load()
  }

  const parsedBullets = board ? (typeof board.bullets === 'string' ? JSON.parse(board.bullets) : board.bullets) : []

  const inp = { background: 'var(--muted-bg)', border: '1px solid var(--card-border)', color: 'var(--foreground)', borderRadius: 8, padding: '8px 12px', width: '100%', fontSize: 14 }

  return (
    <div className="max-w-3xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-1" style={{ color: 'var(--foreground)' }}>📋 Schwarzes Brett</h1>
        <p style={{ color: 'var(--muted)' }}>6×3 Karten-Bild an der Lobby-Wand. Schwarzer Hintergrund, weißer Text, Seek-Logo.</p>
      </div>

      {!canWrite && <div className="mb-6 px-4 py-3 rounded-xl text-sm" style={{ background: 'var(--muted-bg)', color: 'var(--muted)', border: '1px solid var(--card-border)' }}>🔒 Nur Lesezugriff.</div>}

      {loading ? <p style={{ color: 'var(--muted)' }}>Laden...</p> : (
        <div className="space-y-6">

          {/* Editor */}
          <div className="rounded-2xl p-6 space-y-4" style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}>
            <h2 className="text-lg font-bold" style={{ color: 'var(--foreground)' }}>Inhalt bearbeiten</h2>
            <div>
              <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--muted)' }}>Titel</label>
              <input style={inp} value={title} onChange={e => setTitle(e.target.value)} placeholder="z.B. Update 1.4 — Neue Features!" disabled={!canWrite} />
            </div>
            <div>
              <label className="text-xs font-medium mb-2 block" style={{ color: 'var(--muted)' }}>Punkte (max. 8)</label>
              <div className="space-y-2">
                {bullets.map((b, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="text-sm w-5 text-center flex-shrink-0" style={{ color: 'var(--muted)' }}>{i + 1}.</span>
                    <input style={{ ...inp, flex: 1 }} value={b}
                      onChange={e => { const next = [...bullets]; next[i] = e.target.value; setBullets(next) }}
                      placeholder={`Punkt ${i + 1}...`} disabled={!canWrite} />
                  </div>
                ))}
              </div>
            </div>
            {error && <p className="text-sm" style={{ color: '#EF4444' }}>{error}</p>}
            {success && <p className="text-sm" style={{ color: '#22C55E' }}>{success}</p>}
            {canWrite && (
              <button onClick={save} disabled={saving || !title.trim()} className="w-full py-2.5 rounded-xl text-sm font-medium text-white"
                style={{ background: 'linear-gradient(135deg, #4F46E5, #7C3AED, #C026D3)', opacity: saving ? 0.7 : 1 }}>
                {saving ? 'Speichern...' : '💾 Speichern & auf Server senden'}
              </button>
            )}
          </div>

          {/* Vorschau (Text-basiert) */}
          {board && (
            <div className="rounded-2xl p-6" style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}>
              <h2 className="text-lg font-bold mb-4" style={{ color: 'var(--foreground)' }}>👁 Aktueller Inhalt</h2>
              {/* Schwarzes Brett Simulation */}
              <div className="rounded-xl p-6" style={{ background: '#000', border: '4px solid #1a1a2e', minHeight: 200 }}>
                <div className="flex items-center gap-4 mb-4 pb-4" style={{ borderBottom: '2px solid #333' }}>
                  <div className="w-12 h-12 rounded-full flex items-center justify-center font-bold text-white text-xl flex-shrink-0"
                    style={{ background: 'linear-gradient(135deg, #4F46E5, #7C3AED)' }}>S</div>
                  <div>
                    <p className="text-xs" style={{ color: '#6B7280' }}>seekclan.de</p>
                    <p className="font-bold text-lg text-white">{board.title}</p>
                  </div>
                </div>
                <div className="space-y-2">
                  {parsedBullets.map((b: string, i: number) => (
                    <p key={i} className="text-white text-sm">
                      <span style={{ color: '#A78BFA' }}>▸ </span>{b}
                    </p>
                  ))}
                </div>
                <p className="text-right text-xs mt-4" style={{ color: '#374151' }}>Seek The Clan</p>
              </div>
              <p className="text-xs mt-2" style={{ color: 'var(--muted)' }}>So sieht das Brett ingame aus (6×3 Karten, 768×384px).</p>
            </div>
          )}

          {/* Setup-Anleitung */}
          <div className="rounded-2xl p-6" style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}>
            <h2 className="text-lg font-bold mb-3" style={{ color: 'var(--foreground)' }}>⚙️ Ingame Setup</h2>
            <div className="space-y-2 text-sm" style={{ color: 'var(--muted)' }}>
              <p>1. Inhalt speichern (oben)</p>
              <p>2. Zur Wand gehen, auf die das Brett soll</p>
              <p>3. Untere linke Ecke anstehen:
                <code className="mx-1 px-1.5 py-0.5 rounded text-xs" style={{ background: 'var(--muted-bg)', color: 'var(--foreground)' }}>/bulletinboardpos1</code>
                (oder mit Koordinaten: /bulletinboardpos1 x y z)
              </p>
              <p>4. Obere rechte Ecke:
                <code className="mx-1 px-1.5 py-0.5 rounded text-xs" style={{ background: 'var(--muted-bg)', color: 'var(--foreground)' }}>/bulletinboardpos2</code>
              </p>
              <p>5. Brett erscheint automatisch (6 breit × 3 hoch)</p>
              <p className="pt-1">Nach Änderungen:
                <code className="mx-1 px-1.5 py-0.5 rounded text-xs" style={{ background: 'var(--muted-bg)', color: 'var(--foreground)' }}>/reloadbulletinboard</code>
              </p>
            </div>
          </div>

        </div>
      )}
    </div>
  )
}