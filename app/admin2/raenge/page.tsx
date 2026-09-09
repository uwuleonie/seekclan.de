'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '../../lib/auth-context'
import { hasWriteAccess } from '../layout'
import { usePathname } from 'next/navigation'

const MC_COLORS = [
  { code: '§0', hex: '#000000', label: 'Schwarz' },
  { code: '§1', hex: '#0000AA', label: 'Dunkelblau' },
  { code: '§2', hex: '#00AA00', label: 'Dunkelgrün' },
  { code: '§3', hex: '#00AAAA', label: 'Dunkelcyan' },
  { code: '§4', hex: '#AA0000', label: 'Dunkelrot' },
  { code: '§5', hex: '#AA00AA', label: 'Lila' },
  { code: '§6', hex: '#FFAA00', label: 'Gold' },
  { code: '§7', hex: '#AAAAAA', label: 'Grau' },
  { code: '§8', hex: '#555555', label: 'Dunkelgrau' },
  { code: '§9', hex: '#5555FF', label: 'Blau' },
  { code: '§a', hex: '#55FF55', label: 'Grün' },
  { code: '§b', hex: '#55FFFF', label: 'Cyan' },
  { code: '§c', hex: '#FF5555', label: 'Rot' },
  { code: '§d', hex: '#FF55FF', label: 'Magenta' },
  { code: '§e', hex: '#FFFF55', label: 'Gelb' },
  { code: '§f', hex: '#FFFFFF', label: 'Weiß' },
]

function renderMcText(text: string): React.ReactNode {
  const parts: { text: string; color: string; bold: boolean }[] = []
  let color = '#FFFFFF', bold = false, current = '', i = 0
  while (i < text.length) {
    if (text[i] === '§' && i + 1 < text.length) {
      if (current) parts.push({ text: current, color, bold })
      current = ''
      const c = text[i + 1].toLowerCase()
      const col = MC_COLORS.find(x => x.code === '§' + c)
      if (col) { color = col.hex; bold = false }
      else if (c === 'l') bold = true
      else if (c === 'r') { color = '#FFFFFF'; bold = false }
      i += 2
    } else { current += text[i]; i++ }
  }
  if (current) parts.push({ text: current, color, bold })
  return parts.map((p, idx) => (
    <span key={idx} style={{ color: p.color, fontWeight: p.bold ? 'bold' : 'normal' }}>{p.text}</span>
  ))
}

type Rank = {
  id: number
  name: string
  display_name: string
  chat_prefix: string
  tab_prefix: string
  tab_suffix: string
  color: string
  priority: number
  is_default: boolean
}

type PlayerRank = {
  uuid: string
  player_name: string
  assigned_by: string
  assigned_at: string
  rank_id: number
  name: string
  display_name: string
  color: string
  tab_prefix: string
  chat_prefix: string
  priority: number
}

const EMPTY_FORM = {
  name: '', display_name: '', chat_prefix: '', tab_prefix: '',
  tab_suffix: '', color: '§7', priority: 0, is_default: false,
}

export default function RaengePage() {
  const { user } = useAuth()
  const pathname = usePathname()
  const canWrite = hasWriteAccess(user?.clan_role, pathname)

  const [tab, setTab] = useState<'ranks' | 'players'>('ranks')
  const [ranks, setRanks] = useState<Rank[]>([])
  const [players, setPlayers] = useState<PlayerRank[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')

  const [showForm, setShowForm] = useState(false)
  const [editingRank, setEditingRank] = useState<Rank | null>(null)
  const [form, setForm] = useState({ ...EMPTY_FORM })

  // Spieler-Rang vergeben
  const [assignUuid, setAssignUuid] = useState('')
  const [assignName, setAssignName] = useState('')
  const [assignRankId, setAssignRankId] = useState<number | ''>('')
  const [assignError, setAssignError] = useState('')

  const inp = { background: 'var(--muted-bg)', border: '1px solid var(--card-border)', color: 'var(--foreground)', borderRadius: 8, padding: '8px 12px', fontSize: 13 }
  const card = { background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 12, padding: '20px' }
  const gradBtn = { background: 'linear-gradient(135deg, #4F46E5, #7C3AED, #C026D3)' }

  const load = async () => {
    setLoading(true)
    const [ranksRes, playersRes] = await Promise.all([
      fetch('/api/admin2/ranks').then(r => r.json()),
      fetch('/api/admin2/ranks/players').then(r => r.json()),
    ])
    setRanks(ranksRes.ranks || [])
    setPlayers(playersRes.players || [])
    setLoading(false)
  }

  useEffect(() => { if (user) load() }, [user])

  const flash = (msg: string, isError = false) => {
    if (isError) { setError(msg); setTimeout(() => setError(''), 3000) }
    else { setSuccess(msg); setTimeout(() => setSuccess(''), 3000) }
  }

  const openCreate = () => {
    setEditingRank(null)
    setForm({ ...EMPTY_FORM })
    setShowForm(true)
  }

  const openEdit = (rank: Rank) => {
    setEditingRank(rank)
    setForm({
      name: rank.name, display_name: rank.display_name,
      chat_prefix: rank.chat_prefix, tab_prefix: rank.tab_prefix,
      tab_suffix: rank.tab_suffix, color: rank.color,
      priority: rank.priority, is_default: rank.is_default,
    })
    setShowForm(true)
  }

  const saveRank = async () => {
    setSaving(true); setError('')
    const method = editingRank ? 'PUT' : 'POST'
    const body = editingRank ? { id: editingRank.id, ...form } : form
    const res = await fetch('/api/admin2/ranks', {
      method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    })
    setSaving(false)
    if (!res.ok) { flash('Fehler beim Speichern', true); return }
    flash(editingRank ? 'Rang aktualisiert!' : 'Rang erstellt!')
    setShowForm(false)
    load()
  }

  const deleteRank = async (rank: Rank) => {
    if (rank.is_default) { flash('Standard-Rang kann nicht gelöscht werden.', true); return }
    if (!confirm(`Rang "${rank.display_name}" wirklich löschen?`)) return
    const res = await fetch('/api/admin2/ranks', {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: rank.id }),
    })
    if (!res.ok) { flash('Fehler beim Löschen', true); return }
    flash('Rang gelöscht.')
    load()
  }

  const assignRank = async () => {
    setAssignError('')
    if (!assignUuid.trim() || !assignRankId) { setAssignError('UUID und Rang erforderlich'); return }
    setSaving(true)
    const res = await fetch('/api/admin2/ranks/players', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uuid: assignUuid.trim(), player_name: assignName.trim() || assignUuid.trim(), rank_id: assignRankId }),
    })
    setSaving(false)
    if (!res.ok) { setAssignError('Fehler beim Vergeben'); return }
    flash('Rang vergeben!')
    setAssignUuid(''); setAssignName(''); setAssignRankId('')
    load()
  }

  const revokeRank = async (uuid: string, playerName: string) => {
    if (!confirm(`Rang von ${playerName} entziehen?`)) return
    await fetch('/api/admin2/ranks/players', {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ uuid }),
    })
    flash('Rang entzogen.')
    load()
  }

  const insertCode = (field: keyof typeof form, code: string) => {
    setForm(f => ({ ...f, [field]: (f[field] as string) + code }))
  }

  if (loading) return <p style={{ color: 'var(--muted)' }}>Laden...</p>

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-1" style={{ color: 'var(--foreground)' }}>🏅 Ränge</h1>
        <p style={{ color: 'var(--muted)' }}>Ingame-Ränge erstellen und Spielern zuweisen.</p>
      </div>

      {success && <div className="mb-4 px-4 py-3 rounded-xl text-sm" style={{ background: '#14532d', color: '#86efac' }}>{success}</div>}
      {error && <div className="mb-4 px-4 py-3 rounded-xl text-sm" style={{ background: '#450a0a', color: '#fca5a5' }}>{error}</div>}

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        {(['ranks', 'players'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} className="px-5 py-2 rounded-xl text-sm font-medium"
            style={tab === t ? { ...gradBtn, color: '#fff' } : { background: 'var(--muted-bg)', color: 'var(--muted)', border: '1px solid var(--card-border)' }}>
            {t === 'ranks' ? '🏅 Rang-Liste' : '👤 Spieler-Zuweisung'}
          </button>
        ))}
      </div>

      {/* ─── Rang-Liste ─── */}
      {tab === 'ranks' && (
        <div className="space-y-4">
          {canWrite && (
            <div className="flex justify-end">
              <button onClick={openCreate} className="px-5 py-2 rounded-xl text-sm font-medium text-white" style={gradBtn}>
                + Neuer Rang
              </button>
            </div>
          )}

          {/* Rang-Formular */}
          {showForm && canWrite && (
            <div style={card} className="space-y-4">
              <h2 className="font-bold text-lg" style={{ color: 'var(--foreground)' }}>
                {editingRank ? `✏️ Rang bearbeiten: ${editingRank.display_name}` : '✨ Neuer Rang'}
              </h2>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs mb-1 block" style={{ color: 'var(--muted)' }}>Interner Name (z.B. vip)</label>
                  <input style={{ ...inp, width: '100%' }} value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="vip" />
                </div>
                <div>
                  <label className="text-xs mb-1 block" style={{ color: 'var(--muted)' }}>Anzeigename</label>
                  <input style={{ ...inp, width: '100%' }} value={form.display_name}
                    onChange={e => setForm(f => ({ ...f, display_name: e.target.value }))} placeholder="§6VIP" />
                </div>
              </div>

              {/* Farb-Picker */}
              <div>
                <label className="text-xs mb-2 block" style={{ color: 'var(--muted)' }}>Farb-Codes einfügen</label>
                <div className="flex flex-wrap gap-1">
                  {MC_COLORS.map(c => (
                    <button key={c.code} title={`${c.label} (${c.code})`}
                      onClick={() => {
                        const activeField = document.activeElement?.getAttribute('data-field') as keyof typeof form | null
                        if (activeField) insertCode(activeField, c.code)
                      }}
                      className="w-6 h-6 rounded border border-white/20 transition-transform hover:scale-125"
                      style={{ background: c.hex }} />
                  ))}
                  <button title="§l Fett" onClick={() => {
                    const af = document.activeElement?.getAttribute('data-field') as keyof typeof form | null
                    if (af) insertCode(af, '§l')
                  }} className="px-2 h-6 rounded text-xs font-bold" style={{ background: 'var(--muted-bg)', color: 'var(--foreground)', border: '1px solid var(--card-border)' }}>§l</button>
                  <button title="§r Reset" onClick={() => {
                    const af = document.activeElement?.getAttribute('data-field') as keyof typeof form | null
                    if (af) insertCode(af, '§r')
                  }} className="px-2 h-6 rounded text-xs" style={{ background: 'var(--muted-bg)', color: 'var(--foreground)', border: '1px solid var(--card-border)' }}>§r</button>
                </div>
              </div>

              {[
                { field: 'chat_prefix' as const, label: 'Chat-Prefix (vor dem Namen im Chat)', placeholder: '§6[VIP] §r' },
                { field: 'tab_prefix' as const, label: 'Tab-Prefix (vor dem Namen in der Tab-Liste)', placeholder: '§6[VIP] ' },
                { field: 'tab_suffix' as const, label: 'Tab-Suffix (nach dem Namen)', placeholder: '§r' },
              ].map(({ field, label, placeholder }) => (
                <div key={field}>
                  <label className="text-xs mb-1 block" style={{ color: 'var(--muted)' }}>{label}</label>
                  <div className="flex gap-2 items-center">
                    <input data-field={field} style={{ ...inp, flex: 1 }} value={form[field] as string}
                      onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))} placeholder={placeholder} />
                    <span className="text-xs px-3 py-2 rounded-lg min-w-[120px]"
                      style={{ background: '#1a1a2e', fontFamily: 'monospace' }}>
                      {form[field] ? renderMcText(form[field] as string) : <span style={{ color: '#555' }}>Vorschau</span>}
                    </span>
                  </div>
                </div>
              ))}

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-xs mb-1 block" style={{ color: 'var(--muted)' }}>Haupt-Farbe (§-Code)</label>
                  <input style={{ ...inp, width: '100%' }} value={form.color}
                    onChange={e => setForm(f => ({ ...f, color: e.target.value }))} placeholder="§6" />
                </div>
                <div>
                  <label className="text-xs mb-1 block" style={{ color: 'var(--muted)' }}>Priorität (höher = weiter oben im Tab)</label>
                  <input type="number" style={{ ...inp, width: '100%' }} value={form.priority}
                    onChange={e => setForm(f => ({ ...f, priority: Number(e.target.value) }))} />
                </div>
                <div className="flex items-end pb-2">
                  <label className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: 'var(--foreground)' }}>
                    <input type="checkbox" checked={form.is_default}
                      onChange={e => setForm(f => ({ ...f, is_default: e.target.checked }))} />
                    Standard-Rang
                  </label>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button onClick={saveRank} disabled={saving} className="px-6 py-2 rounded-xl text-sm font-medium text-white" style={gradBtn}>
                  {saving ? 'Speichern...' : editingRank ? 'Speichern' : 'Erstellen'}
                </button>
                <button onClick={() => setShowForm(false)} className="px-6 py-2 rounded-xl text-sm font-medium"
                  style={{ background: 'var(--muted-bg)', color: 'var(--muted)', border: '1px solid var(--card-border)' }}>
                  Abbrechen
                </button>
              </div>
            </div>
          )}

          {/* Rang-Tabelle */}
          <div style={card}>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--card-border)' }}>
                  {['Rang', 'Chat-Prefix', 'Tab-Prefix', 'Prio', 'Standard', ''].map(h => (
                    <th key={h} className="text-left pb-3 pr-4 font-medium" style={{ color: 'var(--muted)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ranks.map(rank => (
                  <tr key={rank.id} style={{ borderBottom: '1px solid var(--card-border)' }}>
                    <td className="py-3 pr-4">
                      <div className="font-medium" style={{ fontFamily: 'monospace' }}>
                        {renderMcText(rank.display_name)}
                      </div>
                      <div className="text-xs" style={{ color: 'var(--muted)' }}>{rank.name}</div>
                    </td>
                    <td className="py-3 pr-4">
                      <span style={{ fontFamily: 'monospace', fontSize: 12, background: '#1a1a2e', padding: '2px 8px', borderRadius: 6 }}>
                        {renderMcText(rank.chat_prefix)}
                      </span>
                    </td>
                    <td className="py-3 pr-4">
                      <span style={{ fontFamily: 'monospace', fontSize: 12, background: '#1a1a2e', padding: '2px 8px', borderRadius: 6 }}>
                        {renderMcText(rank.tab_prefix)}
                      </span>
                    </td>
                    <td className="py-3 pr-4" style={{ color: 'var(--muted)' }}>{rank.priority}</td>
                    <td className="py-3 pr-4">{rank.is_default ? '✅' : '—'}</td>
                    <td className="py-3">
                      {canWrite && (
                        <div className="flex gap-2">
                          <button onClick={() => openEdit(rank)} className="px-3 py-1 rounded-lg text-xs"
                            style={{ background: 'var(--muted-bg)', color: 'var(--foreground)', border: '1px solid var(--card-border)' }}>
                            ✏️
                          </button>
                          {!rank.is_default && (
                            <button onClick={() => deleteRank(rank)} className="px-3 py-1 rounded-lg text-xs"
                              style={{ background: '#450a0a', color: '#fca5a5', border: '1px solid #7f1d1d' }}>
                              🗑️
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
                {ranks.length === 0 && (
                  <tr><td colSpan={6} className="py-8 text-center" style={{ color: 'var(--muted)' }}>Noch keine Ränge erstellt.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── Spieler-Zuweisung ─── */}
      {tab === 'players' && (
        <div className="space-y-4">
          {canWrite && (
            <div style={card} className="space-y-3">
              <h2 className="font-bold" style={{ color: 'var(--foreground)' }}>Rang vergeben</h2>
              {assignError && <p className="text-sm" style={{ color: '#fca5a5' }}>{assignError}</p>}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs mb-1 block" style={{ color: 'var(--muted)' }}>Minecraft-UUID</label>
                  <input style={{ ...inp, width: '100%' }} value={assignUuid}
                    onChange={e => setAssignUuid(e.target.value)} placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" />
                </div>
                <div>
                  <label className="text-xs mb-1 block" style={{ color: 'var(--muted)' }}>Spielername (optional)</label>
                  <input style={{ ...inp, width: '100%' }} value={assignName}
                    onChange={e => setAssignName(e.target.value)} placeholder="uwuleonie" />
                </div>
                <div>
                  <label className="text-xs mb-1 block" style={{ color: 'var(--muted)' }}>Rang</label>
                  <select style={{ ...inp, width: '100%' }} value={assignRankId}
                    onChange={e => setAssignRankId(Number(e.target.value))}>
                    <option value="">— Rang wählen —</option>
                    {ranks.map(r => (
                      <option key={r.id} value={r.id}>{r.display_name.replace(/§./g, '')} (Prio {r.priority})</option>
                    ))}
                  </select>
                </div>
              </div>
              <button onClick={assignRank} disabled={saving} className="px-5 py-2 rounded-xl text-sm font-medium text-white" style={gradBtn}>
                {saving ? 'Speichern...' : 'Rang vergeben'}
              </button>
            </div>
          )}

          {/* Spieler mit Rängen */}
          <div style={card}>
            <h2 className="font-bold mb-4" style={{ color: 'var(--foreground)' }}>Spieler mit Rängen ({players.length})</h2>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--card-border)' }}>
                  {['Spieler', 'Rang', 'Vergeben von', 'Am', ''].map(h => (
                    <th key={h} className="text-left pb-3 pr-4 font-medium" style={{ color: 'var(--muted)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {players.map(p => (
                  <tr key={p.uuid} style={{ borderBottom: '1px solid var(--card-border)' }}>
                    <td className="py-3 pr-4">
                      <div className="font-medium" style={{ color: 'var(--foreground)' }}>{p.player_name}</div>
                      <div className="text-xs" style={{ color: 'var(--muted)' }}>{p.uuid}</div>
                    </td>
                    <td className="py-3 pr-4">
                      <span style={{ fontFamily: 'monospace', fontSize: 12, background: '#1a1a2e', padding: '2px 8px', borderRadius: 6 }}>
                        {renderMcText(p.tab_prefix || p.display_name)}
                      </span>
                    </td>
                    <td className="py-3 pr-4" style={{ color: 'var(--muted)' }}>{p.assigned_by || '—'}</td>
                    <td className="py-3 pr-4 text-xs" style={{ color: 'var(--muted)' }}>
                      {new Date(p.assigned_at).toLocaleDateString('de-DE')}
                    </td>
                    <td className="py-3">
                      {canWrite && (
                        <button onClick={() => revokeRank(p.uuid, p.player_name)}
                          className="px-3 py-1 rounded-lg text-xs"
                          style={{ background: '#450a0a', color: '#fca5a5', border: '1px solid #7f1d1d' }}>
                          Entziehen
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {players.length === 0 && (
                  <tr><td colSpan={5} className="py-8 text-center" style={{ color: 'var(--muted)' }}>Noch kein Spieler hat einen Rang.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}