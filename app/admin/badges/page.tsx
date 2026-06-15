  'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '../../lib/auth-context'
import Link from 'next/link'

type Badge = {
  id: string
  name: string
  icon_url: string
}

type Member = {
  id: string
  display_name: string
  role: string
  badges: Badge[]
}

export default function AdminBadgesPage() {
  const { user, loading } = useAuth()
  const [badges, setBadges] = useState<Badge[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [loadingData, setLoadingData] = useState(true)

  const [newBadgeName, setNewBadgeName] = useState('')
  const [newBadgeIcon, setNewBadgeIcon] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const fetchAll = async () => {
    const [badgesRes, membersRes] = await Promise.all([
      fetch('/api/admin/badges'),
      fetch('/api/clan/members'),
    ])
    const badgesData = await badgesRes.json()
    const membersData = await membersRes.json()
    setBadges(badgesData.badges || [])
    setMembers(membersData.members || [])
    setLoadingData(false)
  }

  useEffect(() => {
    if (user) fetchAll()
  }, [user])

  const handleCreateBadge = async () => {
    if (!newBadgeName || !newBadgeIcon) { setError('Name und Icon-URL erforderlich'); return }
    setSaving(true); setError(''); setSuccess('')
    const res = await fetch('/api/admin/badges', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newBadgeName, icon_url: newBadgeIcon }),
    })
    if (res.ok) {
      setSuccess('Badge erstellt!')
      setNewBadgeName(''); setNewBadgeIcon('')
      fetchAll()
    } else setError('Fehler beim Erstellen')
    setSaving(false)
  }

  const handleDeleteBadge = async (id: string, name: string) => {
    if (!confirm(`Badge "${name}" wirklich löschen?`)) return
    const res = await fetch('/api/admin/badges', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    if (res.ok) fetchAll()
    else setError('Fehler beim Löschen')
  }

  const handleAssign = async (member_id: string, badge_id: string) => {
    await fetch('/api/admin/badges/assign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ member_id, badge_id }),
    })
    fetchAll()
  }

  const handleUnassign = async (member_id: string, badge_id: string) => {
    await fetch('/api/admin/badges/assign', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ member_id, badge_id }),
    })
    fetchAll()
  }

  const memberHasBadge = (member: Member, badge_id: string) =>
    member.badges?.some(b => b.id === badge_id)

  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-900">Laden...</div>
  if (!user || user.username !== 'uwuleonie') return <div className="min-h-screen flex items-center justify-center text-gray-900">Kein Zugriff</div>

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-8 py-10">
        <Link href="/admin" className="text-gray-500 text-sm flex items-center gap-1 mb-8 hover:text-gray-700">← Zurück zum Admin</Link>

        <h1 className="text-3xl font-bold mb-8 text-gray-900">Clan-Abzeichen</h1>

        {error && <p className="text-red-500 text-sm mb-4 bg-red-50 px-4 py-2 rounded-xl">{error}</p>}
        {success && <p className="text-green-600 text-sm mb-4 bg-green-50 px-4 py-2 rounded-xl">{success}</p>}

        {/* Badge erstellen */}
        <div className="bg-white rounded-2xl p-6 shadow-sm mb-6">
          <h2 className="font-bold text-lg mb-4 text-gray-900">Neues Abzeichen erstellen</h2>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Name</label>
              <input value={newBadgeName} onChange={e => setNewBadgeName(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900 outline-none focus:border-purple-400"
                placeholder="z.B. Gründer" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Icon-URL (Emoji oder Bild-URL)</label>
              <input value={newBadgeIcon} onChange={e => setNewBadgeIcon(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900 outline-none focus:border-purple-400"
                placeholder="z.B. 👑 oder https://..." />
            </div>
          </div>
          {newBadgeIcon && (
            <div className="mb-4 flex items-center gap-2 text-sm text-gray-500">
              Vorschau:
              {newBadgeIcon.startsWith('http') ? (
                <img src={newBadgeIcon} alt="preview" className="w-6 h-6 rounded" />
              ) : (
                <span className="text-xl">{newBadgeIcon}</span>
              )}
            </div>
          )}
          <button onClick={handleCreateBadge} disabled={saving}
            className="btn-gradient text-white px-6 py-2.5 rounded-xl text-sm font-medium disabled:opacity-50">
            {saving ? 'Erstellen...' : '+ Abzeichen erstellen'}
          </button>
        </div>

        {/* Badge-Liste */}
        <div className="bg-white rounded-2xl shadow-sm mb-6 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="font-bold text-lg text-gray-900">Alle Abzeichen ({badges.length})</h2>
          </div>
          {loadingData ? (
            <div className="text-center py-10 text-gray-400">Laden...</div>
          ) : badges.length === 0 ? (
            <div className="text-center py-10 text-gray-400">Noch keine Abzeichen erstellt</div>
          ) : (
            <div className="divide-y divide-gray-50">
              {badges.map(badge => (
                <div key={badge.id} className="flex items-center gap-4 px-6 py-4 hover:bg-gray-50">
                  {badge.icon_url.startsWith('http') ? (
                    <img src={badge.icon_url} alt={badge.name} className="w-8 h-8 rounded" />
                  ) : (
                    <span className="text-2xl">{badge.icon_url}</span>
                  )}
                  <span className="flex-1 font-medium text-gray-900">{badge.name}</span>
                  <button onClick={() => handleDeleteBadge(badge.id, badge.name)}
                    className="text-red-400 hover:text-red-600 text-sm px-3 py-1.5 rounded-xl hover:bg-red-50 transition-all">
                    Löschen
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Badges zuweisen */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="font-bold text-lg text-gray-900">Abzeichen zuweisen</h2>
          </div>
          {loadingData ? (
            <div className="text-center py-10 text-gray-400">Laden...</div>
          ) : members.length === 0 ? (
            <div className="text-center py-10 text-gray-400">Keine Mitglieder gefunden</div>
          ) : (
            <div className="divide-y divide-gray-50">
              {members.map(member => (
                <div key={member.id} className="px-6 py-4">
                  <div className="flex items-center gap-3 mb-3">
                    <img src={`https://mc-heads.net/avatar/${member.display_name}/32`}
                      alt={member.display_name} className="w-8 h-8 rounded-lg" />
                    <span className="font-medium text-gray-900">{member.display_name}</span>
                    <span className="text-xs text-gray-400">{member.role}</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {badges.map(badge => {
                      const has = memberHasBadge(member, badge.id)
                      return (
                        <button key={badge.id}
                          onClick={() => has ? handleUnassign(member.id, badge.id) : handleAssign(member.id, badge.id)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${
                            has
                              ? 'bg-purple-100 border-purple-300 text-purple-700 hover:bg-red-50 hover:border-red-300 hover:text-red-600'
                              : 'bg-gray-100 border-gray-200 text-gray-500 hover:bg-purple-50 hover:border-purple-300 hover:text-purple-600'
                          }`}>
                          {badge.icon_url.startsWith('http') ? (
                            <img src={badge.icon_url} alt="" className="w-3.5 h-3.5 rounded" />
                          ) : (
                            <span>{badge.icon_url}</span>
                          )}
                          {badge.name}
                          {has && <span className="ml-0.5">✓</span>}
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )}
