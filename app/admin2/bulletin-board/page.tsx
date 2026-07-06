'use client'

import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../../lib/auth-context'
import { hasWriteAccess } from '../layout'
import { usePathname } from 'next/navigation'

type Board = {
  id: number
  title: string
  bullets: string[]
}

export default function BulletinBoardPage() {
  const { user } = useAuth()
  const pathname = usePathname()
  const canWrite = hasWriteAccess(user?.clan_role, pathname)

  const [board, setBoard] = useState<Board | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [previewing, setPreviewing] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [title, setTitle] = useState('')
  const [bullets, setBullets] = useState<string[]>(['', '', '', ''])
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  const load = () => {
    setLoading(true)
    fetch('/api/admin2/bulletin-board')
      .then(r => r.json())
      .then(d => {
        if (d.board) {
          setBoard(d.board)
          setTitle(d.board.title)
          const b = typeof d.board.bullets === 'string' ? JSON.parse(d.board.bullets) : d.board.bullets
          setBullets([...b, '', '', '', ''].slice(0, 8))
        }
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => { if (user) load() }, [user])

  const preview = async () => {
    setPreviewing(true)
    setPreviewUrl(null)
    const res = await fetch('/api/admin2/bulletin-board', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, bullets: bullets.filter(b => b.trim()) }),
    })
    if (res.ok) {
      const blob = await res.blob()
      setPreviewUrl(URL.createObjectURL(blob))
    }
    setPreviewing(false)
  }

  const save = async () => {
    setSaving(true)
    setError('')
    setSuccess('')
    const res = await fetch('/api/admin2/bulletin-board', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, bullets: bullets.filter(b => b.trim()) }),
    })
    setSaving(false)
    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      setError(d.error || 'Fehler beim Speichern')
      return
    }
    setSuccess('Gespeichert! Ingame /reloadbulletinboard ausführen um es auf die Karten zu laden.')
    load()
  }

  const inp = { background: 'var(--muted-bg)', border: '1px solid var(--card-border)', color: 'var(--foreground)', borderRadius: 8, padding: '8px 12px', width: '100%', fontSize: 14 }

  return (
    <div className="max-w-3xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-1" style={{ color: 'var(--foreground)' }}>📋 Schwarzes Brett</h1>
        <p style={{ color: 'var(--muted)' }}>6×3 Karten-Bild an der Lobby-Wand. Zeigt Updates und News für Spieler.</p>
      </div>

      {!canWrite && (
        <div className="mb-6 px-4 py-3 rounded-xl text-sm" style={{ background: 'var(--muted-bg)', color: 'var(--muted)', border: '1px solid var(--card-border)' }}>
          🔒 Nur Lesezugriff.
        </div>
      )}

      {loading ? <p style={{ color: 'var(--muted)' }}>Laden...</p> : (
        <div className="space-y-6">
          {/* Editor */}
          <div className="rounded-2xl p-6 space-y-4" style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}>
            <h2 className="text-lg font-bold" style={{ color: 'var(--foreground)' }}>Inhalt bearbeiten</h2>

            <div>
              <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--muted)' }}>Titel</label>
              <input style={inp} value={title} onChange={e => setTitle(e.target.value)}
                placeholder="z.B. Update 1.4 — Neue Features!" disabled={!canWrite} />
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
                    {canWrite && b && (
                      <button onClick={() => { const next = [...bullets]; next[i] = ''; setBullets(next) }}
                        className="text-xs px-2 py-1 rounded-lg flex-shrink-0"
                        style={{ background: 'var(--muted-bg)', color: 'var(--muted)', border: '1px solid var(--card-border)' }}>✕</button>
                    )}
                  </div>
                ))}
              </div>
              <p className="text-xs mt-2" style={{ color: 'var(--muted)' }}>Leere Felder werden ignoriert.</p>
            </div>

            {error && <p className="text-sm" style={{ color: '#EF4444' }}>{error}</p>}
            {success && <p className="text-sm" style={{ color: '#22C55E' }}>{success}</p>}

            {canWrite && (
              <div className="flex gap-3 pt-2">
                <button onClick={preview} disabled={previewing || !title.trim()}
                  className="px-5 py-2.5 rounded-xl text-sm font-medium"
                  style={{ background: 'var(--muted-bg)', color: 'var(--foreground)', border: '1px solid var(--card-border)', opacity: previewing ? 0.7 : 1 }}>
                  {previewing ? 'Vorschau...' : '👁 Vorschau'}
                </button>
                <button onClick={save} disabled={saving || !title.trim()}
                  className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white"
                  style={{ background: 'linear-gradient(135deg, #4F46E5, #7C3AED, #C026D3)', opacity: saving ? 0.7 : 1 }}>
                  {saving ? 'Speichern...' : '💾 Speichern & auf Server senden'}
                </button>
              </div>
            )}
          </div>

          {/* Vorschau */}
          {previewUrl && (
            <div className="rounded-2xl p-6" style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}>
              <h2 className="text-lg font-bold mb-4" style={{ color: 'var(--foreground)' }}>👁 Vorschau</h2>
              <img src={previewUrl} alt="Vorschau" className="w-full rounded-xl" style={{ imageRendering: 'pixelated', border: '1px solid var(--card-border)' }} />
              <p className="text-xs mt-2" style={{ color: 'var(--muted)' }}>So wird das Bild auf den Karten aussehen (768×384px, 6×3 Karten).</p>
            </div>
          )}

          {/* Ingame Setup */}
          <div className="rounded-2xl p-6" style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}>
            <h2 className="text-lg font-bold mb-3" style={{ color: 'var(--foreground)' }}>⚙️ Ingame Setup</h2>
            <div className="space-y-2 text-sm" style={{ color: 'var(--muted)' }}>
              <p>1. Zuerst speichern (oben)</p>
              <p>2. Ingame zur Wand gehen wo das Brett hängen soll</p>
              <p>3. <code className="px-1.5 py-0.5 rounded" style={{ background: 'var(--muted-bg)', color: 'var(--foreground)' }}>/setbulletinboard</code> ausführen (untere linke Ecke der Wand anschauen)</p>
              <p>4. Plugin platziert automatisch 18 Item Frames (6 breit × 3 hoch) mit den Karten</p>
              <p className="pt-1">Zum Aktualisieren nach Änderungen: <code className="px-1.5 py-0.5 rounded" style={{ background: 'var(--muted-bg)', color: 'var(--foreground)' }}>/reloadbulletinboard</code></p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}