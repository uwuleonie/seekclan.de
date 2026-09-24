'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '../../lib/auth-context'
import { hasWriteAccess } from '../layout'
import { usePathname } from 'next/navigation'

type LineType = 'static' | 'animated' | 'empty'
type ScoreboardLine = { id: string; type: LineType; text: string; frames?: string[]; interval?: number }
type ScoreboardConfig = { title: string; lines: ScoreboardLine[] }
type Rank = { id: number; name: string; display_name: string; priority: number; is_default: boolean }

const MAX_LINES = 15

const SERVERS = [
  { id: 'lobby',  label: '🏠 Lobby 1', color: '#7C3AED' },
  { id: 'lobby2', label: '🏠 Lobby 2', color: '#7C3AED' },
  { id: 'smp',    label: '⚔️ SMP',     color: '#16A34A' },
]

// Alle Variablen, die das Plugin SeekScoreboard wirklich ersetzt (auf jedem Server)
const VARIABLES: { key: string; desc: (server: string) => string; sample: string }[] = [
  { key: '{name}',           desc: () => 'Spielername',                                    sample: '' },
  { key: '{rang}',           desc: () => 'Rang des Spielers (aus SeekRanks, mit Farbe)',   sample: '' },
  { key: '{sternies}',       desc: () => 'Sternies',                                       sample: '1.250' },
  { key: '{streak}',         desc: () => 'Login-Streak',                                   sample: '7' },
  { key: '{spielzeit}',      desc: s => s === 'smp' ? 'SMP-Spielzeit' : 'Gesamt-Spielzeit (Lobby + SMP)', sample: '12h 30min' },
  { key: '{playtime_lobby}', desc: () => 'Lobby-Spielzeit',                                sample: '4h 10min' },
  { key: '{playtime_smp}',   desc: () => 'SMP-Spielzeit',                                  sample: '8h 20min' },
  { key: '{online}',         desc: () => 'Spieler auf diesem Server',                      sample: '5' },
  { key: '{ping}',           desc: () => 'Ping in ms',                                     sample: '23' },
  { key: '{time}',           desc: () => 'Ingame-Uhrzeit',                                 sample: '14:30' },
  { key: '{x}',              desc: () => 'X-Koordinate',                                   sample: '120' },
  { key: '{y}',              desc: () => 'Y-Koordinate',                                   sample: '64' },
  { key: '{z}',              desc: () => 'Z-Koordinate',                                   sample: '-340' },
  { key: '{quest1_bar}',     desc: () => 'Quest 1 Fortschritt (Platzhalter)',             sample: '░░░░░░░░░░' },
  { key: '{quest2_bar}',     desc: () => 'Quest 2 Fortschritt (Platzhalter)',             sample: '░░░░░░░░░░' },
]

const MC_COLORS = [
  { code: '§0', hex: '#000000', name: 'Schwarz' }, { code: '§1', hex: '#0000AA', name: 'Dunkelblau' },
  { code: '§2', hex: '#00AA00', name: 'Dunkelgrün' }, { code: '§3', hex: '#00AAAA', name: 'Dunkeltürkis' },
  { code: '§4', hex: '#AA0000', name: 'Dunkelrot' }, { code: '§5', hex: '#AA00AA', name: 'Lila' },
  { code: '§6', hex: '#FFAA00', name: 'Gold' }, { code: '§7', hex: '#AAAAAA', name: 'Grau' },
  { code: '§8', hex: '#555555', name: 'Dunkelgrau' }, { code: '§9', hex: '#5555FF', name: 'Blau' },
  { code: '§a', hex: '#55FF55', name: 'Grün' }, { code: '§b', hex: '#55FFFF', name: 'Türkis' },
  { code: '§c', hex: '#FF5555', name: 'Rot' }, { code: '§d', hex: '#FF55FF', name: 'Pink' },
  { code: '§e', hex: '#FFFF55', name: 'Gelb' }, { code: '§f', hex: '#FFFFFF', name: 'Weiß' },
]
const MC_FORMATS = [
  { code: '§l', name: 'Fett' }, { code: '§o', name: 'Kursiv' },
  { code: '§n', name: 'Unterstrichen' }, { code: '§m', name: 'Durchgestrichen' }, { code: '§r', name: 'Reset' },
]

// Rendert Minecraft-Text inkl. Hex-Farben im Format §x§R§R§G§G§B§B (wie das Plugin)
function renderMcText(text: string): React.ReactNode {
  type Part = { text: string; color: string; bold: boolean; italic: boolean; underline: boolean; strike: boolean }
  const parts: Part[] = []
  let color = '#FFFFFF', bold = false, italic = false, underline = false, strike = false, current = '', i = 0
  const push = () => { if (current) parts.push({ text: current, color, bold, italic, underline, strike }); current = '' }
  while (i < text.length) {
    if (text[i] === '§' && i + 1 < text.length) {
      const c = text[i + 1].toLowerCase()
      if (c === 'x' && i + 13 < text.length) {
        let hex = '', ok = true
        for (let k = 0; k < 6; k++) {
          const sec = text[i + 2 + k * 2], digit = text[i + 3 + k * 2]
          if (sec !== '§' || !/[0-9a-fA-F]/.test(digit || '')) { ok = false; break }
          hex += digit
        }
        if (ok) {
          push(); color = '#' + hex; bold = italic = underline = strike = false
          i += 14; continue
        }
      }
      push()
      const col = MC_COLORS.find(x => x.code === '§' + c)
      if (col) { color = col.hex; bold = italic = underline = strike = false }
      else if (c === 'l') bold = true
      else if (c === 'o') italic = true
      else if (c === 'n') underline = true
      else if (c === 'm') strike = true
      else if (c === 'r') { color = '#FFFFFF'; bold = italic = underline = strike = false }
      i += 2
    } else { current += text[i]; i++ }
  }
  push()
  return parts.map((p, idx) => (
    <span key={idx} style={{
      color: p.color, fontWeight: p.bold ? 'bold' : 'normal', fontStyle: p.italic ? 'italic' : 'normal',
      textDecoration: [p.underline ? 'underline' : '', p.strike ? 'line-through' : ''].join(' ').trim() || 'none',
    }}>{p.text}</span>
  ))
}

function generateGradient(text: string, fromHex: string, toHex: string): string {
  const from = parseInt(fromHex.slice(1), 16), to = parseInt(toHex.slice(1), 16)
  const fr = (from >> 16) & 0xFF, fg = (from >> 8) & 0xFF, fb = from & 0xFF
  const tr = (to >> 16) & 0xFF, tg = (to >> 8) & 0xFF, tb = to & 0xFF
  return text.split('').map((ch, i) => {
    const t = text.length === 1 ? 0 : i / (text.length - 1)
    const r = Math.round(fr + (tr - fr) * t).toString(16).padStart(2, '0')
    const g = Math.round(fg + (tg - fg) * t).toString(16).padStart(2, '0')
    const b = Math.round(fb + (tb - fb) * t).toString(16).padStart(2, '0')
    return `§x§${r[0]}§${r[1]}§${g[0]}§${g[1]}§${b[0]}§${b[1]}${ch}`
  }).join('')
}

// Nur als Startvorlage, wenn fuer einen Server noch nichts gespeichert ist
const TEMPLATE_CONFIGS: Record<string, ScoreboardConfig> = {
  lobby: {
    title: '§5§l✦ Seek The Clan',
    lines: [
      { id: '1', type: 'static', text: '§7seekclan.de' },
      { id: '2', type: 'empty', text: '' },
      { id: '3', type: 'static', text: '§f{name}' },
      { id: '4', type: 'static', text: '§7Rang: {rang}' },
    ],
  },
  lobby2: {
    title: '§5§l✦ Seek The Clan',
    lines: [
      { id: '1', type: 'static', text: '§7seekclan.de' },
      { id: '2', type: 'empty', text: '' },
      { id: '3', type: 'static', text: '§f{name}' },
      { id: '4', type: 'static', text: '§7Rang: {rang}' },
    ],
  },
  smp: {
    title: '§a§lSeekClan §r§7SMP',
    lines: [
      { id: '1', type: 'static', text: '§7seekclan.de' },
      { id: '2', type: 'empty', text: '' },
      { id: '3', type: 'static', text: '§f{name}' },
      { id: '4', type: 'static', text: '§7Rang: {rang}' },
    ],
  },
}

export default function ScoreboardEditorPage() {
  const { user } = useAuth()
  const pathname = usePathname()
  const canWrite = hasWriteAccess(user?.clan_role, pathname)

  const [activeServer, setActiveServer] = useState('lobby')
  const [configs, setConfigs] = useState<Record<string, ScoreboardConfig>>(TEMPLATE_CONFIGS)
  const [savedServers, setSavedServers] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')
  const [editingLine, setEditingLine] = useState<string | null>(null)
  const [showGradient, setShowGradient] = useState(false)
  const [gradFrom, setGradFrom] = useState('#4F46E5')
  const [gradTo, setGradTo] = useState('#C026D3')
  const [gradText, setGradText] = useState('')
  const [tick, setTick] = useState(0)
  const [ranks, setRanks] = useState<Rank[]>([])
  const [previewRankId, setPreviewRankId] = useState<number | null>(null)
  const [previewName, setPreviewName] = useState('')

  // Wie im Plugin: jede Sekunde ein Tick
  useEffect(() => {
    const iv = setInterval(() => setTick(t => t + 1), 1000)
    return () => clearInterval(iv)
  }, [])

  const load = async () => {
    setLoading(true); setLoadError('')
    try {
      const res = await fetch('/api/admin2/scoreboard-config')
      if (!res.ok) { setLoadError(`Config konnte nicht geladen werden (HTTP ${res.status}).`); return }
      const d = await res.json()
      const newConfigs = { ...TEMPLATE_CONFIGS }
      const saved = new Set<string>()
      for (const [server, cfg] of Object.entries((d.configs || {}) as Record<string, any>)) {
        const lines = typeof cfg.lines === 'string' ? JSON.parse(cfg.lines) : (cfg.lines || [])
        newConfigs[server] = {
          title: cfg.title,
          lines: lines.map((l: any, idx: number) => ({
            id: l.id || `${Date.now()}_${idx}`,
            type: l.type || 'static',
            text: l.text || '',
            frames: l.frames && l.frames.length ? l.frames : undefined,
            interval: l.interval || 2,
          })),
        }
        saved.add(server)
      }
      setConfigs(newConfigs)
      setSavedServers(saved)

      // Raenge fuer die Vorschau von {rang}
      const r = await fetch('/api/admin2/ranks')
      if (r.ok) {
        const rd = await r.json()
        const list: Rank[] = rd.ranks || []
        setRanks(list)
        const def = list.find(x => x.is_default) || list[0]
        if (def) setPreviewRankId(def.id)
      }
    } catch (e: any) {
      setLoadError('Config konnte nicht geladen werden: ' + (e?.message || e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { if (user) { load(); setPreviewName(user.username || 'Spieler') } }, [user])

  const config = configs[activeServer] || TEMPLATE_CONFIGS[activeServer]
  const setConfig = (updater: (c: ScoreboardConfig) => ScoreboardConfig) => {
    setConfigs(prev => ({ ...prev, [activeServer]: updater(prev[activeServer] || TEMPLATE_CONFIGS[activeServer]) }))
  }

  const save = async () => {
    setSaving(true); setError(''); setSuccess('')
    const res = await fetch('/api/admin2/scoreboard-config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...config, server_name: activeServer }),
    })
    setSaving(false)
    if (!res.ok) { setError('Fehler beim Speichern'); return }
    setSavedServers(prev => new Set(prev).add(activeServer))
    setSuccess(`Gespeichert für ${SERVERS.find(s => s.id === activeServer)?.label}! Ingame aktiv innerhalb von ca. 30 Sekunden (sofort mit /seekscoreboardreload).`)
  }

  const addLine = (type: LineType) => {
    if (config.lines.length >= MAX_LINES) return
    const id = Date.now().toString()
    setConfig(c => ({ ...c, lines: [...c.lines, { id, type, text: type === 'empty' ? '' : '§f', frames: type === 'animated' ? ['§fFrame 1', '§eFrame 2'] : undefined, interval: 2 }] }))
    if (type !== 'empty') setEditingLine(id)
  }
  const removeLine = (id: string) => { setConfig(c => ({ ...c, lines: c.lines.filter(l => l.id !== id) })); if (editingLine === id) setEditingLine(null) }
  const moveLine = (id: string, dir: 'up' | 'down') => {
    setConfig(c => {
      const lines = [...c.lines], idx = lines.findIndex(l => l.id === id), newIdx = dir === 'up' ? idx - 1 : idx + 1
      if (newIdx < 0 || newIdx >= lines.length) return c
      ;[lines[idx], lines[newIdx]] = [lines[newIdx], lines[idx]]
      return { ...c, lines }
    })
  }
  const updateLine = (id: string, updates: Partial<ScoreboardLine>) => setConfig(c => ({ ...c, lines: c.lines.map(l => l.id === id ? { ...l, ...updates } : l) }))
  const insertCode = (id: string, code: string) => { const line = config.lines.find(l => l.id === id); if (line) updateLine(id, { text: line.text + code }) }

  // Rohtext einer Zeile (Animation mit Intervall wie im Plugin)
  const getLineRaw = (line: ScoreboardLine) => {
    if (line.type === 'empty') return ''
    if (line.type === 'animated' && line.frames?.length) {
      const interval = Math.max(1, line.interval || 2)
      return line.frames[Math.floor(tick / interval) % line.frames.length]
    }
    return line.text
  }

  // Variablen mit Beispielwerten ersetzen (fuer die Vorschau)
  const previewRank = ranks.find(r => r.id === previewRankId)
  const resolvePreview = (text: string) => {
    let out = text
    for (const v of VARIABLES) {
      let value = v.sample
      if (v.key === '{name}') value = previewName || 'Spieler'
      if (v.key === '{rang}') value = previewRank ? previewRank.display_name + '§r' : '§7-'
      out = out.split(v.key).join(value)
    }
    return out
  }

  const inp = { background: 'var(--muted-bg)', border: '1px solid var(--card-border)', color: 'var(--foreground)', borderRadius: 8, padding: '8px 12px', width: '100%', fontSize: 13 }
  const card = { background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 12, padding: '16px 20px' }
  const gradBtn = { background: 'linear-gradient(135deg, #4F46E5, #7C3AED, #C026D3)' }
  const activeServerObj = SERVERS.find(s => s.id === activeServer)!
  const isSaved = savedServers.has(activeServer)

  if (loading) return <p style={{ color: 'var(--muted)' }}>Laden...</p>

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-1" style={{ color: 'var(--foreground)' }}>📊 Scoreboard-Editor</h1>
        <p style={{ color: 'var(--muted)' }}>Scoreboard pro Server konfigurieren. Die Vorschau zeigt genau das, was ingame angezeigt wird.</p>
      </div>

      {loadError && (
        <div className="mb-4 px-4 py-3 rounded-xl text-sm" style={{ background: '#450a0a', color: '#fca5a5' }}>
          {loadError} Die angezeigten Zeilen sind NICHT die ingame-Config.
        </div>
      )}

      {/* Server-Tabs */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {SERVERS.map(s => (
          <button key={s.id} onClick={() => { setActiveServer(s.id); setEditingLine(null) }}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-all"
            style={{
              background: activeServer === s.id ? s.color : 'var(--muted-bg)',
              color: activeServer === s.id ? '#fff' : 'var(--muted)',
              border: `1px solid ${activeServer === s.id ? s.color : 'var(--card-border)'}`,
            }}>
            {s.label}{!savedServers.has(s.id) && ' •'}
          </button>
        ))}
        <div className="ml-auto flex gap-2">
          <button
            onClick={() => {
              navigator.clipboard.writeText(JSON.stringify(config))
              setSuccess('Config kopiert!')
              setTimeout(() => setSuccess(''), 2000)
            }}
            className="px-3 py-2 rounded-lg text-sm"
            style={{ background: 'var(--muted-bg)', color: 'var(--muted)', border: '1px solid var(--card-border)' }}>
            📋 Config kopieren
          </button>
          <button
            onClick={async () => {
              try {
                const parsed = JSON.parse(await navigator.clipboard.readText())
                if (parsed.title && Array.isArray(parsed.lines)) {
                  setConfigs(prev => ({ ...prev, [activeServer]: parsed }))
                  setSuccess('Config eingefügt! (noch nicht gespeichert)')
                  setTimeout(() => setSuccess(''), 2500)
                } else setError('Ungültige Config in Zwischenablage')
              } catch { setError('Keine gültige Config in der Zwischenablage') }
            }}
            className="px-3 py-2 rounded-lg text-sm"
            style={{ background: 'var(--muted-bg)', color: 'var(--muted)', border: '1px solid var(--card-border)' }}>
            📥 Config einfügen
          </button>
        </div>
      </div>

      {!isSaved && !loadError && (
        <div className="mb-4 px-4 py-3 rounded-xl text-sm" style={{ background: '#422006', color: '#fcd34d' }}>
          Für {activeServerObj.label} ist noch keine Config gespeichert. Das hier ist nur eine Vorlage, ingame wird aktuell nichts angezeigt.
        </div>
      )}

      <div className="grid gap-6" style={{ gridTemplateColumns: '1fr 340px' }}>
        {/* Editor links */}
        <div className="space-y-4">
          <div style={card}>
            <h2 className="text-sm font-bold mb-3" style={{ color: 'var(--foreground)' }}>Titel</h2>
            <input style={inp} value={config.title} onChange={e => setConfig(c => ({ ...c, title: e.target.value }))} disabled={!canWrite} />
          </div>

          <div style={card}>
            <h2 className="text-sm font-bold mb-3" style={{ color: 'var(--foreground)' }}>
              Zeilen <span className="font-normal text-xs" style={{ color: 'var(--muted)' }}>({config.lines.length}/{MAX_LINES})</span>
            </h2>
            <div className="space-y-2">
              {config.lines.map((line, idx) => (
                <div key={line.id}>
                  <div className="flex items-center gap-2 p-2 rounded-lg" style={{ background: 'var(--muted-bg)', border: editingLine === line.id ? `1px solid ${activeServerObj.color}` : '1px solid var(--card-border)' }}>
                    <div className="flex flex-col gap-0.5 flex-shrink-0">
                      <button onClick={() => moveLine(line.id, 'up')} disabled={idx === 0 || !canWrite} className="text-xs px-1" style={{ color: 'var(--muted)', opacity: idx === 0 ? 0.3 : 1 }}>▲</button>
                      <button onClick={() => moveLine(line.id, 'down')} disabled={idx === config.lines.length - 1 || !canWrite} className="text-xs px-1" style={{ color: 'var(--muted)', opacity: idx === config.lines.length - 1 ? 0.3 : 1 }}>▼</button>
                    </div>
                    <span className="text-xs px-2 py-0.5 rounded flex-shrink-0" style={{ background: line.type === 'animated' ? '#4F46E520' : line.type === 'empty' ? '#33333320' : '#7C3AED20', color: line.type === 'animated' ? '#818CF8' : line.type === 'empty' ? 'var(--muted)' : '#A78BFA' }}>
                      {line.type === 'animated' ? '🎬' : line.type === 'empty' ? '—' : '📝'}
                    </span>
                    <div className="flex-1 text-sm font-mono truncate px-2 py-0.5 rounded" style={{ minHeight: 20, background: '#1a1a1a' }}>
                      {line.type === 'empty' ? <span style={{ color: '#666' }}>Leerzeile</span> : renderMcText(getLineRaw(line))}
                    </div>
                    {canWrite && (
                      <div className="flex gap-1 flex-shrink-0">
                        {line.type !== 'empty' && (
                          <button onClick={() => setEditingLine(editingLine === line.id ? null : line.id)}
                            className="text-xs px-2 py-1 rounded" style={{ background: editingLine === line.id ? activeServerObj.color : 'var(--card-bg)', color: editingLine === line.id ? '#fff' : 'var(--muted)', border: '1px solid var(--card-border)' }}>
                            ✏️
                          </button>
                        )}
                        <button onClick={() => removeLine(line.id)} className="text-xs px-2 py-1 rounded" style={{ background: '#FEE2E2', color: '#EF4444' }}>✕</button>
                      </div>
                    )}
                  </div>

                  {editingLine === line.id && line.type !== 'empty' && (
                    <div className="mt-2 p-3 rounded-lg space-y-3" style={{ background: 'var(--card-bg)', border: `1px solid ${activeServerObj.color}` }}>
                      {line.type === 'static' ? (
                        <div>
                          <label className="text-xs mb-1 block" style={{ color: 'var(--muted)' }}>Text</label>
                          <input style={inp} value={line.text} onChange={e => updateLine(line.id, { text: e.target.value })} />
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <label className="text-xs mb-1 block" style={{ color: 'var(--muted)' }}>Animations-Frames</label>
                          {(line.frames || []).map((frame, fi) => (
                            <div key={fi} className="flex gap-2">
                              <input style={{ ...inp, flex: 1 }} value={frame} onChange={e => { const f = [...(line.frames || [])]; f[fi] = e.target.value; updateLine(line.id, { frames: f }) }} />
                              <button onClick={() => updateLine(line.id, { frames: (line.frames || []).filter((_, i) => i !== fi) })} className="px-2 rounded" style={{ background: '#FEE2E2', color: '#EF4444' }}>✕</button>
                            </div>
                          ))}
                          <button onClick={() => updateLine(line.id, { frames: [...(line.frames || []), '§fNeuer Frame'] })} className="text-xs px-3 py-1 rounded" style={{ background: 'var(--muted-bg)', color: 'var(--muted)', border: '1px solid var(--card-border)' }}>+ Frame</button>
                          <div className="flex items-center gap-2">
                            <label className="text-xs" style={{ color: 'var(--muted)' }}>Wechsel alle (Sek):</label>
                            <input type="number" min="1" max="30" value={line.interval || 2} onChange={e => updateLine(line.id, { interval: Math.max(1, parseInt(e.target.value) || 2) })} style={{ ...inp, width: 70 }} />
                          </div>
                        </div>
                      )}
                      <div>
                        <label className="text-xs mb-2 block" style={{ color: 'var(--muted)' }}>Farben</label>
                        <div className="flex flex-wrap gap-1">
                          {MC_COLORS.map(c => (<button key={c.code} onClick={() => insertCode(line.id, c.code)} title={c.name} className="w-6 h-6 rounded border-2 hover:scale-110 transition-transform" style={{ background: c.hex, borderColor: '#333' }} />))}
                        </div>
                      </div>
                      <div>
                        <label className="text-xs mb-2 block" style={{ color: 'var(--muted)' }}>Formatierungen</label>
                        <div className="flex gap-1 flex-wrap">
                          {MC_FORMATS.map(f => (<button key={f.code} onClick={() => insertCode(line.id, f.code)} className="text-xs px-2 py-1 rounded" style={{ background: 'var(--muted-bg)', color: 'var(--foreground)', border: '1px solid var(--card-border)' }}>{f.name}</button>))}
                        </div>
                      </div>
                      <div>
                        <label className="text-xs mb-2 block" style={{ color: 'var(--muted)' }}>Variablen</label>
                        <div className="flex gap-1 flex-wrap">
                          {VARIABLES.map(v => (<button key={v.key} onClick={() => insertCode(line.id, v.key)} title={v.desc(activeServer)} className="text-xs px-2 py-1 rounded font-mono" style={{ background: '#4F46E520', color: '#818CF8', border: '1px solid #4F46E540' }}>{v.key}</button>))}
                        </div>
                      </div>
                      <div>
                        <button onClick={() => setShowGradient(s => !s)} className="text-xs px-3 py-1 rounded" style={{ background: 'linear-gradient(135deg, #4F46E5, #C026D3)', color: '#fff' }}>🌈 Farbverlauf</button>
                        {showGradient && (
                          <div className="mt-2 p-3 rounded-lg space-y-2" style={{ background: 'var(--muted-bg)', border: '1px solid var(--card-border)' }}>
                            <input style={inp} value={gradText} onChange={e => setGradText(e.target.value)} placeholder="Text für Farbverlauf" />
                            <div className="flex gap-2 items-center">
                              <div><label className="text-xs block mb-1" style={{ color: 'var(--muted)' }}>Von</label><input type="color" value={gradFrom} onChange={e => setGradFrom(e.target.value)} className="w-10 h-8 rounded cursor-pointer" /></div>
                              <div><label className="text-xs block mb-1" style={{ color: 'var(--muted)' }}>Bis</label><input type="color" value={gradTo} onChange={e => setGradTo(e.target.value)} className="w-10 h-8 rounded cursor-pointer" /></div>
                              <div className="flex-1 h-8 rounded mt-4" style={{ background: `linear-gradient(90deg, ${gradFrom}, ${gradTo})` }} />
                            </div>
                            <button onClick={() => { insertCode(line.id, generateGradient(gradText, gradFrom, gradTo)); setShowGradient(false) }} className="text-xs px-3 py-1 rounded text-white" style={gradBtn}>Einfügen</button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
            {canWrite && (
              <div className="flex gap-2 mt-4 items-center">
                <button onClick={() => addLine('static')} disabled={config.lines.length >= MAX_LINES} className="text-xs px-3 py-1.5 rounded-lg" style={{ background: 'var(--muted-bg)', color: 'var(--foreground)', border: '1px solid var(--card-border)' }}>+ Text</button>
                <button onClick={() => addLine('animated')} disabled={config.lines.length >= MAX_LINES} className="text-xs px-3 py-1.5 rounded-lg" style={{ background: 'var(--muted-bg)', color: 'var(--foreground)', border: '1px solid var(--card-border)' }}>+ Animation</button>
                <button onClick={() => addLine('empty')} disabled={config.lines.length >= MAX_LINES} className="text-xs px-3 py-1.5 rounded-lg" style={{ background: 'var(--muted-bg)', color: 'var(--foreground)', border: '1px solid var(--card-border)' }}>+ Leerzeile</button>
                {config.lines.length >= MAX_LINES && <span className="text-xs" style={{ color: 'var(--muted)' }}>Minecraft zeigt maximal {MAX_LINES} Zeilen.</span>}
              </div>
            )}
          </div>

          {canWrite && (
            <div>
              {error && <p className="text-sm mb-2" style={{ color: '#EF4444' }}>{error}</p>}
              {success && <p className="text-sm mb-2" style={{ color: '#22C55E' }}>{success}</p>}
              <button onClick={save} disabled={saving} className="w-full py-3 rounded-xl text-sm font-medium text-white" style={{ ...gradBtn, opacity: saving ? 0.7 : 1 }}>
                {saving ? 'Speichern...' : `💾 Speichern für ${activeServerObj.label}`}
              </button>
            </div>
          )}
        </div>

        {/* Vorschau rechts */}
        <div className="sticky top-6 self-start">
          <div style={card}>
            <h2 className="text-sm font-bold mb-1" style={{ color: 'var(--foreground)' }}>👁 Vorschau (wie ingame)</h2>
            <p className="text-xs mb-3" style={{ color: activeServerObj.color }}>{activeServerObj.label}</p>

            <div className="grid grid-cols-2 gap-2 mb-3">
              <div>
                <label className="text-xs block mb-1" style={{ color: 'var(--muted)' }}>Vorschau-Name</label>
                <input style={{ ...inp, padding: '6px 8px', fontSize: 12 }} value={previewName} onChange={e => setPreviewName(e.target.value)} />
              </div>
              <div>
                <label className="text-xs block mb-1" style={{ color: 'var(--muted)' }}>Vorschau-Rang</label>
                <select style={{ ...inp, padding: '6px 8px', fontSize: 12 }} value={previewRankId ?? ''} onChange={e => setPreviewRankId(Number(e.target.value))}>
                  {ranks.length === 0 && <option value="">keine Ränge</option>}
                  {ranks.map(r => <option key={r.id} value={r.id}>{r.display_name.replace(/§./g, '')}</option>)}
                </select>
              </div>
            </div>

            <div className="rounded-lg overflow-hidden" style={{ background: 'rgba(0,0,0,0.75)', border: '2px solid #333', fontFamily: 'monospace', fontSize: 13 }}>
              <div className="px-3 py-1.5 text-center" style={{ background: 'rgba(0,0,0,0.4)' }}>
                {renderMcText(resolvePreview(config.title))}
              </div>
              <div className="px-3 py-1.5 space-y-0.5">
                {config.lines.map((line, idx) => (
                  <div key={line.id} className="flex justify-between items-center gap-3" style={{ minHeight: 18 }}>
                    <span className="whitespace-pre">{line.type === 'empty' ? '\u00a0' : renderMcText(resolvePreview(getLineRaw(line)))}</span>
                    <span style={{ color: '#FF5555', fontSize: 12 }}>{config.lines.length - idx}</span>
                  </div>
                ))}
              </div>
            </div>
            <p className="text-xs mt-2" style={{ color: 'var(--muted)' }}>
              Variablen zeigen Beispielwerte, {'{name}'} und {'{rang}'} kannst du oben wählen. Animationen laufen im gleichen Takt wie ingame.
            </p>

            <div className="mt-4 pt-4" style={{ borderTop: '1px solid var(--card-border)' }}>
              <p className="text-xs font-medium mb-2" style={{ color: 'var(--muted)' }}>Variablen</p>
              <div className="space-y-1">
                {VARIABLES.map(v => (
                  <div key={v.key} className="flex items-center gap-2">
                    <code className="text-xs px-1.5 py-0.5 rounded" style={{ background: '#4F46E520', color: '#818CF8' }}>{v.key}</code>
                    <span className="text-xs" style={{ color: 'var(--muted)' }}>{v.desc(activeServer)}</span>
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