'use client'

import { useState, useEffect, useMemo } from 'react'
import { useAuth } from '../../lib/auth-context'
import Link from 'next/link'
import Modal from '../../components/Modal'
import { compressImageFile, convertToPng } from '../../lib/image-compress'

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

// Muss exakt mit STUFEN aus app/abzeichen/page.tsx, app/clan/page.tsx,
// app/[username]/page.tsx und app/[username]/abzeichen/page.tsx übereinstimmen.
const STUFEN_LABELS = ['Neuling', 'Mitglied', 'Treues Mitglied', 'Vertrauter', 'Goat', 'OG']

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

  // Edit Modal
  const [editBadge, setEditBadge] = useState<Badge | null>(null)
  const [editName, setEditName] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editCategory, setEditCategory] = useState('')
  const [editErreichbar, setEditErreichbar] = useState(true)

  // Badge-Liste Filter
  const [badgeSearch, setBadgeSearch] = useState('')
  const [badgeCatFilter, setBadgeCatFilter] = useState<string | null>(null)
  const [badgeErreichbarFilter, setBadgeErreichbarFilter] = useState<'alle' | 'ja' | 'nein'>('alle')

  // Zuweisen
  const [selectedMember, setSelectedMember] = useState<Member | null>(null)
  const [memberSearch, setMemberSearch] = useState('')
  const [assignBadgeSearch, setAssignBadgeSearch] = useState('')

  const [saving, setSaving] = useState(false)
  const [savingEdit, setSavingEdit] = useState(false)
  const [savingCat, setSavingCat] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Clandauer-Stufen-Icons (stufe0.png … stufe5.png, fester Dateiname)
  const [stufeUploading, setStufeUploading] = useState<number | null>(null)
  const [stufePreviewBust, setStufePreviewBust] = useState(0)

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

  const uploadStufeIcon = async (file: File, stufeIndex: number) => {
    setStufeUploading(stufeIndex)
    setError('')
    try {
      const png = await convertToPng(file)
      const formData = new FormData()
      formData.append('file', png)
      formData.append('stufe_index', String(stufeIndex))
      const res = await fetch('/api/admin/badges/upload-stufe-icon', { method: 'POST', body: formData })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error || 'Upload fehlgeschlagen')
        setStufeUploading(null)
        return
      }
      setSuccess(`Stufe ${stufeIndex} Icon hochgeladen!`)
      setStufePreviewBust(b => b + 1) // Cache-Buster, damit das neue Bild sofort angezeigt wird
    } catch {
      setError('Upload fehlgeschlagen')
    }
    setStufeUploading(null)
  }

  // Gefilterte Badges für die Liste
  const filteredBadges = useMemo(() => {
    return badges.filter(b => {
      if (badgeSearch && !b.name.toLowerCase().includes(badgeSearch.toLowerCase())) return false
      if (badgeCatFilter && b.category_id !== badgeCatFilter) return false
      if (badgeErreichbarFilter === 'ja' && !b.erreichbar) return false
      if (badgeErreichbarFilter === 'nein' && b.erreichbar) return false
      return true
    })
  }, [badges, badgeSearch, badgeCatFilter, badgeErreichbarFilter])

  // Gefilterte Mitglieder für Zuweisen
  const filteredMembers = useMemo(() => {
    if (!memberSearch) return members
    return members.filter(m => m.display_name.toLowerCase().includes(memberSearch.toLowerCase()))
  }, [members, memberSearch])

  // Badges gruppiert nach Kategorie für das ausgewählte Mitglied
  const groupedBadgesForMember = useMemo(() => {
    const search = assignBadgeSearch.toLowerCase()
    const filtered = assignBadgeSearch
      ? badges.filter(b => b.name.toLowerCase().includes(search))
      : badges

    const groups: { cat: Category | null, badges: Badge[] }[] = []
    categories.forEach(cat => {
      const catBadges = filtered.filter(b => b.category_id === cat.id)
      if (catBadges.length > 0) groups.push({ cat, badges: catBadges })
    })
    const uncategorized = filtered.filter(b => !b.category_id)
    if (uncategorized.length > 0) groups.push({ cat: null, badges: uncategorized })
    return groups
  }, [badges, categories, assignBadgeSearch])

  const openEdit = (badge: Badge) => {
    setEditBadge(badge)
    setEditName(badge.name)
    setEditDescription(badge.description || '')
    setEditCategory(badge.category_id || '')
    setEditErreichbar(badge.erreichbar)
    setError('')
  }

  const handleSaveEdit = async () => {
    if (!editBadge) return
    setSavingEdit(true); setError(''); setSuccess('')
    const res = await fetch('/api/admin/badges', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: editBadge.id, name: editName, description: editDescription || null, category_id: editCategory || null, erreichbar: editErreichbar }),
    })
    if (res.ok) { setSuccess('Gespeichert!'); setEditBadge(null); fetchAll() }
    else setError('Fehler beim Speichern')
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
    if (res.ok) { setSuccess('Kategorie erstellt!'); setNewCatName(''); setNewCatColor('#888780'); fetchAll() }
    else setError('Fehler beim Erstellen')
    setSavingCat(false)
  }

  const handleDeleteCategory = async (id: string, name: string) => {
    if (!confirm(`Kategorie "${name}" wirklich löschen?`)) return
    const res = await fetch('/api/admin/badge-categories', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    if (res.ok) fetchAll()
    else setError('Fehler beim Löschen')
  }

  const handleCreateBadge = async () => {
    if (!newBadgeName || !newBadgeIcon) { setError('Name und Icon erforderlich'); return }
    setSaving(true); setError(''); setSuccess('')
    const res = await fetch('/api/admin/badges', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newBadgeName, icon_url: newBadgeIcon, erreichbar: newBadgeErreichbar, category_id: newBadgeCategory || null, description: newBadgeDescription || null }),
    })
    if (res.ok) { setSuccess('Abzeichen erstellt!'); setNewBadgeName(''); setNewBadgeIcon(''); setNewBadgeDescription(''); setNewBadgeCategory(''); fetchAll() }
    else setError('Fehler beim Erstellen')
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
    await fetch('/api/admin/badges/assign', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ member_id, badge_id }) })
    fetchAll()
  }

  const handleUnassign = async (member_id: string, badge_id: string) => {
    await fetch('/api/admin/badges/assign', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ member_id, badge_id }) })
    fetchAll()
  }

  const memberHasBadge = (member: Member, badge_id: string) => member.badges?.some(b => b.id === badge_id)

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

        <h1 className="text-3xl font-bold mb-8" style={{ color: 'var(--foreground)' }}>Clan-Abzeichen</h1>

        {error && <p className="text-red-500 text-sm mb-4 px-4 py-2 rounded-xl" style={{ background: 'rgba(239,68,68,0.1)' }}>{error}</p>}
        {success && <p className="text-green-500 text-sm mb-4 px-4 py-2 rounded-xl" style={{ background: 'rgba(34,197,94,0.1)' }}>{success}</p>}

        {/* ── Kategorien ── */}
        <div className="card rounded-2xl p-6 mb-6">
          <h2 className="font-bold text-lg mb-4" style={{ color: 'var(--foreground)' }}>Kategorien</h2>
          {categories.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-4">
              {categories.map(cat => (
                <div key={cat.id} className="flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium text-white" style={{ backgroundColor: cat.color }}>
                  {cat.name}
                  <button onClick={() => handleDeleteCategory(cat.id, cat.name)} className="opacity-70 hover:opacity-100 text-xs ml-1">✕</button>
                </div>
              ))}
            </div>
          )}
          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <label className="text-sm font-medium block mb-1" style={{ color: 'var(--muted)' }}>Name</label>
              <input value={newCatName} onChange={e => setNewCatName(e.target.value)}
                className="w-full rounded-xl px-4 py-2.5 text-sm outline-none" style={inputStyle} placeholder="z.B. Events" />
            </div>
            <div>
              <label className="text-sm font-medium block mb-1" style={{ color: 'var(--muted)' }}>Farbe</label>
              <div className="flex gap-1.5 flex-wrap" style={{ maxWidth: 220 }}>
                {PRESET_COLORS.map(c => (
                  <button key={c} onClick={() => setNewCatColor(c)}
                    className="w-7 h-7 rounded-full border-2 transition-all"
                    style={{ backgroundColor: c, borderColor: newCatColor === c ? 'var(--foreground)' : 'transparent', transform: newCatColor === c ? 'scale(1.2)' : 'scale(1)' }} />
                ))}
                <label className="w-7 h-7 rounded-full border-2 flex items-center justify-center cursor-pointer overflow-hidden relative" style={{ borderColor: 'var(--card-border)' }}>
                  <span className="text-xs">🎨</span>
                  <input type="color" value={newCatColor} onChange={e => setNewCatColor(e.target.value)} className="absolute opacity-0 w-full h-full cursor-pointer" />
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
        <div className="card rounded-2xl p-6 mb-6">
          <h2 className="font-bold text-lg mb-4" style={{ color: 'var(--foreground)' }}>Neues Abzeichen erstellen</h2>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="text-sm font-medium block mb-1" style={{ color: 'var(--muted)' }}>Name</label>
              <input value={newBadgeName} onChange={e => setNewBadgeName(e.target.value)}
                className="w-full rounded-xl px-4 py-2.5 text-sm outline-none" style={inputStyle} placeholder="z.B. Gründer" />
              <div className="flex items-center gap-2 mt-2">
                <input type="checkbox" id="erreichbar" checked={newBadgeErreichbar} onChange={e => setNewBadgeErreichbar(e.target.checked)} className="w-4 h-4 rounded accent-purple-500" />
                <label htmlFor="erreichbar" className="text-sm" style={{ color: 'var(--muted)' }}>Noch erreichbar?</label>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium block mb-1" style={{ color: 'var(--muted)' }}>Icon (Emoji oder URL)</label>
              <input value={newBadgeIcon} onChange={e => setNewBadgeIcon(e.target.value)}
                className="w-full rounded-xl px-4 py-2.5 text-sm outline-none" style={inputStyle} placeholder="z.B. 👑 oder https://..." />
              <div className="mt-2">
                <input type="file" accept="image/*" onChange={async (e) => {
                  const file = e.target.files?.[0]
                  if (!file) return
                  setSaving(true)
                  setError('')
                  try {
                    const compressed = await compressImageFile(file)
                    const formData = new FormData()
                    formData.append('file', compressed)
                    const res = await fetch('/api/admin/badges/upload', { method: 'POST', body: formData })
                    if (!res.ok) {
                      setError(res.status === 413 ? 'Bild ist trotz Komprimierung zu groß. Bitte ein kleineres Bild wählen.' : 'Upload fehlgeschlagen')
                      setSaving(false)
                      return
                    }
                    const data = await res.json()
                    if (data.url) { setNewBadgeIcon(data.url); setSuccess('Bild hochgeladen!') }
                    else setError('Upload fehlgeschlagen')
                  } catch {
                    setError('Upload fehlgeschlagen')
                  }
                  setSaving(false)
                }} className="w-full rounded-xl px-4 py-2.5 text-sm outline-none file:mr-3 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-purple-50 file:text-purple-700"
                  style={inputStyle} />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium block mb-1" style={{ color: 'var(--muted)' }}>Kategorie</label>
              <select value={newBadgeCategory} onChange={e => setNewBadgeCategory(e.target.value)}
                className="w-full rounded-xl px-4 py-2.5 text-sm outline-none" style={inputStyle}>
                <option value="">— Keine Kategorie —</option>
                {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium block mb-1" style={{ color: 'var(--muted)' }}>Beschreibung</label>
              <input value={newBadgeDescription} onChange={e => setNewBadgeDescription(e.target.value)}
                className="w-full rounded-xl px-4 py-2.5 text-sm outline-none" style={inputStyle} placeholder="Wofür gibt es dieses Abzeichen?" />
            </div>
          </div>
          {newBadgeIcon && (
            <div className="mb-4 flex items-center gap-2 text-sm" style={{ color: 'var(--muted)' }}>
              Vorschau:
              {newBadgeIcon.startsWith('http') ? <img src={newBadgeIcon} alt="preview" className="w-6 h-6 rounded" /> : <span className="text-xl">{newBadgeIcon}</span>}
            </div>
          )}
          <button onClick={handleCreateBadge} disabled={saving}
            className="btn-gradient text-white px-6 py-2.5 rounded-xl text-sm font-medium disabled:opacity-50">
            {saving ? 'Erstellen...' : '+ Abzeichen erstellen'}
          </button>
        </div>

        {/* ── Clandauer-Stufen-Icons ── */}
        <div className="card rounded-2xl p-6 mb-6">
          <h2 className="font-bold text-lg mb-1" style={{ color: 'var(--foreground)' }}>Clandauer-Stufen-Icons</h2>
          <p className="text-sm mb-4" style={{ color: 'var(--muted)' }}>
            Die 6 Icons für das automatische Mitgliedsdauer-System (Neuling bis OG). Diese werden NICHT als eigene
            Abzeichen geführt, sondern fest unter stufe0.png – stufe5.png gespeichert und direkt von den
            Stufen-Seiten geladen.
          </p>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-4">
            {STUFEN_LABELS.map((label, i) => (
              <div key={i} className="text-center">
                <label className="block cursor-pointer group">
                  <div className="w-16 h-16 mx-auto rounded-xl flex items-center justify-center overflow-hidden relative"
                    style={{ background: 'var(--muted-bg)', border: '1px solid var(--card-border)' }}>
                    <img
                      key={`${i}-${stufePreviewBust}`}
                      src={`/api/uploads/badge-icons/stufe${i}.png?v=${stufePreviewBust}`}
                      alt={label}
                      className="w-full h-full object-contain"
                      onError={e => { (e.target as HTMLImageElement).style.opacity = '0.15' }}
                      onLoad={e => { (e.target as HTMLImageElement).style.opacity = '1' }}
                    />
                    {stufeUploading === i && (
                      <div className="absolute inset-0 flex items-center justify-center text-xs" style={{ background: 'rgba(0,0,0,0.5)', color: '#fff' }}>...</div>
                    )}
                  </div>
                  <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if (f) uploadStufeIcon(f, i); e.target.value = '' }} />
                  <p className="text-xs mt-1.5 group-hover:underline" style={{ color: 'var(--muted)' }}>Stufe {i}</p>
                  <p className="text-[11px]" style={{ color: 'var(--muted)' }}>{label}</p>
                </label>
              </div>
            ))}
          </div>
        </div>

        {/* ── Alle Abzeichen ── */}
        <div className="card rounded-2xl overflow-hidden mb-6">
          <div className="px-6 py-4" style={{ borderBottom: '1px solid var(--card-border)' }}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-bold text-lg" style={{ color: 'var(--foreground)' }}>Alle Abzeichen ({filteredBadges.length})</h2>
            </div>
            {/* Suche + Filter */}
            <div className="flex gap-3 flex-wrap">
              <input value={badgeSearch} onChange={e => setBadgeSearch(e.target.value)}
                className="flex-1 rounded-xl px-4 py-2 text-sm outline-none min-w-40" style={inputStyle} placeholder="🔍 Abzeichen suchen..." />
              <div className="flex rounded-xl overflow-hidden text-xs border" style={{ borderColor: 'var(--card-border)' }}>
                {(['alle', 'ja', 'nein'] as const).map(f => (
                  <button key={f} onClick={() => setBadgeErreichbarFilter(f)}
                    className="px-3 py-2 font-medium transition-all"
                    style={badgeErreichbarFilter === f ? { background: 'var(--foreground)', color: 'var(--background)' } : { color: 'var(--muted)', background: 'var(--card)' }}>
                    {f === 'alle' ? 'Alle' : f === 'ja' ? '✓ Erreichbar' : '✕ Nicht mehr'}
                  </button>
                ))}
              </div>
            </div>
            {/* Kategorie Filter */}
            <div className="flex gap-2 flex-wrap mt-3">
              <button onClick={() => setBadgeCatFilter(null)}
                className="px-3 py-1 rounded-full text-xs font-medium transition-all"
                style={!badgeCatFilter ? { background: 'var(--foreground)', color: 'var(--background)' } : { background: 'var(--muted-bg)', color: 'var(--muted)' }}>
                Alle
              </button>
              {categories.map(cat => (
                <button key={cat.id} onClick={() => setBadgeCatFilter(badgeCatFilter === cat.id ? null : cat.id)}
                  className="px-3 py-1 rounded-full text-xs font-medium transition-all text-white"
                  style={{ backgroundColor: cat.color, opacity: badgeCatFilter === cat.id || !badgeCatFilter ? 1 : 0.4 }}>
                  {cat.name}
                </button>
              ))}
            </div>
          </div>

          {loadingData ? (
            <div className="text-center py-10" style={{ color: 'var(--muted)' }}>Laden...</div>
          ) : filteredBadges.length === 0 ? (
            <div className="text-center py-10" style={{ color: 'var(--muted)' }}>Keine Abzeichen gefunden</div>
          ) : (
            <div>
              {filteredBadges.map(badge => (
                <div key={badge.id} className="flex items-center gap-4 px-6 py-4" style={{ borderBottom: '1px solid var(--card-border)' }}>
                  {badge.icon_url.startsWith('http') ? <img src={badge.icon_url} alt={badge.name} className="w-8 h-8 rounded" /> : <span className="text-2xl">{badge.icon_url}</span>}
                  <div className="flex-1">
                    <span className="font-medium" style={{ color: 'var(--foreground)' }}>{badge.name}</span>
                    {badge.badge_categories && (
                      <span className="ml-2 text-xs px-2 py-0.5 rounded-full text-white font-medium" style={{ backgroundColor: badge.badge_categories.color }}>{badge.badge_categories.name}</span>
                    )}
                    {badge.description && <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>{badge.description}</p>}
                  </div>
                  {!badge.erreichbar && <span className="text-xs px-2 py-0.5 rounded-full text-red-400" style={{ background: 'rgba(239,68,68,0.1)' }}>Nicht mehr erreichbar</span>}
                  <button onClick={() => openEdit(badge)} className="text-sm px-3 py-1.5 rounded-xl transition-all" style={{ color: '#7C3AED', background: 'rgba(124,58,237,0.1)' }}>Bearbeiten</button>
                  <button onClick={() => handleDeleteBadge(badge.id, badge.name)} className="text-sm px-3 py-1.5 rounded-xl transition-all" style={{ color: '#ef4444', background: 'rgba(239,68,68,0.1)' }}>Löschen</button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Abzeichen zuweisen ── */}
        <div className="card rounded-2xl overflow-hidden">
          <div className="px-6 py-4" style={{ borderBottom: '1px solid var(--card-border)' }}>
            <h2 className="font-bold text-lg" style={{ color: 'var(--foreground)' }}>Abzeichen zuweisen</h2>
          </div>

          {!selectedMember ? (
            // Mitglied auswählen
            <div className="p-6">
              <input value={memberSearch} onChange={e => setMemberSearch(e.target.value)}
                className="w-full rounded-xl px-4 py-2.5 text-sm outline-none mb-4" style={inputStyle} placeholder="🔍 Mitglied suchen..." />
              <div className="grid grid-cols-2 gap-3">
                {filteredMembers.map(member => (
                  <button key={member.id} onClick={() => setSelectedMember(member)}
                    className="flex items-center gap-3 p-3 rounded-xl text-left transition-all hover:opacity-80"
                    style={{ background: 'var(--muted-bg)', border: '1px solid var(--card-border)' }}>
                    <img src={`https://mc-heads.net/avatar/${member.display_name}/32`} alt={member.display_name} className="w-8 h-8 rounded-lg" />
                    <div>
                      <p className="font-medium text-sm" style={{ color: 'var(--foreground)' }}>{member.display_name}</p>
                      <p className="text-xs" style={{ color: 'var(--muted)' }}>{member.badges?.length || 0} Abzeichen</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            // Badges für ausgewähltes Mitglied
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <button onClick={() => { setSelectedMember(null); setAssignBadgeSearch('') }}
                  className="text-sm hover:opacity-70" style={{ color: 'var(--muted)' }}>← Zurück</button>
                <img src={`https://mc-heads.net/avatar/${selectedMember.display_name}/32`} alt={selectedMember.display_name} className="w-8 h-8 rounded-lg" />
                <span className="font-bold" style={{ color: 'var(--foreground)' }}>{selectedMember.display_name}</span>
                <span className="text-xs px-2 py-0.5 rounded-full ml-auto" style={{ background: 'var(--muted-bg)', color: 'var(--muted)' }}>
                  {selectedMember.badges?.length || 0} / {badges.length} Abzeichen
                </span>
              </div>

              <input value={assignBadgeSearch} onChange={e => setAssignBadgeSearch(e.target.value)}
                className="w-full rounded-xl px-4 py-2.5 text-sm outline-none mb-4" style={inputStyle} placeholder="🔍 Abzeichen suchen..." />

              <div className="space-y-4">
                {groupedBadgesForMember.map(({ cat, badges: catBadges }) => (
                  <div key={cat?.id || 'uncategorized'}>
                    <div className="flex items-center gap-2 mb-2">
                      {cat ? (
                        <span className="px-2 py-0.5 rounded-full text-xs font-bold text-white" style={{ backgroundColor: cat.color }}>{cat.name}</span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-xs font-bold text-white bg-gray-400">Sonstige</span>
                      )}
                      <div className="flex-1 h-px" style={{ background: 'var(--card-border)' }} />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {catBadges.map(badge => {
                        // Immer aktuellen Member aus der members-Liste holen
                        const currentMember = members.find(m => m.id === selectedMember.id) || selectedMember
                        const has = memberHasBadge(currentMember, badge.id)
                        return (
                          <button key={badge.id}
                            onClick={() => {
                              if (has) handleUnassign(selectedMember.id, badge.id)
                              else handleAssign(selectedMember.id, badge.id)
                            }}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all border"
                            style={has
                              ? { background: 'rgba(124,58,237,0.15)', borderColor: '#7C3AED', color: '#7C3AED' }
                              : { background: 'var(--muted-bg)', borderColor: 'var(--card-border)', color: 'var(--muted)' }}>
                            {badge.icon_url.startsWith('http') ? <img src={badge.icon_url} alt="" className="w-3.5 h-3.5 rounded" /> : <span>{badge.icon_url}</span>}
                            {badge.name}
                            {has && <span className="ml-0.5">✓</span>}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Edit Modal */}
      {editBadge && (
        <Modal onClose={() => setEditBadge(null)}>
          <div className="relative p-8 h-full overflow-y-auto" style={{ background: 'var(--card)' }}>
            <button onClick={() => setEditBadge(null)}
              className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full text-sm"
              style={{ background: 'var(--muted-bg)', color: 'var(--muted)' }}>✕</button>
            <div className="flex items-center gap-3 mb-6">
              {editBadge.icon_url.startsWith('http') ? <img src={editBadge.icon_url} alt={editBadge.name} className="w-10 h-10 rounded-xl" /> : <span className="text-3xl">{editBadge.icon_url}</span>}
              <h3 className="text-lg font-bold" style={{ color: 'var(--foreground)' }}>Abzeichen bearbeiten</h3>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium block mb-1" style={{ color: 'var(--muted)' }}>Name</label>
                <input value={editName} onChange={e => setEditName(e.target.value)}
                  className="w-full rounded-xl px-4 py-2.5 text-sm outline-none" style={inputStyle} />
              </div>
              <div>
                <label className="text-sm font-medium block mb-1" style={{ color: 'var(--muted)' }}>Kategorie</label>
                <select value={editCategory} onChange={e => setEditCategory(e.target.value)}
                  className="w-full rounded-xl px-4 py-2.5 text-sm outline-none" style={inputStyle}>
                  <option value="">— Keine Kategorie —</option>
                  {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium block mb-1" style={{ color: 'var(--muted)' }}>Beschreibung</label>
                <input value={editDescription} onChange={e => setEditDescription(e.target.value)}
                  className="w-full rounded-xl px-4 py-2.5 text-sm outline-none" style={inputStyle} placeholder="Wofür gibt es dieses Abzeichen?" />
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="edit-erreichbar" checked={editErreichbar} onChange={e => setEditErreichbar(e.target.checked)} className="w-4 h-4 rounded accent-purple-500" />
                <label htmlFor="edit-erreichbar" className="text-sm" style={{ color: 'var(--muted)' }}>Noch erreichbar?</label>
              </div>
            </div>
            {error && <p className="text-red-500 text-sm mt-3">{error}</p>}
            <div className="flex gap-3 mt-6">
              <button onClick={() => setEditBadge(null)}
                className="flex-1 rounded-xl px-4 py-2.5 text-sm font-medium"
                style={{ border: '1px solid var(--card-border)', color: 'var(--muted)' }}>
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