'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '../../lib/auth-context'
import Link from 'next/link'

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

export default function AdminClanPage() {
  const { user, loading } = useAuth()
  const [members, setMembers] = useState<Member[]>([])
  const [loadingMembers, setLoadingMembers] = useState(true)

  const [newName, setNewName] = useState('')
  const [newRole, setNewRole] = useState('Mitglied')
  const [newDate, setNewDate] = useState('')
  const [newDiscord, setNewDiscord] = useState('')

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const fetchMembers = async () => {
    const res = await fetch('/api/clan/members')
    const data = await res.json()
    setMembers(data.members || [])
    setLoadingMembers(false)
  }

  useEffect(() => {
    if (user) fetchMembers()
  }, [user])

  const handleAdd = async () => {
    if (!newName || !newDate) { setError('Name und Datum sind erforderlich'); return }
    setSaving(true); setError(''); setSuccess('')
    try {
      const res = await fetch('/api/admin/clan/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ display_name: newName, role: newRole, join_date: newDate, discord_tag: newDiscord || null }),
      })
      const data = await res.json()
      if (!res.ok) setError(data.error || 'Fehler')
      else {
        setSuccess(`${newName} wurde hinzugefügt!`)
        setNewName(''); setNewRole('Mitglied'); setNewDate(''); setNewDiscord('')
        fetchMembers()
      }
    } catch { setError('Fehler') }
    setSaving(false)
  }

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`${name} wirklich entfernen?`)) return
    try {
      const res = await fetch('/api/admin/clan/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      if (res.ok) fetchMembers()
    } catch { setError('Fehler beim Löschen') }
  }

  const handleRoleChange = async (id: string, role: string) => {
    try {
      await fetch('/api/admin/clan/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, role }),
      })
      fetchMembers()
    } catch { setError('Fehler beim Aktualisieren') }
  }

  const handleStufeOverride = async (id: string, value: string) => {
    const stufe_override = value === 'auto' ? null : parseInt(value)
    try {
      await fetch('/api/admin/clan/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, stufe_override }),
      })
      fetchMembers()
    } catch { setError('Fehler beim Aktualisieren') }
  }

  const inputStyle = {
    background: 'var(--muted-bg)',
    border: '1px solid var(--card-border)',
    color: 'var(--foreground)',
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--background)', color: 'var(--foreground)' }}>Laden...</div>
  if (!user || user.clan_role !== 'admin') return <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--background)', color: 'var(--foreground)' }}>Kein Zugriff</div>

  return (
    <div className="min-h-screen" style={{ background: 'var(--background)' }}>
      <div className="max-w-4xl mx-auto px-8 py-10">
        <Link href="/admin" className="text-sm flex items-center gap-1 mb-8 hover:opacity-70" style={{ color: 'var(--muted)' }}>← Zurück zum Admin</Link>

        <h1 className="text-3xl font-bold mb-8" style={{ color: 'var(--foreground)' }}>Clan-Mitglieder</h1>

        {error && <p className="text-red-500 text-sm mb-4 px-4 py-2 rounded-xl" style={{ background: 'rgba(239,68,68,0.1)' }}>{error}</p>}
        {success && <p className="text-green-500 text-sm mb-4 px-4 py-2 rounded-xl" style={{ background: 'rgba(34,197,94,0.1)' }}>{success}</p>}

        {/* Mitglied hinzufügen */}
        <div className="card rounded-2xl p-6 mb-6">
          <h2 className="font-bold text-lg mb-4" style={{ color: 'var(--foreground)' }}>Mitglied hinzufügen</h2>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="text-sm font-medium block mb-1" style={{ color: 'var(--muted)' }}>Minecraft Username</label>
              <input value={newName} onChange={e => setNewName(e.target.value)}
                className="w-full rounded-xl px-4 py-2.5 text-sm outline-none" style={inputStyle} placeholder="uwuleonie" />
            </div>
            <div>
              <label className="text-sm font-medium block mb-1" style={{ color: 'var(--muted)' }}>Rang</label>
              <select value={newRole} onChange={e => setNewRole(e.target.value)}
                className="w-full rounded-xl px-4 py-2.5 text-sm outline-none" style={inputStyle}>
                {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium block mb-1" style={{ color: 'var(--muted)' }}>Beitrittsdatum</label>
              <input value={newDate} onChange={e => setNewDate(e.target.value)} type="date"
                className="w-full rounded-xl px-4 py-2.5 text-sm outline-none" style={inputStyle} />
            </div>
            <div>
              <label className="text-sm font-medium block mb-1" style={{ color: 'var(--muted)' }}>Discord Tag (optional)</label>
              <input value={newDiscord} onChange={e => setNewDiscord(e.target.value)}
                className="w-full rounded-xl px-4 py-2.5 text-sm outline-none" style={inputStyle} placeholder="username" />
            </div>
          </div>
          <button onClick={handleAdd} disabled={saving}
            className="btn-gradient text-white px-6 py-2.5 rounded-xl text-sm font-medium disabled:opacity-50">
            {saving ? 'Hinzufügen...' : '+ Mitglied hinzufügen'}
          </button>
        </div>

        {/* Mitgliederliste */}
        <div className="card rounded-2xl overflow-hidden">
          <div className="px-6 py-4" style={{ borderBottom: '1px solid var(--card-border)' }}>
            <h2 className="font-bold text-lg" style={{ color: 'var(--foreground)' }}>Alle Mitglieder ({members.length})</h2>
          </div>
          {loadingMembers ? (
            <div className="text-center py-10" style={{ color: 'var(--muted)' }}>Laden...</div>
          ) : members.length === 0 ? (
            <div className="text-center py-10" style={{ color: 'var(--muted)' }}>Noch keine Mitglieder</div>
          ) : (
            <div>
              {members.map(member => (
                <div key={member.id} className="flex items-center gap-4 px-6 py-4" style={{ borderBottom: '1px solid var(--card-border)' }}>
                  <img src={`/api/player-heads/${member.display_name}/40`} alt={member.display_name} className="w-10 h-10 rounded-xl" />
                  <div className="flex-1">
                    <p className="font-medium" style={{ color: 'var(--foreground)' }}>{member.display_name}</p>
                    <p className="text-xs" style={{ color: 'var(--muted)' }}>Seit {new Date(member.join_date).toLocaleDateString('de-DE')}</p>
                  </div>
                  <select value={member.role} onChange={e => handleRoleChange(member.id, e.target.value)}
                    className="rounded-xl px-3 py-1.5 text-sm outline-none" style={inputStyle}>
                    {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                  <select value={member.stufe_override ?? 'auto'} onChange={e => handleStufeOverride(member.id, e.target.value)}
                    className="rounded-xl px-3 py-1.5 text-sm outline-none" style={inputStyle}>
                    <option value="auto">🌱 Auto</option>
                    <option value="0">Stufe 0 – Neuling</option>
                    <option value="1">Stufe 1 – Mitglied</option>
                    <option value="2">Stufe 2 – Treues Mitglied</option>
                    <option value="3">Stufe 3 – Vertrauter</option>
                    <option value="4">Stufe 4 – Goat</option>
                    <option value="5">Stufe 5 – OG</option>
                  </select>
                  <button onClick={() => handleDelete(member.id, member.display_name)}
                    className="text-sm px-3 py-1.5 rounded-xl transition-all"
                    style={{ color: '#ef4444', background: 'rgba(239,68,68,0.1)' }}>
                    Entfernen
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}