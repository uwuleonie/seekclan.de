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
  permissions: string[]
  can_assign_up_to_priority: number
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
  permissions: [] as string[],
  can_assign_up_to_priority: -1,
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
  const [newPerm, setNewPerm] = useState('')
  const [focusedField, setFocusedField] = useState<string | null>(null)

  // Rang vergeben: nur noch per Spielername
  const [assignName, setAssignName] = useState('')
  const [assignRankId, setAssignRankId] = useState<number | ''>('')
  const [assignError, setAssignError] = useState('')
  const [playerFilter, setPlayerFilter] = useState('')

  const inp = { background: 'var(--muted-bg)', border: '1px solid var(--card-border)', color: 'var(--foreground)', borderRadius: 8, padding: '8px 12px', fontSize: 13 }
  const card = { background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 12, padding: '20px' }
  const gradBtn = { background: 'linear-gradient(135deg, #4F46E5, #7C3AED, #C026D3)' }

  const load = async () => {
    setLoading(true)
    const [ranksRes, playersRes] = await Promise.all([
      fetch('/api/admin2/ranks').then(r => r.json()).catch(() => ({})),
      fetch('/api/admin2/ranks/players').then(r => r.json()).catch(() => ({})),
    ])
    setRanks((ranksRes.ranks || []).map((r: Rank) => ({
      ...r,
      permissions: Array.isArray(r.permissions) ? r.permissions : [],
    })))
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
    setForm({ ...EMPTY_FORM, permissions: [] })
    setShowForm(true)
  }

  const openEdit = (rank: Rank) => {
    setEditingRank(rank)
    setForm({
      name: rank.name, display_name: rank.display_name,
      chat_prefix: rank.chat_prefix, tab_prefix: rank.tab_prefix,
      tab_suffix: rank.tab_suffix, color: rank.color,
      priority: rank.priority, is_default: rank.is_default,
      permissions: Array.isArray(rank.permissions) ? [...rank.permissions] : [],
      can_assign_up_to_priority: rank.can_assign_up_to_priority ?? -1,
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
    if (!confirm(`Rang "${rank.display_name.replace(/§./g, '')}" wirklich löschen?`)) return
    const res = await fetch('/api/admin2/ranks', {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: rank.id }),
    })
    if (!res.ok) { flash('Fehler beim Löschen', true); return }
    flash('Rang gelöscht.')
    load()
  }

  const assignRank = async () => {
    setAssignError('')
    const name = assignName.trim()
    if (!name || !assignRankId) { setAssignError('Spielername und Rang erforderlich'); return }
    setSaving(true)
    const res = await fetch('/api/admin2/ranks/players', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ player_name: name, rank_id: assignRankId }),
    })
    const data = await res.json().catch(() => ({}))
    setSaving(false)
    if (!res.ok) { setAssignError(data.error || 'Fehler beim Vergeben'); return }
    flash(`Rang an ${data.player_name || name} vergeben!`)
    setAssignName(''); setAssignRankId('')
    load()
  }

  const revokeRank = async (uuid: string, playerName: string) => {
    if (!confirm(`${playerName} auf den Standard-Rang zurücksetzen?`)) return
    await fetch('/api/admin2/ranks/players', {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ uuid }),
    })
    flash('Auf Standard-Rang zurückgesetzt.')
    load()
  }

  const insertColorCode = (code: string) => {
    if (!focusedField) return
    setForm(f => ({ ...f, [focusedField]: (f[focusedField as keyof typeof f] as string) + code }))
  }

  const addPermission = () => {
    const p = newPerm.trim()
    if (!p || form.permissions.includes(p)) return
    setForm(f => ({ ...f, permissions: [...f.permissions, p] }))
    setNewPerm('')
  }

  const removePermission = (perm: string) => {
    setForm(f => ({ ...f, permissions: f.permissions.filter(p => p !== perm) }))
  }

  if (loading) return <p style={{ color: 'var(--muted)', padding: 32 }}>Laden...</p>

  const colorFields = [
    { field: 'chat_prefix', label: 'Chat-Prefix (vor dem Namen im Chat)', placeholder: '§6VIP' },
    { field: 'tab_prefix', label: 'Tab-Prefix (vor dem Namen in der Tab-Liste und über dem Kopf)', placeholder: '§6VIP' },
    { field: 'tab_suffix', label: 'Tab-Suffix (nach dem Namen)', placeholder: '' },
  ]

  const filteredPlayers = players.filter(p =>
    !playerFilter.trim() ||
    p.player_name.toLowerCase().includes(playerFilter.trim().toLowerCase()) ||
    p.display_name.replace(/§./g, '').toLowerCase().includes(playerFilter.trim().toLowerCase())
  )

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-1" style={{ color: 'var(--foreground)' }}>🏅 Ränge</h1>
        <p style={{ color: 'var(--muted)' }}>Ingame-Ränge erstellen, Permissions konfigurieren und Spielern zuweisen.</p>
      </div>

      {success && <div className="mb-4 px-4 py-3 rounded-xl text-sm" style={{ background: '#14532d', color: '#86efac' }}>{success}</div>}
      {error && <div className="mb-4 px-4 py-3 rounded-xl text-sm" style={{ background: '#450a0a', color: '#fca5a5' }}>{error}</div>}

      <div className="flex gap-2 mb-6">
        {(['ranks', 'players'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} className="px-5 py-2 rounded-xl text-sm font-medium"
            style={tab === t ? { ...gradBtn, color: '#fff' } : { background: 'var(--muted-bg)', color: 'var(--muted)', border: '1px solid var(--card-border)' }}>
            {t === 'ranks' ? '🏅 Rang-Liste' : '👤 Spieler-Zuweisung'}
          </button>
        ))}
      </div>

      {/* ─── RANG-LISTE ─── */}
      {tab === 'ranks' && (
        <div className="space-y-4">
          {canWrite && !showForm && (
            <div className="flex justify-end">
              <button onClick={openCreate} className="px-5 py-2 rounded-xl text-sm font-medium text-white" style={gradBtn}>
                + Neuer Rang
              </button>
            </div>
          )}

          {showForm && canWrite && (
            <div style={card} className="space-y-5">
              <h2 className="font-bold text-lg" style={{ color: 'var(--foreground)' }}>
                {editingRank ? `✏️ ${editingRank.display_name.replace(/§./g, '')} bearbeiten` : '✨ Neuer Rang'}
              </h2>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs mb-1 block" style={{ color: 'var(--muted)' }}>Interner Name (z.B. vip)</label>
                  <input style={{ ...inp, width: '100%' }} value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="vip" />
                </div>
                <div>
                  <label className="text-xs mb-1 block" style={{ color: 'var(--muted)' }}>Anzeigename (§-Codes erlaubt)</label>
                  <input style={{ ...inp, width: '100%' }} value={form.display_name}
                    onFocus={() => setFocusedField('display_name')}
                    onChange={e => setForm(f => ({ ...f, display_name: e.target.value }))} placeholder="§6VIP" />
                </div>
              </div>

              <div>
                <label className="text-xs mb-2 block" style={{ color: 'var(--muted)' }}>
                  Farb-Codes einfügen
                  <span className="ml-2 opacity-50">(Klick auf Farbe → in das zuletzt fokussierte Feld)</span>
                </label>
                <div className="flex flex-wrap gap-1 items-center">
                  {MC_COLORS.map(c => (
                    <button key={c.code} title={`${c.label} (${c.code})`}
                      onClick={() => insertColorCode(c.code)}
                      className="w-6 h-6 rounded border border-white/20 hover:scale-125 transition-transform"
                      style={{ background: c.hex }} />
                  ))}
                  <button onClick={() => insertColorCode('§l')} title="§l Fett"
                    className="px-2 h-6 rounded text-xs font-bold"
                    style={{ background: 'var(--muted-bg)', color: 'var(--foreground)', border: '1px solid var(--card-border)' }}>§l</button>
                  <button onClick={() => insertColorCode('§r')} title="§r Reset"
                    className="px-2 h-6 rounded text-xs"
                    style={{ background: 'var(--muted-bg)', color: 'var(--foreground)', border: '1px solid var(--card-border)' }}>§r</button>
                </div>
              </div>

              {colorFields.map(({ field, label, placeholder }) => (
                <div key={field}>
                  <label className="text-xs mb-1 block" style={{ color: 'var(--muted)' }}>{label}</label>
                  <div className="flex gap-2 items-center">
                    <input style={{ ...inp, flex: 1 }}
                      value={form[field as keyof typeof form] as string}
                      onFocus={() => setFocusedField(field)}
                      onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))}
                      placeholder={placeholder} />
                    <span className="text-xs px-3 py-2 rounded-lg min-w-[140px] text-center"
                      style={{ background: '#1a1a2e', fontFamily: 'monospace' }}>
                      {(form[field as keyof typeof form] as string)
                        ? renderMcText(form[field as keyof typeof form] as string)
                        : <span style={{ color: '#555' }}>Vorschau</span>}
                    </span>
                  </div>
                </div>
              ))}

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-xs mb-1 block" style={{ color: 'var(--muted)' }}>Namensfarbe (Chat, Tab & über dem Kopf)</label>
                  <input style={{ ...inp, width: '100%' }} value={form.color}
                    onFocus={() => setFocusedField('color')}
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
                    Standard-Rang (bekommt jeder neue Spieler)
                  </label>
                </div>
              </div>

              {/* Vorschau wie ingame */}
              <div>
                <label className="text-xs mb-1 block" style={{ color: 'var(--muted)' }}>Vorschau (Tab / Chat)</label>
                <div className="px-3 py-2 rounded-lg text-sm" style={{ background: '#1a1a2e', fontFamily: 'monospace' }}>
                  {renderMcText((form.tab_prefix || '').trim())}
                  {(form.tab_prefix || '').replace(/§./g, '').trim() && <span style={{ color: '#AAAAAA' }}> | </span>}
                  {renderMcText((form.color || '§f') + (user?.username || 'Spieler'))}
                </div>
              </div>

              <div style={{ borderTop: '1px solid var(--card-border)', paddingTop: 16 }}>
                <label className="text-sm font-medium mb-3 block" style={{ color: 'var(--foreground)' }}>
                  🔐 Permissions <span className="font-normal text-xs" style={{ color: 'var(--muted)' }}>(werden Spielern mit diesem Rang gegeben, mit - davor wird eine Permission entzogen)</span>
                </label>
                <div className="flex flex-wrap gap-2 mb-3 min-h-[32px]">
                  {form.permissions.map(perm => (
                    <span key={perm} className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs"
                      style={{ background: '#1e1b4b', color: '#a5b4fc', border: '1px solid #3730a3' }}>
                      {perm}
                      {canWrite && (
                        <button onClick={() => removePermission(perm)} className="ml-1 opacity-60 hover:opacity-100">✕</button>
                      )}
                    </span>
                  ))}
                  {form.permissions.length === 0 && (
                    <span className="text-xs" style={{ color: 'var(--muted)' }}>Keine Permissions gesetzt.</span>
                  )}
                </div>
                {canWrite && (
                  <div className="flex gap-2">
                    <input style={{ ...inp, flex: 1 }} value={newPerm}
                      onChange={e => setNewPerm(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && addPermission()}
                      placeholder="z.B. essentials.fly" />
                    <button onClick={addPermission} className="px-4 py-2 rounded-lg text-sm font-medium text-white" style={gradBtn}>
                      + Hinzufügen
                    </button>
                  </div>
                )}
              </div>

              <div style={{ borderTop: '1px solid var(--card-border)', paddingTop: 16 }}>
                <label className="text-sm font-medium mb-1 block" style={{ color: 'var(--foreground)' }}>
                  👮 Rang vergeben bis Priorität
                  <span className="font-normal text-xs ml-2" style={{ color: 'var(--muted)' }}>(-1 = darf gar nichts vergeben)</span>
                </label>
                <div className="flex items-center gap-3">
                  <input type="number" style={{ ...inp, width: 100 }} value={form.can_assign_up_to_priority}
                    onChange={e => setForm(f => ({ ...f, can_assign_up_to_priority: Number(e.target.value) }))} />
                  <span className="text-xs" style={{ color: 'var(--muted)' }}>
                    {form.can_assign_up_to_priority < 0
                      ? '❌ Darf keine Ränge vergeben'
                      : `✅ Darf Ränge mit Priorität ≤ ${form.can_assign_up_to_priority} vergeben`}
                  </span>
                </div>
                {ranks.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {ranks.map(r => (
                      <button key={r.id} onClick={() => setForm(f => ({ ...f, can_assign_up_to_priority: r.priority }))}
                        className="px-2 py-1 rounded text-xs"
                        style={{ background: 'var(--muted-bg)', color: 'var(--muted)', border: '1px solid var(--card-border)' }}>
                        {r.name} (Prio {r.priority})
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex gap-3 pt-2">
                <button onClick={saveRank} disabled={saving}
                  className="px-6 py-2 rounded-xl text-sm font-medium text-white" style={gradBtn}>
                  {saving ? 'Speichern...' : editingRank ? 'Speichern' : 'Erstellen'}
                </button>
                <button onClick={() => setShowForm(false)}
                  className="px-6 py-2 rounded-xl text-sm font-medium"
                  style={{ background: 'var(--muted-bg)', color: 'var(--muted)', border: '1px solid var(--card-border)' }}>
                  Abbrechen
                </button>
              </div>
            </div>
          )}

          <div style={card}>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--card-border)' }}>
                  {['Rang', 'Tab-Prefix', 'Chat-Prefix', 'Prio', 'Permissions', 'Vergabe bis', 'Std', ''].map(h => (
                    <th key={h} className="text-left pb-3 pr-3 font-medium" style={{ color: 'var(--muted)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ranks.map(rank => (
                  <tr key={rank.id} style={{ borderBottom: '1px solid var(--card-border)' }}>
                    <td className="py-3 pr-3">
                      <div style={{ fontFamily: 'monospace' }}>{renderMcText(rank.display_name)}</div>
                      <div className="text-xs" style={{ color: 'var(--muted)' }}>{rank.name}</div>
                    </td>
                    <td className="py-3 pr-3">
                      <span style={{ fontFamily: 'monospace', fontSize: 11, background: '#1a1a2e', padding: '2px 6px', borderRadius: 6 }}>
                        {renderMcText(rank.tab_prefix || '—')}
                      </span>
                    </td>
                    <td className="py-3 pr-3">
                      <span style={{ fontFamily: 'monospace', fontSize: 11, background: '#1a1a2e', padding: '2px 6px', borderRadius: 6 }}>
                        {renderMcText(rank.chat_prefix || '—')}
                      </span>
                    </td>
                    <td className="py-3 pr-3" style={{ color: 'var(--muted)' }}>{rank.priority}</td>
                    <td className="py-3 pr-3">
                      {rank.permissions.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {rank.permissions.slice(0, 2).map(p => (
                            <span key={p} className="px-1.5 py-0.5 rounded text-xs"
                              style={{ background: '#1e1b4b', color: '#a5b4fc' }}>{p}</span>
                          ))}
                          {rank.permissions.length > 2 && (
                            <span className="text-xs" style={{ color: 'var(--muted)' }}>+{rank.permissions.length - 2}</span>
                          )}
                        </div>
                      ) : <span style={{ color: 'var(--muted)' }}>—</span>}
                    </td>
                    <td className="py-3 pr-3 text-xs" style={{ color: 'var(--muted)' }}>
                      {rank.can_assign_up_to_priority < 0 ? '—' : `≤ ${rank.can_assign_up_to_priority}`}
                    </td>
                    <td className="py-3 pr-3">{rank.is_default ? '✅' : '—'}</td>
                    <td className="py-3">
                      {canWrite && (
                        <div className="flex gap-2">
                          <button onClick={() => openEdit(rank)}
                            className="px-3 py-1 rounded-lg text-xs"
                            style={{ background: 'var(--muted-bg)', color: 'var(--foreground)', border: '1px solid var(--card-border)' }}>✏️</button>
                          {!rank.is_default && (
                            <button onClick={() => deleteRank(rank)}
                              className="px-3 py-1 rounded-lg text-xs"
                              style={{ background: '#450a0a', color: '#fca5a5', border: '1px solid #7f1d1d' }}>🗑️</button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
                {ranks.length === 0 && (
                  <tr><td colSpan={8} className="py-8 text-center" style={{ color: 'var(--muted)' }}>Noch keine Ränge erstellt.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── SPIELER-ZUWEISUNG ─── */}
      {tab === 'players' && (
        <div className="space-y-4">
          {canWrite && (
            <div style={card} className="space-y-3">
              <h2 className="font-bold" style={{ color: 'var(--foreground)' }}>Rang vergeben</h2>
              <p className="text-xs" style={{ color: 'var(--muted)' }}>
                Einfach den Minecraft-Namen eingeben. Die UUID wird automatisch ermittelt, der Spieler muss dafür nicht online sein.
              </p>
              {assignError && <p className="text-sm" style={{ color: '#fca5a5' }}>{assignError}</p>}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs mb-1 block" style={{ color: 'var(--muted)' }}>Minecraft-Name</label>
                  <input style={{ ...inp, width: '100%' }} value={assignName}
                    onChange={e => setAssignName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && assignRank()}
                    placeholder="uwuleonie" />
                </div>
                <div>
                  <label className="text-xs mb-1 block" style={{ color: 'var(--muted)' }}>Rang</label>
                  <select style={{ ...inp, width: '100%' }} value={assignRankId}
                    onChange={e => setAssignRankId(e.target.value ? Number(e.target.value) : '')}>
                    <option value="">— Rang wählen —</option>
                    {ranks.map(r => (
                      <option key={r.id} value={r.id}>{r.display_name.replace(/§./g, '')} (Prio {r.priority})</option>
                    ))}
                  </select>
                </div>
              </div>
              <button onClick={assignRank} disabled={saving}
                className="px-5 py-2 rounded-xl text-sm font-medium text-white" style={gradBtn}>
                {saving ? 'Wird gesucht...' : 'Rang vergeben'}
              </button>
            </div>
          )}

          <div style={card}>
            <div className="flex items-center justify-between mb-4 gap-4">
              <h2 className="font-bold" style={{ color: 'var(--foreground)' }}>Spieler mit Rängen ({players.length})</h2>
              <input style={{ ...inp, width: 240 }} value={playerFilter}
                onChange={e => setPlayerFilter(e.target.value)} placeholder="🔍 Spieler oder Rang suchen" />
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--card-border)' }}>
                  {['Spieler', 'Rang', 'Vergeben von', 'Am', ''].map(h => (
                    <th key={h} className="text-left pb-3 pr-4 font-medium" style={{ color: 'var(--muted)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredPlayers.map(p => (
                  <tr key={p.uuid} style={{ borderBottom: '1px solid var(--card-border)' }}>
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-2">
                        <img src={`/api/player-heads/${p.player_name}/24`} alt="" className="w-6 h-6 rounded" />
                        <div>
                          <div className="font-medium" style={{ color: 'var(--foreground)' }}>{p.player_name}</div>
                          <div className="text-xs" style={{ color: 'var(--muted)' }}>{p.uuid}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 pr-4">
                      <span style={{ fontFamily: 'monospace', fontSize: 12, background: '#1a1a2e', padding: '2px 8px', borderRadius: 6 }}>
                        {renderMcText(p.display_name)}
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
                {filteredPlayers.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-8 text-center" style={{ color: 'var(--muted)' }}>
                      {players.length === 0 ? 'Noch kein Spieler hat einen Rang.' : 'Keine Treffer.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}