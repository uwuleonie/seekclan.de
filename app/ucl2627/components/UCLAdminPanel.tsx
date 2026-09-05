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
  match_tip_count: number
  has_table_tip: boolean
}

type PlayerDetail = {
  player: { name: string; role: string | null; type: string; minecraft_username: string | null }
  tips: any[]
  tableTip: string[] | null
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
  // Richtiger Gewinner / Unentschieden — einziger: 2 Pkt
  if (Math.sign(th - ta) === Math.sign(rh - ra)) {
    const isAlone = allForMatch.filter(t => Math.sign(t.tip_home - t.tip_away) === Math.sign(rh - ra)).length === 1
    return isAlone ? 2 : 1
  }
  return 0
}

// ── Kleine Hilfskomponenten ───────────────────────────────────────────────────
function ClubLogo({ club, size = 20 }: { club: Club | undefined; size?: number }) {
  const [err, setErr] = useState(false)
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

export default function UCLAdminPanel({ matches, clubs, allTips, myTips, table, setMatches, setTable, reloadTable }: Props) {
  const [open, setOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<'main' | 'partner' | 'hottakes' | 'doubles' | 'spieler' | 'wappen' | 'star'>('main')

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
  const [starResults, setStarResults] = useState<{ matchday: number; player_name: string; actual_goals: number }[]>([])
  const [starGoalInputs, setStarGoalInputs] = useState<Record<number, string>>({})
  const [starSaving, setStarSaving] = useState<Record<number, boolean>>({})
  const [starTips, setStarTips] = useState<{ matchday: number; player_name: string; tipped_goals: number; username: string | null; gast_name: string | null }[]>([])
  const [starMatchday, setStarMatchday] = useState(1)

  // Star-Results laden
  React.useEffect(() => {
    if (activeTab !== 'star') return
    fetch('/api/ucl2627/admin/star-result')
      .then(r => r.json())
      .then(d => {
        if (d.results) {
          setStarResults(d.results)
          const inputs: Record<number, string> = {}
          for (const r of d.results) inputs[r.matchday] = String(r.actual_goals)
          setStarGoalInputs(inputs)
        }
      })
      .catch(console.error)
  }, [activeTab])

  React.useEffect(() => {
    if (activeTab !== 'star') return
    fetch(`/api/ucl2627/admin/star-tips?matchday=${starMatchday}`)
      .then(r => r.json())
      .then(d => { if (d.tips) setStarTips(d.tips) })
      .catch(console.error)
  }, [activeTab, starMatchday])

  const handleSaveStar = async (matchday: number, playerName: string) => {
    const goals = parseInt(starGoalInputs[matchday] || '0') || 0
    setStarSaving(p => ({ ...p, [matchday]: true }))
    try {
      await fetch('/api/ucl2627/admin/star-result', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matchday, player_name: playerName, actual_goals: goals }),
      })
      setStarResults(prev => {
        const filtered = prev.filter(r => r.matchday !== matchday)
        return [...filtered, { matchday, player_name: playerName, actual_goals: goals }].sort((a,b) => a.matchday - b.matchday)
      })
    } catch {}
    setStarSaving(p => ({ ...p, [matchday]: false }))
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
  type AdminHottake = { id: number; content: string; valid_until: string; status: string; hardness: number | null; created_at: string; username?: string; gast_name?: string }
  const [hottakes, setHottakes] = useState<AdminHottake[]>([])
  const [hottakesLoading, setHottakesLoading] = useState(false)

  // Spieler
  const [participants, setParticipants] = useState<Participant[]>([])
  const [partLoading, setPartLoading] = useState(false)
  const [playerDetail, setPlayerDetail] = useState<PlayerDetail|null>(null)
  const [playerLoading, setPlayerLoading] = useState(false)
  const [playerSearch, setPlayerSearch] = useState('')
  const [playerDay, setPlayerDay] = useState(1)

  const clubMap = Object.fromEntries(clubs.map(c => [c.id, c]))
  const sortedTable = [...table].sort((a,b) => a.position - b.position)

  // Inputs vorbelegen
  useEffect(() => {
    const init: Record<string, { h: string; a: string }> = {}
    for (const m of matches) init[m.id] = { h: m.result_home !== null ? String(m.result_home) : '', a: m.result_away !== null ? String(m.result_away) : '' }
    setAdminInputs(init)
  }, [matches])

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
    fetch('/api/ucl2627/admin/matchday-status')
      .then(r => r.json())
      .then(d => {
        if (d.status) {
          const finished = new Set<number>(
            Object.entries(d.status).filter(([, v]) => v).map(([k]) => Number(k))
          )
          setFinishedMatchdays(finished)
        }
      })
  }, [open])

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
  useEffect(() => {
    if (activeTab !== 'hottakes' || hottakes.length > 0) return
    setHottakesLoading(true)
    fetch('/api/ucl2627/admin/hottakes')
      .then(r => r.json())
      .then(d => { if (d.hottakes) setHottakes(d.hottakes) })
      .finally(() => setHottakesLoading(false))
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
      const res = await fetch('/api/ucl2627/admin', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ match_id: matchId, result_home: h, result_away: a }) })
      if (!res.ok) throw new Error()
      setMatches(prev => prev.map(m => m.id === matchId ? { ...m, result_home: parseInt(h), result_away: parseInt(a) } : m))
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
      await fetch('/api/ucl2627/admin', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ match_id: matchId }) })
      setMatches(prev => prev.map(m => m.id === matchId ? { ...m, result_home: null, result_away: null } : m))
      setAdminInputs(p => ({ ...p, [matchId]: { h: '', a: '' } }))
      setAdminSave(p => ({ ...p, [matchId]: 'idle' }))
    } catch {
      setAdminSave(p => ({ ...p, [matchId]: 'error' }))
      setTimeout(() => setAdminSave(p => ({ ...p, [matchId]: 'idle' })), 3000)
    }
  }

  const handleSaveAll = async () => {
    const toSave = matches.filter(m => m.matchday === adminDay && adminInputs[m.id]?.h !== '' && adminInputs[m.id]?.a !== '')
    if (!toSave.length) return
    let ok = 0, fail = 0
    await Promise.all(toSave.map(async m => {
      const { h, a } = adminInputs[m.id]
      const res = await fetch('/api/ucl2627/admin', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ match_id: m.id, result_home: h, result_away: a }) })
      if (res.ok) { setMatches(prev => prev.map(x => x.id === m.id ? { ...x, result_home: parseInt(h), result_away: parseInt(a) } : x)); ok++ }
      else fail++
    }))
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
        body: JSON.stringify({ matchday: day, finished: nowFinished }),
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
      reloadTable()
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

  const handleHottakeUpdate = async (id: number, updates: { status?: string; hardness?: number }) => {
    const res = await fetch('/api/ucl2627/admin/hottakes', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...updates }),
    })
    if (res.ok) setHottakes(prev => prev.map(h => h.id === id ? { ...h, ...updates } : h))
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
          <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', overflow: 'hidden' }}>

            {/* LINKS: Tabellen-Override */}
            <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', borderRight: `1px solid ${C.border}` }}>
              {/* Subheader */}
              <div style={{ padding: '12px 20px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                <span style={{ flex: 1, fontSize: 11, fontWeight: 700, color: C.gold, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Tabellen-Override</span>
                {hasOverride && <Badge color={C.gold}>Aktiv</Badge>}
                <button onClick={handleSaveOverride} disabled={overrideSaving} style={{ padding: '5px 14px', borderRadius: 7, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700, background: `linear-gradient(135deg,${C.gold},${C.goldL})`, color: '#05081a' }}>Speichern</button>
                {hasOverride && <button onClick={handleDeleteOverride} disabled={overrideSaving} style={{ padding: '5px 10px', borderRadius: 7, border: `1px solid ${C.red}44`, background: 'none', cursor: 'pointer', fontSize: 12, color: C.red }}>Reset</button>}
              </div>
              <p style={{ margin: '6px 20px 4px', fontSize: 10, color: C.muted }}>Drag & Drop zum Umsortieren — überschreibt automatische Berechnung</p>

              {/* Tabellen-Drag-Liste */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '4px 12px 16px' }}>
                {/* Zonen-Labels */}
                {adminTableOrder.map((clubId, idx) => {
                  const club = clubMap[clubId]
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
                  const ms       = matches.filter(m => m.matchday === day)
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
                  const dayMatches = matches.filter(m => m.matchday === adminDay)
                  const byDate: Record<string, Match[]> = {}
                  for (const m of dayMatches) {
                    const d = new Date(m.kickoff).toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit', timeZone: 'UTC' })
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
                        const uhrzeit   = new Date(match.kickoff).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' })
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
            <div style={{ padding: '12px 16px', borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: C.gold, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Alle Hottakes — {hottakes.length}</span>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '10px 14px' }}>
              {hottakesLoading && <p style={{ color: C.muted, fontSize: 13, padding: 20 }}>Lade…</p>}
              {!hottakesLoading && hottakes.length === 0 && <p style={{ color: C.muted, fontSize: 13, padding: '20px 4px' }}>Noch keine Hottakes.</p>}
              {hottakes.map(h => {
                const author = h.username || h.gast_name || '?'
                const expired = new Date(h.valid_until) < new Date()
                const hardnessColors: Record<number, string> = { 1: '#ffd54f', 2: '#ff8a65', 3: '#ef5350' }
                const hardnessLabels: Record<number, string> = { 1: 'Lauwarm 🌡', 2: 'Heiß 🔥', 3: 'Höllisch ☠️' }
                return (
                  <div key={h.id} style={{ padding: '14px 16px', marginBottom: 8, borderRadius: 10, background: C.row, border: `1px solid ${h.status === 'accepted' ? C.green+'33' : h.status === 'rejected' ? '#ef535033' : C.border}` }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>{author}</span>
                      <span style={{ fontSize: 10, color: C.muted }}>{new Date(h.created_at).toLocaleDateString('de-DE')}</span>
                      <span style={{ fontSize: 10, color: expired ? C.muted : '#ffd54f', marginLeft: 'auto' }}>
                        bis {new Date(h.valid_until).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                        {expired ? ' (abgelaufen)' : ''}
                      </span>
                    </div>
                    <p style={{ margin: '0 0 10px', fontSize: 13, color: '#fff', lineHeight: 1.5 }}>{h.content}</p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' as const }}>
                      <button onClick={() => handleHottakeUpdate(h.id, { status: 'accepted' })} style={{ padding: '4px 10px', borderRadius: 6, border: `1px solid ${C.green}55`, background: h.status === 'accepted' ? `${C.green}22` : 'none', cursor: 'pointer', fontSize: 11, fontWeight: 600, color: C.green }}>✓ Annehmen</button>
                      <button onClick={() => handleHottakeUpdate(h.id, { status: 'rejected' })} style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #ef535055', background: h.status === 'rejected' ? '#ef535022' : 'none', cursor: 'pointer', fontSize: 11, fontWeight: 600, color: '#ef5350' }}>✕ Ablehnen</button>
                      <button onClick={() => handleHottakeUpdate(h.id, { status: 'pending' })} style={{ padding: '4px 10px', borderRadius: 6, border: `1px solid ${C.muted}`, background: h.status === 'pending' ? 'rgba(255,255,255,0.07)' : 'none', cursor: 'pointer', fontSize: 11, color: C.muted }}>Ausstehend</button>
                      <span style={{ fontSize: 11, color: C.muted, marginLeft: 8 }}>Härte:</span>
                      {[1,2,3].map(lvl => (
                        <button key={lvl} onClick={() => handleHottakeUpdate(h.id, { hardness: lvl })}
                          style={{ padding: '4px 10px', borderRadius: 6, border: `1px solid ${hardnessColors[lvl]}55`, background: h.hardness === lvl ? `${hardnessColors[lvl]}22` : 'none', cursor: 'pointer', fontSize: 11, fontWeight: 600, color: hardnessColors[lvl] }}>
                          {hardnessLabels[lvl]}
                        </button>
                      ))}
                    </div>
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
                      const match = matches.find(m => m.id === d.match_id)
                      const home  = match ? clubMap[match.home_club_id] : undefined
                      const away  = match ? clubMap[match.away_club_id] : undefined
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
        {activeTab === 'star' && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ padding: '10px 14px', borderBottom: `1px solid ${C.border}`, display: 'flex', gap: 6, flexWrap: 'wrap' as const, flexShrink: 0 }}>
              {[1,2,3,4,5,6,7,8].map(d => (
                <button key={d} onClick={() => setStarMatchday(d)}
                  style={{ padding: '4px 12px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700, background: starMatchday === d ? `linear-gradient(135deg,${C.gold},${C.goldL})` : 'rgba(255,255,255,0.07)', color: starMatchday === d ? '#05081a' : C.muted }}>
                  ST {d}
                </button>
              ))}
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px' }}>
              {(() => {
                const dayTips = starTips.filter(t => t.matchday === starMatchday)
                const result = starResults.find(r => r.matchday === starMatchday)
                const byPlayer: Record<string, { tippers: string[]; tippedGoals: number[] }> = {}
                for (const t of dayTips) {
                  if (!byPlayer[t.player_name]) byPlayer[t.player_name] = { tippers: [], tippedGoals: [] }
                  byPlayer[t.player_name].tippers.push(t.username || t.gast_name || '?')
                  byPlayer[t.player_name].tippedGoals.push(t.tipped_goals)
                }
                return (
                  <>
                    {dayTips.length === 0 && <p style={{ color: C.muted, fontSize: 13, marginBottom: 16 }}>Noch keine Tipps für ST {starMatchday}.</p>}
                    {Object.entries(byPlayer).map(([player, data]) => (
                      <div key={player} style={{ marginBottom: 12, borderRadius: 10, background: C.row, border: `1px solid ${C.border}`, overflow: 'hidden' }}>
                        <div style={{ padding: '8px 12px', background: 'rgba(201,168,76,0.08)', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 13, fontWeight: 800, color: '#fff' }}>⭐ {player}</span>
                          <span style={{ fontSize: 11, color: C.muted, marginLeft: 'auto' }}>{data.tippers.length}×</span>
                        </div>
                        {data.tippers.map((tipper, i) => {
                          const tipped = data.tippedGoals[i]
                          const pts = result ? Math.min(tipped, result.actual_goals) * 2 : null
                          return (
                            <div key={tipper} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', borderBottom: `1px solid rgba(255,255,255,0.04)` }}>
                              <span style={{ fontSize: 12, color: '#fff', flex: 1 }}>{tipper}</span>
                              <span style={{ fontSize: 11, color: C.muted }}>{tipped} Tor{tipped !== 1 ? 'e' : ''}</span>
                              {pts !== null && <span style={{ fontSize: 12, fontWeight: 700, color: pts > 0 ? C.green : C.muted }}>+{pts}P</span>}
                            </div>
                          )
                        })}
                      </div>
                    ))}
                    <div style={{ marginTop: 16, padding: '14px', borderRadius: 12, background: 'rgba(201,168,76,0.06)', border: `1px solid rgba(201,168,76,0.2)` }}>
                      <p style={{ margin: '0 0 10px', fontSize: 12, fontWeight: 700, color: C.gold }}>
                        Tore eintragen {result ? `· Aktuell: ${result.player_name} ${result.actual_goals}T` : ''}
                      </p>
                      {/* Auch bereits eingetragene Spieler ohne Tipps anzeigen */}
                      {(() => {
                        const allPlayers = [...new Set([...Object.keys(byPlayer), ...(result ? [result.player_name] : [])])]
                        return allPlayers.length === 0
                          ? <p style={{ fontSize: 12, color: C.muted, margin: 0 }}>Keine Tipps — nichts einzutragen.</p>
                          : allPlayers.map(player => (
                          <div key={player} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                            <span style={{ fontSize: 13, fontWeight: 600, color: '#fff', flex: 1 }}>⭐ {player}</span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'rgba(255,255,255,0.06)', border: `1px solid ${C.border}`, borderRadius: 8, padding: '4px 10px' }}>
                              <button onClick={() => setStarGoalInputs(p => ({ ...p, [starMatchday]: String(Math.max(0, parseInt(p[starMatchday]||'0') - 1)) }))} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 18 }}>−</button>
                              <span style={{ fontSize: 15, fontWeight: 700, color: '#fff', minWidth: 20, textAlign: 'center' as const }}>{starGoalInputs[starMatchday] || '0'}</span>
                              <button onClick={() => setStarGoalInputs(p => ({ ...p, [starMatchday]: String(parseInt(p[starMatchday]||'0') + 1) }))} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 18 }}>+</button>
                            </div>
                            <button onClick={() => handleSaveStar(starMatchday, player)} disabled={!!starSaving[starMatchday]}
                              style={{ padding: '6px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700, background: `linear-gradient(135deg,${C.gold},${C.goldL})`, color: '#05081a', opacity: starSaving[starMatchday] ? 0.5 : 1 }}>
                              {starSaving[starMatchday] ? '…' : '✓'}
                            </button>
                          </div>
                          ))
                      })()
                      }
                    </div>
                  </>
                )
              })()}
            </div>
          </div>
        )}

        {/* ── Tab: Wappen ── */}
        {activeTab === 'wappen' && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: C.gold, textTransform: 'uppercase', letterSpacing: '0.08em', flex: 1 }}>Vereinswappen bearbeiten</span>
              <input
                value={wappenFilter}
                onChange={e => setWappenFilter(e.target.value)}
                placeholder="Suchen…"
                style={{ background: 'rgba(255,255,255,0.06)', border: `1px solid ${C.border}`, borderRadius: 8, padding: '5px 10px', color: '#fff', fontSize: 12, outline: 'none', width: 160 }}
              />
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '8px 14px 20px' }}>
              {clubs
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

            {/* Teilnehmerliste */}
            <div style={{ width: 320, flexShrink: 0, display: 'flex', flexDirection: 'column', borderRight: `1px solid ${C.border}`, overflow: 'hidden' }}>
              <div style={{ padding: '12px 14px', borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
                <input
                  value={playerSearch} onChange={e => setPlayerSearch(e.target.value)}
                  placeholder="Suchen…"
                  style={{ width: '100%', background: 'rgba(255,255,255,0.06)', border: `1px solid ${C.border}`, borderRadius: 8, padding: '7px 12px', color: '#fff', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
                />
              </div>
              <div style={{ flex: 1, overflowY: 'auto' }}>
                {partLoading && <p style={{ textAlign: 'center', padding: 32, color: C.muted, fontSize: 13 }}>Lade…</p>}
                {!partLoading && filteredParticipants.length === 0 && <p style={{ textAlign: 'center', padding: 32, color: C.muted, fontSize: 13 }}>Keine Teilnehmer</p>}
                {filteredParticipants.map(p => {
                  const isSelected = playerDetail?.player?.name === p.name
                  return (
                    <div key={p.name} onClick={() => loadPlayer(p.name, p.type)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', cursor: 'pointer', borderBottom: `1px solid ${C.border}`, background: isSelected ? 'rgba(61,90,254,0.12)' : 'transparent', transition: 'background 0.15s' }}>
                      <MCHead username={p.minecraft_username} size={32} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</p>
                        <p style={{ margin: 0, fontSize: 11, color: C.muted }}>
                          {p.match_tip_count} Spieltipps · {p.has_table_tip ? 'Tabellentipp ✓' : 'kein Tabellentipp'}
                        </p>
                      </div>
                      {p.type === 'gast' && <Badge color={C.muted}>Gast</Badge>}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Spieler-Detail */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              {!playerDetail && !playerLoading && (
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 10, color: C.muted }}>
                  <span style={{ fontSize: 32 }}>👈</span>
                  <p style={{ margin: 0, fontSize: 13 }}>Teilnehmer auswählen</p>
                </div>
              )}
              {playerLoading && (
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.muted, fontSize: 13 }}>Lade…</div>
              )}
              {playerDetail && !playerLoading && (
                <>
                  {/* Detail-Header */}
                  <div style={{ padding: '14px 20px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                    <MCHead username={playerDetail.player.minecraft_username} size={40} />
                    <div>
                      <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#fff' }}>{playerDetail.player.name}</p>
                      <p style={{ margin: 0, fontSize: 11, color: C.muted }}>
                        {playerDetail.player.type === 'user' ? `Rolle: ${playerDetail.player.role ?? '—'}` : 'Gast'} · {playerDetail.tips.length} Spieltipps · {playerDetail.tableTip ? 'Tabellentipp ✓' : 'kein Tabellentipp'}
                      </p>
                    </div>
                  </div>

                  {/* Zwei Spalten: Tabellentipp links, Spieltage rechts */}
                  <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', overflow: 'hidden' }}>

                    {/* Tabellentipp */}
                    <div style={{ borderRight: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                      <p style={{ margin: 0, padding: '10px 16px', fontSize: 11, fontWeight: 700, color: C.gold, textTransform: 'uppercase', letterSpacing: '0.08em', borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>Tabellentipp</p>
                      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 10px' }}>
                        {!playerDetail.tableTip ? (
                          <p style={{ color: C.muted, fontSize: 12, padding: '16px 6px' }}>Kein Tabellentipp abgegeben.</p>
                        ) : playerDetail.tableTip.map((clubId: string, i: number) => {
                          const club  = clubMap[clubId]
                          const pos   = i + 1
                          const color = zoneColor(pos)
                          // Live-Position
                          const livePos = sortedTable.findIndex(r => r.club_id === clubId) + 1
                          const correct = livePos === pos
                          const inSection = livePos > 0 && zoneColor(livePos) === zoneColor(pos)
                          return (
                            <div key={clubId} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '4px 8px', marginBottom: 2, borderRadius: 7, background: correct ? 'rgba(76,175,80,0.08)' : C.row, border: `1px solid ${correct ? C.green+'33' : color+'14'}` }}>
                              <span style={{ fontSize: 11, fontWeight: 700, color, width: 20, textAlign: 'center', flexShrink: 0 }}>{pos}</span>
                              <ClubLogo club={club} size={18} />
                              <span style={{ fontSize: 12, fontWeight: 600, color: '#fff', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{club?.short ?? clubId}</span>
                              {correct ? <span style={{ fontSize: 10, color: C.green }}>🎯</span> : inSection ? <span style={{ fontSize: 10, color: color }}>✓</span> : livePos > 0 ? <span style={{ fontSize: 10, color: C.muted }}>#{livePos}</span> : null}
                            </div>
                          )
                        })}
                      </div>
                    </div>

                    {/* Spieltage */}
                    <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                      {/* Spieltag-Tabs */}
                      <div style={{ padding: '8px 12px', borderBottom: `1px solid ${C.border}`, display: 'flex', gap: 4, flexWrap: 'wrap', flexShrink: 0 }}>
                        {[1,2,3,4,5,6,7,8].map(day => {
                          const dayTips = playerDetail.tips.filter((t: any) => t.matchday === day)
                          const dayMs   = matches.filter(m => m.matchday === day)
                          const active  = playerDay === day
                          return (
                            <button key={day} onClick={() => setPlayerDay(day)} style={{ padding: '4px 10px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 600, background: active ? 'linear-gradient(135deg,#1a237e,#3d5afe)' : 'rgba(255,255,255,0.05)', color: active ? '#fff' : C.muted, outline: `1px solid ${active ? 'transparent' : C.border}` }}>
                              ST {day}
                              <span style={{ fontSize: 9, marginLeft: 3, opacity: 0.7 }}>{dayTips.length}/{dayMs.length}</span>
                            </button>
                          )
                        })}
                      </div>
                      {/* Tipps */}
                      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 12px 16px' }}>
                        {playerDetail.tips.filter((t: any) => t.matchday === playerDay).length === 0 && (
                          <p style={{ color: C.muted, fontSize: 12, padding: '16px 4px' }}>Keine Tipps für Spieltag {playerDay}.</p>
                        )}
                        {playerDetail.tips.filter((t: any) => t.matchday === playerDay).map((t: any) => {
                          const home = clubMap[t.home_club_id]
                          const away = clubMap[t.away_club_id]
                          const hasResult = t.result_home !== null && t.result_away !== null
                          const allForMatch = (allTips.length ? allTips : myTips).filter(x => x.match_id === t.match_id)
                          const fakeTip = { tip_home: t.tip_home, tip_away: t.tip_away }
                          const fakeMatch = { result_home: t.result_home, result_away: t.result_away }
                          const pts = getTipPoints(fakeTip, fakeMatch, allForMatch)
                          const uhrzeit = new Date(t.kickoff).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' })
                          return (
                            <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '7px 8px', marginBottom: 4, borderRadius: 8, background: C.row, border: `1px solid ${C.border}` }}>
                              <span style={{ fontSize: 10, color: C.muted, flexShrink: 0, width: 30 }}>{uhrzeit}</span>
                              <ClubLogo club={home} size={18} />
                              <span style={{ fontSize: 11, fontWeight: 600, color: '#fff', flex: 1, textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{home?.short ?? '???'}</span>
                              <span style={{ fontSize: 13, fontWeight: 800, color: '#4dbfff', flexShrink: 0, minWidth: 32, textAlign: 'center' }}>{t.tip_home}:{t.tip_away}</span>
                              <span style={{ fontSize: 11, fontWeight: 600, color: '#fff', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{away?.short ?? '???'}</span>
                              <ClubLogo club={away} size={18} />
                              {hasResult && <span style={{ fontSize: 10, color: C.muted, flexShrink: 0 }}>{t.result_home}:{t.result_away}</span>}
                              {pts !== null && (
                                <span style={{ fontSize: 11, fontWeight: 700, flexShrink: 0, minWidth: 28, textAlign: 'right', color: pts===5 ? C.gold : pts>=3 ? C.green : pts>=1 ? '#ffd54f' : C.red }}>+{pts}</span>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  )
}