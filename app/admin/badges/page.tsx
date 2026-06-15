'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '../../lib/auth-context'
import Link from 'next/link'
import Modal from '../../components/Modal'

type Category = {
  id: string
  name: string
  color: string
}

type Badge = {
  id: string
  name: string
  icon_url: string
  erreichbar: boolean
  description: string | null
  category_id: string | null
  badge_categories: Category | null
}

type Member = {
  id: string
  display_name: string
  role: string
  badges: { id: string }[]
}

const PRESET_COLORS = [
  '#888780', '#639922', '#E24B4A', '#4F46E5', '#C026D3',
  '#0891B2', '#D97706', '#059669', '#DC2626', '#7C3AED',
]

export default function AdminBadgesPage() {
  const { user, loading } = useAuth()
  const [badges, setBadges] = useState<Badge[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [loadingData, setLoadingData] = useState(true)

  // Neues Abzeichen
  const [newBadgeName, setNewBadgeName] = useState('')
  const [newBadgeIcon, setNewBadgeIcon] = useState('')
  const [newBadgeErreichbar, setNewBadgeErreichbar] = useState(true)
  const [newBadgeCategory, setNewBadgeCategory] = useState('')
  const [newBadgeDescription, setNewBadgeDescription] = useState('')

  // Neue Kategorie
  const [newCatName, setNewCatName] = useState('')
  const [newCatColor, setNewCatColor] = useState('#888780')

  // Edit-Modal
  const [editBadge, setEditBadge] = useState<Badge | null>(null)
  const [editName, setEditName] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editCategory, setEditCategory] = useState('')
  const [editErreichbar, setEditErreichbar] = useState(true)

  const [saving, setSaving] = useState(false)
  const [savingEdit, setSavingEdit] = useState(false)
  const [savingCat, setSavingCat] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const fetchAll = async () => {
    const [badgesRes, membersRes, catsRes] = await Promise.all([
      fetch('/api/admin/badges'),
      fetch('/api/clan/members'),
      fetch('/api/admin/badge-categories'),
    ])
    const badgesData = await badgesRes.json()
    const membersData = await membersRes.json()
    const catsData = await catsRes.json()
    setBadges(badgesData.badges || [])
    setMembers(membersData.members || [])
    setCategories(catsData.categories || [])
    setLoadingData(false)
  }

  useEffect(() => {
    if (user) fetchAll()
  }, [user])

  const openEdit = (badge: Badge) => {
    setEditBadge(badge)
    setEditName(badge.name)
    setEditDescription(badge.description || '')
    setEditCategory(badge.category_id || '')
    setEditErreichbar(badge.erreichbar)
    setError('')
    setSuccess('')
  }

  const handleSaveEdit = async () => {
    if (!editBadge) return
    setSavingEdit(true); setError(''); setSuccess('')
    const res = await fetch('/api/admin/badges', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: editBadge.id,
        name: editName,
        description: editDescription || null,
        category_id: editCategory || null,
        erreichbar: editErreichbar,
      }),
    })
    if (res.ok) {
      setSuccess('Gespeichert!')
      setEditBadge(null)
      fetchAll()
    } else setError('Fehler beim Speichern')
    setSavingEdit(false)
  }

  const handleCreateCategory = async () => {
    if (!newCatName) { setError('Kategoriename erforderlich'); return }
    setSavingCat(true); setError(''); setSuccess('')
    const res = await fetch('/api/admin/badge-categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newCatName, color: newCatColor }),
    })
    if (res.ok) {
      setSuccess('Kategorie erstellt!')
      setNewCatName('')
      setNewCatColor('#888780')
      fetchAll()
    } else setError('Fehler beim Erstellen')
    setSavingCat(false)
  }

  const handleDeleteCategory = async (id: string, name: string) => {
    if (!confirm(`Kategorie "${name}" wirklich löschen? Abzeichen verlieren ihre Zuordnung.`)) return
    const res = await fetch('/api/admin/badge-categories', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    if (res.ok) fetchAll()
    else setError('Fehler beim Löschen')
  }

  const handleCreateBadge = async () => {
    if (!newBadgeName || !newBadgeIcon) { setError('Name und Icon-URL erforderlich'); return }
    setSaving(true); setError(''); setSuccess('')
    const res = await fetch('/api/admin/badges', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: newBadgeName,
        icon_url: newBadgeIcon,
        erreichbar: newBadgeErreichbar,
        category_id: newBadgeCategory || null,
        description: newBadgeDescription || null,
      }),
    })
    if (res.ok) {
      setSuccess('Abzeichen erstellt!')
      setNewBadgeName(''); setNewBadgeIcon(''); setNewBadgeDescription(''); setNewBadgeCategory('')
      fetchAll()
    } else setError('Fehler beim Erstellen')
    setSaving(false)
  }

  const handleDeleteBadge = async (id: string, name: string) => {
    if (!confirm(`Abzeichen "${name}" wirklich löschen?`)) return
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
  if (!user || user.clan_role !== 'admin') return <div className="min-h-screen flex items-center justify-center text-gray-900">Kein Zugriff</div>

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-8 py-10">
        <Link href="/admin" className="text-gray-500 text-sm flex items-center gap-1 mb-8 hover:text-gray-700">← Zurück zum Admin</Link>

        <h1 className="text-3xl font-bold mb-8 text-gray-900">Clan-Abzeichen</h1>

        {error && <p className="text-red-500 text-sm mb-4 bg-red-50 px-4 py-2 rounded-xl">{error}</p>}
        {success && <p className="text-green-600 text-sm mb-4 bg-green-50 px-4 py-2 rounded-xl">{success}</p>}

        {/* ── Kategorien ── */}
        <div className="bg-white rounded-2xl p-6 shadow-sm mb-6">
          <h2 className="font-bold text-lg mb-4 text-gray-900">Kategorien</h2>
          {categories.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-4">
              {categories.map(cat => (
                <div key={cat.id} className="flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium text-white"
                  style={{ backgroundColor: cat.color }}>
                  {cat.name}
                  <button onClick={() => handleDeleteCategory(cat.id, cat.name)}
                    className="opacity-70 hover:opacity-100 text-xs ml-1">✕</button>
                </div>
              ))}
            </div>
          )}
          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <label className="text-sm font-medium text-gray-700 block mb-1">Name</label>
              <input value={newCatName} onChange={e => setNewCatName(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900 outline-none focus:border-purple-400"
                placeholder="z.B. Events" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Farbe</label>
              <div className="flex gap-1.5 flex-wrap" style={{ maxWidth: 220 }}>
                {PRESET_COLORS.map(c => (
                  <button key={c} onClick={() => setNewCatColor(c)}
                    className="w-7 h-7 rounded-full border-2 transition-all"
                    style={{
                      backgroundColor: c,
                      borderColor: newCatColor === c ? '#1f2937' : 'transparent',
                      transform: newCatColor === c ? 'scale(1.2)' : 'scale(1)',
                    }} />
                ))}
                <label className="w-7 h-7 rounded-full border-2 border-gray-200 flex items-center justify-center cursor-pointer overflow-hidden relative" title="Eigene Farbe">
                  <span className="text-xs">🎨</span>
                  <input type="color" value={newCatColor} onChange={e => setNewCatColor(e.target.value)}
                    className="absolute opacity-0 w-full h-full cursor-pointer" />
                </label>
              </div>
            </div>
            <button onClick={handleCreateCategory} disabled={savingCat}
              className="btn-gradient text-white px-5 py-2.5 rounded-xl text-sm font-medium disabled:opacity-50 whitespace-nowrap">
              {savingCat ? '...' : '+ Kategorie'}
            </button>
          </div>
        </div>

        {/* ── Abzeichen erstellen ── */}
        <div className="bg-white rounded-2xl p-6 shadow-sm mb-6">
          <h2 className="font-bold text-lg mb-4 text-gray-900">Neues Abzeichen erstellen</h2>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Name</label>
              <input value={newBadgeName} onChange={e => setNewBadgeName(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900 outline-none focus:border-purple-400"
                placeholder="z.B. Gründer" />
              <div className="flex items-center gap-2 mt-2">
                <input type="checkbox" id="erreichbar" checked={newBadgeErreichbar} onChange={e => setNewBadgeErreichbar(e.target.checked)}
                  className="w-4 h-4 rounded accent-purple-500" />
                <label htmlFor="erreichbar" className="text-sm text-gray-600">Noch erreichbar?</label>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Icon (Emoji oder URL)</label>
              <input value={newBadgeIcon} onChange={e => setNewBadgeIcon(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900 outline-none focus:border-purple-400"
                placeholder="z.B. 👑 oder https://..." />
              <div className="mt-2">
                <input type="file" accept="image/*" onChange={async (e) => {
                  const file = e.target.files?.[0]
                  if (!file) return
                  setError(''); setSaving(true)
                  const formData = new FormData()
                  formData.append('file', file)
                  const res = await fetch('/api/admin/badges/upload', { method: 'POST', body: formData })
                  const data = await res.json()
                  if (data.url) { setNewBadgeIcon(data.url); setSuccess('Bild hochgeladen!') }
                  else setError('Upload fehlgeschlagen')
                  setSaving(false)
                }}
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900 outline-none focus:border-purple-400 file:mr-3 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100" />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Kategorie</label>
              <select value={newBadgeCategory} onChange={e => setNewBadgeCategory(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900 outline-none focus:border-purple-400">
                <option value="">— Keine Kategorie —</option>
                {categories.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Beschreibung</label>
              <input value={newBadgeDescription} onChange={e => setNewBadgeDescription(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900 outline-none focus:border-purple-400"
                placeholder="Wofür gibt es dieses Abzeichen?" />
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

        {/* ── Badge-Liste ── */}
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
                  <div className="flex-1">
                    <span className="font-medium text-gray-900">{badge.name}</span>
                    {badge.badge_categories && (
                      <span className="ml-2 text-xs px-2 py-0.5 rounded-full text-white font-medium"
                        style={{ backgroundColor: badge.badge_categories.color }}>
                        {badge.badge_categories.name}
                      </span>
                    )}
                    {badge.description && (
                      <p className="text-xs text-gray-400 mt-0.5">{badge.description}</p>
                    )}
                  </div>
                  {!badge.erreichbar && (
                    <span className="text-xs text-red-400 bg-red-50 px-2 py-0.5 rounded-full">Nicht mehr erreichbar</span>
                  )}
                  <button onClick={() => openEdit(badge)}
                    className="text-purple-400 hover:text-purple-600 text-sm px-3 py-1.5 rounded-xl hover:bg-purple-50 transition-all">
                    Bearbeiten
                  </button>
                  <button onClick={() => handleDeleteBadge(badge.id, badge.name)}
                    className="text-red-400 hover:text-red-600 text-sm px-3 py-1.5 rounded-xl hover:bg-red-50 transition-all">
                    Löschen
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Badges zuweisen ── */}
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

      {/* ── Edit Modal ── */}
      {editBadge && (
        <Modal onClose={() => setEditBadge(null)}>
          <div className="relative p-8 h-full overflow-y-auto">
            <button onClick={() => setEditBadge(null)}
              className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 text-sm">
              ✕
            </button>
            <div className="flex items-center gap-3 mb-6">
              {editBadge.icon_url.startsWith('http') ? (
                <img src={editBadge.icon_url} alt={editBadge.name} className="w-10 h-10 rounded-xl" />
              ) : (
                <span className="text-3xl">{editBadge.icon_url}</span>
              )}
              <h3 className="text-lg font-bold text-gray-900">Abzeichen bearbeiten</h3>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Name</label>
                <input value={editName} onChange={e => setEditName(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900 outline-none focus:border-purple-400" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Kategorie</label>
                <select value={editCategory} onChange={e => setEditCategory(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900 outline-none focus:border-purple-400">
                  <option value="">— Keine Kategorie —</option>
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Beschreibung</label>
                <input value={editDescription} onChange={e => setEditDescription(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900 outline-none focus:border-purple-400"
                  placeholder="Wofür gibt es dieses Abzeichen?" />
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="edit-erreichbar" checked={editErreichbar} onChange={e => setEditErreichbar(e.target.checked)}
                  className="w-4 h-4 rounded accent-purple-500" />
                <label htmlFor="edit-erreichbar" className="text-sm text-gray-600">Noch erreichbar?</label>
              </div>
            </div>
            {error && <p className="text-red-500 text-sm mt-3">{error}</p>}
            <div className="flex gap-3 mt-6">
              <button onClick={() => setEditBadge(null)}
                className="flex-1 border border-gray-200 text-gray-600 px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50">
                Abbrechen
              </button>
              <button onClick={handleSaveEdit} disabled={savingEdit}
                className="flex-1 btn-gradient text-white px-4 py-2.5 rounded-xl text-sm font-medium disabled:opacity-50">
                {savingEdit ? 'Speichern...' : 'Speichern'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}