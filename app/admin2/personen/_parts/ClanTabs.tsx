'use client'

// /admin2/personen → Tabs „Clan“ und „Abzeichen“ (früher /admin2/clan).
//   Clan:      wer einen Clan-Rang hat (Rang-System) – mit Clan-Akte (Beitritt, Stufe, Discord), Freischaltungen.
//              Aufnehmen = Clan-Akte + Clan-Rang, Entfernen = Rang zurück auf den Standard-Rang (Akte bleibt als „ehemalig“) –
//              dabei wird gefragt, ob die Person gegangen ist oder geworfen wurde (steht dann in der Clan-Historie).
//   Abzeichen: Abzeichen und Kategorien anlegen und an Mitglieder vergeben.

import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../../lib/auth-context'
import { compressImageFile } from '../../../lib/image-compress'
import { darf, darfRangGeben } from '@/app/lib/rechte-def'
import { STUFEN as STUFEN_ZEIT, stufeVon, zeitSeit } from '@/app/lib/clan-stufen'
import Anfragen from './Anfragen'

// ─── Types ───────────────────────────────────────────────────────────────────

type RangKurz = { id: number; anzeige: string; farbe: string; prioritaet: number; clan: boolean; team: boolean }
type ClanPerson = {
  akteId: string | null; key: string; name: string; mcName: string; username: string | null; uuid: string | null
  rang: RangKurz; beitritt: string | null; rangSeit: string | null; stufe_override: number | null; discord_tag: string | null; aktiv: boolean
}
type RangVoll = RangKurz & { schluessel: string | null; vergabeBis: number }

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

type MemberWithBadges = { id: string; display_name: string; badges: { id: string }[] }

// ─── Konstanten ──────────────────────────────────────────────────────────────

const PRESET_COLORS = ['#888780', '#639922', '#E24B4A', '#4F46E5', '#C026D3', '#0891B2', '#D97706', '#059669', '#7C3AED']
const STUFEN = STUFEN_ZEIT.map((s, i) => ({ value: i, label: s.name }))



/** Zeilen der Mitgliederliste: auf breiten Bildschirmen feste Spalten, damit alles untereinander steht */
const ZEILEN_CSS = `
.ga-clan-zeile { display: grid; grid-template-columns: minmax(0, 1fr); gap: 8px; align-items: center; }
@media (min-width: 900px) {
  .ga-clan-zeile { grid-template-columns: minmax(180px, 1fr) 120px 140px 210px 150px 110px; gap: 10px; }
  .ga-clan-ohne { grid-column: 3 / -1; }
}`

// ─── Tab: Mitglieder ─────────────────────────────────────────────────────────

export function MitgliederTab({ canWrite, oeffnen }: { canWrite: boolean; oeffnen?: (key: string) => void }) {
  const { user } = useAuth()
  const [leute, setLeute] = useState<ClanPerson[]>([])
  const [raenge, setRaenge] = useState<RangVoll[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<number | 'alle' | 'ehemalig'>('alle')
  const [sort, setSort] = useState<'dauer' | 'az' | 'rang'>('rang')
  const [showAdd, setShowAdd] = useState(false)
  const [neu, setNeu] = useState({ mcName: '', join_date: new Date().toISOString().slice(0, 10), discord_tag: '', rangId: '' })
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ t: string; f?: boolean } | null>(null)
  const [entfernen, setEntfernen] = useState<{ akteId: string; name: string } | null>(null)
  const darfRaenge = darf(user, 'raenge.vergeben')

  const laden = () => {
    setLoading(true)
    Promise.all([
      fetch('/api/admin2/clan-members', { cache: 'no-store' }).then(r => r.json()),
      fetch('/api/admin2/ranks', { cache: 'no-store' }).then(r => r.json()),
    ]).then(([m, r]) => { setLeute(m.members || []); setRaenge(r.ranks || []) }).finally(() => setLoading(false))
  }
  useEffect(() => { laden() }, [])
  const melden = (t: string, f = false) => { setMsg({ t, f }); setTimeout(() => setMsg(null), f ? 6000 : 3000) }

  const anfrage = async (url: string, method: string, body?: unknown) => {
    const r = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined })
    const d = await r.json().catch(() => ({}))
    if (!r.ok) { melden(d.error || 'Fehler', true); return false }
    laden(); return true
  }

  /** Minecraft-Account (Name oder UUID) zuweisen, ohne /link im Spiel */
  const minecraftZuweisen = async (p: { key: string; akteId: string | null; name: string; mcName: string }) => {
    const ziel = p.key.startsWith('u:') ? p.key : p.akteId ? `cm:${p.akteId}` : null
    if (!ziel) return
    const eingabe = window.prompt(`Minecraft-Name oder UUID für ${p.name}:`, p.mcName)
    if (!eingabe?.trim()) return
    if (await anfrage('/api/admin2/personen', 'PATCH', { key: ziel, minecraft: eingabe.trim() })) melden(`${p.name} ist jetzt mit Minecraft verbunden`)
  }

  const aufnehmen = async () => {
    if (!neu.mcName.trim()) return
    setBusy(true)
    const ok = await anfrage('/api/admin2/clan-members', 'POST', { ...neu, rangId: neu.rangId ? Number(neu.rangId) : undefined })
    setBusy(false)
    if (ok) { melden(`${neu.mcName} ist jetzt im Clan`); setShowAdd(false); setNeu({ mcName: '', join_date: new Date().toISOString().slice(0, 10), discord_tag: '', rangId: '' }) }
  }

  const clanRaenge = raenge.filter(r => r.clan)
  const aktive = leute.filter(p => p.aktiv)
  const gezeigt = useMemo(() => leute
    .filter(p => (filter === 'ehemalig' ? !p.aktiv : p.aktiv && (filter === 'alle' || p.rang.id === filter)))
    .filter(p => !search.trim() || p.name.toLowerCase().includes(search.toLowerCase()) || p.mcName.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (sort === 'az') return a.name.localeCompare(b.name)
      if (sort === 'rang') return b.rang.prioritaet - a.rang.prioritaet || a.name.localeCompare(b.name)
      return new Date(a.beitritt ?? 0).getTime() - new Date(b.beitritt ?? 0).getTime()
    }), [leute, filter, search, sort])

  const ogCount = aktive.filter(p => stufeVon(p.beitritt, p.stufe_override) === 5).length
  const neuCount = aktive.filter(p => p.beitritt && Date.now() - new Date(p.beitritt).getTime() < 90 * 86_400_000).length
  const inputStyle = { background: 'var(--muted-bg)', border: '1px solid var(--card-border)', color: 'var(--foreground)' }

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <StatCard label="Im Clan" value={String(aktive.length)} color="#7C3AED" />
        <StatCard label="Ränge im Clan" value={String(new Set(aktive.map(p => p.rang.id)).size)} color="#0891B2" />
        <StatCard label="OG-Stufe" value={String(ogCount)} color="#D97706" />
        <StatCard label="Neu (90 Tage)" value={String(neuCount)} color="#059669" />
      </div>

      <Anfragen canWrite={canWrite} onGeaendert={laden} />

      {msg && <div className="rounded-xl px-4 py-3 text-sm mb-4" style={{ background: msg.f ? '#ef44441a' : '#22c55e1a', color: msg.f ? '#f87171' : '#4ade80' }}>{msg.t}</div>}

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Name suchen …" className="px-3 py-2 rounded-xl text-sm" style={inputStyle} />
        <button onClick={() => setFilter('alle')} className="px-3 py-1.5 rounded-full text-xs font-medium" style={filter === 'alle' ? { background: 'var(--foreground)', color: 'var(--background)' } : { background: 'var(--muted-bg)', color: 'var(--muted)' }}>Alle ({aktive.length})</button>
        {clanRaenge.filter(r => aktive.some(p => p.rang.id === r.id)).map(r => (
          <button key={r.id} onClick={() => setFilter(r.id)} className="px-3 py-1.5 rounded-full text-xs font-medium"
            style={filter === r.id ? { background: r.farbe, color: '#111' } : { background: `${r.farbe}1f`, color: r.farbe }}>
            {r.anzeige} ({aktive.filter(p => p.rang.id === r.id).length})
          </button>
        ))}
        {leute.some(p => !p.aktiv) && (
          <button onClick={() => setFilter('ehemalig')} className="px-3 py-1.5 rounded-full text-xs font-medium" style={filter === 'ehemalig' ? { background: 'var(--foreground)', color: 'var(--background)' } : { background: 'var(--muted-bg)', color: 'var(--muted)' }}>
            Ehemalige ({leute.filter(p => !p.aktiv).length})
          </button>
        )}
        <select value={sort} onChange={e => setSort(e.target.value as typeof sort)} className="ml-auto px-3 py-2 rounded-xl text-sm" style={inputStyle}>
          <option value="rang">Nach Rang</option><option value="dauer">Nach Zeit im Clan</option><option value="az">A → Z</option>
        </select>
        {canWrite && <button onClick={() => setShowAdd(s => !s)} className="px-4 py-2 rounded-xl text-sm font-medium text-white" style={{ background: 'linear-gradient(135deg, #4F46E5, #7C3AED, #C026D3)' }}>+ Aufnehmen</button>}
      </div>

      {showAdd && canWrite && (
        <div className="rounded-2xl p-5 mb-5 grid sm:grid-cols-5 gap-3 items-end" style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}>
          <label className="text-xs sm:col-span-2" style={{ color: 'var(--muted)' }}>Minecraft-Name
            <input value={neu.mcName} onChange={e => setNeu(n => ({ ...n, mcName: e.target.value }))} className="mt-1 w-full px-3 py-2 rounded-xl text-sm" style={inputStyle} placeholder="z. B. Notch" /></label>
          <label className="text-xs" style={{ color: 'var(--muted)' }}>Beitritt
            <input type="date" value={neu.join_date} onChange={e => setNeu(n => ({ ...n, join_date: e.target.value }))} className="mt-1 w-full px-3 py-2 rounded-xl text-sm" style={inputStyle} /></label>
          <label className="text-xs" style={{ color: 'var(--muted)' }}>Rang
            <select value={neu.rangId} onChange={e => setNeu(n => ({ ...n, rangId: e.target.value }))} className="mt-1 w-full px-3 py-2 rounded-xl text-sm" style={inputStyle}>
              <option value="">Clan (Standard)</option>
              {clanRaenge.filter(r => darfRangGeben(user, null, r)).map(r => <option key={r.id} value={r.id}>{r.anzeige}</option>)}
            </select></label>
          <label className="text-xs" style={{ color: 'var(--muted)' }}>Discord (optional)
            <input value={neu.discord_tag} onChange={e => setNeu(n => ({ ...n, discord_tag: e.target.value }))} className="mt-1 w-full px-3 py-2 rounded-xl text-sm" style={inputStyle} /></label>
          <div className="sm:col-span-5 flex justify-end gap-2">
            <button onClick={() => setShowAdd(false)} className="px-4 py-2 rounded-xl text-sm" style={inputStyle}>Abbrechen</button>
            <button onClick={aufnehmen} disabled={busy || !neu.mcName.trim()} className="px-4 py-2 rounded-xl text-sm font-medium text-white disabled:opacity-40" style={{ background: '#7C3AED' }}>{busy ? 'Suche bei Mojang …' : 'In den Clan aufnehmen'}</button>
          </div>
        </div>
      )}

      {loading ? <p style={{ color: 'var(--muted)' }}>Lädt …</p> : !gezeigt.length ? <p style={{ color: 'var(--muted)' }}>Niemand gefunden.</p> : (
        <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid var(--card-border)' }}>
          <style>{ZEILEN_CSS}</style>
          {gezeigt.map((p, i) => {
            const stufe = stufeVon(p.beitritt, p.stufe_override)
            const optionen = raenge.filter(r => darfRangGeben(user, p.rang, r))
            return (
              <div key={p.akteId ?? p.key} className="ga-clan-zeile px-4 py-3" style={{ background: i % 2 ? 'transparent' : 'var(--card-bg)', borderTop: i ? '1px solid var(--card-border)' : undefined, opacity: p.aktiv ? 1 : 0.6 }}>
                {/* Spalte 1: Kopf, Name, Infos */}
                <div className="flex items-center gap-3 min-w-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`/api/player-heads/${encodeURIComponent(p.mcName)}/64?v=2`} alt="" className="w-8 h-8 rounded-md flex-shrink-0" loading="lazy" />
                  <div className="min-w-0">
                    <p className="font-semibold text-sm truncate" style={{ color: 'var(--foreground)' }}>
                      {oeffnen ? <button type="button" onClick={() => oeffnen(p.key)} className="hover:underline text-left" title="Alles zu dieser Person">{p.name}</button> : p.name}
                      {p.mcName !== p.name && <span className="text-xs font-normal ml-1.5" style={{ color: 'var(--muted)' }}>({p.mcName})</span>}
                    </p>
                    <p className="text-[11px]" style={{ color: 'var(--muted)' }}>
                      {p.beitritt ? `seit ${zeitSeit(p.beitritt)}` : 'ohne Beitrittsdatum'}{p.username && p.username !== p.name ? ` · Konto: ${p.username}` : ''}{!p.uuid ? ' · ⚠️ ohne Minecraft-UUID' : ''}
                      {!p.uuid && canWrite && (p.akteId || p.key.startsWith('u:')) && (
                        <button type="button" onClick={() => minecraftZuweisen(p)} className="ml-2 underline" style={{ color: '#a78bfa' }}>Minecraft zuweisen</button>
                      )}
                    </p>
                  </div>
                </div>
                {/* Spalte 2: Rang */}
                {canWrite && darfRaenge && optionen.some(o => o.id === p.rang.id) ? (
                  <select value={p.rang.id} onChange={e => anfrage('/api/admin2/personen', 'POST', { key: p.key, rangId: Number(e.target.value) })} className="w-full px-2 py-1.5 rounded-lg text-xs font-semibold" style={{ ...inputStyle, color: p.rang.farbe }}>
                    {optionen.map(r => <option key={r.id} value={r.id}>{r.anzeige}</option>)}
                  </select>
                ) : (
                  <span className="justify-self-start text-xs px-2.5 py-1 rounded-full font-semibold" style={{ background: `${p.rang.farbe}22`, color: p.rang.farbe }}>{p.rang.anzeige}</span>
                )}
                {p.akteId ? (
                  <>
                    {/* Spalte 3–6: Beitritt, Stufe, Discord, Entfernen */}
                    <input type="date" disabled={!canWrite} defaultValue={p.beitritt?.slice(0, 10) ?? ''} onBlur={e => e.target.value && e.target.value !== p.beitritt?.slice(0, 10) && anfrage(`/api/admin2/clan-members/${p.akteId}`, 'PATCH', { join_date: e.target.value })}
                      className="w-full px-2 py-1.5 rounded-lg text-xs" style={inputStyle} title="Beitrittsdatum" />
                    <select disabled={!canWrite} value={p.stufe_override ?? 'auto'} onChange={e => anfrage(`/api/admin2/clan-members/${p.akteId}`, 'PATCH', { stufe_override: e.target.value === 'auto' ? null : Number(e.target.value) })}
                      className="w-full px-2 py-1.5 rounded-lg text-xs" style={inputStyle} title="Stufe">
                      <option value="auto">Stufe auto ({STUFEN[stufe].label})</option>
                      {STUFEN.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                    </select>
                    <input disabled={!canWrite} defaultValue={p.discord_tag ?? ''} placeholder="Discord" onBlur={e => e.target.value !== (p.discord_tag ?? '') && anfrage(`/api/admin2/clan-members/${p.akteId}`, 'PATCH', { discord_tag: e.target.value || null })}
                      className="w-full px-2 py-1.5 rounded-lg text-xs" style={inputStyle} title="Discord" />
                    {canWrite ? (p.aktiv
                      ? <button onClick={() => setEntfernen({ akteId: p.akteId!, name: p.name })} className="w-full px-2 py-1.5 rounded-lg text-xs" style={{ ...inputStyle, color: '#f87171' }}>Entfernen</button>
                      : <button onClick={() => confirm(`Die Clan-Akte von ${p.name} endgültig löschen (mit Abzeichen)?`) && anfrage(`/api/admin2/clan-members/${p.akteId}?endgueltig=1`, 'DELETE')} className="w-full px-2 py-1.5 rounded-lg text-xs" style={{ ...inputStyle, color: '#f87171' }}>Akte löschen</button>) : <span />}
                  </>
                ) : <span className="ga-clan-ohne text-[11px]" style={{ color: 'var(--muted)' }}>noch keine Clan-Akte – sie entsteht bei der Umstellung oder beim Aufnehmen</span>}
              </div>
            )
          })}
        </div>
      )}

      {/* Entfernen: gegangen oder geworfen? (steht so in der Clan-Historie) */}
      {entfernen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: '#0009' }} onClick={() => setEntfernen(null)}>
          <div className="rounded-2xl p-5 w-full max-w-sm space-y-3" style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }} onClick={e => e.stopPropagation()}>
            <p className="font-bold" style={{ color: 'var(--foreground)' }}>{entfernen.name} aus dem Clan entfernen</p>
            <p className="text-xs" style={{ color: 'var(--muted)' }}>Der Rang geht zurück auf den Standard-Rang, Beitritt und Abzeichen bleiben gespeichert. Was steht in der Clan-Historie?</p>
            <div className="grid gap-2">
              {([['verlassen', 'Hat den Clan verlassen', '#94a3b8'], ['geworfen', 'Wurde geworfen', '#f87171'], ['entfernt', 'Wurde entfernt (ohne Angabe)', '#fb923c']] as const).map(([a, text, farbe]) => (
                <button key={a} onClick={async () => { const e = entfernen; setEntfernen(null); if (await anfrage(`/api/admin2/clan-members/${e.akteId}?austritt=${a}`, 'DELETE')) melden(`${e.name} ist nicht mehr im Clan`) }}
                  className="px-3 py-2 rounded-xl text-sm font-medium text-left" style={{ background: `${farbe}1a`, color: farbe, border: `1px solid ${farbe}55` }}>{text}</button>
              ))}
              <button onClick={() => setEntfernen(null)} className="px-3 py-2 rounded-xl text-sm" style={inputStyle}>Abbrechen</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// ─── Tab: Abzeichen ──────────────────────────────────────────────────────────

export function AbzeichenTab({ canWrite }: { canWrite: boolean }) {
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
      fetch('/api/admin2/badges').then(r => r.json()),
      fetch('/api/admin2/badge-categories').then(r => r.json()),
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
    const res = await fetch('/api/admin2/badges/upload', { method: 'POST', body: formData })
    const data = await res.json()
    if (data.url) setNewIconUrl(data.url)
    setUploadingIcon(false)
  }

  const createBadge = async () => {
    if (!newName.trim() || !newIconUrl) return
    setSaving(true)
    await fetch('/api/admin2/badges', {
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
    await fetch('/api/admin2/badge-categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newCatName.trim(), color: newCatColor }),
    })
    setNewCatName(''); setSavingCat(false); setShowNewCat(false)
    loadAll()
  }

  const deleteBadge = async (id: string) => {
    if (!confirm('Dieses Abzeichen wirklich löschen?')) return
    await fetch('/api/admin2/badges', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    loadAll()
  }

  const saveEdit = async () => {
    if (!editBadge) return
    await fetch('/api/admin2/badges', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: editBadge.id, name: editName, description: editDesc || null, category_id: editCat || null, erreichbar: editErreichbar }),
    })
    setEditBadge(null)
    loadAll()
  }

  const toggleBadgeForMember = async (memberId: string, badgeId: string, hasIt: boolean) => {
    if (hasIt) {
      await fetch('/api/admin2/badges/assign', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ member_id: memberId, badge_id: badgeId }) })
    } else {
      await fetch('/api/admin2/badges/assign', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ member_id: memberId, badge_id: badgeId }) })
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
                    fetch('/api/admin2/badge-categories', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: cat.id }) }).then(loadAll)
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
              <img src={`/api/player-heads/${m.display_name}/64?v=2`} alt="" className="w-6 h-6 rounded-md flex-shrink-0" />
              <span className="truncate">{m.display_name}</span>
              {m.badges?.length > 0 && <span className="text-xs ml-auto flex-shrink-0" style={{ color: 'var(--muted)' }}>{m.badges.length}</span>}
            </button>
          ))}
        </div>

        {assignMember && (
          <div>
            <div className="flex items-center gap-3 mb-3">
              <img src={`/api/player-heads/${assignMember.display_name}/64?v=2`} alt="" className="w-8 h-8 rounded-lg" />
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

export function StatCard({ label, value, color }: { label: string, value: string, color: string }) {
  return (
    <div className="card rounded-2xl p-5">
      <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--muted)' }}>{label}</p>
      <p className="text-3xl font-bold" style={{ color }}>{value}</p>
    </div>
  )
}