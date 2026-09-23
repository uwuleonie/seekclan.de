'use client'

import React, { useState, useEffect, useRef } from 'react'

// ── Typen ─────────────────────────────────────────────────────────────────────
type Club    = { id: string; name: string; short: string; logo_url: string | null; country: string }
type Match   = { id: string; matchday: number; home_club_id: string; away_club_id: string; kickoff: string; result_home: number | null; result_away: number | null; phase: 'ligaphase' }
type TableRow= { club_id: string; position: number; played: number; won: number; drawn: number; lost: number; goals_for: number; goals_against: number; points: number }
type Tip     = { id: string; match_id: string; user_id: string | null; username: string | null; gast_name: string | null; tip_home: number; tip_away: number }

type Participant = {
  name: string
  minecraft_username: string | null
  type: 'user' | 'gast'
  ucl_match_count: number
  has_ucl_table: boolean
  has_uwcl_match: boolean
  has_uwcl_table: boolean
}

type PlayerDetail = {
  player: { name: string; role: string | null; type: string; minecraft_username: string | null }
  tips: any[]
  uwclTips: any[]
  tableTip: string[] | null
  uwclTableTip: string[] | null
  _tab?: string
}

type Props = {
  matches: Match[]
  clubs: Club[]
  allTips: Tip[]
  myTips: Tip[]
  table: TableRow[]
  setMatches: React.Dispatch<React.SetStateAction<Match[]>>
  setTable: React.Dispatch<React.SetStateAction<TableRow[]>>
  reloadTable: () => void
  uwclMatches?: Match[]
  uwclClubs?: Club[]
  reloadUwclTable?: () => void
  setUwclMatches?: React.Dispatch<React.SetStateAction<Match[]>>
}

// ── Farben ────────────────────────────────────────────────────────────────────
const C = {
  gold:   '#c9a84c',
  goldL:  '#e8c96a',
  blue:   '#0099ff',
  muted:  'rgba(180,210,255,0.45)',
  green:  '#4caf50',
  purple: '#9c27b0',
  red:    '#ef5350',
  bg:     'rgba(4,8,28,0.98)',
  border: 'rgba(255,255,255,0.07)',
  row:    'rgba(255,255,255,0.03)',
}

function zoneColor(pos: number) {
  if (pos <= 8)  return C.green
  if (pos <= 24) return C.blue
  return C.purple
}

function getTipPoints(tip: { tip_home: number; tip_away: number }, match: { result_home: number | null; result_away: number | null }, allForMatch: Tip[]) {
  if (match.result_home === null || match.result_away === null) return null
  const rh = match.result_home, ra = match.result_away
  const th = tip.tip_home,    ta = tip.tip_away
  // Genaues Ergebnis
  if (th === rh && ta === ra) {
    const isAlone = allForMatch.filter(t => t.tip_home === rh && t.tip_away === ra).length === 1
    return isAlone ? 5 : 3
  }
  // Richtiges Torverhältnis — einziger: 4 Pkt
  if (th - ta === rh - ra) {
    const isAlone = allForMatch.filter(t => t.tip_home - t.tip_away === rh - ra).length === 1
    return isAlone ? 4 : 2
  }
  // Richtiger Gewinner / Unentschieden — einziger: 3 Pkt
  if (Math.sign(th - ta) === Math.sign(rh - ra)) {
    const isAlone = allForMatch.filter(t => Math.sign(t.tip_home - t.tip_away) === Math.sign(rh - ra)).length === 1
    return isAlone ? 3 : 1
  }
  return 0
}

// ── Kleine Hilfskomponenten ───────────────────────────────────────────────────
function ClubLogo({ club, size = 20 }: { club: Club | undefined; size?: number }) {
  const [err, setErr] = useState(false)
  useEffect(() => { setErr(false) }, [club?.id, club?.logo_url])
  const dim = { width: size, height: size, flexShrink: 0 as const }
  if (!club) return <div style={{ ...dim, borderRadius: '50%', background: 'rgba(255,255,255,0.1)' }} />
  if (club.logo_url && !err)
    return <img src={club.logo_url} alt={club.short} style={{ ...dim, objectFit: 'contain' }} onError={() => setErr(true)} />
  return <div style={{ ...dim, borderRadius: '50%', background: 'linear-gradient(135deg,#1a237e,#3d5afe)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 7, color: '#fff', fontWeight: 700 }}>{club.short.slice(0,3)}</div>
}

function MCHead({ username, size = 28 }: { username: string | null | undefined; size?: number }) {
  const [err, setErr] = useState(false)
  const dim = { width: size, height: size, borderRadius: 4, flexShrink: 0 as const }
  if (username && !err)
    return <img src={`/api/player-heads/${username}/${size}`} alt={username} style={dim} onError={() => setErr(true)} />
  return (
    <div style={{ ...dim, background: 'rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <svg width={size * 0.6} height={size * 0.6} viewBox="0 0 24 24" fill="rgba(255,255,255,0.4)">
        <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z"/>
      </svg>
    </div>
  )
}

function Badge({ children, color }: { children: React.ReactNode; color: string }) {
  return <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 20, background: `${color}22`, color, fontWeight: 600, flexShrink: 0 }}>{children}</span>
}

// ── Hauptkomponente ───────────────────────────────────────────────────────────
function WappenRow({ club, editUrl, state, onChange, onSave, onUpload, border, gold, goldL, green, red, muted, row }: {
  club: Club; editUrl: string; state: string
  onChange: (url: string) => void; onSave: () => void; onUpload: (file: File) => void
  border: string; gold: string; goldL: string; green: string; red: string; muted: string; row: string
}) {
  const [imgErr, setImgErr] = React.useState(false)
  const [dragging, setDragging] = React.useState(false)
  const fileRef = React.useRef<HTMLInputElement>(null)
  React.useEffect(() => { setImgErr(false) }, [editUrl])
  const changed = editUrl !== (club.logo_url ?? '')

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file && (file.type.startsWith('image/') || file.name.endsWith('.webp'))) onUpload(file)
  }

  return (
    <div
      onDragOver={e => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', marginBottom: 6, borderRadius: 10, background: dragging ? 'rgba(201,168,76,0.08)' : row, border: `1px solid ${dragging ? 'rgba(201,168,76,0.6)' : border}`, transition: 'all 0.15s' }}>
      {/* Vorschau — klickbar zum Datei wählen */}
      <div
        onClick={() => fileRef.current?.click()}
        title="Klicken oder Bild reinziehen"
        style={{ width: 40, height: 40, borderRadius: 8, background: '#111', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden', cursor: 'pointer', border: `1px solid ${dragging ? 'rgba(201,168,76,0.6)' : 'rgba(255,255,255,0.1)'}` }}>
        {editUrl && !imgErr
          ? <img src={editUrl} alt="" style={{ width: 36, height: 36, objectFit: 'contain' }} onError={() => setImgErr(true)} />
          : <span style={{ fontSize: 16 }}>📁</span>}
      </div>
      <input ref={fileRef} type="file" accept="image/*,.webp" style={{ display: 'none' }}
        onChange={e => { const f = e.target.files?.[0]; if (f) onUpload(f) }} />
      <span style={{ fontSize: 12, fontWeight: 600, color: '#fff', width: 120, flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{club.name}</span>
      <input
        value={editUrl}
        onChange={e => onChange(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') onSave() }}
        placeholder="URL oder Bild reinziehen…"
        style={{ flex: 1, background: 'rgba(255,255,255,0.07)', border: `1px solid ${changed ? 'rgba(201,168,76,0.5)' : border}`, borderRadius: 7, padding: '6px 10px', color: '#fff', fontSize: 12, outline: 'none' }}
      />
      <button onClick={onSave} disabled={state === 'saving' || !editUrl}
        style={{ padding: '6px 12px', borderRadius: 7, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 700, background: state === 'saved' ? 'rgba(76,175,80,0.3)' : state === 'error' ? 'rgba(239,83,80,0.3)' : `linear-gradient(135deg,${gold},${goldL})`, color: state === 'saved' ? green : state === 'error' ? red : '#05081a', opacity: state === 'saving' || !editUrl ? 0.5 : 1, flexShrink: 0 }}>
        {state === 'saving' ? '…' : state === 'saved' ? '✓' : state === 'error' ? '✗' : '↵'}
      </button>
    </div>
  )
}

export default function UCLAdminPanel({ matches, clubs, allTips, myTips, table, setMatches, setTable, reloadTable, uwclMatches = [], uwclClubs = [], reloadUwclTable, setUwclMatches }: Props) {
  const [open, setOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<'main' | 'partner' | 'hottakes' | 'doubles' | 'spieler' | 'wappen' | 'star'>('main')
  const [adminComp, setAdminComp] = useState<'ucl' | 'uwcl'>('ucl')

  // Aktive Matches/Clubs je nach Wettbewerb
  const activeAdminMatches: Match[] = adminComp === 'ucl' ? matches : uwclMatches
  const activeAdminClubs: Club[] = adminComp === 'ucl' ? clubs : uwclClubs
  const activeReloadTable = adminComp === 'ucl' ? reloadTable : (reloadUwclTable ?? reloadTable)
  const activeSetMatches = adminComp === 'ucl' ? setMatches : (setUwclMatches ?? setMatches)

  // Ergebnisse
  const [adminDay, setAdminDay] = useState(1)
  const [adminInputs, setAdminInputs] = useState<Record<string, { h: string; a: string }>>({})
  const [adminSave, setAdminSave] = useState<Record<string, 'idle'|'saving'|'saved'|'error'>>({})
  const [adminMsg, setAdminMsg] = useState<{ type:'ok'|'err'; text:string }|null>(null)

  // Override
  const [adminTableOrder, setAdminTableOrder] = useState<string[]>([])
  const [overrideSaving, setOverrideSaving] = useState(false)
  const [overrideMsg, setOverrideMsg] = useState<{ type:'ok'|'err'; text:string }|null>(null)
  const [hasOverride, setHasOverride] = useState(false)
  const dragFrom = useRef<number|null>(null)

  // Spieltag-Status
  const [finishedMatchdays, setFinishedMatchdays] = useState<Set<number>>(new Set())
  const [finishingSaving, setFinishingSaving] = useState(false)

  // Star-Admin
  type StarTipRow = { comp: 'ucl' | 'uwcl'; matchday: number; player_name: string; user_id: string | null; username: string | null; minecraft_username: string | null; gast_name: string | null }
  type StarResultRow = { comp: 'ucl' | 'uwcl'; matchday: number; player_name: string; actual_goals: number }
  const [starTips, setStarTips] = useState<StarTipRow[]>([])
  const [starResults, setStarResults] = useState<StarResultRow[]>([])
  const [starGoalInputs, setStarGoalInputs] = useState<Record<string, string>>({})
  const [starMatchday, setStarMatchday] = useState(1)
  const [starView, setStarView] = useState<'tore' | 'spieltag' | 'tipper' | 'konflikte'>('tore')
  const [starExtraPlayers, setStarExtraPlayers] = useState<{ comp: 'ucl' | 'uwcl'; name: string }[]>([])
  const [starCellState, setStarCellState] = useState<Record<string, 'ok' | 'err'>>({})
  const [starBusy, setStarBusy] = useState<string | null>(null)
  const [starSaveError, setStarSaveError] = useState<string | null>(null)
  const [starMoveTarget, setStarMoveTarget] = useState<Record<string, { comp: 'ucl' | 'uwcl'; matchday: number }>>({})
  const [starNewPlayer, setStarNewPlayer] = useState('')

  const starResKey = (comp: string, md: number, name: string) => `${comp}__${md}__${name.trim().toLowerCase()}`
  const starTipKey = (t: StarTipRow) => `${t.comp}__${t.matchday}__${t.user_id ?? 'g:' + t.gast_name}__${t.player_name}`
  const starWho = (t: StarTipRow) => t.username || t.gast_name || '?'
  const starWhoKey = (t: StarTipRow) => t.user_id ?? `g:${t.gast_name}`

  const loadStarData = React.useCallback(() => {
    fetch('/api/ucl2627/admin/star-tips')
      .then(r => r.json())
      .then(d => { if (d.tips) setStarTips(d.tips.map((t: any) => ({ ...t, matchday: Number(t.matchday) }))) })
      .catch(console.error)
    fetch('/api/ucl2627/admin/star-result')
      .then(r => r.json())
      .then(d => {
        if (!d.results) return
        const results: StarResultRow[] = d.results.map((r: any) => ({ ...r, matchday: Number(r.matchday), actual_goals: Number(r.actual_goals) }))
        setStarResults(results)
        const inputs: Record<string, string> = {}
        for (const r of results) inputs[starResKey(r.comp, r.matchday, r.player_name)] = String(r.actual_goals)
        setStarGoalInputs(prev => ({ ...inputs, ...prev }))
      })
      .catch(console.error)
  }, [])

  React.useEffect(() => {
    if (activeTab === 'star') loadStarData()
  }, [activeTab, loadStarData])

  const handleSaveStar = async (comp: 'ucl' | 'uwcl', matchday: number, playerName: string, goals: number) => {
    const key = starResKey(comp, matchday, playerName)
    setStarBusy(key); setStarSaveError(null)
    try {
      const res = await fetch('/api/ucl2627/admin/star-result', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comp, matchday, player_name: playerName.trim(), actual_goals: goals }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) {
        setStarSaveError(d.error ?? 'Fehler beim Speichern')
        setStarCellState(p => ({ ...p, [key]: 'err' }))
      } else {
        setStarResults(prev => [...prev.filter(r => starResKey(r.comp, r.matchday, r.player_name) !== key), { comp, matchday, player_name: playerName.trim(), actual_goals: goals }])
        setStarGoalInputs(p => ({ ...p, [key]: String(goals) }))
        setStarCellState(p => ({ ...p, [key]: 'ok' }))
        setTimeout(() => setStarCellState(p => { const n = { ...p }; if (n[key] === 'ok') delete n[key]; return n }), 1500)
      }
    } catch (e: any) { setStarSaveError(e.message ?? 'Netzwerkfehler'); setStarCellState(p => ({ ...p, [key]: 'err' })) }
    setStarBusy(null)
  }

  const handleDeleteStarResult = async (r: StarResultRow) => {
    const key = starResKey(r.comp, r.matchday, r.player_name)
    setStarBusy(key); setStarSaveError(null)
    try {
      const res = await fetch('/api/ucl2627/admin/star-result', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(r) })
      if (!res.ok) { const d = await res.json().catch(() => ({})); setStarSaveError(d.error ?? 'Fehler') }
      else setStarResults(prev => prev.filter(x => starResKey(x.comp, x.matchday, x.player_name) !== key))
    } catch (e: any) { setStarSaveError(e.message ?? 'Netzwerkfehler') }
    setStarBusy(null)
  }

  const handleMoveStarTip = async (t: StarTipRow, to: { comp: 'ucl' | 'uwcl'; matchday: number }) => {
    const key = starTipKey(t)
    setStarBusy(key); setStarSaveError(null)
    try {
      const res = await fetch('/api/ucl2627/admin/star-tips', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comp: t.comp, matchday: t.matchday, player_name: t.player_name, user_id: t.user_id, gast_name: t.gast_name, to_comp: to.comp, to_matchday: to.matchday }),
      })
      if (!res.ok) { const d = await res.json().catch(() => ({})); setStarSaveError(d.error ?? 'Fehler beim Verschieben') }
      else {
        setStarTips(prev => prev.map(x => starTipKey(x) === key ? { ...x, comp: to.comp, matchday: to.matchday } : x))
        setStarMoveTarget(prev => { const n = { ...prev }; delete n[key]; return n })
      }
    } catch (e: any) { setStarSaveError(e.message ?? 'Netzwerkfehler') }
    setStarBusy(null)
  }

  const handleDeleteStarTip = async (t: StarTipRow) => {
    if (!confirm(`Starspieler-Tipp „${t.player_name}" von ${starWho(t)} löschen?`)) return
    const key = starTipKey(t)
    setStarBusy(key); setStarSaveError(null)
    try {
      const res = await fetch('/api/ucl2627/admin/star-tips', {
        method: 'DELETE', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comp: t.comp, matchday: t.matchday, player_name: t.player_name, user_id: t.user_id, gast_name: t.gast_name }),
      })
      if (!res.ok) { const d = await res.json().catch(() => ({})); setStarSaveError(d.error ?? 'Fehler beim Löschen') }
      else setStarTips(prev => prev.filter(x => starTipKey(x) !== key))
    } catch (e: any) { setStarSaveError(e.message ?? 'Netzwerkfehler') }
    setStarBusy(null)
  }

  // Wappen-Editing
  const [wappenEdits, setWappenEdits] = useState<Record<string, string>>({})
  const [wappenSaving, setWappenSaving] = useState<Record<string, 'idle'|'saving'|'saved'|'error'>>({})
  const [wappenFilter, setWappenFilter] = useState('')

  // Partnervereine
  const [selectedPartners, setSelectedPartners] = useState<Set<string>>(new Set())
  const [partnerSaving, setPartnerSaving] = useState(false)
  const [partnerMsg, setPartnerMsg] = useState<{ type: 'ok'|'err'; text: string }|null>(null)

  // Hottakes
  type AdminHottake = { id: number; content: string; valid_until: string; status: string; hardness: number | null; fulfilled: boolean | null; points_awarded: boolean; created_at: string; username?: string; gast_name?: string }
  const [hottakesArchive, setHottakesArchive] = useState(false)
  const [hottakes, setHottakes] = useState<AdminHottake[]>([])
  const [hottakesLoading, setHottakesLoading] = useState(false)

  // Spieler
  const [participants, setParticipants] = useState<Participant[]>([])
  const [partLoading, setPartLoading] = useState(false)
  const [playerDetail, setPlayerDetail] = useState<PlayerDetail|null>(null)
  const [playerLoading, setPlayerLoading] = useState(false)
  const [playerSearch, setPlayerSearch] = useState('')
  const [playerDay, setPlayerDay] = useState(1)

  const uclClubMap  = Object.fromEntries(clubs.map(c => [c.id, c]))
  const uwclClubMap = Object.fromEntries(uwclClubs.map(c => [c.id, c]))
  // Kombiniert: UWCL-IDs sind mit 'uwcl_' geprefixt, keine Kollision
  const allClubMap  = { ...uclClubMap, ...uwclClubMap }
  const clubMap     = adminComp === 'uwcl' ? uwclClubMap : uclClubMap
  const allMatches  = [...matches, ...uwclMatches]
  const sortedTable = [...table].sort((a,b) => a.position - b.position)

  // Inputs vorbelegen
  useEffect(() => {
    const init: Record<string, { h: string; a: string }> = {}
    for (const m of [...matches, ...uwclMatches]) init[m.id] = { h: m.result_home !== null ? String(m.result_home) : '', a: m.result_away !== null ? String(m.result_away) : '' }
    setAdminInputs(init)
  }, [matches, uwclMatches])

  useEffect(() => {
    if (adminTableOrder.length === 0 && table.length > 0)
      setAdminTableOrder(sortedTable.map(r => r.club_id))
  }, [table])

  // Alle Spieler-Partnerwahlen für Admin
  const [allPlayerPartners, setAllPlayerPartners] = useState<{ username: string | null; gast_name: string | null; club_id: string }[]>([])

  useEffect(() => {
    if (activeTab !== 'partner') return
    fetch('/api/ucl2627/partner/all')
      .then(r => r.json())
      .then(d => { if (d.partners) setAllPlayerPartners(d.partners) })
      .catch(console.error)
  }, [activeTab])

  // Partnervereine laden
  useEffect(() => {
    if (!open) return
    fetch('/api/ucl2627/admin/partner-clubs')
      .then(r => r.json())
      .then(d => { if (d.partnerClubs) setSelectedPartners(new Set(d.partnerClubs)) })
      .catch(console.error)
  }, [open])

  // Spieltag-Status laden beim Öffnen
  useEffect(() => {
    if (!open) return
    setFinishedMatchdays(new Set())
    fetch(`/api/ucl2627/admin/matchday-status?comp=${adminComp}`)
      .then(r => r.json())
      .then(d => {
        if (d.status) {
          const finished = new Set<number>(
            Object.entries(d.status).filter(([, v]) => v).map(([k]) => Number(k))
          )
          setFinishedMatchdays(finished)
        }
      })
  }, [open, adminComp])

  // Doubles laden wenn Tab geöffnet
  const [allDoubles, setAllDoubles] = useState<{ matchday: number; match_id: string; username: string | null; gast_name: string | null }[]>([])
  const [doublesLoading, setDoublesLoading] = useState(false)

  useEffect(() => {
    if (activeTab !== 'doubles' || allDoubles.length > 0) return
    setDoublesLoading(true)
    fetch('/api/ucl2627/double-tip/all')
      .then(r => r.json())
      .then(d => { if (d.doubles) setAllDoubles(d.doubles) })
      .finally(() => setDoublesLoading(false))
  }, [activeTab])

  // Hottakes laden wenn Tab geöffnet
  const reloadHottakes = () => {
    setHottakesLoading(true)
    fetch('/api/ucl2627/admin/hottakes')
      .then(r => r.json())
      .then(d => { if (d.hottakes) setHottakes(d.hottakes) })
      .finally(() => setHottakesLoading(false))
  }

  useEffect(() => {
    if (activeTab !== 'hottakes') return
    reloadHottakes()
  }, [activeTab])

  // Teilnehmerliste laden wenn Tab geöffnet
  useEffect(() => {
    if (activeTab !== 'spieler' || participants.length > 0) return
    setPartLoading(true)
    fetch('/api/ucl2627/admin/player-tips')
      .then(r => r.json())
      .then(d => { if (d.participants) setParticipants(d.participants) })
      .finally(() => setPartLoading(false))
  }, [activeTab])

  // ── Ergebnisse Handler ────────────────────────────────────────────────────
  const handleSave = async (matchId: string) => {
    const { h, a } = adminInputs[matchId] || {}
    if (h === '' || a === '') return
    setAdminSave(p => ({ ...p, [matchId]: 'saving' }))
    try {
      const res = await fetch('/api/ucl2627/admin', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ match_id: matchId, result_home: h, result_away: a, comp: adminComp }) })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        setAdminMsg({ type: 'err', text: d.error || `HTTP ${res.status}` })
        throw new Error()
      }
      activeSetMatches(prev => prev.map(m => m.id === matchId ? { ...m, result_home: parseInt(h), result_away: parseInt(a) } : m))
      activeReloadTable()
      setAdminSave(p => ({ ...p, [matchId]: 'saved' }))
      setTimeout(() => setAdminSave(p => ({ ...p, [matchId]: 'idle' })), 2000)
    } catch {
      setAdminSave(p => ({ ...p, [matchId]: 'error' }))
      setTimeout(() => setAdminSave(p => ({ ...p, [matchId]: 'idle' })), 3000)
    }
  }

  const handleReset = async (matchId: string) => {
    setAdminSave(p => ({ ...p, [matchId]: 'saving' }))
    try {
      const res = await fetch('/api/ucl2627/admin', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ match_id: matchId, comp: adminComp }) })
      if (!res.ok) throw new Error()
      activeSetMatches(prev => prev.map(m => m.id === matchId ? { ...m, result_home: null, result_away: null } : m))
      activeReloadTable()
      setAdminInputs(p => ({ ...p, [matchId]: { h: '', a: '' } }))
      setAdminSave(p => ({ ...p, [matchId]: 'idle' }))
    } catch {
      setAdminSave(p => ({ ...p, [matchId]: 'error' }))
      setTimeout(() => setAdminSave(p => ({ ...p, [matchId]: 'idle' })), 3000)
    }
  }

  const handleSaveAll = async () => {
    const toSave = activeAdminMatches.filter(m => m.matchday === adminDay && (adminInputs[m.id]?.h ?? '') !== '' && (adminInputs[m.id]?.a ?? '') !== '')
    if (!toSave.length) return
    let ok = 0, fail = 0
    await Promise.all(toSave.map(async m => {
      const { h, a } = adminInputs[m.id]
      const res = await fetch('/api/ucl2627/admin', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ match_id: m.id, result_home: h, result_away: a, comp: adminComp }) })
      if (res.ok) { activeSetMatches(prev => prev.map(x => x.id === m.id ? { ...x, result_home: parseInt(h), result_away: parseInt(a) } : x)); ok++ }
      else fail++
    }))
    activeReloadTable()
    setAdminMsg(fail === 0 ? { type: 'ok', text: `${ok} gespeichert` } : { type: 'err', text: `${ok} ok, ${fail} Fehler` })
    setTimeout(() => setAdminMsg(null), 3000)
  }

  const handleFinishDay = async (day: number) => {
    const nowFinished = !finishedMatchdays.has(day)
    setFinishingSaving(true)
    setAdminMsg(null)
    try {
      const res = await fetch('/api/ucl2627/admin/matchday-status', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matchday: day, finished: nowFinished, comp: adminComp }),
      })
      const data = await res.json()
      if (!res.ok) {
        setAdminMsg({ type: 'err', text: data.error || `HTTP ${res.status}` })
        setFinishingSaving(false)
        return
      }
      setFinishedMatchdays(prev => {
        const next = new Set(prev)
        nowFinished ? next.add(day) : next.delete(day)
        return next
      })
      setAdminMsg({ type: 'ok', text: nowFinished ? `ST ${day} beendet` : `ST ${day} geöffnet` })
      setTimeout(() => setAdminMsg(null), 3000)
      activeReloadTable()
    } catch (e: any) {
      setAdminMsg({ type: 'err', text: e.message || 'Netzwerkfehler' })
    }
    setFinishingSaving(false)
  }

  // ── Partner Handler ───────────────────────────────────────────────────────
  const handleTogglePartner = (clubId: string) => {
    setSelectedPartners(prev => {
      const next = new Set(prev)
      if (next.has(clubId)) { next.delete(clubId) } else if (next.size < 12) { next.add(clubId) }
      return next
    })
  }

  const handleSavePartners = async () => {
    setPartnerSaving(true)
    try {
      const res = await fetch('/api/ucl2627/admin/partner-clubs', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ club_ids: [...selectedPartners] }),
      })
      setPartnerMsg(res.ok ? { type: 'ok', text: 'Gespeichert' } : { type: 'err', text: 'Fehler' })
    } catch { setPartnerMsg({ type: 'err', text: 'Fehler' }) }
    setPartnerSaving(false)
    setTimeout(() => setPartnerMsg(null), 3000)
  }

  // ── Override Handler ──────────────────────────────────────────────────────
  const handleSaveOverride = async () => {
    if (adminTableOrder.length !== 36) return
    setOverrideSaving(true)
    try {
      const res = await fetch('/api/ucl2627/admin/table-override', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ranking: adminTableOrder }) })
      if (!res.ok) throw new Error()
      setTable(prev => {
        const m = Object.fromEntries(prev.map(r => [r.club_id, r]))
        return adminTableOrder.map((id, i) => ({ ...(m[id] || { club_id: id, played:0, won:0, drawn:0, lost:0, goals_for:0, goals_against:0, points:0 }), club_id: id, position: i+1 }))
      })
      setHasOverride(true)
      setOverrideMsg({ type: 'ok', text: 'Override gespeichert' })
    } catch {
      setOverrideMsg({ type: 'err', text: 'Fehler' })
    }
    setOverrideSaving(false)
    setTimeout(() => setOverrideMsg(null), 3000)
  }

  const handleDeleteOverride = async () => {
    setOverrideSaving(true)
    await fetch('/api/ucl2627/admin/table-override', { method: 'DELETE' })
    setHasOverride(false)
    const d = await fetch('/api/ucl2627/table').then(r => r.json())
    if (d.table) { setTable(d.table); setAdminTableOrder([...d.table].sort((a:TableRow,b:TableRow) => a.position-b.position).map((r:TableRow) => r.club_id)) }
    setOverrideSaving(false)
    setOverrideMsg({ type: 'ok', text: 'Override gelöscht' })
    setTimeout(() => setOverrideMsg(null), 2000)
  }

  const handleDragStart = (idx: number) => { dragFrom.current = idx }
  const handleDragOver  = (e: React.DragEvent, idx: number) => {
    e.preventDefault()
    if (dragFrom.current === null || dragFrom.current === idx) return
    const o = [...adminTableOrder]; const [mv] = o.splice(dragFrom.current, 1); o.splice(idx, 0, mv)
    dragFrom.current = idx; setAdminTableOrder(o)
  }
  const handleDragEnd = () => { dragFrom.current = null }

  // ── Hottake Handler ───────────────────────────────────────────────────────
  const handleUploadWappen = async (clubId: string, file: File) => {
    // Datei als Base64 lesen und als Data-URL verwenden
    const reader = new FileReader()
    reader.onload = async (e) => {
      const dataUrl = e.target?.result as string
      if (!dataUrl) return
      setWappenEdits(p => ({ ...p, [clubId]: dataUrl }))
      // Direkt speichern
      setWappenSaving(p => ({ ...p, [clubId]: 'saving' }))
      try {
        const res = await fetch('/api/ucl2627/admin/club-logo', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ club_id: clubId, logo_url: dataUrl }),
        })
        if (!res.ok) throw new Error()
        setWappenSaving(p => ({ ...p, [clubId]: 'saved' }))
        setTimeout(() => setWappenSaving(p => ({ ...p, [clubId]: 'idle' })), 2000)
      } catch {
        setWappenSaving(p => ({ ...p, [clubId]: 'error' }))
        setTimeout(() => setWappenSaving(p => ({ ...p, [clubId]: 'idle' })), 3000)
      }
    }
    reader.readAsDataURL(file)
  }

  const handleSaveWappen = async (clubId: string) => {
    const url = wappenEdits[clubId]
    if (!url) return
    setWappenSaving(p => ({ ...p, [clubId]: 'saving' }))
    try {
      const res = await fetch('/api/ucl2627/admin/club-logo', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ club_id: clubId, logo_url: url }),
      })
      if (!res.ok) throw new Error()
      setWappenSaving(p => ({ ...p, [clubId]: 'saved' }))
      setTimeout(() => setWappenSaving(p => ({ ...p, [clubId]: 'idle' })), 2000)
    } catch {
      setWappenSaving(p => ({ ...p, [clubId]: 'error' }))
      setTimeout(() => setWappenSaving(p => ({ ...p, [clubId]: 'idle' })), 3000)
    }
  }

  const handleHottakeUpdate = async (id: number, updates: { status?: string; hardness?: number; fulfilled?: boolean }) => {
    try {
      const res = await fetch('/api/ucl2627/admin/hottakes', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...updates }),
      })
      const d = await res.json()
      if (res.ok) {
        // Komplett neu laden damit points_awarded, fulfilled etc. korrekt aus der DB kommen
        reloadHottakes()
      } else {
        alert(`Fehler: ${d.error || res.status}`)
      }
    } catch (e: any) {
      alert(`Netzwerkfehler: ${e.message}`)
    }
  }

  // ── Spieler Handler ───────────────────────────────────────────────────────
  const handleLoadPlayer = async (name: string, type: 'user'|'gast') => {
    setPlayerLoading(true); setPlayerDetail(null); setPlayerDay(1)
    const param = type === 'user' ? `name=${encodeURIComponent(name)}` : `gast_name=${encodeURIComponent(name)}`
    const res = await fetch(`/api/ucl2627/admin/player-tips?${param}`)
    const d = await res.json()
    if (res.ok) setPlayerDetail(d)
    setPlayerLoading(false)
  }

  // ── Spieler Handler ───────────────────────────────────────────────────────
  const loadPlayer = async (name: string, type: 'user'|'gast') => {
    setPlayerLoading(true); setPlayerDetail(null); setPlayerDay(1)
    const param = type === 'user' ? `name=${encodeURIComponent(name)}` : `gast_name=${encodeURIComponent(name)}`
    const res = await fetch(`/api/ucl2627/admin/player-tips?${param}`)
    const d = await res.json()
    if (res.ok) setPlayerDetail(d)
    setPlayerLoading(false)
  }

  const filteredParticipants = playerSearch.trim()
    ? participants.filter(p => p.name.toLowerCase().includes(playerSearch.toLowerCase()))
    : participants

  // ── Render ────────────────────────────────────────────────────────────────
  if (!open) return (
    <button onClick={() => setOpen(true)} style={{ position: 'fixed', bottom: 80, left: 28, zIndex: 1000, width: 44, height: 44, borderRadius: '50%', border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg,#1a237e,#3d5afe)', color: '#fff', fontSize: 18, boxShadow: '0 4px 20px rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Admin">⚙</button>
  )

  return (
    <>
      {/* Backdrop */}
      <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 8500, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)' }} />

      {/* Großer zentrierter Kasten */}
      <div style={{ position: 'fixed', inset: '2vh 2vw', zIndex: 8501, background: C.bg, border: '1px solid rgba(201,168,76,0.25)', borderRadius: 20, boxShadow: '0 24px 80px rgba(0,0,0,0.7)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* ── Header ── */}
        <div style={{ padding: '16px 24px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0, background: 'rgba(0,0,0,0.3)' }}>
          <img src="/ucl-badge.png" alt="" style={{ width: 28, height: 28, objectFit: 'contain' }} />
          <span style={{ fontSize: 15, fontWeight: 800, color: '#fff', letterSpacing: '-0.01em' }}>UCL Admin — 26/27</span>

          {/* Tabs */}
          <div style={{ display: 'flex', gap: 4, marginLeft: 16, background: 'rgba(255,255,255,0.05)', borderRadius: 10, padding: 3 }}>
            {([['main','Übersicht'],['partner','Partner'],['hottakes','🔥 Hottakes'],['doubles','Doppel'],['spieler','Teilnehmer'],['wappen','Wappen'],['star','⭐ Star']] as const).map(([key, label]) => (
              <button key={key} onClick={() => setActiveTab(key as any)} style={{ padding: '6px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700, background: activeTab === key ? 'linear-gradient(135deg,#1a237e,#3d5afe)' : 'transparent', color: activeTab === key ? '#fff' : C.muted, transition: 'all 0.15s' }}>
                {label}
              </button>
            ))}
          </div>

          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
            {adminMsg   && <Badge color={adminMsg.type   === 'ok' ? C.green  : C.red}>{adminMsg.text}</Badge>}
            {overrideMsg && <Badge color={overrideMsg.type === 'ok' ? C.gold : C.red}>{overrideMsg.text}</Badge>}
            <button onClick={() => setOpen(false)} style={{ width: 32, height: 32, borderRadius: 8, border: `1px solid ${C.border}`, background: 'none', cursor: 'pointer', color: C.muted, fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
          </div>
        </div>

        {/* ── Tab: Übersicht (Tabelle + Ergebnisse nebeneinander) ── */}
        {activeTab === 'main' && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {/* UCL/UWCL Umschalter */}
            <div style={{ padding: '8px 16px', borderBottom: `1px solid ${C.border}`, display: 'flex', gap: 6, flexShrink: 0 }}>
              {(['ucl', 'uwcl'] as const).map(comp => (
                <button key={comp} onClick={() => setAdminComp(comp)}
                  style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700,
                    background: adminComp === comp ? 'linear-gradient(135deg,rgba(201,168,76,0.3),rgba(61,90,254,0.25))' : 'rgba(255,255,255,0.05)',
                    color: adminComp === comp ? C.gold : C.muted,
                    outline: adminComp === comp ? `1px solid rgba(201,168,76,0.4)` : 'none' }}>
                  <img src={comp === 'ucl' ? '/ucl-badge.png' : '/uwcl-badge.png'} alt="" style={{ width: 14, height: 14, objectFit: 'contain', display: 'block', filter: adminComp === comp ? 'none' : 'brightness(0.5)' }} />
                  {comp === 'ucl' ? 'UCL' : 'UWCL'}
                </button>
              ))}
            </div>
            <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', overflow: 'hidden' }}>

            {/* LINKS: Tabellen-Override */}
            <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', borderRight: `1px solid ${C.border}` }}>
              {/* Subheader */}
              <div style={{ padding: '12px 20px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                <span style={{ flex: 1, fontSize: 11, fontWeight: 700, color: C.gold, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Tabellen-Override (UCL)</span>
                {hasOverride && <Badge color={C.gold}>Aktiv</Badge>}
                <button onClick={handleSaveOverride} disabled={overrideSaving} style={{ padding: '5px 14px', borderRadius: 7, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700, background: `linear-gradient(135deg,${C.gold},${C.goldL})`, color: '#05081a' }}>Speichern</button>
                {hasOverride && <button onClick={handleDeleteOverride} disabled={overrideSaving} style={{ padding: '5px 10px', borderRadius: 7, border: `1px solid ${C.red}44`, background: 'none', cursor: 'pointer', fontSize: 12, color: C.red }}>Reset</button>}
              </div>
              <p style={{ margin: '6px 20px 4px', fontSize: 10, color: C.muted }}>Drag & Drop zum Umsortieren — überschreibt automatische Berechnung</p>

              {/* Tabellen-Drag-Liste */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '4px 12px 16px' }}>
                {/* Zonen-Labels */}
                {adminTableOrder.map((clubId, idx) => {
                  const club = uclClubMap[clubId]
                  const pos  = idx + 1
                  const color = zoneColor(pos)
                  const isZoneStart = pos === 1 || pos === 9 || pos === 25
                  const zoneLabel = pos === 1 ? 'Achtelfinale (1–8)' : pos === 9 ? 'Playoffs (9–24)' : 'Ausscheiden (25–36)'
                  return (
                    <React.Fragment key={clubId}>
                      {isZoneStart && (
                        <div style={{ padding: '8px 8px 4px', display: 'flex', alignItems: 'center', gap: 6 }}>
                          <div style={{ width: 6, height: 6, borderRadius: '50%', background: color, flexShrink: 0 }} />
                          <span style={{ fontSize: 10, fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{zoneLabel}</span>
                        </div>
                      )}
                      <div
                        draggable
                        onDragStart={() => handleDragStart(idx)}
                        onDragOver={e => handleDragOver(e, idx)}
                        onDragEnd={handleDragEnd}
                        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 10px', marginBottom: 2, borderRadius: 8, background: C.row, border: `1px solid ${color}18`, cursor: 'grab', userSelect: 'none' }}
                      >
                        <span style={{ fontSize: 11, fontWeight: 700, color, width: 22, textAlign: 'center', flexShrink: 0 }}>{pos}</span>
                        <span style={{ fontSize: 12, color: C.muted, flexShrink: 0 }}>⠿</span>
                        <ClubLogo club={club} size={18} />
                        <span style={{ fontSize: 12, fontWeight: 600, color: '#fff', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{club?.name ?? clubId}</span>
                        <span style={{ fontSize: 10, color: C.muted, flexShrink: 0 }}>{club?.short}</span>
                      </div>
                    </React.Fragment>
                  )
                })}
              </div>
            </div>

            {/* RECHTS: Ergebnisse */}
            <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              {/* Spieltag-Tabs */}
              <div style={{ padding: '10px 16px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0, flexWrap: 'wrap' }}>
                {[1,2,3,4,5,6,7,8].map(day => {
                  const ms       = activeAdminMatches.filter(m => m.matchday === day)
                  const done     = ms.filter(m => m.result_home !== null).length
                  const active   = adminDay === day
                  const finished = finishedMatchdays.has(day)
                  return (
                    <button key={day} onClick={() => setAdminDay(day)} style={{ padding: '5px 11px', borderRadius: 7, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 600, background: finished ? 'rgba(76,175,80,0.18)' : active ? 'linear-gradient(135deg,#1a237e,#3d5afe)' : 'rgba(255,255,255,0.05)', color: finished ? C.green : active ? '#fff' : C.muted, outline: `1px solid ${finished ? C.green+'55' : active ? 'transparent' : C.border}` }}>
                      {finished ? '✓ ' : ''}ST {day}
                      <span style={{ fontSize: 9, marginLeft: 3, opacity: 0.75 }}>{done}/{ms.length}</span>
                    </button>
                  )
                })}
                <button onClick={handleSaveAll} style={{ marginLeft: 'auto', padding: '5px 13px', borderRadius: 7, border: 'none', cursor: 'pointer', background: `linear-gradient(135deg,${C.gold},${C.goldL})`, color: '#05081a', fontWeight: 700, fontSize: 11 }}>Alle ↵</button>
              </div>

              {/* Match-Liste */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '8px 14px 20px' }}>
                {(() => {
                  const dayMatches = activeAdminMatches.filter(m => m.matchday === adminDay)
                  const byDate: Record<string, Match[]> = {}
                  for (const m of dayMatches) {
                    const d = new Date(m.kickoff.replace(/Z$/, '')).toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit', timeZone: 'UTC' })
                    if (!byDate[d]) byDate[d] = []
                    byDate[d].push(m)
                  }
                  return Object.entries(byDate).map(([date, ms]) => (
                    <div key={date}>
                      <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: C.muted, margin: '12px 0 6px 2px' }}>{date}</p>
                      {ms.map(match => {
                        const home = clubMap[match.home_club_id]
                        const away = clubMap[match.away_club_id]
                        const { h, a } = adminInputs[match.id] || { h: '', a: '' }
                        const state = adminSave[match.id] || 'idle'
                        const hasResult = match.result_home !== null && match.result_away !== null
                        const changed   = h !== (match.result_home !== null ? String(match.result_home) : '') || a !== (match.result_away !== null ? String(match.result_away) : '')
                        const uhrzeit   = new Date(match.kickoff.replace(/Z$/, '')).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' })
                        return (
                          <div key={match.id} style={{ background: hasResult ? 'rgba(76,175,80,0.05)' : C.row, border: `1px solid ${hasResult ? 'rgba(76,175,80,0.18)' : C.border}`, borderRadius: 8, padding: '7px 10px', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ fontSize: 10, color: C.muted, fontWeight: 600, flexShrink: 0, width: 32 }}>{uhrzeit}</span>
                            <ClubLogo club={home} size={16} />
                            <span style={{ fontSize: 11, fontWeight: 600, color: '#fff', flex: 1, textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{home?.short ?? '???'}</span>
                            <span style={{ fontSize: 10, color: hasResult ? C.green : 'rgba(255,255,255,0.2)', fontWeight: 700, flexShrink: 0, width: 30, textAlign: 'center' }}>{hasResult ? `${match.result_home}:${match.result_away}` : 'vs'}</span>
                            <span style={{ fontSize: 11, fontWeight: 600, color: '#fff', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{away?.short ?? '???'}</span>
                            <ClubLogo club={away} size={16} />
                            <div style={{ display: 'flex', alignItems: 'center', gap: 3, flexShrink: 0 }}>
                              <input type="number" min="0" max="99" value={h} onChange={e => setAdminInputs(p => ({ ...p, [match.id]: { h: e.target.value, a: p[match.id]?.a ?? '' } }))} onKeyDown={e => { if (e.key === 'Enter') handleSave(match.id) }} style={{ width: 32, padding: '4px 2px', textAlign: 'center', background: 'rgba(255,255,255,0.07)', border: `1px solid ${changed ? 'rgba(201,168,76,0.5)' : C.border}`, borderRadius: 5, color: '#fff', fontSize: 13, fontWeight: 700, outline: 'none' }} placeholder="–" />
                              <span style={{ color: C.muted, fontWeight: 700, fontSize: 11 }}>:</span>
                              <input type="number" min="0" max="99" value={a} onChange={e => setAdminInputs(p => ({ ...p, [match.id]: { h: p[match.id]?.h ?? '', a: e.target.value } }))} onKeyDown={e => { if (e.key === 'Enter') handleSave(match.id) }} style={{ width: 32, padding: '4px 2px', textAlign: 'center', background: 'rgba(255,255,255,0.07)', border: `1px solid ${changed ? 'rgba(201,168,76,0.5)' : C.border}`, borderRadius: 5, color: '#fff', fontSize: 13, fontWeight: 700, outline: 'none' }} placeholder="–" />
                            </div>
                            <button onClick={() => handleSave(match.id)} disabled={state === 'saving' || h === '' || a === ''} style={{ padding: '4px 8px', borderRadius: 5, border: 'none', cursor: h===''||a==='' ? 'not-allowed':'pointer', fontSize: 11, fontWeight: 700, background: state==='saved' ? 'rgba(76,175,80,0.3)' : state==='error' ? 'rgba(239,83,80,0.3)' : changed ? `linear-gradient(135deg,${C.gold},${C.goldL})` : 'rgba(255,255,255,0.07)', color: state==='saved' ? C.green : state==='error' ? C.red : changed ? '#05081a' : C.muted, opacity: h===''||a==='' ? 0.35:1, minWidth: 30 }}>
                              {state==='saving' ? '…' : state==='saved' ? '✓' : state==='error' ? '✗' : '↵'}
                            </button>
                            {hasResult && <button onClick={() => handleReset(match.id)} style={{ padding: '4px 6px', borderRadius: 5, border: `1px solid ${C.red}44`, background: 'none', cursor: 'pointer', fontSize: 11, color: C.red, flexShrink: 0 }}>✕</button>}
                          </div>
                        )
                      })}
                    </div>
                  ))
                })()}
              </div>
              {/* Spieltag beenden / wieder öffnen */}
              <div style={{ padding: '10px 16px', borderTop: `1px solid ${C.border}`, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
                {finishedMatchdays.has(adminDay) ? (
                  <>
                    <span style={{ fontSize: 12, color: C.green, fontWeight: 600 }}>✓ Spieltag {adminDay} beendet — Tabelle aktualisiert</span>
                    <button onClick={() => handleFinishDay(adminDay)} disabled={finishingSaving} style={{ marginLeft: 'auto', padding: '6px 14px', borderRadius: 7, border: `1px solid ${C.red}55`, background: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: C.red, opacity: finishingSaving ? 0.5 : 1 }}>
                      Wieder öffnen
                    </button>
                  </>
                ) : (
                  <>
                    <span style={{ fontSize: 12, color: C.muted }}>Alle Ergebnisse eingetragen?</span>
                    <button onClick={() => handleFinishDay(adminDay)} disabled={finishingSaving} style={{ marginLeft: 'auto', padding: '6px 16px', borderRadius: 7, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700, background: `linear-gradient(135deg,${C.green},#66bb6a)`, color: '#fff', opacity: finishingSaving ? 0.5 : 1 }}>
                      Spieltag {adminDay} beenden ✓
                    </button>
                  </>
                )}
              </div>
            </div>
            </div>{/* /ergebnisse-grid */}
          </div>
        )}

        {/* ── Tab: Partner ── */}
        {activeTab === 'partner' && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
              <span style={{ flex: 1, fontSize: 12, fontWeight: 700, color: C.gold, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Partnervereine — {selectedPartners.size}/12 gewählt</span>
              {partnerMsg && <span style={{ fontSize: 11, fontWeight: 600, color: partnerMsg.type === 'ok' ? C.green : '#ef5350' }}>{partnerMsg.text}</span>}
              <button onClick={handleSavePartners} disabled={partnerSaving} style={{ padding: '5px 14px', borderRadius: 7, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700, background: `linear-gradient(135deg,${C.gold},${C.goldL})`, color: '#05081a' }}>Speichern</button>
            </div>
            <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', overflow: 'hidden' }}>
              {/* Links: Vereine auswählen */}
              <div style={{ borderRight: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <p style={{ margin: '8px 14px 4px', fontSize: 10, color: C.muted }}>Klick zum Auswählen/Abwählen (max 12)</p>
                <div style={{ flex: 1, overflowY: 'auto', padding: '4px 10px 16px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, alignContent: 'start' }}>
                  {clubs.map(club => {
                    const isSel = selectedPartners.has(club.id)
                    return (
                      <button key={club.id} onClick={() => handleTogglePartner(club.id)}
                        style={{ padding: '8px 6px', borderRadius: 8, border: `1px solid ${isSel ? C.gold+'66' : C.border}`, background: isSel ? `rgba(201,168,76,0.12)` : C.row, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                        <ClubLogo club={club} size={20} />
                        <span style={{ fontSize: 9, fontWeight: 600, color: isSel ? C.gold : C.muted, textAlign: 'center' }}>{club.short}</span>
                        {isSel && <span style={{ fontSize: 8, color: C.gold }}>✓</span>}
                      </button>
                    )
                  })}
                </div>
              </div>
              {/* Rechts: Spieler-Partnerwahlen */}
              <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <p style={{ margin: '8px 14px 4px', fontSize: 10, color: C.muted }}>Gewählte Partner der Spieler</p>
                <div style={{ flex: 1, overflowY: 'auto', padding: '4px 10px 16px' }}>
                  {allPlayerPartners.length === 0
                    ? <p style={{ fontSize: 12, color: C.muted, padding: '16px 4px' }}>Noch keine Wahlen.</p>
                    : allPlayerPartners.map((p, i) => {
                      const club = clubs.find(c => c.id === p.club_id)
                      const name = p.username || p.gast_name || '?'
                      return (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', marginBottom: 4, borderRadius: 8, background: C.row, border: `1px solid ${C.border}` }}>
                          <span style={{ fontSize: 12, fontWeight: 600, color: '#fff', flex: 1 }}>{name}</span>
                          <ClubLogo club={club} size={18} />
                          <span style={{ fontSize: 11, color: C.gold }}>{club?.short ?? p.club_id}</span>
                        </div>
                      )
                    })
                  }
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Tab: Hottakes ── */}
        {activeTab === 'hottakes' && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', borderBottom: `1px solid ${C.border}`, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: C.gold, textTransform: 'uppercase', letterSpacing: '0.08em', flex: 1 }}>
                {hottakesArchive ? 'Archiv' : 'Aktive Hottakes'} — {hottakes.filter(h => { const isDone = h.points_awarded === true || h.fulfilled === false || h.status === 'rejected'; return hottakesArchive ? isDone : !isDone }).length}
              </span>
              <button onClick={() => setHottakesArchive(v => !v)}
                style={{ fontSize: 11, fontWeight: 600, padding: '4px 12px', borderRadius: 8, border: `1px solid ${C.border}`, background: hottakesArchive ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.04)', color: hottakesArchive ? '#fff' : C.muted, cursor: 'pointer' }}>
                {hottakesArchive ? '← Aktive' : 'Archiv →'}
              </button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '10px 14px' }}>
              {hottakesLoading && <p style={{ color: C.muted, fontSize: 13, padding: 20 }}>Lade…</p>}
              {!hottakesLoading && hottakes.filter(h => {
                const isDone = h.points_awarded === true || h.fulfilled === false || h.status === 'rejected'
                return hottakesArchive ? isDone : !isDone
              }).length === 0 && (
                <p style={{ color: C.muted, fontSize: 13, padding: '20px 4px' }}>{hottakesArchive ? 'Noch kein Archiv.' : 'Keine aktiven Hottakes.'}</p>
              )}
              {hottakes.filter(h => {
                // Archiv: fulfilled gesetzt, rejected, oder points vergeben
                const isDone = h.points_awarded === true || h.fulfilled === false || h.status === 'rejected'
                return hottakesArchive ? isDone : !isDone
              }).map(h => {
                const author = h.username || h.gast_name || '?'
                const expired = new Date(h.valid_until) < new Date()
                const isGuest = !h.username
                const hardnessColors: Record<number, string> = { 1: '#ffd54f', 2: '#ff8a65', 3: '#ef5350' }
                const hardnessLabels: Record<number, string> = { 1: 'Lauwarm', 2: 'Heiß', 3: 'Höllisch' }
                const pointsByHardness: Record<number, number> = { 1: 4, 2: 8, 3: 12 }
                const pts = h.hardness ? pointsByHardness[h.hardness] : null
                const borderColor = h.fulfilled === true ? C.green+'44' : h.fulfilled === false ? '#ef535044' : h.status === 'accepted' ? C.green+'22' : h.status === 'rejected' ? '#ef535022' : C.border
                return (
                  <div key={h.id} style={{ padding: '14px 16px', marginBottom: 8, borderRadius: 10, background: C.row, border: `1px solid ${borderColor}` }}>
                    {/* Header */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' as const }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>{author}</span>
                      {isGuest && <span style={{ fontSize: 10, color: C.muted, background: 'rgba(255,255,255,0.07)', borderRadius: 4, padding: '1px 5px' }}>Gast</span>}
                      <span style={{ fontSize: 10, color: C.muted }}>{new Date(h.created_at).toLocaleDateString('de-DE')}</span>
                      <span style={{ fontSize: 10, color: expired ? C.muted : '#ffd54f', marginLeft: 'auto' }}>
                        bis {new Date(h.valid_until).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                        {expired ? ' (abgelaufen)' : ''}
                      </span>
                      {h.status === 'accepted' && <span style={{ fontSize: 10, color: C.green, fontWeight: 700, background: `${C.green}18`, borderRadius: 4, padding: '1px 6px' }}>✓ Angenommen</span>}
                      {h.status === 'rejected' && <span style={{ fontSize: 10, color: '#ef5350', fontWeight: 700, background: '#ef535018', borderRadius: 4, padding: '1px 6px' }}>✗ Abgelehnt</span>}
                      {h.points_awarded && <span style={{ fontSize: 10, color: C.green, fontWeight: 700, background: `${C.green}18`, borderRadius: 4, padding: '1px 6px' }}>+{pts} Pkt. vergeben</span>}
                    </div>

                    <p style={{ margin: '0 0 10px', fontSize: 13, color: '#fff', lineHeight: 1.5 }}>{h.content}</p>

                    {/* Status */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' as const, marginBottom: 8 }}>
                      <span style={{ fontSize: 11, color: C.muted }}>Status:</span>
                      <button onClick={() => handleHottakeUpdate(h.id, { status: 'accepted' })} style={{ padding: '4px 10px', borderRadius: 6, border: `1px solid ${C.green}55`, background: h.status === 'accepted' ? `${C.green}22` : 'none', cursor: 'pointer', fontSize: 11, fontWeight: 600, color: C.green }}>Annehmen</button>
                      <button onClick={() => handleHottakeUpdate(h.id, { status: 'rejected' })} style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #ef535055', background: h.status === 'rejected' ? '#ef535022' : 'none', cursor: 'pointer', fontSize: 11, fontWeight: 600, color: '#ef5350' }}>Ablehnen</button>
                      <button onClick={() => handleHottakeUpdate(h.id, { status: 'pending' })} style={{ padding: '4px 10px', borderRadius: 6, border: `1px solid ${C.muted}`, background: h.status === 'pending' ? 'rgba(255,255,255,0.07)' : 'none', cursor: 'pointer', fontSize: 11, color: C.muted }}>Ausstehend</button>
                    </div>

                    {/* Härte */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' as const, marginBottom: 8 }}>
                      <span style={{ fontSize: 11, color: C.muted }}>Härte:</span>
                      {[1,2,3].map(lvl => (
                        <button key={lvl} onClick={() => handleHottakeUpdate(h.id, { hardness: lvl })}
                          style={{ padding: '4px 10px', borderRadius: 6, border: `1px solid ${hardnessColors[lvl]}55`, background: h.hardness === lvl ? `${hardnessColors[lvl]}22` : 'none', cursor: 'pointer', fontSize: 11, fontWeight: 600, color: hardnessColors[lvl] }}>
                          {hardnessLabels[lvl]} {pointsByHardness[lvl]}P
                        </button>
                      ))}
                    </div>

                    {/* Erfüllung — bei allen akzeptierten Hottakes */}
                    {h.status === 'accepted' && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' as const, paddingTop: 8, borderTop: `1px solid ${C.border}` }}>
                        <span style={{ fontSize: 11, color: C.muted }}>Erfüllung:</span>
                        <button onClick={() => handleHottakeUpdate(h.id, { fulfilled: true })}
                          disabled={h.points_awarded && h.fulfilled === true}
                          style={{ padding: '5px 14px', borderRadius: 6, border: `1px solid ${C.green}66`, background: h.fulfilled === true ? `${C.green}28` : 'none', cursor: h.points_awarded && h.fulfilled === true ? 'default' : 'pointer', fontSize: 11, fontWeight: 700, color: C.green, opacity: h.points_awarded && h.fulfilled === true ? 0.7 : 1 }}>
                          Erfüllt {pts ? `(+${pts} Pkt.)` : '— erst Härte setzen'}
                        </button>
                        <button onClick={() => handleHottakeUpdate(h.id, { fulfilled: false })}
                          style={{ padding: '5px 14px', borderRadius: 6, border: '1px solid #ef535066', background: h.fulfilled === false ? '#ef535028' : 'none', cursor: 'pointer', fontSize: 11, fontWeight: 700, color: '#ef5350' }}>
                          Nicht erfüllt
                        </button>
                        {isGuest && <span style={{ fontSize: 10, color: C.muted }}>Gast — keine Punkte</span>}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ── Tab: Doppeltipps ── */}
        {activeTab === 'doubles' && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: C.gold, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Doppeltipps — {allDoubles.length} gesamt</span>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '10px 14px' }}>
              {doublesLoading && <p style={{ color: C.muted, fontSize: 13, padding: 20 }}>Lade…</p>}
              {[1,2,3,4,5,6,7,8].map(day => {
                const dayDoubles = allDoubles.filter(d => d.matchday === day)
                if (dayDoubles.length === 0) return null
                return (
                  <div key={day} style={{ marginBottom: 16 }}>
                    <p style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 8px' }}>Spieltag {day}</p>
                    {dayDoubles.map((d, i) => {
                      const match = allMatches.find(m => m.id === d.match_id)
                      const home  = match ? allClubMap[match.home_club_id] : undefined
                      const away  = match ? allClubMap[match.away_club_id] : undefined
                      const name  = d.username || d.gast_name || '?'
                      return (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', marginBottom: 4, borderRadius: 8, background: C.row, border: `1px solid rgba(201,168,76,0.15)` }}>
                          <span style={{ fontSize: 13, fontWeight: 600, color: '#fff', width: 120, flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
                          <span style={{ fontSize: 10, color: C.gold, flexShrink: 0 }}>⚡</span>
                          <ClubLogo club={home} size={16} />
                          <span style={{ fontSize: 11, color: '#fff', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{home?.short ?? '?'} vs {away?.short ?? '?'}</span>
                          <ClubLogo club={away} size={16} />
                        </div>
                      )
                    })}
                  </div>
                )
              })}
              {!doublesLoading && allDoubles.length === 0 && <p style={{ color: C.muted, fontSize: 13, padding: '20px 4px' }}>Noch keine Doppeltipps.</p>}
            </div>
          </div>
        )}

        {/* ── Tab: Star ── */}
        {activeTab === 'star' && (() => {
          const comp = adminComp
          const compMatches = comp === 'ucl' ? matches : uwclMatches
          const days = (() => { const d = [...new Set(compMatches.map(m => m.matchday))].sort((a, b) => a - b); return d.length ? d : [1,2,3,4,5,6,7,8] })()
          const daysFor = (k: 'ucl' | 'uwcl') => { const d = [...new Set((k === 'ucl' ? matches : uwclMatches).map(m => m.matchday))].sort((a, b) => a - b); return d.length ? d : [1,2,3,4,5,6,7,8] }
          const compTips = starTips.filter(t => t.comp === comp)
          const compResults = starResults.filter(r => r.comp === comp)

          // Konflikte: mehrere Tipps am selben Spieltag / Spieler wiederverwendet
          const doubleSlot = new Set<string>()
          const slotCount: Record<string, number> = {}
          for (const t of starTips) { const k = `${starWhoKey(t)}|${t.comp}|${t.matchday}`; slotCount[k] = (slotCount[k] ?? 0) + 1 }
          for (const t of starTips) if (slotCount[`${starWhoKey(t)}|${t.comp}|${t.matchday}`] > 1) doubleSlot.add(starTipKey(t))
          const reused = new Set<string>()
          const nameCount: Record<string, number> = {}
          for (const t of starTips) { const k = `${starWhoKey(t)}|${t.player_name.trim().toLowerCase()}`; nameCount[k] = (nameCount[k] ?? 0) + 1 }
          for (const t of starTips) if (nameCount[`${starWhoKey(t)}|${t.player_name.trim().toLowerCase()}`] > 1) reused.add(starTipKey(t))
          const conflictTips = starTips.filter(t => doubleSlot.has(starTipKey(t)) || reused.has(starTipKey(t)))

          const resultFor = (md: number, name: string) => compResults.find(r => r.matchday === md && r.player_name.trim().toLowerCase() === name.trim().toLowerCase())
          const openResults = (md: number) => {
            const players = [...new Set(compTips.filter(t => t.matchday === md).map(t => t.player_name.trim().toLowerCase()))]
            return players.filter(p => !compResults.some(r => r.matchday === md && r.player_name.trim().toLowerCase() === p)).length
          }
          const firstKick = (md: number) => {
            const ks = compMatches.filter(m => m.matchday === md).map(m => new Date(m.kickoff).getTime())
            return ks.length ? new Date(Math.min(...ks)) : null
          }

          const renderTipRow = (t: StarTipRow, showSlot: boolean) => {
            const key = starTipKey(t)
            const target = starMoveTarget[key] ?? { comp: t.comp, matchday: t.matchday }
            const changed = target.comp !== t.comp || target.matchday !== t.matchday
            const isDouble = doubleSlot.has(key)
            const isReused = reused.has(key)
            const res = starResults.find(r => r.comp === t.comp && r.matchday === t.matchday && r.player_name.trim().toLowerCase() === t.player_name.trim().toLowerCase())
            return (
              <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 8, background: (isDouble || isReused) ? 'rgba(239,83,80,0.07)' : C.row, border: `1px solid ${(isDouble || isReused) ? 'rgba(239,83,80,0.3)' : C.border}` }}>
                <MCHead username={t.minecraft_username} size={22} />
                <span style={{ width: 110, fontSize: 12, fontWeight: 700, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flexShrink: 0 }}>{starWho(t)}</span>
                {showSlot && <span style={{ fontSize: 10, fontWeight: 700, color: t.comp === 'ucl' ? '#7b9fff' : '#ce93d8', flexShrink: 0 }}>{t.comp.toUpperCase()} ST{t.matchday}</span>}
                <span style={{ flex: 1, fontSize: 12, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>⭐ {t.player_name}</span>
                {isDouble && <span style={{ fontSize: 9, fontWeight: 800, padding: '1px 6px', borderRadius: 4, background: 'rgba(239,83,80,0.2)', color: C.red }}>2× AM ST</span>}
                {isReused && <span style={{ fontSize: 9, fontWeight: 800, padding: '1px 6px', borderRadius: 4, background: 'rgba(255,152,0,0.2)', color: '#ffb74d' }}>WIEDERVERWENDET</span>}
                {res && <span style={{ fontSize: 10, fontWeight: 700, color: res.actual_goals > 0 ? C.green : C.muted, flexShrink: 0 }}>+{res.actual_goals * 2}</span>}
                {/* Verschieben */}
                <select value={target.comp} onChange={e => setStarMoveTarget(p => ({ ...p, [key]: { comp: e.target.value as any, matchday: target.matchday } }))}
                  style={{ background: 'rgba(255,255,255,0.06)', border: `1px solid ${C.border}`, borderRadius: 6, color: '#fff', fontSize: 11, padding: '3px 4px' }}>
                  <option value="ucl">UCL</option><option value="uwcl">UWCL</option>
                </select>
                <select value={target.matchday} onChange={e => setStarMoveTarget(p => ({ ...p, [key]: { comp: target.comp, matchday: Number(e.target.value) } }))}
                  style={{ background: 'rgba(255,255,255,0.06)', border: `1px solid ${C.border}`, borderRadius: 6, color: '#fff', fontSize: 11, padding: '3px 4px' }}>
                  {daysFor(target.comp).map(d => <option key={d} value={d}>ST{d}</option>)}
                </select>
                <button onClick={() => handleMoveStarTip(t, target)} disabled={!changed || starBusy === key}
                  style={{ padding: '3px 9px', borderRadius: 6, border: 'none', fontSize: 11, fontWeight: 700, cursor: changed ? 'pointer' : 'default',
                    background: changed ? `linear-gradient(135deg,${C.gold},${C.goldL})` : 'rgba(255,255,255,0.05)', color: changed ? '#05081a' : C.muted }}>
                  {starBusy === key ? '…' : 'Verschieben'}
                </button>
                <button onClick={() => handleDeleteStarTip(t)} title="Tipp löschen"
                  style={{ background: 'none', border: 'none', color: C.red, cursor: 'pointer', fontSize: 15, padding: '0 2px' }}>×</button>
              </div>
            )
          }

          return (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              {/* Kopfzeile */}
              <div style={{ padding: '10px 14px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0, flexWrap: 'wrap' as const }}>
                <div style={{ display: 'flex', gap: 3, background: 'rgba(255,255,255,0.05)', borderRadius: 9, padding: 3 }}>
                  {(['ucl', 'uwcl'] as const).map(k => (
                    <button key={k} onClick={() => setAdminComp(k)}
                      style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 700,
                        background: adminComp === k ? 'linear-gradient(135deg,rgba(201,168,76,0.3),rgba(61,90,254,0.25))' : 'transparent', color: adminComp === k ? C.gold : C.muted }}>
                      <img src={k === 'ucl' ? '/ucl-badge.png' : '/uwcl-badge.png'} alt="" style={{ width: 13, height: 13, objectFit: 'contain' }} />
                      {k.toUpperCase()}
                    </button>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 3 }}>
                  {([['tore', 'Tore'], ['spieltag', 'Nach Spieltag'], ['tipper', 'Nach Tipper'], ['konflikte', `Konflikte (${conflictTips.length})`]] as const).map(([k, l]) => (
                    <button key={k} onClick={() => setStarView(k)}
                      style={{ padding: '4px 10px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 700,
                        background: starView === k ? (k === 'konflikte' && conflictTips.length ? 'rgba(239,83,80,0.25)' : 'rgba(61,90,254,0.3)') : 'rgba(255,255,255,0.05)',
                        color: starView === k ? '#fff' : (k === 'konflikte' && conflictTips.length ? C.red : C.muted) }}>
                      {l}
                    </button>
                  ))}
                </div>
                <div style={{ flex: 1 }} />
                <span style={{ fontSize: 11, color: C.muted }}>
                  {compTips.length} Tipps · {new Set(compTips.map(starWhoKey)).size} Tipper · {days.reduce((s, d) => s + openResults(d), 0)} Ergebnisse offen
                </span>
                <button onClick={loadStarData} style={{ padding: '4px 10px', borderRadius: 6, border: `1px solid ${C.border}`, background: 'transparent', color: C.muted, fontSize: 11, cursor: 'pointer' }}>↻</button>
              </div>

              {starSaveError && (
                <div style={{ margin: '10px 14px 0', padding: '8px 12px', borderRadius: 8, background: 'rgba(239,83,80,0.12)', border: '1px solid rgba(239,83,80,0.3)', fontSize: 12, color: C.red, fontWeight: 600 }}>⚠ {starSaveError}</div>
              )}

              {/* ── Ansicht: Tore (alle Spieler × alle Spieltage) ── */}
              {starView === 'tore' && (
                <div style={{ flex: 1, overflow: 'auto', padding: '12px 16px' }}>
                  {(() => {
                    const byKey = new Map<string, string>()
                    for (const t of compTips) byKey.set(t.player_name.trim().toLowerCase(), byKey.get(t.player_name.trim().toLowerCase()) ?? t.player_name.trim())
                    for (const r of compResults) byKey.set(r.player_name.trim().toLowerCase(), byKey.get(r.player_name.trim().toLowerCase()) ?? r.player_name.trim())
                    for (const x of starExtraPlayers.filter(x => x.comp === comp)) byKey.set(x.name.toLowerCase(), byKey.get(x.name.toLowerCase()) ?? x.name)
                    const players = [...byKey.values()].sort((a, b) => a.localeCompare(b))

                    const commit = (md: number, player: string) => {
                      const rk = starResKey(comp, md, player)
                      const raw = (starGoalInputs[rk] ?? '').trim()
                      const existing = resultFor(md, player)
                      if (raw === '') {
                        if (existing) handleDeleteStarResult(existing)
                        return
                      }
                      const goals = parseInt(raw)
                      if (isNaN(goals) || goals < 0) return
                      if (existing && existing.actual_goals === goals) return
                      handleSaveStar(comp, md, player, goals)
                    }

                    return (
                      <>
                        <p style={{ margin: '0 0 10px', fontSize: 11, color: C.muted, lineHeight: 1.5 }}>
                          Tore pro Spieler und Spieltag eintragen — speichert automatisch beim Verlassen des Feldes oder mit Enter. Leeres Feld = Eintrag löschen.
                          {' '}<span style={{ color: C.gold }}>Goldener Rand</span> = an diesem Spieltag von jemandem als Starspieler getippt.
                        </p>

                        <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
                          <input value={starNewPlayer} onChange={e => setStarNewPlayer(e.target.value)} placeholder="Spieler hinzufügen…"
                            onKeyDown={e => { if (e.key === 'Enter' && starNewPlayer.trim()) { setStarExtraPlayers(p => [...p, { comp, name: starNewPlayer.trim() }]); setStarNewPlayer('') } }}
                            style={{ flex: 1, maxWidth: 280, background: 'rgba(255,255,255,0.06)', border: `1px solid ${C.border}`, borderRadius: 7, padding: '5px 10px', color: '#fff', fontSize: 12, outline: 'none' }} />
                          <button disabled={!starNewPlayer.trim()} onClick={() => { setStarExtraPlayers(p => [...p, { comp, name: starNewPlayer.trim() }]); setStarNewPlayer('') }}
                            style={{ padding: '5px 12px', borderRadius: 7, border: 'none', fontSize: 11, fontWeight: 700, cursor: 'pointer', background: 'rgba(255,255,255,0.08)', color: '#fff', opacity: starNewPlayer.trim() ? 1 : 0.4 }}>
                            + Zeile
                          </button>
                        </div>

                        {players.length === 0 ? (
                          <p style={{ fontSize: 12, color: C.muted }}>Noch keine Spieler in der {comp.toUpperCase()}. Füge oben einen hinzu.</p>
                        ) : (
                          <table style={{ borderCollapse: 'separate', borderSpacing: 3, fontSize: 12 }}>
                            <thead>
                              <tr>
                                <th style={{ textAlign: 'left' as const, color: C.muted, fontWeight: 700, padding: '4px 8px', position: 'sticky' as const, left: 0, background: C.bg, minWidth: 160 }}>Spieler</th>
                                {days.map(d => <th key={d} style={{ color: C.gold, fontWeight: 800, padding: '4px 6px', minWidth: 52 }}>ST{d}</th>)}
                                <th style={{ color: C.muted, fontWeight: 700, padding: '4px 8px' }}>Σ Tore</th>
                              </tr>
                            </thead>
                            <tbody>
                              {players.map(player => {
                                const total = compResults.filter(r => r.player_name.trim().toLowerCase() === player.toLowerCase()).reduce((s, r) => s + r.actual_goals, 0)
                                const tipCount = compTips.filter(t => t.player_name.trim().toLowerCase() === player.toLowerCase()).length
                                return (
                                  <tr key={player}>
                                    <td style={{ padding: '4px 8px', fontWeight: 700, color: '#fff', whiteSpace: 'nowrap' as const, position: 'sticky' as const, left: 0, background: C.bg }}>
                                      ⭐ {player}
                                      {tipCount > 0 && <span style={{ fontSize: 10, color: C.muted, fontWeight: 400, marginLeft: 6 }}>{tipCount}× getippt</span>}
                                    </td>
                                    {days.map(d => {
                                      const rk = starResKey(comp, d, player)
                                      const existing = resultFor(d, player)
                                      const tipped = compTips.some(t => t.matchday === d && t.player_name.trim().toLowerCase() === player.toLowerCase())
                                      const state = starCellState[rk]
                                      const value = starGoalInputs[rk] ?? (existing ? String(existing.actual_goals) : '')
                                      return (
                                        <td key={d} style={{ padding: 0 }}>
                                          <input
                                            inputMode="numeric"
                                            value={value}
                                            placeholder="–"
                                            onChange={e => setStarGoalInputs(p => ({ ...p, [rk]: e.target.value.replace(/[^0-9]/g, '') }))}
                                            onBlur={() => commit(d, player)}
                                            onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                                            disabled={starBusy === rk}
                                            style={{
                                              width: 52, height: 30, textAlign: 'center' as const, fontSize: 14, fontWeight: 800, outline: 'none', borderRadius: 6,
                                              color: existing && existing.actual_goals > 0 ? C.green : '#fff',
                                              background: state === 'ok' ? 'rgba(76,175,80,0.2)' : state === 'err' ? 'rgba(239,83,80,0.2)' : existing ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.03)',
                                              border: `1px solid ${state === 'err' ? C.red : tipped ? 'rgba(201,168,76,0.6)' : C.border}`,
                                            }}
                                          />
                                        </td>
                                      )
                                    })}
                                    <td style={{ padding: '4px 8px', fontWeight: 800, color: total > 0 ? C.green : C.muted, textAlign: 'center' as const }}>{total}</td>
                                  </tr>
                                )
                              })}
                            </tbody>
                          </table>
                        )}
                      </>
                    )
                  })()}
                </div>
              )}

              {/* ── Ansicht: Nach Spieltag ── */}
              {starView === 'spieltag' && (
                <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
                  {/* Spieltage */}
                  <div style={{ width: 150, flexShrink: 0, borderRight: `1px solid ${C.border}`, overflowY: 'auto', padding: 8 }}>
                    {days.map(d => {
                      const n = compTips.filter(t => t.matchday === d).length
                      const open = openResults(d)
                      const conf = compTips.some(t => t.matchday === d && (doubleSlot.has(starTipKey(t)) || reused.has(starTipKey(t))))
                      const fk = firstKick(d)
                      const locked = !!fk && fk <= new Date()
                      const active = starMatchday === d
                      return (
                        <button key={d} onClick={() => setStarMatchday(d)}
                          style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 6, padding: '8px 10px', marginBottom: 4, borderRadius: 8, border: 'none', cursor: 'pointer', textAlign: 'left' as const,
                            background: active ? 'rgba(201,168,76,0.18)' : 'rgba(255,255,255,0.03)', outline: active ? `1px solid ${C.gold}55` : 'none' }}>
                          <span style={{ fontSize: 12, fontWeight: 800, color: active ? C.gold : '#fff', flex: 1 }}>ST {d}</span>
                          {conf && <span title="Konflikt" style={{ width: 7, height: 7, borderRadius: '50%', background: C.red }} />}
                          <span style={{ fontSize: 10, color: C.muted }}>{n}</span>
                          {open > 0
                            ? <span title="Ergebnisse offen" style={{ fontSize: 9, fontWeight: 800, padding: '1px 5px', borderRadius: 4, background: locked ? 'rgba(255,152,0,0.2)' : 'rgba(255,255,255,0.06)', color: locked ? '#ffb74d' : C.muted }}>{open}</span>
                            : n > 0 && <span style={{ fontSize: 10, color: C.green }}>✓</span>}
                        </button>
                      )
                    })}
                  </div>

                  {/* Detail */}
                  <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
                    {(() => {
                      const dayTips = compTips.filter(t => t.matchday === starMatchday)
                      // Spieler aus Tipps UND bereits gespeicherten Ergebnissen — so bleiben auch
                      // manuell angelegte Spieler bzw. Ergebnisse ohne Tipp jederzeit bearbeitbar
                      const players = [...new Map([
                        ...dayTips.map(t => [t.player_name.trim().toLowerCase(), t.player_name.trim()] as [string, string]),
                        ...compResults.filter(r => r.matchday === starMatchday).map(r => [r.player_name.trim().toLowerCase(), r.player_name.trim()] as [string, string]),
                      ]).values()].sort((a, b) => a.localeCompare(b))
                      const fk = firstKick(starMatchday)
                      return (
                        <>
                          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 10 }}>
                            <span style={{ fontSize: 13, fontWeight: 800, color: '#fff' }}>{comp.toUpperCase()} · Spieltag {starMatchday}</span>
                            <span style={{ fontSize: 11, color: C.muted }}>
                              {fk ? (fk <= new Date() ? 'gesperrt seit ' : 'Tippschluss ') + fk.toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : ''}
                            </span>
                          </div>

                          {/* Tore eintragen */}
                          <p style={{ margin: '0 0 6px', fontSize: 10, fontWeight: 700, color: C.gold, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Tore eintragen ({players.length} Spieler)</p>
                          {players.length === 0 && <p style={{ fontSize: 12, color: C.muted, margin: '0 0 12px' }}>Niemand hat für diesen Spieltag einen Starspieler gesetzt.</p>}
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 6, marginBottom: 12 }}>
                            {players.map(player => {
                              const rk = starResKey(comp, starMatchday, player)
                              const existing = resultFor(starMatchday, player)
                              const val = parseInt(starGoalInputs[rk] ?? (existing ? String(existing.actual_goals) : '0')) || 0
                              const tippers = dayTips.filter(t => t.player_name.trim().toLowerCase() === player.toLowerCase())
                              const dirty = !existing || existing.actual_goals !== val
                              return (
                                <div key={rk} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 8, background: existing ? 'rgba(201,168,76,0.08)' : C.row, border: `1px solid ${existing ? 'rgba(201,168,76,0.3)' : C.border}` }}>
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>⭐ {player}</p>
                                    <p style={{ margin: 0, fontSize: 10, color: C.muted }}>{tippers.length} Tipper{existing ? ` · ${existing.actual_goals} Tor${existing.actual_goals !== 1 ? 'e' : ''} gespeichert` : ' · offen'}</p>
                                  </div>
                                  <button onClick={() => setStarGoalInputs(p => ({ ...p, [rk]: String(Math.max(0, val - 1)) }))} style={{ width: 24, height: 24, borderRadius: 6, border: 'none', background: 'rgba(255,255,255,0.06)', color: '#fff', cursor: 'pointer' }}>−</button>
                                  <input type="number" min={0} value={starGoalInputs[rk] ?? String(val)}
                                    onChange={e => setStarGoalInputs(p => ({ ...p, [rk]: e.target.value.replace(/[^0-9]/g, '') }))}
                                    onKeyDown={e => { if (e.key === 'Enter' && dirty) handleSaveStar(comp, starMatchday, player, val) }}
                                    style={{ width: 38, textAlign: 'center' as const, fontSize: 14, fontWeight: 800, color: '#fff', background: 'rgba(255,255,255,0.06)', border: `1px solid ${C.border}`, borderRadius: 6, padding: '2px 0', outline: 'none' }} />
                                  <button onClick={() => setStarGoalInputs(p => ({ ...p, [rk]: String(val + 1) }))} style={{ width: 24, height: 24, borderRadius: 6, border: 'none', background: 'rgba(255,255,255,0.06)', color: '#fff', cursor: 'pointer' }}>+</button>
                                  <button onClick={() => handleSaveStar(comp, starMatchday, player, val)} disabled={starBusy === rk || !dirty}
                                    style={{ padding: '4px 10px', borderRadius: 6, border: 'none', fontSize: 11, fontWeight: 700, cursor: dirty ? 'pointer' : 'default',
                                      background: dirty ? `linear-gradient(135deg,${C.gold},${C.goldL})` : 'rgba(76,175,80,0.15)', color: dirty ? '#05081a' : C.green }}>
                                    {starBusy === rk ? '…' : dirty ? 'Speichern' : '✓'}
                                  </button>
                                  {existing && (
                                    <button onClick={() => handleDeleteStarResult(existing)} title="Ergebnis löschen"
                                      style={{ background: 'none', border: 'none', color: C.red, cursor: 'pointer', fontSize: 14, padding: 0 }}>×</button>
                                  )}
                                </div>
                              )
                            })}
                          </div>

                          {/* Ergebnis für Spieler ohne Tipp (z.B. vorab) */}
                          <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
                            <input value={starNewPlayer} onChange={e => setStarNewPlayer(e.target.value)} placeholder="Weiteren Spieler hinzufügen…"
                              style={{ flex: 1, background: 'rgba(255,255,255,0.06)', border: `1px solid ${C.border}`, borderRadius: 7, padding: '5px 10px', color: '#fff', fontSize: 12, outline: 'none' }} />
                            <button disabled={!starNewPlayer.trim()} onClick={() => { handleSaveStar(comp, starMatchday, starNewPlayer.trim(), 0); setStarNewPlayer('') }}
                              style={{ padding: '5px 12px', borderRadius: 7, border: 'none', fontSize: 11, fontWeight: 700, cursor: 'pointer', background: 'rgba(255,255,255,0.08)', color: '#fff', opacity: starNewPlayer.trim() ? 1 : 0.4 }}>
                              + Mit 0 Toren anlegen
                            </button>
                          </div>

                          {/* Tipps */}
                          <p style={{ margin: '0 0 6px', fontSize: 10, fontWeight: 700, color: C.gold, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Tipps ({dayTips.length})</p>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            {dayTips.length === 0 && <p style={{ fontSize: 12, color: C.muted, margin: 0 }}>Keine Tipps.</p>}
                            {[...dayTips].sort((a, b) => starWho(a).localeCompare(starWho(b))).map(t => renderTipRow(t, false))}
                          </div>
                        </>
                      )
                    })()}
                  </div>
                </div>
              )}

              {/* ── Ansicht: Nach Tipper (Raster) ── */}
              {starView === 'tipper' && (
                <div style={{ flex: 1, overflow: 'auto', padding: '12px 16px' }}>
                  {(() => {
                    const people = [...new Map(compTips.map(t => [starWhoKey(t), t])).values()].sort((a, b) => starWho(a).localeCompare(starWho(b)))
                    if (people.length === 0) return <p style={{ color: C.muted, fontSize: 12 }}>Noch keine Starspieler-Tipps in der {comp.toUpperCase()}.</p>
                    return (
                      <table style={{ borderCollapse: 'separate', borderSpacing: 3, fontSize: 11 }}>
                        <thead>
                          <tr>
                            <th style={{ textAlign: 'left' as const, color: C.muted, fontWeight: 700, padding: '4px 8px', position: 'sticky' as const, left: 0, background: C.bg }}>Tipper</th>
                            {days.map(d => <th key={d} style={{ color: C.gold, fontWeight: 800, padding: '4px 8px', minWidth: 110 }}>ST{d}</th>)}
                            <th style={{ color: C.muted, fontWeight: 700, padding: '4px 8px' }}>Pkt</th>
                          </tr>
                        </thead>
                        <tbody>
                          {people.map(p => {
                            const pk = starWhoKey(p)
                            let total = 0
                            return (
                              <tr key={pk}>
                                <td style={{ padding: '5px 8px', fontWeight: 700, color: '#fff', whiteSpace: 'nowrap' as const, position: 'sticky' as const, left: 0, background: C.bg }}>{starWho(p)}</td>
                                {days.map(d => {
                                  const cell = compTips.filter(t => starWhoKey(t) === pk && t.matchday === d)
                                  if (cell.length === 0) return <td key={d} style={{ padding: '5px 8px', borderRadius: 6, background: 'rgba(255,255,255,0.02)', color: 'rgba(255,255,255,0.15)', textAlign: 'center' as const }}>–</td>
                                  const bad = cell.length > 1 || cell.some(t => reused.has(starTipKey(t)))
                                  return (
                                    <td key={d} onClick={() => { setStarMatchday(d); setStarView('spieltag') }} title="Zum Spieltag"
                                      style={{ padding: '5px 8px', borderRadius: 6, cursor: 'pointer', background: bad ? 'rgba(239,83,80,0.12)' : 'rgba(201,168,76,0.08)', border: `1px solid ${bad ? 'rgba(239,83,80,0.35)' : 'rgba(201,168,76,0.2)'}` }}>
                                      {cell.map(t => {
                                        const r = resultFor(d, t.player_name)
                                        if (r) total += r.actual_goals * 2
                                        return (
                                          <div key={starTipKey(t)} style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                                            <span style={{ color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const, maxWidth: 110 }}>{t.player_name}</span>
                                            {r && <span style={{ color: r.actual_goals > 0 ? C.green : C.muted, fontWeight: 700 }}>+{r.actual_goals * 2}</span>}
                                          </div>
                                        )
                                      })}
                                    </td>
                                  )
                                })}
                                <td style={{ padding: '5px 8px', fontWeight: 800, color: C.gold, textAlign: 'right' as const }}>{total}</td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    )
                  })()}
                </div>
              )}

              {/* ── Ansicht: Konflikte ── */}
              {starView === 'konflikte' && (
                <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
                  <p style={{ margin: '0 0 10px', fontSize: 11, color: C.muted, lineHeight: 1.5 }}>
                    <b style={{ color: C.red }}>2× am ST</b>: Tipper hat an einem Spieltag mehr als einen Starspieler ·{' '}
                    <b style={{ color: '#ffb74d' }}>Wiederverwendet</b>: derselbe Spieler wurde vom Tipper mehrfach gesetzt (UCL + UWCL zusammen).
                    Per Verschieben oder × auflösen.
                  </p>
                  {conflictTips.length === 0
                    ? <p style={{ fontSize: 13, color: C.green }}>✓ Keine Konflikte</p>
                    : <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {[...conflictTips].sort((a, b) => starWho(a).localeCompare(starWho(b)) || a.comp.localeCompare(b.comp) || a.matchday - b.matchday).map(t => renderTipRow(t, true))}
                      </div>}
                </div>
              )}
            </div>
          )
        })()}

        {/* ── Tab: Wappen ── */}
        {activeTab === 'wappen' && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: C.gold, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Vereinswappen bearbeiten</span>
              {/* UCL / UWCL Switch */}
              <div style={{ display: 'flex', gap: 3, background: 'rgba(255,255,255,0.05)', borderRadius: 9, padding: 3 }}>
                {(['ucl', 'uwcl'] as const).map(comp => (
                  <button key={comp} onClick={() => setAdminComp(comp)}
                    style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 700, transition: 'all 0.15s',
                      background: adminComp === comp ? 'linear-gradient(135deg,rgba(201,168,76,0.3),rgba(61,90,254,0.25))' : 'transparent',
                      color: adminComp === comp ? C.gold : C.muted,
                      outline: adminComp === comp ? `1px solid rgba(201,168,76,0.4)` : 'none' }}>
                    <img src={comp === 'ucl' ? '/ucl-badge.png' : '/uwcl-badge.png'} alt="" style={{ width: 13, height: 13, objectFit: 'contain', filter: adminComp === comp ? 'none' : 'brightness(0.5)' }} />
                    {comp.toUpperCase()}
                  </button>
                ))}
              </div>
              <div style={{ flex: 1 }} />
              <input
                value={wappenFilter}
                onChange={e => setWappenFilter(e.target.value)}
                placeholder="Suchen…"
                style={{ background: 'rgba(255,255,255,0.06)', border: `1px solid ${C.border}`, borderRadius: 8, padding: '5px 10px', color: '#fff', fontSize: 12, outline: 'none', width: 160 }}
              />
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '8px 14px 20px' }}>
              {activeAdminClubs
                .filter(c => !wappenFilter || c.name.toLowerCase().includes(wappenFilter.toLowerCase()))
                .map(club => {
                  const state = wappenSaving[club.id] || 'idle'
                  const editUrl = wappenEdits[club.id] ?? club.logo_url ?? ''
                  return (
                    <WappenRow
                      key={club.id}
                      club={club}
                      editUrl={editUrl}
                      state={state}
                      onChange={url => setWappenEdits(p => ({ ...p, [club.id]: url }))}
                      onSave={() => handleSaveWappen(club.id)}
                      onUpload={file => handleUploadWappen(club.id, file)}
                      border={C.border}
                      gold={C.gold}
                      goldL={C.goldL}
                      green={C.green}
                      red={C.red}
                      muted={C.muted}
                      row={C.row}
                    />
                  )
                })}
            </div>
          </div>
        )}

        {/* ── Tab: Teilnehmer ── */}
        {activeTab === 'spieler' && (
          <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

            {/* ── Teilnehmerliste ── */}
            <div style={{ width: 260, flexShrink: 0, display: 'flex', flexDirection: 'column', borderRight: `1px solid ${C.border}`, overflow: 'hidden' }}>
              <div style={{ padding: '10px 12px', borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
                <input value={playerSearch} onChange={e => setPlayerSearch(e.target.value)} placeholder="Suchen…"
                  style={{ width: '100%', background: 'rgba(255,255,255,0.06)', border: `1px solid ${C.border}`, borderRadius: 7, padding: '6px 10px', color: '#fff', fontSize: 12, outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div style={{ flex: 1, overflowY: 'auto' }}>
                {partLoading && <p style={{ textAlign: 'center', padding: 24, color: C.muted, fontSize: 12 }}>Lade…</p>}
                {!partLoading && filteredParticipants.length === 0 && <p style={{ textAlign: 'center', padding: 24, color: C.muted, fontSize: 12 }}>Keine Teilnehmer</p>}
                {filteredParticipants.map(p => {
                  const isSelected = playerDetail?.player?.name === p.name
                  return (
                    <div key={p.name} onClick={() => loadPlayer(p.name, p.type)}
                      style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '9px 12px', cursor: 'pointer', borderBottom: `1px solid ${C.border}`, background: isSelected ? 'rgba(61,90,254,0.14)' : 'transparent', transition: 'background 0.12s' }}>
                      <MCHead username={p.minecraft_username} size={28} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</p>
                        {/* Status-Badges */}
                        <div style={{ display: 'flex', gap: 3, marginTop: 3, flexWrap: 'wrap' }}>
                          {p.ucl_match_count > 0 && <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 4, background: 'rgba(61,90,254,0.2)', color: '#7b9fff' }}>UCL {p.ucl_match_count}T</span>}
                          {p.has_ucl_table && <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 4, background: 'rgba(201,168,76,0.2)', color: C.gold }}>Tab✓</span>}
                          {p.has_uwcl_match && <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 4, background: 'rgba(156,39,176,0.25)', color: '#ce93d8' }}>UWCL</span>}
                          {p.has_uwcl_table && <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 4, background: 'rgba(156,39,176,0.15)', color: '#ba68c8' }}>UTab✓</span>}
                          {p.type === 'gast' && <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 4, background: 'rgba(255,255,255,0.08)', color: C.muted }}>Gast</span>}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* ── Spieler-Detail ── */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              {!playerDetail && !playerLoading && (
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 10, color: C.muted }}>
                  <span style={{ fontSize: 28 }}>👈</span>
                  <p style={{ margin: 0, fontSize: 13 }}>Teilnehmer auswählen</p>
                </div>
              )}
              {playerLoading && <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.muted, fontSize: 13 }}>Lade…</div>}
              {playerDetail && !playerLoading && (() => {
                const detailTab = (playerDetail as any)._tab ?? 'ucl-spiele'
                const setDetailTab = (t: string) => setPlayerDetail((prev: any) => prev ? { ...prev, _tab: t } : prev)

                const renderMatchList = (tips: any[], cMap: Record<string,any>, allT: any[]) => {
                  const days = [...new Set(tips.map((t: any) => t.matchday))].sort((a,b) => a-b)
                  if (tips.length === 0) return <p style={{ color: C.muted, fontSize: 12, padding: 16 }}>Keine Tipps abgegeben.</p>
                  return days.map(day => (
                    <div key={day} style={{ marginBottom: 12 }}>
                      <p style={{ margin: '0 0 6px', fontSize: 10, fontWeight: 700, color: C.gold, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Spieltag {day}</p>
                      {tips.filter((t: any) => t.matchday === day).map((t: any) => {
                        const home = cMap[t.home_club_id]
                        const away = cMap[t.away_club_id]
                        const hasResult = t.result_home !== null && t.result_away !== null
                        const allForMatch = allT.filter(x => x.match_id === t.match_id)
                        const fakeTip = { tip_home: t.tip_home, tip_away: t.tip_away }
                        const fakeMatch = { result_home: t.result_home, result_away: t.result_away }
                        const pts = getTipPoints(fakeTip, fakeMatch, allForMatch)
                        const uhrzeit = new Date(t.kickoff).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' })
                        return (
                          <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 8px', marginBottom: 3, borderRadius: 7, background: C.row, border: `1px solid ${C.border}` }}>
                            <span style={{ fontSize: 10, color: C.muted, flexShrink: 0, width: 28 }}>{uhrzeit}</span>
                            <ClubLogo club={home} size={16} />
                            <span style={{ fontSize: 11, fontWeight: 600, color: '#fff', flex: 1, textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{home?.short ?? '???'}</span>
                            <span style={{ fontSize: 12, fontWeight: 800, color: '#4dbfff', flexShrink: 0, minWidth: 34, textAlign: 'center' }}>{t.tip_home}:{t.tip_away}</span>
                            <span style={{ fontSize: 11, fontWeight: 600, color: '#fff', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{away?.short ?? '???'}</span>
                            <ClubLogo club={away} size={16} />
                            {hasResult && <span style={{ fontSize: 10, color: C.muted, flexShrink: 0 }}>{t.result_home}:{t.result_away}</span>}
                            {pts !== null && <span style={{ fontSize: 11, fontWeight: 700, flexShrink: 0, minWidth: 26, textAlign: 'right', color: pts===5 ? C.gold : pts>=3 ? C.green : pts>=1 ? '#ffd54f' : C.red }}>+{pts}</span>}
                          </div>
                        )
                      })}
                    </div>
                  ))
                }

                const renderTableTip = (ranking: string[], cMap: Record<string,any>, sortedT: any[], zColor: (p:number) => string) => {
                  if (!ranking || ranking.length === 0) return <p style={{ color: C.muted, fontSize: 12, padding: 16 }}>Kein Tabellentipp abgegeben.</p>
                  return ranking.map((clubId, i) => {
                    const club = cMap[clubId]
                    const pos = i + 1
                    const color = zColor(pos)
                    const livePos = sortedT.findIndex(r => r.club_id === clubId) + 1
                    const correct = livePos === pos
                    const inSection = livePos > 0 && zColor(livePos) === zColor(pos)
                    return (
                      <div key={clubId} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 7px', marginBottom: 2, borderRadius: 6, background: correct ? 'rgba(76,175,80,0.08)' : C.row, border: `1px solid ${correct ? C.green+'33' : color+'14'}` }}>
                        <span style={{ fontSize: 10, fontWeight: 700, color, width: 18, textAlign: 'center', flexShrink: 0 }}>{pos}</span>
                        <ClubLogo club={club} size={16} />
                        <span style={{ fontSize: 11, fontWeight: 600, color: '#fff', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{club?.short ?? clubId}</span>
                        {correct ? <span style={{ fontSize: 9, color: C.green }}>🎯</span> : inSection ? <span style={{ fontSize: 9, color }}>✓</span> : livePos > 0 ? <span style={{ fontSize: 9, color: C.muted }}>#{livePos}</span> : null}
                      </div>
                    )
                  })
                }

                const DETAIL_TABS = [
                  { key: 'ucl-spiele', label: 'UCL Spiele', count: playerDetail.tips?.length ?? 0 },
                  { key: 'uwcl-spiele', label: 'UWCL Spiele', count: (playerDetail as any).uwclTips?.length ?? 0 },
                  { key: 'ucl-tabelle', label: 'UCL Tabelle' },
                  { key: 'uwcl-tabelle', label: 'UWCL Tabelle' },
                ]

                return (
                  <>
                    {/* Header */}
                    <div style={{ padding: '12px 16px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                      <MCHead username={playerDetail.player.minecraft_username} size={36} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#fff' }}>{playerDetail.player.name}</p>
                        <p style={{ margin: 0, fontSize: 11, color: C.muted }}>
                          {playerDetail.player.type === 'user' ? `Rolle: ${playerDetail.player.role ?? '—'}` : 'Gast'}
                        </p>
                      </div>
                      {/* Status-Chips */}
                      <div style={{ display: 'flex', gap: 5 }}>
                        {[
                          { label: `UCL ${playerDetail.tips?.length ?? 0}T`, show: (playerDetail.tips?.length ?? 0) > 0, color: '#7b9fff', bg: 'rgba(61,90,254,0.15)' },
                          { label: 'Tab✓', show: !!playerDetail.tableTip, color: C.gold, bg: 'rgba(201,168,76,0.15)' },
                          { label: `UWCL ${(playerDetail as any).uwclTips?.length ?? 0}T`, show: ((playerDetail as any).uwclTips?.length ?? 0) > 0, color: '#ce93d8', bg: 'rgba(156,39,176,0.2)' },
                          { label: 'UTab✓', show: !!(playerDetail as any).uwclTableTip, color: '#ba68c8', bg: 'rgba(156,39,176,0.12)' },
                        ].filter(x => x.show).map(x => (
                          <span key={x.label} style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 5, background: x.bg, color: x.color }}>{x.label}</span>
                        ))}
                      </div>
                    </div>

                    {/* Sub-Tabs */}
                    <div style={{ display: 'flex', gap: 0, borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
                      {DETAIL_TABS.map(tab => (
                        <button key={tab.key} onClick={() => setDetailTab(tab.key)}
                          style={{ flex: 1, padding: '9px 4px', border: 'none', borderBottom: detailTab === tab.key ? `2px solid ${C.gold}` : '2px solid transparent', background: 'transparent', cursor: 'pointer', fontSize: 11, fontWeight: 700, color: detailTab === tab.key ? C.gold : C.muted, transition: 'color 0.15s', whiteSpace: 'nowrap' }}>
                          {tab.label}{tab.count !== undefined ? <span style={{ opacity: 0.6, marginLeft: 3 }}>({tab.count})</span> : null}
                        </button>
                      ))}
                    </div>

                    {/* Tab-Content */}
                    <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px' }}>
                      {detailTab === 'ucl-spiele' && renderMatchList(playerDetail.tips ?? [], uclClubMap, allTips.length ? allTips : myTips)}
                      {detailTab === 'uwcl-spiele' && renderMatchList((playerDetail as any).uwclTips ?? [], uwclClubMap, [])}
                      {detailTab === 'ucl-tabelle' && renderTableTip(playerDetail.tableTip ?? [], uclClubMap, sortedTable, zoneColor)}
                      {detailTab === 'uwcl-tabelle' && renderTableTip((playerDetail as any).uwclTableTip ?? [], uwclClubMap, [], (p) => p <= 4 ? C.green : p <= 12 ? C.blue : C.red)}
                    </div>
                  </>
                )
              })()}
            </div>
          </div>
        )}
      </div>
    </>
  )
}