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
}

const ROLES = ['Owner', 'Admin', 'VIP', 'Mod', 'Mitglied']

export default function AdminClanPage() {
  const { user, loading } = useAuth()
  const [members, setMembers] = useState<Member[]>([])
  const [loadingMembers, setLoadingMembers] = useState(true)

  // Neues Mitglied
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
    setSaving(true)
    setError('')
    setSuccess('')
    try {
      const res = await fetch('/api/admin/clan/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          display_name: newName,
          role: newRole,
          join_date: newDate,
          discord_tag: newDiscord || null,
        }),
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

  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-900">Laden...</div>
  if (!user || user.username !== 'uwuleonie') return <div className="min-h-screen flex items-center justify-center text-gray-900">Kein Zugriff</div>

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-8 py-10">
        <Link href="/admin" className="text-gray-500 text-sm flex items-center gap-1 mb-8 hover:text-gray-700">← Zurück zum Admin</Link>

        <h1 className="text-3xl font-bold mb-8 text-gray-900">Clan-Mitglieder</h1>

        {error && <p className="text-red-500 text-sm mb-4 bg-red-50 px-4 py-2 rounded-xl">{error}</p>}
        {success && <p className="text-green-600 text-sm mb-4 bg-green-50 px-4 py-2 rounded-xl">{success}</p>}

        {/* Neues Mitglied */}
        <div className="bg-white rounded-2xl p-6 shadow-sm mb-6">
          <h2 className="font-bold text-lg mb-4 text-gray-900">Mitglied hinzufügen</h2>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Minecraft Username</label>
              <input value={newName} onChange={e => setNewName(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900 outline-none focus:border-purple-400"
                placeholder="uwuleonie" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Rang</label>
              <select value={newRole} onChange={e => setNewRole(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900 outline-none focus:border-purple-400">
                {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Beitrittsdatum</label>
              <input value={newDate} onChange={e => setNewDate(e.target.value)} type="date"
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900 outline-none focus:border-purple-400" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Discord Tag (optional)</label>
              <input value={newDiscord} onChange={e => setNewDiscord(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900 outline-none focus:border-purple-400"
                placeholder="username" />
            </div>
          </div>
          <button onClick={handleAdd} disabled={saving}
            className="btn-gradient text-white px-6 py-2.5 rounded-xl text-sm font-medium disabled:opacity-50">
            {saving ? 'Hinzufügen...' : '+ Mitglied hinzufügen'}
          </button>
        </div>

        {/* Mitgliederliste */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="font-bold text-lg text-gray-900">Alle Mitglieder ({members.length})</h2>
          </div>
          {loadingMembers ? (
            <div className="text-center py-10 text-gray-400">Laden...</div>
          ) : members.length === 0 ? (
            <div className="text-center py-10 text-gray-400">Noch keine Mitglieder</div>
          ) : (
            <div className="divide-y divide-gray-50">
              {members.map(member => (
                <div key={member.id} className="flex items-center gap-4 px-6 py-4 hover:bg-gray-50">
                  <img src={`https://mc-heads.net/avatar/${member.display_name}/40`}
                    alt={member.display_name} className="w-10 h-10 rounded-xl" />
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">{member.display_name}</p>
                    <p className="text-gray-400 text-xs">Seit {new Date(member.join_date).toLocaleDateString('de-DE')}</p>
                  </div>
                  <select value={member.role} onChange={e => handleRoleChange(member.id, e.target.value)}
                    className="border border-gray-200 rounded-xl px-3 py-1.5 text-sm text-gray-900 outline-none focus:border-purple-400">
                    {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                  <button onClick={() => handleDelete(member.id, member.display_name)}
                    className="text-red-400 hover:text-red-600 text-sm px-3 py-1.5 rounded-xl hover:bg-red-50 transition-all">
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