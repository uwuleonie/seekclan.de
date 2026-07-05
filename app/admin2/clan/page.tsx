'use client'

import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../lib/auth-context'
import { usePathname } from 'next/navigation'
import { compressImageFile } from '../../lib/image-compress'

function canWriteOnPath(clanRole: string | null | undefined, pathname: string): boolean {
  if (clanRole === 'administrator' || clanRole === 'owner') return true
  if (clanRole === 'teammitglied') return ['/admin2/update-konzepte', '/admin2/team-chat', '/admin2/wm-tippspiel'].some(p => pathname.startsWith(p))
  return false
}

// ─── Types ───────────────────────────────────────────────────────────────────

type Member = {
  id: string
  display_name: string
  role: string
  join_date: string
  discord_tag: string | null
  has_seek_account: boolean
  stufe_override: number | null
}

type Category = { id: string, name: string, color: string }

type Badge = {
  id: string
  name: string
  icon_url: string
  erreichbar: boolean
  description: string | null
  category_id: string | null
  badge_categories: Category | null
}

type MemberWithBadges = Member & { badges: { id: string }[] }

// ─── Konstanten ──────────────────────────────────────────────────────────────

const ROLES = ['Owner', 'Admin', 'VIP', 'Mod', 'Mitglied']
const TEAM_ROLES = ['Owner', 'Admin', 'Mod']
const PRESET_COLORS = ['#888780', '#639922', '#E24B4A', '#4F46E5', '#C026D3', '#0891B2', '#D97706', '#059669', '#7C3AED']
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

// ─── Hauptseite ──────────────────────────────────────────────────────────────

export default function ClanPage() {
  const { user } = useAuth()
  const pathname = usePathname()
  const canWrite = canWriteOnPath(user?.clan_role, pathname)
  const [tab, setTab] = useState<'mitglieder' | 'abzeichen'>('mitglieder')

  return (
    <div className="max-w-6xl">
      <div className="flex items-start justify-between gap-6 mb-6">
        <div>
          <h1 className="text-3xl font-bold mb-1" style={{ color: 'var(--foreground)' }}>Clan & Abzeichen</h1>
          <p style={{ color: 'var(--muted)' }}>Mitglieder verwalten und Abzeichen vergeben.</p>
        </div>
      </div>

      {!canWrite && (
        <p className="text-xs mb-5" style={{ color: '#EAB308' }}>
          🔒 Nur Lesezugriff — Änderungen sind für deine Rolle nicht möglich.
        </p>
      )}

      <div className="flex gap-2 mb-6">
        {(['mitglieder', 'abzeichen'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className="px-4 py-2 rounded-xl text-sm font-medium transition-all"
            style={tab === t
              ? { background: '#7C3AED22', color: '#7C3AED', border: '1px solid #7C3AED55' }
              : { background: 'var(--muted-bg)', color: 'var(--muted)', border: '1px solid var(--card-border)' }}>
            {t === 'mitglieder' ? '👥 Mitglieder' : '🎖️ Abzeichen'}
          </button>
        ))}
      </div>

      {tab === 'mitglieder' ? <MitgliederTab canWrite={canWrite} /> : <AbzeichenTab canWrite={canWrite} />}
    </div>
  )
}

// ─── Tab: Mitglieder ─────────────────────────────────────────────────────────

function MitgliederTab({ canWrite }: { canWrite: boolean }) {
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
    setSaving(true); setError('')
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
      setError(data.error || 'Fehler')
    }
    setSaving(false)
  }

  const changeRole = async (id: string, role: string) => {
    await fetch(`/api/admin2/clan-members/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role }),
    })
    loadMembers()
  }

  const changeStufe = async (id: string, value: string) => {
    const stufe_override = value === 'auto' ? null : parseInt(value)
    await fetch(`/api/admin2/clan-members/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ stufe_override }),
    })
    loadMembers()
  }

  const removeMember = async (id: string, name: string) => {
    if (!confirm(`${name} wirklich aus dem Clan entfernen?`)) return
    await fetch(`/api/admin2/clan-members/${id}`, { method: 'DELETE' })
    loadMembers()
  }

  const filtered = useMemo(() => members
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
    }), [members, search, filter, sort])

  const teamCount = members.filter(m => TEAM_ROLES.includes(m.role)).length
  const ogCount = members.filter(m => (m.stufe_override ?? autoStufe(m.join_date)) === 5).length
  const neuCount = members.filter(m => (Date.now() - new Date(m.join_date).getTime()) < 1000 * 60 * 60 * 24 * 90).length

  const inputStyle = { background: 'var(--muted-bg)', border: '1px solid var(--card-border)', color: 'var(--foreground)' }

  return (
    <>
      <div className="grid grid-cols-4 gap-4 mb-6">
        <StatCard label="Mitglieder" value={String(members.length)} color="var(--foreground)" />
        <StatCard label="Teammitglieder" value={String(teamCount)} color="#3B82F6" />
        <StatCard label="OGs (Stufe 5)" value={String(ogCount)} color="#F59E0B" />
        <StatCard label="Neu (< 3 Mon.)" value={String(neuCount)} color="#22C55E" />
      </div>

      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Mitglied suchen..."
          className="rounded-xl px-4 py-2.5 text-sm outline-none flex-1 min-w-[200px]" style={inputStyle} />
        {(['alle', 'admin', 'mods', 'mitglieder'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className="px-4 py-2.5 rounded-xl text-sm font-medium capitalize transition-all"
            style={filter === f ? { background: 'var(--muted-bg)', color: 'var(--foreground)', border: '1px solid var(--card-border)' } : { color: 'var(--muted)' }}>
            {f === 'alle' ? 'Alle' : f === 'admin' ? 'Admin' : f === 'mods' ? 'Mods' : 'Mitglieder'}
          </button>
        ))}
        {(['dauer', 'az', 'rang'] as const).map(s => (
          <button key={s} onClick={() => setSort(s)}
            className="px-4 py-2.5 rounded-xl text-sm font-medium transition-all"
            style={sort === s ? { background: 'var(--muted-bg)', color: 'var(--foreground)', border: '1px solid var(--card-border)' } : { color: 'var(--muted)' }}>
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
        <div className="card rounded-2xl p-6 mb-4">
          {error && <p className="text-red-500 text-sm mb-3">{error}</p>}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Minecraft Username"
              className="rounded-xl px-4 py-2.5 text-sm outline-none" style={inputStyle} />
            <select value={newRole} onChange={e => setNewRole(e.target.value)}
              className="rounded-xl px-4 py-2.5 text-sm outline-none" style={inputStyle}>
              {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
            <input type="date" value={newDate} onChange={e => setNewDate(e.target.value)}
              className="rounded-xl px-4 py-2.5 text-sm outline-none" style={inputStyle} />
            <input value={newDiscord} onChange={e => setNewDiscord(e.target.value)} placeholder="Discord Tag (optional)"
              className="rounded-xl px-4 py-2.5 text-sm outline-none" style={inputStyle} />
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
                    className="rounded-xl px-3 py-1.5 text-sm outline-none flex-shrink-0" style={inputStyle}>
                    {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                ) : (
                  <span className="text-xs px-3 py-1.5 rounded-full flex-shrink-0" style={{ background: 'var(--muted-bg)', color: 'var(--foreground)' }}>{m.role}</span>
                )}
                {canWrite ? (
                  <select value={m.stufe_override ?? 'auto'} onChange={e => changeStufe(m.id, e.target.value)}
                    className="rounded-xl px-3 py-1.5 text-sm outline-none flex-shrink-0" style={inputStyle}>
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
        {filtered.length} von {members.length} Mitgliedern · „Auto" berechnet das Abzeichen aus der Clandauer.
      </p>
    </>
  )
}

// ─── Tab: Abzeichen ──────────────────────────────────────────────────────────

function AbzeichenTab({ canWrite }: { canWrite: boolean }) {
  const [badges, setBadges] = useState<Badge[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [members, setMembers] = useState<MemberWithBadges[]>([])
  const [loading, setLoading] = useState(true)

  // Filter/Suche Abzeichen
  const [search, setSearch] = useState('')
  const [catFilter, setCatFilter] = useState<string | null>(null)
  const [erreichbarFilter, setErreichbarFilter] = useState<'alle' | 'ja' | 'nein'>('alle')

  // Neues Abzeichen
  const [showNewBadge, setShowNewBadge] = useState(false)
  const [newName, setNewName] = useState('')
  const [newIconUrl, setNewIconUrl] = useState('')
  const [newErreichbar, setNewErreichbar] = useState(true)
  const [newCatId, setNewCatId] = useState('')
  const [newDescription, setNewDescription] = useState('')
  const [uploadingIcon, setUploadingIcon] = useState(false)
  const [saving, setSaving] = useState(false)

  // Neue Kategorie
  const [showNewCat, setShowNewCat] = useState(false)
  const [newCatName, setNewCatName] = useState('')
  const [newCatColor, setNewCatColor] = useState('#888780')
  const [savingCat, setSavingCat] = useState(false)

  // Edit
  const [editBadge, setEditBadge] = useState<Badge | null>(null)
  const [editName, setEditName] = useState('')
  const [editDesc, setEditDesc] = useState('')
  const [editCat, setEditCat] = useState('')
  const [editErreichbar, setEditErreichbar] = useState(true)

  // Zuweisen
  const [assignMember, setAssignMember] = useState<MemberWithBadges | null>(null)
  const [memberSearch, setMemberSearch] = useState('')
  const [assignSearch, setAssignSearch] = useState('')

  const loadAll = async () => {
    setLoading(true)
    const [badgesRes, catsRes, membersRes] = await Promise.all([
      fetch('/api/admin/badges').then(r => r.json()),
      fetch('/api/admin/badge-categories').then(r => r.json()),
      fetch('/api/clan/members').then(r => r.json()),
    ])
    setBadges(badgesRes.badges || [])
    setCategories(catsRes.categories || [])
    setMembers(membersRes.members || [])
    setLoading(false)
  }

  useEffect(() => { loadAll() }, [])

  const uploadIcon = async (file: File) => {
    setUploadingIcon(true)
    const compressed = await compressImageFile(file)
    const formData = new FormData()
    formData.append('file', compressed)
    const res = await fetch('/api/admin/badges/upload', { method: 'POST', body: formData })
    const data = await res.json()
    if (data.url) setNewIconUrl(data.url)
    setUploadingIcon(false)
  }

  const createBadge = async () => {
    if (!newName.trim() || !newIconUrl) return
    setSaving(true)
    await fetch('/api/admin/badges', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName.trim(), icon_url: newIconUrl, erreichbar: newErreichbar, category_id: newCatId || null, description: newDescription || null }),
    })
    setNewName(''); setNewIconUrl(''); setNewErreichbar(true); setNewCatId(''); setNewDescription('')
    setShowNewBadge(false); setSaving(false)
    loadAll()
  }

  const createCategory = async () => {
    if (!newCatName.trim()) return
    setSavingCat(true)
    await fetch('/api/admin/badge-categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newCatName.trim(), color: newCatColor }),
    })
    setNewCatName(''); setSavingCat(false); setShowNewCat(false)
    loadAll()
  }

  const deleteBadge = async (id: string) => {
    if (!confirm('Dieses Abzeichen wirklich löschen?')) return
    await fetch('/api/admin/badges', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    loadAll()
  }

  const saveEdit = async () => {
    if (!editBadge) return
    await fetch('/api/admin/badges', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: editBadge.id, name: editName, description: editDesc || null, category_id: editCat || null, erreichbar: editErreichbar }),
    })
    setEditBadge(null)
    loadAll()
  }

  const toggleBadgeForMember = async (memberId: string, badgeId: string, hasIt: boolean) => {
    if (hasIt) {
      await fetch('/api/admin/badges/assign', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ member_id: memberId, badge_id: badgeId }) })
    } else {
      await fetch('/api/admin/badges/assign', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ member_id: memberId, badge_id: badgeId }) })
    }
    loadAll()
  }

  const filteredBadges = useMemo(() => badges.filter(b => {
    if (search.trim() && !b.name.toLowerCase().includes(search.toLowerCase())) return false
    if (catFilter && b.category_id !== catFilter) return false
    if (erreichbarFilter === 'ja' && !b.erreichbar) return false
    if (erreichbarFilter === 'nein' && b.erreichbar) return false
    return true
  }), [badges, search, catFilter, erreichbarFilter])

  const filteredMembers = members.filter(m =>
    !memberSearch.trim() || m.display_name.toLowerCase().includes(memberSearch.toLowerCase())
  )

  const inputStyle = { background: 'var(--muted-bg)', border: '1px solid var(--card-border)', color: 'var(--foreground)' }

  if (loading) return <p className="text-sm text-center py-10" style={{ color: 'var(--muted)' }}>Laden...</p>

  return (
    <>
      {/* Kategorien */}
      <div className="card rounded-2xl p-5 mb-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold" style={{ color: 'var(--foreground)' }}>Kategorien</h2>
          {canWrite && (
            <button onClick={() => setShowNewCat(v => !v)} className="text-sm px-3 py-1.5 rounded-xl"
              style={{ background: 'var(--muted-bg)', color: 'var(--foreground)', border: '1px solid var(--card-border)' }}>
              + Kategorie
            </button>
          )}
        </div>
        {showNewCat && canWrite && (
          <div className="flex gap-2 mb-3 flex-wrap">
            <input value={newCatName} onChange={e => setNewCatName(e.target.value)} placeholder="Kategorie-Name"
              className="flex-1 rounded-xl px-3 py-2 text-sm outline-none" style={inputStyle} />
            <div className="flex gap-1.5 flex-wrap items-center">
              {PRESET_COLORS.map(c => (
                <button key={c} onClick={() => setNewCatColor(c)}
                  className="w-6 h-6 rounded-full border-2 transition-all"
                  style={{ background: c, borderColor: newCatColor === c ? 'var(--foreground)' : 'transparent' }} />
              ))}
              <input type="color" value={newCatColor} onChange={e => setNewCatColor(e.target.value)} className="w-8 h-8 rounded-lg cursor-pointer" />
            </div>
            <button onClick={createCategory} disabled={savingCat} className="btn-gradient text-white px-4 py-2 rounded-xl text-sm disabled:opacity-50">
              Erstellen
            </button>
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setCatFilter(null)}
            className="text-xs px-3 py-1.5 rounded-full"
            style={!catFilter ? { background: '#7C3AED', color: '#fff' } : { background: 'var(--muted-bg)', color: 'var(--muted)' }}>
            Alle
          </button>
          {categories.map(cat => (
            <button key={cat.id} onClick={() => setCatFilter(catFilter === cat.id ? null : cat.id)}
              className="text-xs px-3 py-1.5 rounded-full"
              style={catFilter === cat.id
                ? { background: cat.color, color: '#fff' }
                : { background: `${cat.color}22`, color: cat.color, border: `1px solid ${cat.color}55` }}>
              {cat.name}
              {canWrite && (
                <span onClick={e => {
                  e.stopPropagation()
                  if (confirm(`Kategorie "${cat.name}" löschen?`)) {
                    fetch('/api/admin/badge-categories', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: cat.id }) }).then(loadAll)
                  }
                }} className="ml-1.5 opacity-60 hover:opacity-100">✕</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Abzeichen-Liste */}
      <div className="card rounded-2xl p-5 mb-5">
        <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
          <h2 className="font-bold" style={{ color: 'var(--foreground)' }}>Abzeichen ({badges.length})</h2>
          <div className="flex items-center gap-2 flex-wrap">
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Abzeichen suchen..."
              className="rounded-xl px-3 py-1.5 text-sm outline-none" style={{ ...inputStyle, minWidth: 160 }} />
            {(['alle', 'ja', 'nein'] as const).map(f => (
              <button key={f} onClick={() => setErreichbarFilter(f)}
                className="text-xs px-3 py-1.5 rounded-full"
                style={erreichbarFilter === f ? { background: '#7C3AED22', color: '#7C3AED', border: '1px solid #7C3AED55' } : { background: 'var(--muted-bg)', color: 'var(--muted)' }}>
                {f === 'alle' ? 'Alle' : f === 'ja' ? '✅ Erreichbar' : '🔒 Intern'}
              </button>
            ))}
            {canWrite && (
              <button onClick={() => setShowNewBadge(v => !v)} className="btn-gradient text-white px-4 py-2 rounded-xl text-sm font-medium">
                + Abzeichen
              </button>
            )}
          </div>
        </div>

        {showNewBadge && canWrite && (
          <div className="card rounded-xl p-4 mb-4">
            <div className="grid grid-cols-2 gap-3 mb-3">
              <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Name"
                className="rounded-xl px-3 py-2 text-sm outline-none" style={inputStyle} />
              <select value={newCatId} onChange={e => setNewCatId(e.target.value)}
                className="rounded-xl px-3 py-2 text-sm outline-none" style={inputStyle}>
                <option value="">Keine Kategorie</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <textarea value={newDescription} onChange={e => setNewDescription(e.target.value)} placeholder="Beschreibung (optional)" rows={2}
                className="rounded-xl px-3 py-2 text-sm outline-none resize-none col-span-2" style={inputStyle} />
            </div>
            <div className="flex items-center gap-3 mb-3 flex-wrap">
              <label className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: 'var(--foreground)' }}>
                <input type="checkbox" checked={newErreichbar} onChange={e => setNewErreichbar(e.target.checked)} />
                Für Spieler erreichbar
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer px-3 py-1.5 rounded-xl"
                style={{ ...inputStyle, cursor: 'pointer' }}>
                {uploadingIcon ? 'Lädt...' : '📁 Icon hochladen'}
                <input type="file" accept="image/*" className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) uploadIcon(f) }} />
              </label>
              {newIconUrl && <img src={newIconUrl} alt="" className="w-10 h-10 rounded-xl object-contain" style={{ background: 'var(--muted-bg)' }} />}
            </div>
            <div className="flex gap-2">
              <button onClick={createBadge} disabled={saving || !newName.trim() || !newIconUrl}
                className="btn-gradient text-white px-5 py-2 rounded-xl text-sm font-medium disabled:opacity-50">
                {saving ? 'Erstellt...' : 'Erstellen'}
              </button>
              <button onClick={() => setShowNewBadge(false)} className="px-5 py-2 rounded-xl text-sm" style={{ color: 'var(--muted)' }}>Abbrechen</button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {filteredBadges.map(badge => {
            const cat = badge.badge_categories
            return (
              <div key={badge.id} className="rounded-xl p-3 flex flex-col gap-2" style={{ background: 'var(--muted-bg)' }}>
                <div className="flex items-start gap-2">
                  <img src={badge.icon_url} alt="" className="w-10 h-10 rounded-lg object-contain flex-shrink-0" style={{ background: 'var(--background)' }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold truncate" style={{ color: 'var(--foreground)' }}>{badge.name}</p>
                    {cat && (
                      <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ background: `${cat.color}22`, color: cat.color }}>
                        {cat.name}
                      </span>
                    )}
                    {!badge.erreichbar && <span className="text-xs ml-1" style={{ color: 'var(--muted)' }}>🔒</span>}
                  </div>
                </div>
                {badge.description && <p className="text-xs" style={{ color: 'var(--muted)' }}>{badge.description}</p>}
                {canWrite && (
                  <div className="flex gap-1.5 mt-auto">
                    <button onClick={() => {
                      setEditBadge(badge)
                      setEditName(badge.name)
                      setEditDesc(badge.description || '')
                      setEditCat(badge.category_id || '')
                      setEditErreichbar(badge.erreichbar)
                    }}
                      className="flex-1 text-xs py-1 rounded-lg" style={{ background: 'var(--background)', color: 'var(--foreground)' }}>
                      Bearbeiten
                    </button>
                    <button onClick={() => deleteBadge(badge.id)}
                      className="text-xs px-2 py-1 rounded-lg" style={{ color: '#EF4444' }}>✕</button>
                  </div>
                )}
              </div>
            )
          })}
          {filteredBadges.length === 0 && <p className="text-sm col-span-4" style={{ color: 'var(--muted)' }}>Keine Abzeichen gefunden.</p>}
        </div>
      </div>

      {/* Zuweisen */}
      <div className="card rounded-2xl p-5">
        <h2 className="font-bold mb-3" style={{ color: 'var(--foreground)' }}>Abzeichen zuweisen</h2>
        <input value={memberSearch} onChange={e => setMemberSearch(e.target.value)} placeholder="Mitglied suchen..."
          className="w-full rounded-xl px-3 py-2 text-sm outline-none mb-3" style={inputStyle} />
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-4">
          {filteredMembers.map(m => (
            <button key={m.id} onClick={() => { setAssignMember(m === assignMember ? null : m); setAssignSearch('') }}
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-left transition-all"
              style={assignMember?.id === m.id
                ? { background: '#7C3AED22', color: '#7C3AED', border: '1px solid #7C3AED55' }
                : { background: 'var(--muted-bg)', color: 'var(--foreground)' }}>
              <img src={`/api/player-heads/${m.display_name}/24`} alt="" className="w-6 h-6 rounded-md flex-shrink-0" />
              <span className="truncate">{m.display_name}</span>
              {m.badges?.length > 0 && <span className="text-xs ml-auto flex-shrink-0" style={{ color: 'var(--muted)' }}>{m.badges.length}</span>}
            </button>
          ))}
        </div>

        {assignMember && (
          <div>
            <div className="flex items-center gap-3 mb-3">
              <img src={`/api/player-heads/${assignMember.display_name}/32`} alt="" className="w-8 h-8 rounded-lg" />
              <p className="font-bold" style={{ color: 'var(--foreground)' }}>{assignMember.display_name}</p>
              <input value={assignSearch} onChange={e => setAssignSearch(e.target.value)} placeholder="Abzeichen suchen..."
                className="ml-auto rounded-xl px-3 py-1.5 text-sm outline-none" style={{ ...inputStyle, minWidth: 160 }} />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {badges.filter(b => !assignSearch.trim() || b.name.toLowerCase().includes(assignSearch.toLowerCase())).map(badge => {
                const hasIt = assignMember.badges?.some(b => b.id === badge.id)
                return (
                  <button key={badge.id} onClick={() => canWrite && toggleBadgeForMember(assignMember.id, badge.id, !!hasIt)}
                    disabled={!canWrite}
                    className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-left disabled:opacity-50"
                    style={hasIt
                      ? { background: '#A855F722', border: '1px solid #A855F755', color: 'var(--foreground)' }
                      : { background: 'var(--muted-bg)', color: 'var(--foreground)' }}>
                    <img src={badge.icon_url} alt="" className="w-6 h-6 rounded-md object-contain flex-shrink-0" style={{ background: 'var(--background)' }} />
                    <span className="truncate text-xs">{badge.name}</span>
                    {hasIt && <span className="ml-auto flex-shrink-0">✓</span>}
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {editBadge && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6" style={{ background: 'rgba(0,0,0,0.6)' }}>
          <div className="w-full max-w-md rounded-2xl p-6" style={{ background: 'var(--background)', border: '1px solid var(--card-border)' }}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-lg" style={{ color: 'var(--foreground)' }}>Abzeichen bearbeiten</h2>
              <button onClick={() => setEditBadge(null)} style={{ color: 'var(--muted)' }}>✕</button>
            </div>
            <div className="flex items-center gap-3 mb-4">
              <img src={editBadge.icon_url} alt="" className="w-12 h-12 rounded-xl object-contain" style={{ background: 'var(--muted-bg)' }} />
              <input value={editName} onChange={e => setEditName(e.target.value)}
                className="flex-1 rounded-xl px-3 py-2 text-sm outline-none" style={inputStyle} />
            </div>
            <textarea value={editDesc} onChange={e => setEditDesc(e.target.value)} placeholder="Beschreibung (optional)" rows={3}
              className="w-full rounded-xl px-3 py-2 text-sm outline-none resize-none mb-3" style={inputStyle} />
            <select value={editCat} onChange={e => setEditCat(e.target.value)}
              className="w-full rounded-xl px-3 py-2 text-sm outline-none mb-3" style={inputStyle}>
              <option value="">Keine Kategorie</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <label className="flex items-center gap-2 text-sm cursor-pointer mb-4" style={{ color: 'var(--foreground)' }}>
              <input type="checkbox" checked={editErreichbar} onChange={e => setEditErreichbar(e.target.checked)} />
              Für Spieler erreichbar
            </label>
            <div className="flex gap-2">
              <button onClick={saveEdit} className="btn-gradient text-white px-5 py-2.5 rounded-xl text-sm font-medium flex-1">Speichern</button>
              <button onClick={() => setEditBadge(null)} className="px-5 py-2.5 rounded-xl text-sm" style={{ color: 'var(--muted)' }}>Abbrechen</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// ─── Hilfkomponenten ─────────────────────────────────────────────────────────

function StatCard({ label, value, color }: { label: string, value: string, color: string }) {
  return (
    <div className="card rounded-2xl p-5">
      <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--muted)' }}>{label}</p>
      <p className="text-3xl font-bold" style={{ color }}>{value}</p>
    </div>
  )
}