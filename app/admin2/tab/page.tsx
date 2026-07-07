'use client'

import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '../../lib/auth-context'
import { hasWriteAccess } from '../layout'
import { usePathname } from 'next/navigation'

const MC_COLORS = [
  { code: '§0', hex: '#000000' }, { code: '§1', hex: '#0000AA' },
  { code: '§2', hex: '#00AA00' }, { code: '§3', hex: '#00AAAA' },
  { code: '§4', hex: '#AA0000' }, { code: '§5', hex: '#AA00AA' },
  { code: '§6', hex: '#FFAA00' }, { code: '§7', hex: '#AAAAAA' },
  { code: '§8', hex: '#555555' }, { code: '§9', hex: '#5555FF' },
  { code: '§a', hex: '#55FF55' }, { code: '§b', hex: '#55FFFF' },
  { code: '§c', hex: '#FF5555' }, { code: '§d', hex: '#FF55FF' },
  { code: '§e', hex: '#FFFF55' }, { code: '§f', hex: '#FFFFFF' },
]
const MC_FORMATS = ['§l', '§o', '§n', '§m', '§r']
const VARIABLES = [
  { key: '{online}', desc: 'Online-Spieler gesamt' },
  { key: '{lobby_online}', desc: 'Spieler in Lobby' },
  { key: '{smp_online}', desc: 'Spieler im SMP' },
  { key: '{name}', desc: 'Spielername' },
  { key: '{streak}', desc: 'Login-Streak' },
  { key: '{sternies}', desc: 'Sternies' },
]

function renderMcText(text: string): React.ReactNode {
  const parts: { text: string; color: string; bold: boolean; italic: boolean }[] = []
  let color = '#FFFFFF', bold = false, italic = false, current = '', i = 0
  while (i < text.length) {
    if (text[i] === '§' && i + 1 < text.length) {
      if (current) parts.push({ text: current, color, bold, italic })
      current = ''
      const c = text[i + 1].toLowerCase()
      const col = MC_COLORS.find(x => x.code === '§' + c)
      if (col) { color = col.hex; bold = false; italic = false }
      else if (c === 'l') bold = true
      else if (c === 'o') italic = true
      else if (c === 'r') { color = '#FFFFFF'; bold = false; italic = false }
      i += 2
    } else { current += text[i]; i++ }
  }
  if (current) parts.push({ text: current, color, bold, italic })
  return parts.map((p, idx) => (
    <span key={idx} style={{ color: p.color, fontWeight: p.bold ? 'bold' : 'normal', fontStyle: p.italic ? 'italic' : 'normal' }}>
      {p.text}
    </span>
  ))
}

function generateGradient(text: string, from: string, to: string): string {
  const f = parseInt(from.slice(1), 16), t = parseInt(to.slice(1), 16)
  const [fr, fg, fb] = [(f >> 16) & 0xFF, (f >> 8) & 0xFF, f & 0xFF]
  const [tr, tg, tb] = [(t >> 16) & 0xFF, (t >> 8) & 0xFF, t & 0xFF]
  return text.split('').map((ch, i) => {
    const p = text.length === 1 ? 0 : i / (text.length - 1)
    const r = Math.round(fr + (tr - fr) * p).toString(16).padStart(2, '0')
    const g = Math.round(fg + (tg - fg) * p).toString(16).padStart(2, '0')
    const b = Math.round(fb + (tb - fb) * p).toString(16).padStart(2, '0')
    return `§x§${r[0]}§${r[1]}§${g[0]}§${g[1]}§${b[0]}§${b[1]}${ch}`
  }).join('')
}

type LineConfig = { text: string; frames: string[]; interval: number; animated: boolean }

// ── Ausgelagerte Komponente (kein Re-render-Problem) ──────────────────────────
interface FieldEditorProps {
  label: string
  cfg: LineConfig
  onChange: (cfg: LineConfig) => void
  canWrite: boolean
}

function FieldEditor({ label, cfg, onChange, canWrite }: FieldEditorProps) {
  const [showGradient, setShowGradient] = useState(false)
  const [gradFrom, setGradFrom] = useState('#4F46E5')
  const [gradTo, setGradTo] = useState('#C026D3')
  const [gradText, setGradText] = useState('')

  const insert = (code: string) => onChange({ ...cfg, text: cfg.text + code })

  const inp = {
    background: 'var(--muted-bg)', border: '1px solid var(--card-border)',
    color: 'var(--foreground)', borderRadius: 8, padding: '8px 12px', width: '100%', fontSize: 13,
  }
  const gradBtn = { background: 'linear-gradient(135deg, #4F46E5, #7C3AED, #C026D3)' }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <span className="text-sm font-bold" style={{ color: 'var(--foreground)' }}>{label}</span>
        <label className="flex items-center gap-1.5 text-xs cursor-pointer" style={{ color: 'var(--muted)' }}>
          <input type="checkbox" checked={cfg.animated}
            onChange={e => onChange({ ...cfg, animated: e.target.checked })} />
          Animiert
        </label>
      </div>

      {!cfg.animated ? (
        <input
          style={inp}
          value={cfg.text}
          onChange={e => onChange({ ...cfg, text: e.target.value })}
          disabled={!canWrite}
          placeholder="§5§l✦ Text hier..."
        />
      ) : (
        <div className="space-y-2">
          {cfg.frames.map((frame, fi) => (
            <div key={fi} className="flex gap-2">
              <input style={{ ...inp, flex: 1 }} value={frame}
                onChange={e => {
                  const f = [...cfg.frames]
                  f[fi] = e.target.value
                  onChange({ ...cfg, frames: f })
                }}
                disabled={!canWrite} />
              <button onClick={() => onChange({ ...cfg, frames: cfg.frames.filter((_, i) => i !== fi) })}
                className="px-2 rounded" style={{ background: '#FEE2E2', color: '#EF4444' }}>✕</button>
            </div>
          ))}
          <button onClick={() => onChange({ ...cfg, frames: [...cfg.frames, '§fNeuer Frame'] })}
            className="text-xs px-3 py-1 rounded"
            style={{ background: 'var(--muted-bg)', color: 'var(--muted)', border: '1px solid var(--card-border)' }}>
            + Frame
          </button>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs" style={{ color: 'var(--muted)' }}>Intervall (Sek):</span>
            <input type="number" min="1" max="30" value={cfg.interval}
              onChange={e => onChange({ ...cfg, interval: parseInt(e.target.value) || 2 })}
              style={{ ...inp, width: 60 }} />
          </div>
        </div>
      )}

      {/* Farben */}
      <div className="flex flex-wrap gap-1">
        {MC_COLORS.map(c => (
          <button key={c.code} onClick={() => insert(c.code)} title={c.code}
            className="w-5 h-5 rounded border hover:scale-110 transition-transform"
            style={{ background: c.hex, borderColor: '#333' }} />
        ))}
        {MC_FORMATS.map(f => (
          <button key={f} onClick={() => insert(f)}
            className="text-xs px-1.5 py-0.5 rounded"
            style={{ background: 'var(--muted-bg)', color: 'var(--foreground)', border: '1px solid var(--card-border)' }}>
            {f}
          </button>
        ))}
      </div>

      {/* Variablen */}
      <div className="flex gap-1 flex-wrap">
        {VARIABLES.map(v => (
          <button key={v.key} onClick={() => insert(v.key)} title={v.desc}
            className="text-xs px-2 py-0.5 rounded font-mono"
            style={{ background: '#4F46E520', color: '#818CF8', border: '1px solid #4F46E540' }}>
            {v.key}
          </button>
        ))}
      </div>

      {/* Farbverlauf */}
      <div>
        <button onClick={() => setShowGradient(s => !s)}
          className="text-xs px-3 py-1 rounded text-white" style={gradBtn}>
          🌈 Farbverlauf
        </button>
        {showGradient && (
          <div className="mt-2 p-3 rounded-lg space-y-2"
            style={{ background: 'var(--muted-bg)', border: '1px solid var(--card-border)' }}>
            <input style={inp} value={gradText} onChange={e => setGradText(e.target.value)} placeholder="Text für Verlauf" />
            <div className="flex gap-2 items-center">
              <input type="color" value={gradFrom} onChange={e => setGradFrom(e.target.value)} className="w-10 h-8 rounded cursor-pointer" />
              <input type="color" value={gradTo} onChange={e => setGradTo(e.target.value)} className="w-10 h-8 rounded cursor-pointer" />
              <div className="flex-1 h-8 rounded" style={{ background: `linear-gradient(90deg, ${gradFrom}, ${gradTo})` }} />
            </div>
            <button onClick={() => { insert(generateGradient(gradText, gradFrom, gradTo)); setShowGradient(false) }}
              className="text-xs px-3 py-1 rounded text-white" style={gradBtn}>
              Einfügen
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Hauptkomponente ────────────────────────────────────────────────────────────
export default function TabEditorPage() {
  const { user } = useAuth()
  const pathname = usePathname()
  const canWrite = hasWriteAccess(user?.clan_role, pathname)

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')
  const [animFrame, setAnimFrame] = useState(0)

  const [header, setHeader] = useState<LineConfig>({
    text: '§5§l✦ Seek The Clan §r§7— §f{online} online',
    frames: [], interval: 2, animated: false,
  })
  const [footer, setFooter] = useState<LineConfig>({
    text: '§7seekclan.de',
    frames: [], interval: 2, animated: false,
  })

  useEffect(() => {
    const i = setInterval(() => setAnimFrame(f => f + 1), 1000)
    return () => clearInterval(i)
  }, [])

  const load = () => {
    setLoading(true)
    fetch('/api/admin2/tab-config').then(r => r.json()).then(d => {
      if (d.config) {
        const hf = typeof d.config.header_frames === 'string'
          ? JSON.parse(d.config.header_frames) : (d.config.header_frames || [])
        const ff = typeof d.config.footer_frames === 'string'
          ? JSON.parse(d.config.footer_frames) : (d.config.footer_frames || [])
        setHeader({ text: d.config.header, frames: hf, interval: 2, animated: hf.length > 0 })
        setFooter({ text: d.config.footer, frames: ff, interval: 2, animated: ff.length > 0 })
      }
    }).finally(() => setLoading(false))
  }
  useEffect(() => { if (user) load() }, [user])

  const save = async () => {
    setSaving(true); setError(''); setSuccess('')
    const res = await fetch('/api/admin2/tab-config', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        header: header.text, footer: footer.text,
        header_frames: header.frames, footer_frames: footer.frames,
      }),
    })
    setSaving(false)
    if (!res.ok) { setError('Fehler beim Speichern'); return }
    setSuccess('Gespeichert! Wird beim nächsten /seekreload aktiv.')
  }

  const getPreview = (cfg: LineConfig) => {
    if (cfg.animated && cfg.frames.length > 0) return cfg.frames[animFrame % cfg.frames.length]
    return cfg.text
  }

  const card = { background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 12, padding: '20px' }
  const gradBtn = { background: 'linear-gradient(135deg, #4F46E5, #7C3AED, #C026D3)' }

  if (loading) return <p style={{ color: 'var(--muted)' }}>Laden...</p>

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-1" style={{ color: 'var(--foreground)' }}>📋 Tab-Listen Editor</h1>
        <p style={{ color: 'var(--muted)' }}>Header und Footer der Tab-Liste konfigurieren.</p>
      </div>

      <div className="grid gap-6" style={{ gridTemplateColumns: '1fr 300px' }}>
        <div className="space-y-4">
          <div style={card}>
            <FieldEditor label="Header" cfg={header} onChange={setHeader} canWrite={canWrite} />
          </div>
          <div style={card}>
            <FieldEditor label="Footer" cfg={footer} onChange={setFooter} canWrite={canWrite} />
          </div>

          {error && <p className="text-sm" style={{ color: '#EF4444' }}>{error}</p>}
          {success && <p className="text-sm" style={{ color: '#22C55E' }}>{success}</p>}

          {canWrite && (
            <button onClick={save} disabled={saving}
              className="w-full py-3 rounded-xl text-sm font-medium text-white"
              style={{ ...gradBtn, opacity: saving ? 0.7 : 1 }}>
              {saving ? 'Speichern...' : '💾 Speichern'}
            </button>
          )}
        </div>

        {/* Preview */}
        <div className="sticky top-6">
          <div style={card}>
            <h2 className="text-sm font-bold mb-4" style={{ color: 'var(--foreground)' }}>👁 Vorschau</h2>
            <div className="rounded-lg overflow-hidden"
              style={{ background: '#1a1a1a', border: '2px solid #333', fontFamily: 'monospace', fontSize: 12 }}>
              <div className="px-3 py-2 text-center" style={{ background: '#2a2a2a', borderBottom: '1px solid #444' }}>
                {renderMcText(getPreview(header))}
              </div>
              <div className="px-3 py-4 space-y-1" style={{ minHeight: 80 }}>
                {['EmilyThorne', 'BARanInt', 'pingplus'].map(p => (
                  <div key={p} className="text-xs" style={{ color: '#aaa' }}>🟢 {p}</div>
                ))}
              </div>
              <div className="px-3 py-2 text-center" style={{ background: '#2a2a2a', borderTop: '1px solid #444' }}>
                {renderMcText(getPreview(footer))}
              </div>
            </div>
            <p className="text-xs mt-2" style={{ color: 'var(--muted)' }}>Animationen laufen in Echtzeit.</p>

            <div className="mt-4 pt-4 space-y-1" style={{ borderTop: '1px solid var(--card-border)' }}>
              <p className="text-xs font-medium mb-2" style={{ color: 'var(--muted)' }}>Variablen</p>
              {VARIABLES.map(v => (
                <div key={v.key} className="flex gap-2 items-center">
                  <code className="text-xs px-1.5 py-0.5 rounded" style={{ background: '#4F46E520', color: '#818CF8' }}>{v.key}</code>
                  <span className="text-xs" style={{ color: 'var(--muted)' }}>{v.desc}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}