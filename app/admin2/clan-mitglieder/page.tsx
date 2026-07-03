'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '../../lib/auth-context'
import { hasWriteAccess } from '../layout'
import { usePathname } from 'next/navigation'

type Member = {
  id: string
  display_name: string
  role: string
  join_date: string
  discord_tag: string | null
  has_seek_account: boolean
  stufe_override: number | null
}

const ROLES = ['Owner', 'Admin', 'VIP', 'Mod', 'Mitglied']
const TEAM_ROLES = ['Owner', 'Admin', 'Mod']

const STUFEN = [
  { value: 0, label: 'Neuling', icon: '🌱' },
  { value: 1, label: 'Mitglied', icon: '🍃' },
  { value: 2, label: 'Treues Mitglied', icon: '🌿' },
  { value: 3, label: 'Vertrauter', icon: '🌳' },
  { value: 4, label: 'Goat', icon: '🐐' },
  { value: 5, label: 'OG', icon: '👑' },
]

function autoStufe(joinDate: string): number {
  const years = (Date.now() - new Date(joinDate).getTime()) / (1000 * 60 * 60 * 24 * 365)
  if (years >= 4) return 5
  if (years >= 2.5) return 4
  if (years >= 1.5) return 3
  if (years >= 0.75) return 2
  if (years >= 0.1) return 1
  return 0
}

function durationLabel(joinDate: string): string {
  const days = Math.floor((Date.now() - new Date(joinDate).getTime()) / (1000 * 60 * 60 * 24))
  const years = Math.floor(days / 365)
  const months = Math.floor((days % 365) / 30)
  if (years === 0 && months === 0) return `${days} Tage`
  if (years === 0) return `${months} Mon.`
  return months > 0 ? `${years} J. ${months} Mon.` : `${years} Jahre`
}

export default function ClanMitgliederPage() {
  const { user } = useAuth()
  const pathname = usePathname()
  const canWrite = hasWriteAccess(user?.clan_role, pathname)

  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'alle' | 'admin' | 'mods' | 'mitglieder'>('alle')
  const [sort, setSort] = useState<'dauer' | 'az' | 'rang'>('dauer')
  const [showAddForm, setShowAddForm] = useState(false)

  const [newName, setNewName] = useState('')
  const [newRole, setNewRole] = useState('Mitglied')
  const [newDate, setNewDate] = useState('')
  const [newDiscord, setNewDiscord] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const loadMembers = () => {
    setLoading(true)
    fetch('/api/admin2/clan-members')
      .then(r => r.json())
      .then(data => setMembers(data.members || []))
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadMembers() }, [])

  const addMember = async () => {
    if (!newName.trim() || !newDate) { setError('Minecraft-Name und Beitrittsdatum sind erforderlich'); return }
    setSaving(true)
    setError('')
    const res = await fetch('/api/admin2/clan-members', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ display_name: newName.trim(), role: newRole, join_date: newDate, discord_tag: newDiscord || null }),
    })
    if (res.ok) {
      setShowAddForm(false)
      setNewName(''); setNewRole('Mitglied'); setNewDate(''); setNewDiscord('')
      loadMembers()
    } else {
      const data = await res.json().catch(() => ({}))
      setError(data.error || 'Fehler beim Hinzufügen')
    }
    setSaving(false)
  }

  const changeRole = async (id: string, role: string) => {
    await fetch(`/api/admin2/clan-members/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role }),
    })
    loadMembers()
  }

  const changeStufe = async (id: string, value: string) => {
    const stufe_override = value === 'auto' ? null : parseInt(value)
    await fetch(`/api/admin2/clan-members/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stufe_override }),
    })
    loadMembers()
  }

  const removeMember = async (id: string, name: string) => {
    if (!confirm(`${name} wirklich aus dem Clan entfernen?`)) return
    await fetch(`/api/admin2/clan-members/${id}`, { method: 'DELETE' })
    loadMembers()
  }

  const filtered = members
    .filter(m => {
      if (search.trim() && !m.display_name.toLowerCase().includes(search.toLowerCase())) return false
      if (filter === 'admin' && m.role !== 'Admin') return false
      if (filter === 'mods' && m.role !== 'Mod') return false
      if (filter === 'mitglieder' && TEAM_ROLES.includes(m.role)) return false
      return true
    })
    .sort((a, b) => {
      if (sort === 'az') return a.display_name.localeCompare(b.display_name)
      if (sort === 'rang') return ROLES.indexOf(a.role) - ROLES.indexOf(b.role)
      return new Date(a.join_date).getTime() - new Date(b.join_date).getTime()
    })

  const teamCount = members.filter(m => TEAM_ROLES.includes(m.role)).length
  const ogCount = members.filter(m => (m.stufe_override ?? autoStufe(m.join_date)) === 5).length
  const neuCount = members.filter(m => (Date.now() - new Date(m.join_date).getTime()) < 1000 * 60 * 60 * 24 * 90).length

  return (
    <div className="max-w-6xl">
      <h1 className="text-3xl font-bold mb-1" style={{ color: 'var(--foreground)' }}>Clan-Mitglieder</h1>
      <p className="mb-1" style={{ color: 'var(--muted)' }}>Minecraft-Namen, Rollen & Sortierung der Clanliste.</p>
      {!canWrite && <p className="text-xs mb-5" style={{ color: '#EAB308' }}>🔒 Nur Lesezugriff — Änderungen sind für deine Rolle nicht möglich.</p>}
      {canWrite && <div className="mb-5" />}

      <div className="grid grid-cols-4 gap-4 mb-6">
        <StatCard label="Mitglieder" value={String(members.length)} color="var(--foreground)" />
        <StatCard label="Teammitglieder" value={String(teamCount)} color="#3B82F6" />
        <StatCard label="OGs (Stufe 5)" value={String(ogCount)} color="#F59E0B" />
        <StatCard label="Neu (< 3 Mon.)" value={String(neuCount)} color="#22C55E" />
      </div>

      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Mitglied suchen ..."
          className="rounded-xl px-4 py-2.5 text-sm outline-none flex-1 min-w-[200px]"
          style={{ background: 'var(--muted-bg)', border: '1px solid var(--card-border)', color: 'var(--foreground)' }} />
        {(['alle', 'admin', 'mods', 'mitglieder'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className="px-4 py-2.5 rounded-xl text-sm font-medium capitalize transition-all"
            style={filter === f
              ? { background: 'var(--muted-bg)', color: 'var(--foreground)', border: '1px solid var(--card-border)' }
              : { color: 'var(--muted)' }}>
            {f === 'alle' ? 'Alle' : f === 'admin' ? 'Admin' : f === 'mods' ? 'Mods' : 'Mitglieder'}
          </button>
        ))}
        {(['dauer', 'az', 'rang'] as const).map(s => (
          <button key={s} onClick={() => setSort(s)}
            className="px-4 py-2.5 rounded-xl text-sm font-medium transition-all"
            style={sort === s
              ? { background: 'var(--muted-bg)', color: 'var(--foreground)', border: '1px solid var(--card-border)' }
              : { color: 'var(--muted)' }}>
            {s === 'dauer' ? 'Nach Dauer' : s === 'az' ? 'A–Z' : 'Nach Rang'}
          </button>
        ))}
        {canWrite && (
          <button onClick={() => setShowAddForm(v => !v)} className="btn-gradient text-white px-5 py-2.5 rounded-xl text-sm font-medium">
            + Mitglied
          </button>
        )}
      </div>

      {showAddForm && canWrite && (
        <div className="card rounded-2xl p-6 mb-6">
          {error && <p className="text-red-500 text-sm mb-3">{error}</p>}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Minecraft Username"
              className="rounded-xl px-4 py-2.5 text-sm outline-none" style={{ background: 'var(--muted-bg)', border: '1px solid var(--card-border)', color: 'var(--foreground)' }} />
            <select value={newRole} onChange={e => setNewRole(e.target.value)}
              className="rounded-xl px-4 py-2.5 text-sm outline-none" style={{ background: 'var(--muted-bg)', border: '1px solid var(--card-border)', color: 'var(--foreground)' }}>
              {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
            <input type="date" value={newDate} onChange={e => setNewDate(e.target.value)}
              className="rounded-xl px-4 py-2.5 text-sm outline-none" style={{ background: 'var(--muted-bg)', border: '1px solid var(--card-border)', color: 'var(--foreground)' }} />
            <input value={newDiscord} onChange={e => setNewDiscord(e.target.value)} placeholder="Discord Tag (optional)"
              className="rounded-xl px-4 py-2.5 text-sm outline-none" style={{ background: 'var(--muted-bg)', border: '1px solid var(--card-border)', color: 'var(--foreground)' }} />
          </div>
          <div className="flex gap-2">
            <button onClick={addMember} disabled={saving} className="btn-gradient text-white px-5 py-2.5 rounded-xl text-sm font-medium disabled:opacity-50">
              {saving ? 'Wird hinzugefügt...' : 'Hinzufügen'}
            </button>
            <button onClick={() => setShowAddForm(false)} className="px-5 py-2.5 rounded-xl text-sm" style={{ color: 'var(--muted)' }}>Abbrechen</button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-center py-10" style={{ color: 'var(--muted)' }}>Laden...</p>
      ) : (
        <div className="card rounded-2xl overflow-hidden">
          {filtered.map(m => {
            const effectiveStufe = m.stufe_override ?? autoStufe(m.join_date)
            const stufeInfo = STUFEN[effectiveStufe]
            return (
              <div key={m.id} className="flex items-center gap-4 px-5 py-4" style={{ borderBottom: '1px solid var(--card-border)' }}>
                <img src={`/api/player-heads/${m.display_name}/40`} alt="" className="w-10 h-10 rounded-xl flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium" style={{ color: 'var(--foreground)' }}>{m.display_name}</p>
                  <p className="text-xs" style={{ color: 'var(--muted)' }}>seit {new Date(m.join_date).toLocaleDateString('de-DE')} · {durationLabel(m.join_date)}</p>
                </div>

                {canWrite ? (
                  <select value={m.role} onChange={e => changeRole(m.id, e.target.value)}
                    className="rounded-xl px-3 py-1.5 text-sm outline-none flex-shrink-0"
                    style={{ background: 'var(--muted-bg)', border: '1px solid var(--card-border)', color: 'var(--foreground)' }}>
                    {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                ) : (
                  <span className="text-xs px-3 py-1.5 rounded-full flex-shrink-0" style={{ background: 'var(--muted-bg)', color: 'var(--foreground)' }}>{m.role}</span>
                )}

                {canWrite ? (
                  <select value={m.stufe_override ?? 'auto'} onChange={e => changeStufe(m.id, e.target.value)}
                    className="rounded-xl px-3 py-1.5 text-sm outline-none flex-shrink-0"
                    style={{ background: 'var(--muted-bg)', border: '1px solid var(--card-border)', color: 'var(--foreground)' }}>
                    <option value="auto">🌱 Auto · {STUFEN[autoStufe(m.join_date)].label}</option>
                    {STUFEN.map(s => <option key={s.value} value={s.value}>{s.icon} {s.label}</option>)}
                  </select>
                ) : (
                  <span className="text-xs px-3 py-1.5 rounded-full flex-shrink-0" style={{ background: 'var(--muted-bg)', color: 'var(--foreground)' }}>
                    {m.stufe_override === null && '🌱 Auto · '}{stufeInfo.icon} {stufeInfo.label}
                  </span>
                )}

                {canWrite && (
                  <button onClick={() => removeMember(m.id, m.display_name)}
                    className="text-xs px-3 py-1.5 rounded-xl flex-shrink-0" style={{ color: '#EF4444' }}>
                    Entfernen
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}

      <p className="text-xs mt-4" style={{ color: 'var(--muted)' }}>
        {filtered.length} von {members.length} Mitgliedern · „Auto" berechnet das Abzeichen aus der Clandauer, lässt sich pro Mitglied aber manuell überschreiben.
      </p>
    </div>
  )
}

function StatCard({ label, value, color }: { label: string, value: string, color: string }) {
  return (
    <div className="card rounded-2xl p-5">
      <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--muted)' }}>{label}</p>
      <p className="text-3xl font-bold" style={{ color }}>{value}</p>
    </div>
  )
}