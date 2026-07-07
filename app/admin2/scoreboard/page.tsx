'use client'

import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../../lib/auth-context'
import { hasWriteAccess } from '../layout'
import { usePathname } from 'next/navigation'

type LineType = 'static' | 'animated' | 'empty'

type ScoreboardLine = {
  id: string
  type: LineType
  text: string
  frames?: string[] // für animated: mehrere Texte
  interval?: number // Sekunden zwischen Frames
}

type ScoreboardConfig = {
  title: string
  lines: ScoreboardLine[]
}

const VARIABLES = [
  { key: '{name}', desc: 'Spielername' },
  { key: '{rang}', desc: 'Rang des Spielers' },
  { key: '{sternies}', desc: 'Sternies ✦' },
  { key: '{spielzeit}', desc: 'Gesamtspielzeit' },
  { key: '{streak}', desc: 'Login-Streak' },
  { key: '{online}', desc: 'Online-Spieler' },
]

const MC_COLORS = [
  { code: '§0', hex: '#000000', name: 'Schwarz' },
  { code: '§1', hex: '#0000AA', name: 'Dunkelblau' },
  { code: '§2', hex: '#00AA00', name: 'Dunkelgrün' },
  { code: '§3', hex: '#00AAAA', name: 'Dunkeltürkis' },
  { code: '§4', hex: '#AA0000', name: 'Dunkelrot' },
  { code: '§5', hex: '#AA00AA', name: 'Lila' },
  { code: '§6', hex: '#FFAA00', name: 'Gold' },
  { code: '§7', hex: '#AAAAAA', name: 'Grau' },
  { code: '§8', hex: '#555555', name: 'Dunkelgrau' },
  { code: '§9', hex: '#5555FF', name: 'Blau' },
  { code: '§a', hex: '#55FF55', name: 'Grün' },
  { code: '§b', hex: '#55FFFF', name: 'Türkis' },
  { code: '§c', hex: '#FF5555', name: 'Rot' },
  { code: '§d', hex: '#FF55FF', name: 'Pink' },
  { code: '§e', hex: '#FFFF55', name: 'Gelb' },
  { code: '§f', hex: '#FFFFFF', name: 'Weiß' },
]

const MC_FORMATS = [
  { code: '§l', name: 'Fett', style: 'font-weight: bold' },
  { code: '§o', name: 'Kursiv', style: 'font-style: italic' },
  { code: '§n', name: 'Unterstrichen', style: 'text-decoration: underline' },
  { code: '§m', name: 'Durchgestrichen', style: 'text-decoration: line-through' },
  { code: '§r', name: 'Reset', style: '' },
]

function renderMcText(text: string): React.ReactNode {
  // Einfaches §-Code Rendering für Preview
  const parts: { text: string; color: string; bold: boolean; italic: boolean }[] = []
  let currentColor = '#FFFFFF'
  let bold = false, italic = false
  let i = 0
  let currentText = ''

  while (i < text.length) {
    if (text[i] === '§' && i + 1 < text.length) {
      if (currentText) parts.push({ text: currentText, color: currentColor, bold, italic })
      currentText = ''
      const code = text[i + 1].toLowerCase()
      const colorMatch = MC_COLORS.find(c => c.code === '§' + code)
      if (colorMatch) { currentColor = colorMatch.hex; bold = false; italic = false }
      else if (code === 'l') bold = true
      else if (code === 'o') italic = true
      else if (code === 'r') { currentColor = '#FFFFFF'; bold = false; italic = false }
      i += 2
    } else {
      currentText += text[i]
      i++
    }
  }
  if (currentText) parts.push({ text: currentText, color: currentColor, bold, italic })

  return parts.map((p, idx) => (
    <span key={idx} style={{ color: p.color, fontWeight: p.bold ? 'bold' : 'normal', fontStyle: p.italic ? 'italic' : 'normal' }}>
      {p.text}
    </span>
  ))
}

function generateGradient(text: string, fromHex: string, toHex: string): string {
  const from = parseInt(fromHex.slice(1), 16)
  const to = parseInt(toHex.slice(1), 16)
  const fr = (from >> 16) & 0xFF, fg = (from >> 8) & 0xFF, fb = from & 0xFF
  const tr = (to >> 16) & 0xFF, tg = (to >> 8) & 0xFF, tb = to & 0xFF
  const chars = text.split('')
  if (chars.length === 0) return text
  return chars.map((ch, i) => {
    const t = chars.length === 1 ? 0 : i / (chars.length - 1)
    const r = Math.round(fr + (tr - fr) * t).toString(16).padStart(2, '0')
    const g = Math.round(fg + (tg - fg) * t).toString(16).padStart(2, '0')
    const b = Math.round(fb + (tb - fb) * t).toString(16).padStart(2, '0')
    return `§x§${r[0]}§${r[1]}§${g[0]}§${g[1]}§${b[0]}§${b[1]}${ch}`
  }).join('')
}

const defaultConfig: ScoreboardConfig = {
  title: '§5§l✦ Seek The Clan',
  lines: [
    { id: '1', type: 'static', text: '§7seekclan.de' },
    { id: '2', type: 'empty', text: '' },
    { id: '3', type: 'static', text: '§f{name}' },
    { id: '4', type: 'empty', text: '' },
    { id: '5', type: 'static', text: '§7Rang' },
    { id: '6', type: 'static', text: '§d✦ {rang}' },
    { id: '7', type: 'empty', text: '' },
    { id: '8', type: 'static', text: '§7Spielzeit' },
    { id: '9', type: 'static', text: '§f⏱ {spielzeit}' },
    { id: '10', type: 'empty', text: '' },
    { id: '11', type: 'static', text: '§7Sternies' },
    { id: '12', type: 'static', text: '§e✦ {sternies}' },
  ]
}

export default function ScoreboardEditorPage() {
  const { user } = useAuth()
  const pathname = usePathname()
  const canWrite = hasWriteAccess(user?.clan_role, pathname)

  const [config, setConfig] = useState<ScoreboardConfig>(defaultConfig)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')
  const [editingLine, setEditingLine] = useState<string | null>(null)
  const [showColorPicker, setShowColorPicker] = useState(false)
  const [showGradient, setShowGradient] = useState(false)
  const [gradientFrom, setGradientFrom] = useState('#4F46E5')
  const [gradientTo, setGradientTo] = useState('#C026D3')
  const [gradientText, setGradientText] = useState('')
  const [animFrame, setAnimFrame] = useState(0)

  // Animation preview
  useEffect(() => {
    const interval = setInterval(() => setAnimFrame(f => f + 1), 1000)
    return () => clearInterval(interval)
  }, [])

  const load = () => {
    setLoading(true)
    fetch('/api/admin2/scoreboard-config')
      .then(r => r.json())
      .then(d => {
        if (d.config) {
          const lines = typeof d.config.lines === 'string' ? JSON.parse(d.config.lines) : d.config.lines
          setConfig({ title: d.config.title, lines: lines.map((l: any, i: number) => ({ ...l, id: l.id || String(i + 1) })) })
        }
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => { if (user) load() }, [user])

  const save = async () => {
    setSaving(true); setError(''); setSuccess('')
    const res = await fetch('/api/admin2/scoreboard-config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    })
    setSaving(false)
    if (!res.ok) { setError('Fehler beim Speichern'); return }
    setSuccess('Gespeichert! Plugin lädt beim nächsten /seekreload.')
  }

  const addLine = (type: LineType) => {
    const id = Date.now().toString()
    setConfig(c => ({
      ...c,
      lines: [...c.lines, { id, type, text: type === 'empty' ? '' : '§f', frames: type === 'animated' ? ['§fFrame 1', '§eFrame 2'] : undefined, interval: 2 }]
    }))
    if (type !== 'empty') setEditingLine(id)
  }

  const removeLine = (id: string) => {
    setConfig(c => ({ ...c, lines: c.lines.filter(l => l.id !== id) }))
    if (editingLine === id) setEditingLine(null)
  }

  const moveLine = (id: string, dir: 'up' | 'down') => {
    setConfig(c => {
      const lines = [...c.lines]
      const idx = lines.findIndex(l => l.id === id)
      const newIdx = dir === 'up' ? idx - 1 : idx + 1
      if (newIdx < 0 || newIdx >= lines.length) return c
      ;[lines[idx], lines[newIdx]] = [lines[newIdx], lines[idx]]
      return { ...c, lines }
    })
  }

  const updateLine = (id: string, updates: Partial<ScoreboardLine>) => {
    setConfig(c => ({ ...c, lines: c.lines.map(l => l.id === id ? { ...l, ...updates } : l) }))
  }

  const insertCode = (id: string, code: string) => {
    const line = config.lines.find(l => l.id === id)
    if (!line) return
    updateLine(id, { text: line.text + code })
  }

  const applyGradient = (id: string) => {
    const result = generateGradient(gradientText, gradientFrom, gradientTo)
    const line = config.lines.find(l => l.id === id)
    if (!line) return
    updateLine(id, { text: line.text + result })
    setShowGradient(false)
  }

  const inp = { background: 'var(--muted-bg)', border: '1px solid var(--card-border)', color: 'var(--foreground)', borderRadius: 8, padding: '8px 12px', width: '100%', fontSize: 13 }
  const card = { background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 12, padding: '16px 20px' }
  const gradBtn = { background: 'linear-gradient(135deg, #4F46E5, #7C3AED, #C026D3)' }

  const getLinePreview = (line: ScoreboardLine) => {
    if (line.type === 'empty') return null
    if (line.type === 'animated' && line.frames?.length) {
      return line.frames[animFrame % line.frames.length]
    }
    return line.text
  }

  if (loading) return <p style={{ color: 'var(--muted)' }}>Laden...</p>

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-1" style={{ color: 'var(--foreground)' }}>📊 Scoreboard-Editor</h1>
        <p style={{ color: 'var(--muted)' }}>Design des Lobby-Scoreboards konfigurieren.</p>
      </div>

      <div className="grid gap-6" style={{ gridTemplateColumns: '1fr 320px' }}>

        {/* Editor links */}
        <div className="space-y-4">

          {/* Titel */}
          <div style={card}>
            <h2 className="text-sm font-bold mb-3" style={{ color: 'var(--foreground)' }}>Titel</h2>
            <input style={inp} value={config.title}
              onChange={e => setConfig(c => ({ ...c, title: e.target.value }))}
              placeholder="§5§l✦ Seek The Clan" disabled={!canWrite} />
          </div>

          {/* Zeilen */}
          <div style={card}>
            <h2 className="text-sm font-bold mb-3" style={{ color: 'var(--foreground)' }}>Zeilen (oben = erste Zeile)</h2>
            <div className="space-y-2">
              {config.lines.map((line, idx) => (
                <div key={line.id}>
                  <div className="flex items-center gap-2 p-2 rounded-lg" style={{ background: 'var(--muted-bg)', border: editingLine === line.id ? '1px solid #7C3AED' : '1px solid var(--card-border)' }}>
                    {/* Reihenfolge */}
                    <div className="flex flex-col gap-0.5 flex-shrink-0">
                      <button onClick={() => moveLine(line.id, 'up')} disabled={idx === 0} className="text-xs px-1" style={{ color: 'var(--muted)', opacity: idx === 0 ? 0.3 : 1 }}>▲</button>
                      <button onClick={() => moveLine(line.id, 'down')} disabled={idx === config.lines.length - 1} className="text-xs px-1" style={{ color: 'var(--muted)', opacity: idx === config.lines.length - 1 ? 0.3 : 1 }}>▼</button>
                    </div>

                    {/* Typ Badge */}
                    <span className="text-xs px-2 py-0.5 rounded flex-shrink-0" style={{
                      background: line.type === 'animated' ? '#4F46E520' : line.type === 'empty' ? '#33333320' : '#7C3AED20',
                      color: line.type === 'animated' ? '#818CF8' : line.type === 'empty' ? 'var(--muted)' : '#A78BFA'
                    }}>
                      {line.type === 'animated' ? '🎬' : line.type === 'empty' ? '—' : '📝'}
                    </span>

                    {/* Preview */}
                    <div className="flex-1 text-sm font-mono truncate" style={{ fontFamily: 'monospace', minHeight: 20 }}>
                      {line.type === 'empty' ? <span style={{ color: 'var(--muted)' }}>Leerzeile</span> : renderMcText(getLinePreview(line) || '')}
                    </div>

                    {canWrite && (
                      <div className="flex gap-1 flex-shrink-0">
                        {line.type !== 'empty' && (
                          <button onClick={() => setEditingLine(editingLine === line.id ? null : line.id)}
                            className="text-xs px-2 py-1 rounded" style={{ background: editingLine === line.id ? '#7C3AED' : 'var(--card-bg)', color: editingLine === line.id ? '#fff' : 'var(--muted)', border: '1px solid var(--card-border)' }}>
                            ✏️
                          </button>
                        )}
                        <button onClick={() => removeLine(line.id)} className="text-xs px-2 py-1 rounded" style={{ background: '#FEE2E2', color: '#EF4444' }}>✕</button>
                      </div>
                    )}
                  </div>

                  {/* Inline Editor */}
                  {editingLine === line.id && line.type !== 'empty' && (
                    <div className="mt-2 p-3 rounded-lg space-y-3" style={{ background: 'var(--card-bg)', border: '1px solid #7C3AED' }}>
                      {line.type === 'static' ? (
                        <div>
                          <label className="text-xs mb-1 block" style={{ color: 'var(--muted)' }}>Text</label>
                          <input style={inp} value={line.text} onChange={e => updateLine(line.id, { text: e.target.value })} />
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <label className="text-xs mb-1 block" style={{ color: 'var(--muted)' }}>Animations-Frames (einer pro Feld)</label>
                          {(line.frames || []).map((frame, fi) => (
                            <div key={fi} className="flex gap-2">
                              <input style={{ ...inp, flex: 1 }} value={frame}
                                onChange={e => { const f = [...(line.frames || [])]; f[fi] = e.target.value; updateLine(line.id, { frames: f }) }} />
                              <button onClick={() => { const f = (line.frames || []).filter((_, i) => i !== fi); updateLine(line.id, { frames: f }) }}
                                className="px-2 rounded" style={{ background: '#FEE2E2', color: '#EF4444' }}>✕</button>
                            </div>
                          ))}
                          <button onClick={() => updateLine(line.id, { frames: [...(line.frames || []), '§fNeuer Frame'] })}
                            className="text-xs px-3 py-1 rounded" style={{ background: 'var(--muted-bg)', color: 'var(--muted)', border: '1px solid var(--card-border)' }}>
                            + Frame
                          </button>
                          <div className="flex items-center gap-2">
                            <label className="text-xs" style={{ color: 'var(--muted)' }}>Intervall (Sek):</label>
                            <input type="number" min="1" max="30" value={line.interval || 2}
                              onChange={e => updateLine(line.id, { interval: parseInt(e.target.value) })}
                              style={{ ...inp, width: 60 }} />
                          </div>
                        </div>
                      )}

                      {/* Farben */}
                      <div>
                        <label className="text-xs mb-2 block" style={{ color: 'var(--muted)' }}>Farben einfügen</label>
                        <div className="flex flex-wrap gap-1">
                          {MC_COLORS.map(c => (
                            <button key={c.code} onClick={() => insertCode(line.id, c.code)}
                              title={c.name + ' ' + c.code}
                              className="w-6 h-6 rounded border-2 hover:scale-110 transition-transform"
                              style={{ background: c.hex, borderColor: '#333' }} />
                          ))}
                        </div>
                      </div>

                      {/* Formatierungen */}
                      <div>
                        <label className="text-xs mb-2 block" style={{ color: 'var(--muted)' }}>Formatierungen</label>
                        <div className="flex gap-1 flex-wrap">
                          {MC_FORMATS.map(f => (
                            <button key={f.code} onClick={() => insertCode(line.id, f.code)}
                              className="text-xs px-2 py-1 rounded" style={{ background: 'var(--muted-bg)', color: 'var(--foreground)', border: '1px solid var(--card-border)' }}>
                              {f.name}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Variablen */}
                      <div>
                        <label className="text-xs mb-2 block" style={{ color: 'var(--muted)' }}>Variablen</label>
                        <div className="flex gap-1 flex-wrap">
                          {VARIABLES.map(v => (
                            <button key={v.key} onClick={() => insertCode(line.id, v.key)}
                              title={v.desc}
                              className="text-xs px-2 py-1 rounded font-mono" style={{ background: '#4F46E520', color: '#818CF8', border: '1px solid #4F46E540' }}>
                              {v.key}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Farbverlauf */}
                      <div>
                        <button onClick={() => setShowGradient(s => !s)} className="text-xs px-3 py-1 rounded" style={{ background: 'linear-gradient(135deg, #4F46E5, #C026D3)', color: '#fff' }}>
                          🌈 Farbverlauf einfügen
                        </button>
                        {showGradient && (
                          <div className="mt-2 p-3 rounded-lg space-y-2" style={{ background: 'var(--muted-bg)', border: '1px solid var(--card-border)' }}>
                            <input style={inp} value={gradientText} onChange={e => setGradientText(e.target.value)} placeholder="Text für Farbverlauf" />
                            <div className="flex gap-2 items-center">
                              <div>
                                <label className="text-xs block mb-1" style={{ color: 'var(--muted)' }}>Von</label>
                                <input type="color" value={gradientFrom} onChange={e => setGradientFrom(e.target.value)} className="w-10 h-8 rounded cursor-pointer" />
                              </div>
                              <div>
                                <label className="text-xs block mb-1" style={{ color: 'var(--muted)' }}>Bis</label>
                                <input type="color" value={gradientTo} onChange={e => setGradientTo(e.target.value)} className="w-10 h-8 rounded cursor-pointer" />
                              </div>
                              <div className="flex-1 h-8 rounded mt-4" style={{ background: `linear-gradient(90deg, ${gradientFrom}, ${gradientTo})` }} />
                            </div>
                            <button onClick={() => applyGradient(line.id)} className="text-xs px-3 py-1 rounded text-white" style={gradBtn}>
                              Einfügen
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {canWrite && (
              <div className="flex gap-2 mt-4">
                <button onClick={() => addLine('static')} className="text-xs px-3 py-1.5 rounded-lg" style={{ background: 'var(--muted-bg)', color: 'var(--foreground)', border: '1px solid var(--card-border)' }}>+ Text</button>
                <button onClick={() => addLine('animated')} className="text-xs px-3 py-1.5 rounded-lg" style={{ background: 'var(--muted-bg)', color: 'var(--foreground)', border: '1px solid var(--card-border)' }}>+ Animation</button>
                <button onClick={() => addLine('empty')} className="text-xs px-3 py-1.5 rounded-lg" style={{ background: 'var(--muted-bg)', color: 'var(--foreground)', border: '1px solid var(--card-border)' }}>+ Leerzeile</button>
              </div>
            )}
          </div>

          {/* Speichern */}
          {canWrite && (
            <div>
              {error && <p className="text-sm mb-2" style={{ color: '#EF4444' }}>{error}</p>}
              {success && <p className="text-sm mb-2" style={{ color: '#22C55E' }}>{success}</p>}
              <button onClick={save} disabled={saving} className="w-full py-3 rounded-xl text-sm font-medium text-white" style={{ ...gradBtn, opacity: saving ? 0.7 : 1 }}>
                {saving ? 'Speichern...' : '💾 Speichern & anwenden'}
              </button>
            </div>
          )}
        </div>

        {/* Preview rechts */}
        <div className="sticky top-6">
          <div style={card}>
            <h2 className="text-sm font-bold mb-4" style={{ color: 'var(--foreground)' }}>👁 Vorschau</h2>
            {/* Minecraft Scoreboard Simulation */}
            <div className="rounded-lg overflow-hidden" style={{ background: '#1a1a1a', border: '2px solid #333', fontFamily: 'monospace', fontSize: 13 }}>
              {/* Titel */}
              <div className="px-3 py-2 text-center" style={{ background: '#2a2a2a', borderBottom: '1px solid #444' }}>
                {renderMcText(config.title)}
              </div>
              {/* Zeilen */}
              <div className="px-3 py-2 space-y-0.5">
                {config.lines.map((line, idx) => {
                  const preview = getLinePreview(line)
                  return (
                    <div key={line.id} className="flex justify-between items-center" style={{ minHeight: 18 }}>
                      <span>
                        {line.type === 'empty' ? '\u00a0' : renderMcText(preview || '')}
                      </span>
                      {line.type !== 'empty' && (
                        <span style={{ color: '#555', fontSize: 11 }}>{config.lines.length - idx}</span>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
            <p className="text-xs mt-2" style={{ color: 'var(--muted)' }}>Animationen laufen in Echtzeit. Variablen zeigen Platzhalter.</p>

            {/* Variablen-Referenz */}
            <div className="mt-4 pt-4" style={{ borderTop: '1px solid var(--card-border)' }}>
              <p className="text-xs font-medium mb-2" style={{ color: 'var(--muted)' }}>Verfügbare Variablen</p>
              <div className="space-y-1">
                {VARIABLES.map(v => (
                  <div key={v.key} className="flex items-center gap-2">
                    <code className="text-xs px-1.5 py-0.5 rounded" style={{ background: '#4F46E520', color: '#818CF8' }}>{v.key}</code>
                    <span className="text-xs" style={{ color: 'var(--muted)' }}>{v.desc}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}