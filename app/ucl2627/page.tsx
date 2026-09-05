'use client'

import React, { useState, useEffect } from 'react'
import UCLTableTip from './components/UCLTableTip'
import UCLCalendarPicker from './components/UCLCalendarPicker'
import UCLMusicPlayer from './components/UCLMusicPlayer'
import UCLAdminPanel from './components/UCLAdminPanel'
import { useAuth } from '../lib/auth-context'
import Link from 'next/link'
function getMatchTipPoints(
  tip: Tip, match: Match, allTipsForMatch: Tip[]
): { points: number; isExact: boolean; isAlone: boolean } {
  if (match.result_home === null || match.result_away === null) return { points: 0, isExact: false, isAlone: false }
  const rh = match.result_home, ra = match.result_away
  const th = tip.tip_home, ta = tip.tip_away
  // Genaues Ergebnis
  if (th === rh && ta === ra) {
    const isAlone = allTipsForMatch.filter(t => t.tip_home === rh && t.tip_away === ra).length === 1
    return { points: isAlone ? 5 : 3, isExact: true, isAlone }
  }
  // Richtiges Torverhältnis — einziger: 4 Pkt
  if (th - ta === rh - ra) {
    const isAlone = allTipsForMatch.filter(t => t.tip_home - t.tip_away === rh - ra).length === 1
    return { points: isAlone ? 4 : 2, isExact: false, isAlone }
  }
  // Richtiger Gewinner / Unentschieden — einziger: 2 Pkt
  if (Math.sign(th - ta) === Math.sign(rh - ra)) {
    const isAlone = allTipsForMatch.filter(t => Math.sign(t.tip_home - t.tip_away) === Math.sign(rh - ra)).length === 1
    return { points: isAlone ? 2 : 1, isExact: false, isAlone }
  }
  return { points: 0, isExact: false, isAlone: false }
}

function calcTableTipPoints(ranking: string[], liveTable: TableRow[]): {
  total: number
  perClub: Record<string, { inSection: boolean; exactPos: boolean; sectionPoints: number; posPoints: number }>
  bonuses: { section1: number; section2: number; section3: number; allCorrect: boolean }
} {
  const liveClubIds = [...liveTable].sort((a, b) => a.position - b.position).map(r => r.club_id)
  const getSection = (pos: number): 1 | 2 | 3 => pos <= 8 ? 1 : pos <= 24 ? 2 : 3
  const perClub: Record<string, { inSection: boolean; exactPos: boolean; sectionPoints: number; posPoints: number }> = {}
  for (let i = 0; i < ranking.length; i++) {
    const clubId = ranking[i], tipPos = i + 1
    const livePos = liveClubIds.indexOf(clubId) + 1
    const inSection = getSection(tipPos) === (livePos > 0 ? getSection(livePos) : 0 as any)
    const exactPos = tipPos === livePos
    perClub[clubId] = { inSection, exactPos, sectionPoints: inSection ? 1 : 0, posPoints: exactPos ? 2 : 0 }
  }
  let bonusSection1 = 0, bonusSection2 = 0, bonusSection3 = 0
  for (const { key, range: [from, to] } of [{ key: 1, range: [1, 8] }, { key: 2, range: [9, 24] }, { key: 3, range: [25, 36] }] as { key: 1|2|3; range: [number,number] }[]) {
    const size = to - from + 1
    const liveInSection = new Set(liveClubIds.slice(from - 1, to))
    const tipInSection = ranking.slice(from - 1, to)
    const correctCount = tipInSection.filter(id => liveInSection.has(id)).length
    const allClubsCorrect = correctCount === size
    const allPosCorrect = allClubsCorrect && tipInSection.every((id, idx) => liveClubIds[from - 1 + idx] === id)
    const bonus = allPosCorrect ? 10 : allClubsCorrect ? 3 : correctCount > size / 2 ? 2 : 0
    if (key === 1) bonusSection1 = bonus
    else if (key === 2) bonusSection2 = bonus
    else bonusSection3 = bonus
  }
  const allCorrect = ranking.every((id, i) => liveClubIds[i] === id)
  const clubPoints = Object.values(perClub).reduce((s, c) => s + c.sectionPoints + c.posPoints, 0)
  return { total: clubPoints + bonusSection1 + bonusSection2 + bonusSection3 + (allCorrect ? 36 : 0), perClub, bonuses: { section1: bonusSection1, section2: bonusSection2, section3: bonusSection3, allCorrect } }
}

const G = {
  card: {
    background: 'rgba(5,15,60,0.45)',
    backdropFilter: 'blur(28px)',
    WebkitBackdropFilter: 'blur(28px)',
    border: '1px solid rgba(255,255,255,0.15)',
    borderRadius: '16px',
    boxShadow: '0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.08)',
  } as React.CSSProperties,
  cardStrong: {
    background: 'rgba(5,18,65,0.5)',
    backdropFilter: 'blur(36px)',
    WebkitBackdropFilter: 'blur(36px)',
    border: '1px solid rgba(201,168,76,0.35)',
    borderRadius: '16px',
    boxShadow: '0 12px 40px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.1)',
  } as React.CSSProperties,
  cardHeader: {
    background: 'rgba(201,168,76,0.09)',
    borderBottom: '1px solid rgba(201,168,76,0.18)',
    padding: '12px 20px',
  } as React.CSSProperties,
  gold:    '#c9a84c',
  goldLight: '#e8c96a',
  blue:    '#0099ff',
  blueLight: '#4dbfff',
  white:   '#ffffff',
  muted:   'rgba(180,210,255,0.5)',
  mutedBg: 'rgba(0,30,100,0.4)',
  green:   '#4caf50',
  purple:  '#9c27b0',
}

type Club = { id: string; name: string; short: string; logo_url: string | null; country: string }
type Match = { id: string; matchday: number; home_club_id: string; away_club_id: string; kickoff: string; result_home: number | null; result_away: number | null; phase: 'ligaphase' }
type TableRow = { club_id: string; position: number; played: number; won: number; drawn: number; lost: number; goals_for: number; goals_against: number; points: number }
type Tip = { id: string; match_id: string; user_id: string | null; username: string | null; gast_name: string | null; tip_home: number; tip_away: number }
type TableTip = { user_id: string | null; username: string | null; gast_name: string | null; ranking: string[] }
type LeaderboardEntry = { name: string; minecraft_username?: string | null; matchPoints: number; tablePoints: number; partnerPoints: number; hottakePoints: number; total: number; exact: number; alone: number; tendency: number }
type PartnerClub = { id: string; name: string; short: string; logo_url: string | null }
type Tab = 'tabelle' | 'spiele' | 'ko' | 'leaderboard' | 'special'

function ClubLogo({ club, size = 'sm' }: { club: Club | undefined; size?: 'sm' | 'md' | 'lg' }) {
  const [err, setErr] = React.useState(false)
  const px = size === 'lg' ? 40 : size === 'md' ? 28 : 20
  const dim = { width: px, height: px, flexShrink: 0 }
  if (!club) return <div style={{ ...dim, borderRadius: '50%', background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, color: G.muted }}>?</div>
  if (club.logo_url && !err) return <img src={club.logo_url} alt={club.short} style={{ ...dim, objectFit: 'contain' }} onError={() => setErr(true)} />
  return <div style={{ ...dim, borderRadius: '50%', background: 'linear-gradient(135deg, #1a237e, #3d5afe)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size === 'lg' ? 10 : 8, color: '#fff', fontWeight: 700 }}>{club.short.slice(0, 3)}</div>
}

// Leaderboard berechnen mit neuer Scoring-Logik
type DoubleTip = { match_id: string; username: string | null; gast_name: string | null }
type PartnerEntry = { username: string | null; gast_name: string | null; club_id: string }
type HottakeEntry = { content: string; valid_until: string; status: string; hardness: number | null; username?: string; gast_name?: string }

function buildLeaderboard(
  allTips: Tip[],
  matches: Match[],
  tableTips: TableTip[],
  liveTable: TableRow[],
  allDoubles: DoubleTip[],
  allPartners: PartnerEntry[],
  allHottakes: HottakeEntry[]
): LeaderboardEntry[] {
  const keys = new Set<string>()
  for (const t of allTips) keys.add(t.gast_name || t.username || t.user_id || '?')
  for (const t of tableTips) keys.add(t.gast_name || t.username || t.user_id || '?')

  const entries: LeaderboardEntry[] = []

  for (const key of keys) {
    const userTips = allTips.filter(t => (t.gast_name || t.username || t.user_id) === key)
    // Welche matches sind für diesen User doppelt?
    const userDoubleMatchIds = new Set(
      allDoubles.filter(d => (d.gast_name || d.username) === key).map(d => d.match_id)
    )
    let matchPoints = 0, exact = 0, alone = 0, tendency = 0

    for (const tip of userTips) {
      const m = matches.find(x => x.id === tip.match_id)
      if (!m) continue
      const allForMatch = allTips.filter(t => t.match_id === tip.match_id)
      const { points, isExact, isAlone } = getMatchTipPoints(tip, m, allForMatch)
      const multiplier = userDoubleMatchIds.has(tip.match_id) ? 2 : 1
      matchPoints += points * multiplier
      if (isExact) exact++
      if (isAlone) alone++
      if (points === 1) tendency++
    }

    let tablePoints = 0
    const tableTip = tableTips.find(t => (t.gast_name || t.username || t.user_id) === key)
    if (tableTip && liveTable.length > 0) {
      const result = calcTableTipPoints(tableTip.ranking, liveTable)
      tablePoints = result.total
    }

    // Partnerverein-Punkte: +2 pro Sieg des Partnervereins
    const partnerEntry = allPartners.find(p => (p.gast_name || p.username) === key)
    let partnerPoints = 0
    if (partnerEntry) {
      for (const m of matches) {
        if (m.result_home === null || m.result_away === null) continue
        const clubIsHome = m.home_club_id === partnerEntry.club_id
        const clubIsAway = m.away_club_id === partnerEntry.club_id
        if (!clubIsHome && !clubIsAway) continue
        const won = clubIsHome ? m.result_home > m.result_away : m.result_away > m.result_home
        if (won) partnerPoints += 2
      }
    }

    // Hottake-Punkte: accepted + abgelaufen
    const userHottakes = allHottakes.filter(h =>
      (h.username || h.gast_name) === key && h.status === 'accepted' && new Date(h.valid_until) < new Date()
    )
    const hottakePoints = userHottakes.reduce((s, h) => {
      const pts = h.hardness === 1 ? 4 : h.hardness === 2 ? 8 : h.hardness === 3 ? 12 : 0
      return s + pts
    }, 0)

    entries.push({ name: key, matchPoints, tablePoints, partnerPoints, hottakePoints, total: matchPoints + tablePoints + partnerPoints + hottakePoints, exact, alone, tendency })
  }

  return entries.sort((a, b) => b.total - a.total || b.exact - a.exact || b.alone - a.alone)
}

export default function UCL2627Page() {
  const { user, loading: authLoading } = useAuth()
  const [tab, setTab] = useState<Tab>('tabelle')
  const [clubs, setClubs] = useState<Club[]>([])
  const [matches, setMatches] = useState<Match[]>([])
  const [table, setTable] = useState<TableRow[]>([])
  const [allTips, setAllTips] = useState<Tip[]>([])      // alle User-Tips (für alone-Berechnung)
  const [myTips, setMyTips] = useState<Tip[]>([])
  const [tableTips, setTableTips] = useState<TableTip[]>([])
  const [myTableTip, setMyTableTip] = useState<string[] | null>(null)
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [tableTipDone, setTableTipDone] = useState(false)
  const [tableTipOpen, setTableTipOpen] = useState(false)
  const [gastName, setGastName] = useState('')
  const [gastNameSet, setGastNameSet] = useState(false)
  const [gastCode, setGastCode] = useState<string | null>(null)
  const [codeInput, setCodeInput] = useState('')
  const [codeMode, setCodeMode] = useState(false)
  const [codeError, setCodeError] = useState('')
  const [codeLoading, setCodeLoading] = useState(false)
  const [showMyCode, setShowMyCode] = useState(false)
  const [inputs, setInputs] = useState<Record<string, [string, string]>>({})
  // Doppeltipps: matchday → match_id
  const [myDoubles, setMyDoubles] = useState<Record<number, string>>({})
  const [allDoubles, setAllDoubles] = useState<{ match_id: string; username: string | null; gast_name: string | null }[]>([])
  const [doubleSaving, setDoubleSaving] = useState(false)
  // Partnerverein
  const [partnerClubs, setPartnerClubs] = useState<PartnerClub[]>([])
  const [myPartner, setMyPartner] = useState<string | null>(null)
  const [allPartners, setAllPartners] = useState<{ username: string | null; gast_name: string | null; club_id: string }[]>([])
  const [partnerSaving, setPartnerSaving] = useState(false)
  // Hottakes
  type Hottake = { id: number; content: string; valid_until: string; status: string; hardness: number | null; created_at: string; username?: string; gast_name?: string }
  const [myHottakes, setMyHottakes] = useState<Hottake[]>([])
  const [publicHottakes, setPublicHottakes] = useState<Hottake[]>([])
  const [allHottakesForLB, setAllHottakesForLB] = useState<any[]>([])
  const [hottakeContent, setHottakeContent] = useState('')
  const [hottakeUntil, setHottakeUntil] = useState('')
  const [hottakeSaving, setHottakeSaving] = useState(false)
  const [hottakeMsg, setHottakeMsg] = useState<{ type: 'ok'|'err'; text: string }|null>(null)
  // Starspieler
  type StarTip = { matchday: number; player_name: string; goals: number }
  type StarResult = { matchday: number; player_name: string; actual_goals: number }
  const [myStarTips, setMyStarTips] = useState<StarTip[]>([])
  const [starResults, setStarResults] = useState<StarResult[]>([])
  const [starPlayer, setStarPlayer] = useState('')
  const [starGoals, setStarGoals] = useState(0)
  const [starSaving, setStarSaving] = useState(false)
  const [starMsg, setStarMsg] = useState<{ type: 'ok'|'err'; text: string }|null>(null)
  const [saving, setSaving] = useState<string | null>(null)
  const [adminInputs, setAdminInputs] = useState<Record<string, { h: string; a: string }>>({})
  const [saved, setSaved] = useState<string | null>(null)
  const [activeMatchday, setActiveMatchday] = useState(1)
  const [collapsedZones, setCollapsedZones] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [existingTableTip, setExistingTableTip] = useState<string[] | null>(null)
  const [tableSource, setTableSource] = useState<'override' | 'calculated'>('calculated')
  const [mcHeads, setMcHeads] = useState<Record<string, string | null>>({}) // username → minecraft_username

  const toggleZone = (zone: string) => setCollapsedZones(prev => { const n = new Set(prev); n.has(zone) ? n.delete(zone) : n.add(zone); return n })

  // LocalStorage
  useEffect(() => {
    const n = localStorage.getItem('ucl_gast_name')
    if (n) { setGastName(n); setGastNameSet(true) }
  }, [])



  // Clubs + Matches
  useEffect(() => {
    fetch('/api/ucl2627/data')
      .then(r => r.json())
      .then(d => {
        const newClubs = d.clubs || []
        const newMatches = (d.matches || []).map((m: any) => ({
          ...m,
          result_home: m.result_home ?? null,
          result_away: m.result_away ?? null,
          phase: 'ligaphase' as const,
        }))
        setClubs(newClubs)
        setMatches(newMatches)
        const initAdmin: Record<string, { h: string; a: string }> = {}
        for (const m of newMatches) {
          initAdmin[m.id] = {
            h: m.result_home !== null ? String(m.result_home) : '',
            a: m.result_away !== null ? String(m.result_away) : '',
          }
        }
        setAdminInputs(initAdmin)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  // Tabelle laden — auch leere Tabelle setzen (vor erstem beendeten Spieltag)
  const reloadTable = () => {
    fetch('/api/ucl2627/table')
      .then(r => r.json())
      .then(d => {
        console.log('[UCL table]', d.source, d.table?.length, 'rows')
        if (d.error) { console.error('[UCL table error]', d.error); return }
        setTable(d.table ?? [])
        setTableSource(d.source ?? 'calculated')
      })
      .catch(e => console.error('[UCL table fetch error]', e))
  }

  useEffect(() => { reloadTable() }, [matches])

  // Meine Tabellen-Tipp
  useEffect(() => {
    if (authLoading) return
    if (!gastNameSet && !user) return
    const params = user ? '' : `?gast_name=${encodeURIComponent(gastName)}`
    fetch(`/api/ucl2627/table-tip${params}`)
      .then(r => r.json())
      .then(d => {
        if (d.tip?.ranking && Array.isArray(d.tip.ranking)) {
          setExistingTableTip(d.tip.ranking)
          setMyTableTip(d.tip.ranking)
          setTableTipDone(true)
        } else {
          setExistingTableTip(null)
          setMyTableTip(null)
        }
      })
      .catch(console.error)
  }, [user, gastNameSet, gastName, authLoading])

  // Meine Match-Tips
  useEffect(() => {
    if (!gastNameSet && !user) return
    const params = user ? '' : `?gast_name=${encodeURIComponent(gastName)}`
    fetch(`/api/ucl2627/match-tips${params}`)
      .then(r => r.json())
      .then(d => {
        if (d.tips) {
          const mapped = d.tips.map((t: any) => ({
            id: String(t.id),
            match_id: t.match_id,
            user_id: t.user_id || null,
            username: t.username || null,
            gast_name: t.gast_name || null,
            tip_home: t.tip_home,
            tip_away: t.tip_away,
          }))
          setMyTips(mapped)
        }
      })
      .catch(console.error)
  }, [user, gastNameSet, gastName])

  // Alle Tips laden (für alone-Berechnung + Leaderboard) — öffentliche Route nötig
  // Wir nutzen die bestehenden Tips aus myTips und laden alle via admin oder approximieren
  // Da keine öffentliche "alle tips" Route existiert, bauen wir Leaderboard nur aus myTips + tableTips
  // Für alone-Berechnung laden wir alle match-tips ohne Filter (neue Route nötig — bis dahin: fallback)
  useEffect(() => {
    // Alle Match-Tips (alle User) für alone-Berechnung
    fetch('/api/ucl2627/match-tips/all')
      .then(r => r.json())
      .then(d => { if (d.tips) setAllTips(d.tips.map((t: any) => ({ id: String(t.id), match_id: t.match_id, user_id: t.user_id || null, username: t.username || null, gast_name: t.gast_name || null, tip_home: t.tip_home, tip_away: t.tip_away }))) })
      .catch(() => setAllTips(myTips)) // fallback: nur eigene Tips
  }, [myTips])

  // Alle Tabellen-Tips laden
  useEffect(() => {
    fetch('/api/ucl2627/table-tip/all')
      .then(r => r.json())
      .then(d => { if (d.tips) setTableTips(d.tips) })
      .catch(console.error)
  }, [])


  // Eigene Doppeltipps laden
  useEffect(() => {
    if (!user && !gastNameSet) return
    const params = user ? '' : `?gast_name=${encodeURIComponent(gastName)}`
    fetch(`/api/ucl2627/double-tip${params}`)
      .then(r => r.json())
      .then(d => {
        if (d.doubles) {
          const map: Record<number, string> = {}
          for (const db of d.doubles) map[db.matchday] = db.match_id
          setMyDoubles(map)
        }
      })
      .catch(console.error)
  }, [user, gastNameSet, gastName])

  // Alle Doppeltipps laden (für Punkteberechnung)
  useEffect(() => {
    fetch('/api/ucl2627/double-tip/all')
      .then(r => r.json())
      .then(d => { if (d.doubles) setAllDoubles(d.doubles) })
      .catch(console.error)
  }, [])

  // Alle Hottakes für Leaderboard (nutzt öffentliche Daten aus GET ohne Auth)
  useEffect(() => {
    fetch('/api/ucl2627/hottakes')
      .then(r => r.json())
      .then(d => { if (d.public) setAllHottakesForLB(d.public) })
      .catch(console.error)
  }, [])

  // Hottakes laden
  useEffect(() => {
    if (!user && !gastNameSet) return
    const params = (!user && gastNameSet) ? `?gast_name=${encodeURIComponent(gastName)}` : ''
    fetch(`/api/ucl2627/hottakes${params}`)
      .then(r => r.json())
      .then(d => {
        if (d.mine) setMyHottakes(d.mine)
        if (d.public) setPublicHottakes(d.public)
      })
      .catch(console.error)
  }, [user, gastNameSet, gastName])

  // Starspieler laden
  useEffect(() => {
    if (!user && !gastNameSet) return
    const params = (!user && gastNameSet) ? `?gast_name=${encodeURIComponent(gastName)}` : ''
    fetch(`/api/ucl2627/star-tip${params}`)
      .then(r => r.json())
      .then(d => {
        if (d.tips) setMyStarTips(d.tips)
        if (d.results) setStarResults(d.results)
      })
      .catch(console.error)
  }, [user, gastNameSet, gastName])

  // Partnervereine laden
  useEffect(() => {
    const params = (!user && gastNameSet) ? `?gast_name=${encodeURIComponent(gastName)}` : ''
    fetch(`/api/ucl2627/partner${params}`)
      .then(r => r.json())
      .then(d => {
        if (d.partnerClubs) setPartnerClubs(d.partnerClubs)
        if (d.myPartner !== undefined) setMyPartner(d.myPartner)
      })
      .catch(console.error)
  }, [user, gastNameSet, gastName])

  useEffect(() => {
    fetch('/api/ucl2627/partner/all')
      .then(r => r.json())
      .then(d => { if (d.partners) setAllPartners(d.partners) })
      .catch(console.error)
  }, [])

  // MC-Heads für Leaderboard laden
  useEffect(() => {
    fetch('/api/ucl2627/participants')
      .then(r => r.json())
      .then(d => {
        if (d.participants) {
          const map: Record<string, string | null> = {}
          for (const p of d.participants) map[p.username] = p.minecraft_username
          setMcHeads(map)
        }
      })
      .catch(console.error)
  }, [])

  // Leaderboard
  useEffect(() => {
    const lb = buildLeaderboard(allTips.length ? allTips : myTips, matches, tableTips, table, allDoubles, allPartners, allHottakesForLB)
    // MC-Heads einpflegen
    setLeaderboard(lb.map(e => ({ ...e, minecraft_username: mcHeads[e.name] ?? null })))
  }, [allTips, myTips, matches, tableTips, table, mcHeads, allDoubles, allPartners, allHottakesForLB])

  const clubMap = Object.fromEntries(clubs.map(c => [c.id, c]))
  const myTipFor = (mid: string) => myTips.find(t => t.match_id === mid)

  const handleHottake = async () => {
    if (!hottakeContent.trim() || !hottakeUntil) return
    if (!user && !gastNameSet) return
    setHottakeSaving(true)
    setHottakeMsg(null)
    try {
      const body: any = { content: hottakeContent, valid_until: hottakeUntil ? `${hottakeUntil}T23:59:59Z` : '' }
      if (!user) body.gast_name = gastName
      const res = await fetch('/api/ucl2627/hottakes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const d = await res.json()
      if (!res.ok) { setHottakeMsg({ type: 'err', text: d.error || 'Fehler' }); setHottakeSaving(false); return }
      setHottakeMsg({ type: 'ok', text: 'Hottake eingereicht!' })
      setHottakeContent(''); setHottakeUntil('')
      // Neu laden
      const params = (!user && gastNameSet) ? `?gast_name=${encodeURIComponent(gastName)}` : ''
      const r2 = await fetch(`/api/ucl2627/hottakes${params}`).then(x => x.json())
      if (r2.mine) setMyHottakes(r2.mine)
    } catch { setHottakeMsg({ type: 'err', text: 'Netzwerkfehler' }) }
    setHottakeSaving(false)
  }

  const handleStarTip = async () => {
    if (!starPlayer.trim()) return
    // Nur Do-Mo
    const day = new Date().getUTCDay()
    if (!(day >= 4 || day <= 1)) { setStarMsg({ type: 'err', text: 'Nur Do–Mo möglich' }); return }
    // Bereits getippt → kein Bearbeiten
    if (myStarTips.find(t => t.matchday === activeMatchday)) { setStarMsg({ type: 'err', text: 'Bereits getippt' }); return }
    setStarSaving(true); setStarMsg(null)
    try {
      const body: any = { matchday: activeMatchday, player_name: starPlayer, goals: starGoals }
      if (!user) body.gast_name = gastName
      const res = await fetch('/api/ucl2627/star-tip', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const d = await res.json()
      if (!res.ok) { setStarMsg({ type: 'err', text: d.error || 'Fehler' }); setStarSaving(false); return }
      setStarMsg({ type: 'ok', text: 'Gespeichert!' })
      setMyStarTips(prev => {
        const filtered = prev.filter(t => t.matchday !== activeMatchday)
        return [...filtered, { matchday: activeMatchday, player_name: starPlayer, goals: starGoals }]
      })
    } catch { setStarMsg({ type: 'err', text: 'Netzwerkfehler' }) }
    setStarSaving(false)
    setTimeout(() => setStarMsg(null), 3000)
  }

  const handlePartner = async (clubId: string) => {
    if (!user && !gastNameSet) return
    setPartnerSaving(true)
    try {
      const body: any = { club_id: clubId }
      if (!user) body.gast_name = gastName
      const res = await fetch('/api/ucl2627/partner', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      if (res.ok) setMyPartner(clubId)
    } catch {}
    setPartnerSaving(false)
  }

  const handleDouble = async (matchId: string, matchday: number) => {
    if (!user && !gastNameSet) return
    const isCurrentDouble = myDoubles[matchday] === matchId
    setDoubleSaving(true)
    try {
      if (isCurrentDouble) {
        const body: any = { matchday }
        if (!user) body.gast_name = gastName
        await fetch('/api/ucl2627/double-tip', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
        setMyDoubles(prev => { const n = { ...prev }; delete n[matchday]; return n })
      } else {
        const body: any = { match_id: matchId, matchday }
        if (!user) body.gast_name = gastName
        const res = await fetch('/api/ucl2627/double-tip', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
        if (res.ok) setMyDoubles(prev => ({ ...prev, [matchday]: matchId }))
      }
    } catch {}
    setDoubleSaving(false)
  }

  // Meine Punkte
  const myMatchPoints = myTips.reduce((s, tip) => {
    const m = matches.find(x => x.id === tip.match_id)
    if (!m) return s
    const allForMatch = (allTips.length ? allTips : myTips).filter(t => t.match_id === tip.match_id)
    const pts = getMatchTipPoints(tip, m, allForMatch).points
    const isDouble = Object.values(myDoubles).includes(tip.match_id)
    return s + pts * (isDouble ? 2 : 1)
  }, 0)
  const myTablePoints = myTableTip && table.length > 0 ? calcTableTipPoints(myTableTip, table).total : 0
  const myPartnerPoints = myPartner ? matches.reduce((s, m) => {
    if (m.result_home === null || m.result_away === null) return s
    const isHome = m.home_club_id === myPartner, isAway = m.away_club_id === myPartner
    if (!isHome && !isAway) return s
    return s + ((isHome ? m.result_home > m.result_away : m.result_away > m.result_home) ? 2 : 0)
  }, 0) : 0
  const myHottakePoints = myHottakes.filter(h => h.status === 'accepted' && new Date(h.valid_until) < new Date()).reduce((s, h) => s + (h.hardness === 1 ? 4 : h.hardness === 2 ? 8 : h.hardness === 3 ? 12 : 0), 0)
  const myStarPoints = myStarTips.reduce((s, tip) => {
    const result = starResults.find(r => r.matchday === tip.matchday)
    if (!result) return s
    return s + Math.min(tip.goals, result.actual_goals) * 2
  }, 0)
  const myTotal = myMatchPoints + myTablePoints + myPartnerPoints + myHottakePoints + myStarPoints
  const myRank = leaderboard.findIndex(e => e.name === (user?.username || gastName)) + 1

  // Tipp abgeben
  const handleTip = async (matchId: string) => {
    const [h, a] = inputs[matchId] || ['', '']
    if (h === '' || a === '' || (!user && !gastNameSet)) return
    setSaving(matchId)
    try {
      const body: any = { match_id: matchId, tip_home: parseInt(h), tip_away: parseInt(a) }
      if (!user) body.gast_name = gastName
      const res = await fetch('/api/ucl2627/match-tips', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const data = await res.json()
      if (!res.ok) { setSaving(null); return }
      const fake: Tip = { id: `t_${matchId}`, match_id: matchId, user_id: user?.id || null, username: user?.username || null, gast_name: !user ? gastName : null, tip_home: parseInt(h), tip_away: parseInt(a) }
      setMyTips(prev => [...prev.filter(t => t.match_id !== matchId), fake])
      setSaved(matchId); setTimeout(() => setSaved(null), 2000)
    } catch {}
    setSaving(null)
  }

  const handleDeleteTip = async (matchId: string) => {
    const body: any = { match_id: matchId }
    if (!user) body.gast_name = gastName
    await fetch('/api/ucl2627/match-tips', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    setMyTips(prev => prev.filter(t => t.match_id !== matchId))
    setInputs(prev => ({ ...prev, [matchId]: ['', ''] }))
  }

  const isAdmin = !!(user && (user.clan_role === 'owner' || user.clan_role === 'administrator'))

  const sortedTable = [...table].sort((a, b) => a.position - b.position)

  function rowZone(pos: number) {
    if (pos <= 8)  return { border: G.green,  bg: 'rgba(76,175,80,0.07)' }
    if (pos <= 24) return { border: G.blue,   bg: 'rgba(61,90,254,0.05)' }
    return               { border: G.purple, bg: 'rgba(156,39,176,0.05)' }
  }

  // Meine Tabellentipp-Punkte aufschlüsseln
  const myTableTipResult = myTableTip && table.length > 0 ? calcTableTipPoints(myTableTip, table) : null

  return (
    <div style={{ minHeight: '100vh', position: 'relative' }}>
      {/* Onboarding */}
      {tableTipOpen && clubs.length > 0 && (
        <UCLTableTip
          initialRanking={existingTableTip || undefined}
          clubs={clubs}
          matches={matches}
          onClose={() => setTableTipOpen(false)}
          readOnly={tableTipDone && !(user?.username === 'uwuleonie' || user?.clan_role === 'owner' || user?.clan_role === 'administrator')}
          canSkip={!!(user && (user.username === 'uwuleonie' || user.clan_role === 'owner' || user.clan_role === 'administrator'))}
          onSkip={() => { localStorage.setItem(`ucl_table_tip_done_${user?.id || gastName}`, 'skip'); setTableTipDone(true); setTableTipOpen(false) }}
          onSubmit={async (ranking) => {
            const body: any = { ranking }
            if (!user) body.gast_name = gastName
            try {
              const res = await fetch('/api/ucl2627/table-tip', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), credentials: 'include' })
              const d = await res.json()
              if (!res.ok) { console.error('[table-tip submit]', d.error); alert('Fehler: ' + (d.error || 'Unbekannt')); return }
              setMyTableTip(ranking)
              setTableTipDone(true)
              setTableTipOpen(false)
            } catch (e) { console.error('[table-tip submit]', e); alert('Netzwerkfehler') }
          }}
        />
      )}

      {/* Gastname-Screen */}
      {!user && !gastNameSet && !loading && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9000, background: 'rgba(3,5,20,0.97)', backdropFilter: 'blur(20px)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', padding: 24 }}>
          <img src="/server-icon-hd.png" alt="seekclan" style={{ width: 64, height: 64, borderRadius: 14, marginBottom: 20, boxShadow: '0 0 32px rgba(61,90,254,0.4)' }} />
          <p style={{ margin: '0 0 4px', fontSize: 11, fontWeight: 700, color: '#c9a84c', textTransform: 'uppercase', letterSpacing: '0.15em' }}>UCL 26/27 Tippspiel</p>

          {gastCode ? (
            /* Code anzeigen nach Registrierung */
            <div style={{ width: '100%', maxWidth: 380, textAlign: 'center' }}>
              <h2 style={{ margin: '0 0 8px', fontSize: 22, fontWeight: 900, color: '#fff' }}>Dein Login-Code</h2>
              <p style={{ margin: '0 0 20px', fontSize: 13, color: 'rgba(180,210,255,0.5)' }}>Speichere diesen Code — damit kannst du dich jederzeit wieder als <strong style={{ color: '#fff' }}>{gastName}</strong> einloggen.</p>
              <div style={{ fontSize: 36, fontWeight: 900, letterSpacing: '0.2em', color: '#c9a84c', background: 'rgba(201,168,76,0.1)', border: '1px solid rgba(201,168,76,0.3)', borderRadius: 14, padding: '18px 24px', marginBottom: 20, fontFamily: 'monospace' }}>{gastCode}</div>
              <button onClick={() => { localStorage.setItem('ucl_gast_name', gastName); setGastNameSet(true) }}
                style={{ width: '100%', padding: '13px', borderRadius: 12, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 15, background: 'linear-gradient(135deg, #1a237e, #3d5afe)', color: '#fff' }}>
                Los geht's →
              </button>
            </div>
          ) : codeMode ? (
            /* Code-Login */
            <div style={{ width: '100%', maxWidth: 340, textAlign: 'center' }}>
              <h2 style={{ margin: '0 0 8px', fontSize: 22, fontWeight: 900, color: '#fff' }}>Mit Code einloggen</h2>
              <p style={{ margin: '0 0 20px', fontSize: 13, color: 'rgba(180,210,255,0.5)' }}>Gib deinen 8-stelligen Code ein.</p>
              {codeError && <p style={{ color: '#ef5350', fontSize: 13, marginBottom: 12 }}>{codeError}</p>}
              <input value={codeInput} onChange={e => setCodeInput(e.target.value.replace(/\D/g, '').slice(0, 8))}
                onKeyDown={async e => {
                  if (e.key === 'Enter' && codeInput.length === 8) {
                    setCodeLoading(true); setCodeError('')
                    const res = await fetch(`/api/ucl2627/guest-code?code=${codeInput}`)
                    const d = await res.json()
                    if (!res.ok) { setCodeError(d.error || 'Ungültiger Code'); setCodeLoading(false); return }
                    localStorage.setItem('ucl_gast_name', d.gast_name)
                    setGastName(d.gast_name); setGastNameSet(true); setCodeLoading(false)
                  }
                }}
                placeholder="12345678" autoFocus
                style={{ width: '100%', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 12, padding: '13px 16px', color: '#fff', fontSize: 22, outline: 'none', boxSizing: 'border-box' as const, textAlign: 'center', letterSpacing: '0.3em', fontFamily: 'monospace', marginBottom: 10 }} />
              <button onClick={async () => {
                if (codeInput.length !== 8) return
                setCodeLoading(true); setCodeError('')
                const res = await fetch(`/api/ucl2627/guest-code?code=${codeInput}`)
                const d = await res.json()
                if (!res.ok) { setCodeError(d.error || 'Ungültiger Code'); setCodeLoading(false); return }
                localStorage.setItem('ucl_gast_name', d.gast_name)
                setGastName(d.gast_name); setGastNameSet(true); setCodeLoading(false)
              }} disabled={codeInput.length !== 8 || codeLoading}
                style={{ width: '100%', padding: '13px', borderRadius: 12, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 15, background: 'linear-gradient(135deg, #1a237e, #3d5afe)', color: '#fff', opacity: codeInput.length !== 8 || codeLoading ? 0.5 : 1, marginBottom: 12 }}>
                {codeLoading ? 'Prüfe…' : 'Einloggen →'}
              </button>
              <button onClick={() => { setCodeMode(false); setCodeError('') }}
                style={{ background: 'none', border: 'none', color: 'rgba(180,210,255,0.5)', cursor: 'pointer', fontSize: 13 }}>← Zurück</button>
            </div>
          ) : (
            /* Neuer Gast */
            <div style={{ width: '100%', maxWidth: 340 }}>
              <h2 style={{ margin: '0 0 8px', fontSize: 26, fontWeight: 900, color: '#fff', textAlign: 'center' }}>Wie heißt du?</h2>
              <p style={{ margin: '0 0 20px', fontSize: 14, color: 'rgba(180,210,255,0.5)', textAlign: 'center' }}>
                Wähle einen Gastnamen oder{' '}
                <Link href="/login" style={{ color: '#4dbfff', textDecoration: 'none', fontWeight: 600 }}>logge dich ein</Link>.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <input value={gastName} onChange={e => setGastName(e.target.value)}
                  onKeyDown={async e => {
                    if (e.key === 'Enter' && gastName.trim()) {
                      setCodeLoading(true)
                      const res = await fetch('/api/ucl2627/guest-code', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ gast_name: gastName.trim() }) })
                      const d = await res.json()
                      setGastCode(d.code || null); setCodeLoading(false)
                    }
                  }}
                  placeholder="Dein Gastname…" autoFocus
                  style={{ width: '100%', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 12, padding: '13px 16px', color: '#fff', fontSize: 15, outline: 'none', boxSizing: 'border-box' as const, textAlign: 'center' }} />
                <button onClick={async () => {
                  if (!gastName.trim()) return
                  setCodeLoading(true)
                  const res = await fetch('/api/ucl2627/guest-code', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ gast_name: gastName.trim() }) })
                  const d = await res.json()
                  setGastCode(d.code || null); setCodeLoading(false)
                }} disabled={codeLoading}
                  style={{ width: '100%', padding: '13px', borderRadius: 12, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 15, background: 'linear-gradient(135deg, #1a237e, #3d5afe)', color: '#fff', opacity: codeLoading ? 0.5 : 1 }}>
                  {codeLoading ? 'Laden…' : 'Weiter →'}
                </button>
                <button onClick={() => setCodeMode(true)}
                  style={{ background: 'none', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: '11px', color: 'rgba(180,210,255,0.6)', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                  🔑 Mit Code einloggen
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <div style={{ position: 'fixed', inset: 0, zIndex: -2, backgroundImage: 'url(/ucl-bg.png)', backgroundSize: '150%', backgroundPosition: 'center center', backgroundRepeat: 'no-repeat', filter: 'brightness(0.55) saturate(1.4) blur(8px)' }} />
      <div style={{ position: 'fixed', inset: 0, zIndex: -1, background: 'linear-gradient(160deg, rgba(0,8,40,0.62) 0%, rgba(0,4,25,0.42) 50%, rgba(0,12,50,0.68) 100%)' }} />
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0 }}>
        <div style={{ position: 'absolute', top: '-25%', left: '-15%', width: 700, height: 700, borderRadius: '50%', background: 'radial-gradient(circle, rgba(0,80,200,0.55) 0%, transparent 65%)' }} />
        <div style={{ position: 'absolute', top: '20%', right: '-20%', width: 600, height: 600, borderRadius: '50%', background: 'radial-gradient(circle, rgba(0,153,255,0.35) 0%, transparent 65%)' }} />
        <div style={{ position: 'absolute', bottom: '-15%', left: '25%', width: 500, height: 500, borderRadius: '50%', background: 'radial-gradient(circle, rgba(0,40,160,0.4) 0%, transparent 70%)' }} />
        <div style={{ position: 'absolute', top: '-20%', left: '50%', transform: 'translateX(-50%)', width: '130vw', height: '130vw', pointerEvents: 'none' }}>
          <div style={{ position: 'absolute', inset: '15%', borderRadius: '50%', background: 'radial-gradient(circle, rgba(0,80,255,0.2) 0%, transparent 70%)' }} />
          <img src="/ucl-ball.png" alt="" style={{ width: '100%', height: '100%', objectFit: 'contain', opacity: 0.15, filter: 'brightness(0) invert(1) sepia(1) saturate(3) hue-rotate(195deg) brightness(0.55)', userSelect: 'none' }} />
        </div>
      </div>

      <div style={{ position: 'relative', zIndex: 1 }}>
        {/* Hero */}
        <div style={{ borderBottom: '1px solid rgba(201,168,76,0.15)', background: 'rgba(5,8,26,0.7)', position: 'relative', zIndex: 2 }}>
          <div style={{ maxWidth: 1260, margin: '0 auto', padding: '32px 24px 28px' }}>
            <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: G.muted, marginBottom: 20, textDecoration: 'none' }}>← Zurück</Link>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 20, flexWrap: 'wrap' }}>
              <div style={{ width: 64, height: 64, borderRadius: 18, background: 'linear-gradient(135deg, #1a237e, #3d5afe)', boxShadow: '0 0 32px rgba(61,90,254,0.5)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 4 }}>
                <img src="/ucl-badge.png" alt="UCL" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
              </div>
              <div>
                <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: G.gold, marginBottom: 4 }}>UEFA Champions League</p>
                <h1 style={{ fontSize: 36, fontWeight: 900, color: '#fff', fontStyle: 'italic', letterSpacing: '-0.02em', textShadow: '0 0 40px rgba(61,90,254,0.6)', margin: 0 }}>TIPPSPIEL 26/27</h1>
                {!user && gastNameSet && (
                  <div style={{ position: 'relative' as const }}>
                    <div onClick={() => { setShowMyCode(p => !p); if (!gastCode) fetch('/api/ucl2627/guest-code', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ gast_name: gastName }) }).then(r => r.json()).then(d => setGastCode(d.code)) }}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 6, padding: '3px 10px', borderRadius: 20, background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer' }}>
                      <span style={{ fontSize: 10, color: G.muted, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Gast:</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>{gastName}</span>
                      <span style={{ fontSize: 10, color: G.muted }}>🔑</span>
                    </div>
                    {showMyCode && (
                      <div style={{ position: 'absolute' as const, top: '110%', left: 0, zIndex: 100, background: 'rgba(4,8,28,0.98)', border: '1px solid rgba(201,168,76,0.3)', borderRadius: 14, padding: '16px 20px', minWidth: 240, boxShadow: '0 8px 32px rgba(0,0,0,0.7)' }}>
                        <p style={{ margin: '0 0 6px', fontSize: 11, color: G.muted, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Dein Login-Code</p>
                        <p style={{ margin: '0 0 10px', fontSize: 10, color: G.muted }}>Damit kannst du dich als <strong style={{ color: '#fff' }}>{gastName}</strong> wieder einloggen</p>
                        <div style={{ fontSize: 26, fontWeight: 900, letterSpacing: '0.2em', color: G.gold, textAlign: 'center', fontFamily: 'monospace', background: 'rgba(201,168,76,0.08)', borderRadius: 10, padding: '10px', marginBottom: 8 }}>
                          {gastCode || '…'}
                        </div>
                        <button onClick={() => setShowMyCode(false)} style={{ width: '100%', padding: '6px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'none', color: G.muted, cursor: 'pointer', fontSize: 12 }}>Schließen</button>
                      </div>
                    )}
                  </div>
                )}
              </div>
              {(user || gastNameSet) && (
                <div style={{ marginLeft: 'auto', display: 'flex', gap: 10, alignItems: 'center' }}>
                  <div style={{ ...G.card, textAlign: 'center', padding: '12px 20px' }}>
                    <p style={{ fontSize: 22, fontWeight: 800, color: G.gold, margin: 0 }}>{myTips.length}<span style={{ fontSize: 13, color: G.muted, fontWeight: 400 }}>/{matches.length}</span></p>
                    <p style={{ fontSize: 11, color: G.muted, marginTop: 2 }}>Spiele getippt</p>
                  </div>
                  <div style={{ ...G.card, textAlign: 'center', padding: '12px 20px' }}>
                    <p style={{ fontSize: 22, fontWeight: 800, color: '#fff', margin: 0 }}>{myRank ? `#${myRank}` : '—'}</p>
                    <p style={{ fontSize: 11, color: G.muted, marginTop: 2 }}>Rang</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div style={{ maxWidth: 1260, margin: '0 auto', padding: '0 24px' }}>
          {/* Gastname */}


          {/* Tabs */}
          <div style={{ padding: '24px 0 0', display: 'flex', gap: 4 }}>
            {(['tabelle', 'spiele', 'ko', 'leaderboard', 'special'] as const).map(t => (
              <button key={t} onClick={() => setTab(t)}
                style={{ padding: '10px 20px', borderRadius: 12, fontSize: 13, fontWeight: 600, cursor: 'pointer', border: 'none', transition: 'all 0.2s', background: tab === t ? 'linear-gradient(135deg, rgba(201,168,76,0.25), rgba(61,90,254,0.2))' : 'rgba(255,255,255,0.04)', color: tab === t ? G.gold : G.muted, boxShadow: tab === t ? '0 0 16px rgba(201,168,76,0.15), inset 0 0 0 1px rgba(201,168,76,0.3)' : 'inset 0 0 0 1px rgba(255,255,255,0.06)', backdropFilter: 'blur(8px)' }}>
                {{ tabelle: 'Tabelle', spiele: 'Spiele', ko: 'K.O.-Phase', leaderboard: 'Leaderboard', special: '⭐ Spezial' }[t]}
              </button>
            ))}
          </div>

          <div style={{ padding: '20px 0 80px', position: 'relative' }}>

            {/* TABELLE */}
            {tab === 'tabelle' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 20, alignItems: 'start' }}>
                <div>
                  {/* Mitmachen-Banner */}
                  {!tableTipDone && (user || gastNameSet) && (
                    <div style={{ marginBottom: 16, borderRadius: 14, background: 'linear-gradient(135deg, rgba(76,175,80,0.15), rgba(56,142,60,0.1))', border: '1px solid rgba(76,175,80,0.4)', padding: '18px 22px', display: 'flex', alignItems: 'center', gap: 16, cursor: 'pointer', boxShadow: '0 0 24px rgba(76,175,80,0.1)' }} onClick={() => setTableTipOpen(true)}>
                      <div style={{ fontSize: 32 }}>⚽</div>
                      <div style={{ flex: 1 }}>
                        <p style={{ margin: 0, fontSize: 15, fontWeight: 800, color: '#fff' }}>Am Tippspiel mitmachen!</p>
                        <p style={{ margin: '3px 0 0', fontSize: 13, color: 'rgba(180,255,180,0.7)' }}>Tippe die UCL-Tabelle und gewinne Punkte für jeden richtigen Verein</p>
                      </div>
                      <div style={{ background: 'linear-gradient(135deg, #4caf50, #66bb6a)', color: '#fff', border: 'none', borderRadius: 10, padding: '10px 20px', fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap', flexShrink: 0 }}>
                        Jetzt tippen →
                      </div>
                    </div>
                  )}

                  {/* Tabellenvorhersage Header (nur wenn bereits getippt) */}
                  {tableTipDone && (
                    <div style={{ ...G.cardStrong, padding: '16px 20px', marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
                      <div>
                        <p style={{ fontWeight: 700, color: '#fff', margin: 0, fontSize: 14 }}>Tabellenvorhersage</p>
                        {myTableTipResult && (
                          <p style={{ margin: '2px 0 0', fontSize: 12, color: G.muted }}>
                            Aktuell: <span style={{ color: G.gold, fontWeight: 700 }}>{myTableTipResult.total} Pkt</span>
                            {myTableTipResult.bonuses.allCorrect && <span style={{ color: G.green, marginLeft: 6 }}>+36 Bonus!</span>}
                          </p>
                        )}
                      </div>
                      <button onClick={() => setTableTipOpen(true)}
                        style={{ background: 'linear-gradient(135deg, #c9a84c, #e8c96a)', color: '#05081a', border: 'none', borderRadius: 10, padding: '10px 18px', fontSize: 13, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}>
                        {user && (user.username === 'uwuleonie' || user.clan_role === 'owner' || user.clan_role === 'administrator') ? 'Tipp bearbeiten' : 'Tipp ansehen'}
                      </button>
                    </div>
                  )}

                  <div style={{ ...G.card, overflow: 'hidden' }}>
                    <div style={{ ...G.cardHeader, display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: G.gold }}>Ligaphase – Tabelle</span>
                      <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: 'rgba(76,175,80,0.2)', color: '#4caf50', fontWeight: 600 }}>Live</span>
                      {tableSource === 'override' && <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, background: 'rgba(201,168,76,0.2)', color: G.gold, fontWeight: 600 }}>Admin Override</span>}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '24px 32px 1fr 40px 28px 28px 28px 58px 44px 44px', padding: '9px 18px', background: 'rgba(0,0,0,0.2)', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: G.muted, gap: 2 }}>
                      <span /><span style={{ textAlign: 'center' }}>#</span><span>Verein</span>
                      <span style={{ textAlign: 'center' }}>SP</span><span style={{ textAlign: 'center' }}>S</span><span style={{ textAlign: 'center' }}>U</span><span style={{ textAlign: 'center' }}>N</span>
                      <span style={{ textAlign: 'center' }}>Tore</span><span style={{ textAlign: 'center' }}>Diff</span><span style={{ textAlign: 'center' }}>Pkt</span>
                    </div>
                    {[
                      { key: 'top', label: 'Top 8 – Achtelfinale', range: [1, 8],   color: G.green  },
                      { key: 'mid', label: '9–24 – Playoffs',      range: [9, 24],  color: G.blue   },
                      { key: 'out', label: '25–36 – Ausscheiden',  range: [25, 36], color: G.purple },
                    ].map(zone => {
                      const rows = sortedTable.slice(zone.range[0] - 1, zone.range[1])
                      const isCollapsed = collapsedZones.has(zone.key)
                      return (
                        <div key={zone.key}>
                          <button onClick={() => toggleZone(zone.key)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '9px 18px', background: `linear-gradient(90deg, ${zone.color}18 0%, transparent 60%)`, border: 'none', borderTop: `1px solid ${zone.color}30`, borderLeft: `3px solid ${zone.color}`, cursor: 'pointer', textAlign: 'left' }}>
                            <div style={{ width: 7, height: 7, borderRadius: '50%', background: zone.color, flexShrink: 0 }} />
                            <span style={{ flex: 1, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: zone.color }}>{zone.label}</span>
                            <span style={{ fontSize: 13, color: zone.color, opacity: 0.7, transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>▾</span>
                          </button>
                          {!isCollapsed && rows.map((row, idx) => {
                            const pos = zone.range[0] + idx
                            const { bg } = rowZone(pos)
                            const club = clubMap[row.club_id]
                            const diff = row.goals_for - row.goals_against
                            // Mein Tabellentipp-Indikator
                            const myTipPos = myTableTip ? myTableTip.indexOf(row.club_id) + 1 : 0
                            const myTipCorrect = myTipPos > 0 && myTipPos === pos
                            const myTipInSection = myTipPos > 0 && !myTipCorrect && rowZone(myTipPos).bg === bg
                            const myTipWrong = myTipPos > 0 && !myTipCorrect && !myTipInSection
                            const tipIndicatorColor = myTipCorrect ? '#4caf50' : myTipInSection ? '#ffd54f' : myTipWrong ? '#ef5350' : null
                            const tipIndicatorTitle = myTipCorrect ? `Exakt: du hast ${pos}. getippt` : myTipInSection ? `Richtiger Abschnitt: du hast ${myTipPos}. getippt` : myTipWrong ? `Falscher Abschnitt: du hast ${myTipPos}. getippt` : ''
                            return (
                              <div key={row.club_id} style={{ display: 'grid', gridTemplateColumns: '6px 24px 32px 1fr 40px 28px 28px 28px 58px 44px 44px', padding: '10px 18px 10px 0', alignItems: 'center', gap: 2, background: bg, borderBottom: '1px solid rgba(255,255,255,0.03)', position: 'relative' as const }}>
                                {/* Farbbalken links */}
                                <div title={tipIndicatorTitle} style={{ width: 4, height: '100%', borderRadius: '0 2px 2px 0', background: tipIndicatorColor ?? 'transparent', alignSelf: 'stretch', minHeight: 36, flexShrink: 0, cursor: tipIndicatorColor ? 'help' : 'default' }} />
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                  {myTipCorrect && <span style={{ fontSize: 9, color: '#4caf50' }}>●</span>}
                                </div>
                                <span style={{ textAlign: 'center', fontSize: 13, fontWeight: 700, color: zone.color }}>{pos}</span>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0 }}>
                                  <ClubLogo club={club} size="sm" />
                                  <span style={{ fontSize: 14, fontWeight: 500, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{club?.name || row.club_id}</span>
                                </div>
                                <span style={{ textAlign: 'center', fontSize: 13, color: G.muted }}>{row.played}</span>
                                <span style={{ textAlign: 'center', fontSize: 13, color: G.green }}>{row.won}</span>
                                <span style={{ textAlign: 'center', fontSize: 13, color: G.muted }}>{row.drawn}</span>
                                <span style={{ textAlign: 'center', fontSize: 13, color: '#ef5350' }}>{row.lost}</span>
                                <span style={{ textAlign: 'center', fontSize: 13, color: G.muted }}>{row.goals_for}:{row.goals_against}</span>
                                <span style={{ textAlign: 'center', fontSize: 13, fontWeight: 600, color: diff > 0 ? G.green : diff < 0 ? '#ef5350' : G.muted }}>{diff > 0 ? '+' : ''}{diff}</span>
                                <span style={{ textAlign: 'center', fontSize: 14, fontWeight: 700, color: '#fff' }}>{row.points}</span>
                              </div>
                            )
                          })}
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Rechts */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div style={{ ...G.card, overflow: 'hidden' }}>
                    <div style={{ ...G.cardHeader }}>
                      <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: G.gold }}>Punkteregeln</span>
                    </div>
                    <div style={{ padding: '14px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {[
                        { pts: '1 Pkt.', label: 'Richtiger Sieger / Unentschieden', color: '#ffd54f' },
                        { pts: '2 Pkt.', label: 'Einziger mit richtigem Gewinner', color: '#ff8a65' },
                        { pts: '2 Pkt.', label: 'Richtige Tordifferenz', color: '#ff8a65' },
                        { pts: '3 Pkt.', label: 'Richtiges Ergebnis (exakt)', color: G.green },
                        { pts: '4 Pkt.', label: 'Einziger mit richtiger Tordifferenz', color: '#66bb6a' },
                        { pts: '5 Pkt.', label: 'Einziger mit genauen Ergebnis', color: G.gold },
                      ].map(r => (
                        <div key={r.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)' }}>{r.label}</span>
                          <span style={{ fontSize: 13, fontWeight: 800, color: r.color, flexShrink: 0 }}>{r.pts}</span>
                        </div>
                      ))}
                      <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: 10, marginTop: 2 }}>
                        <p style={{ fontSize: 11, color: G.gold, fontWeight: 700, margin: '0 0 6px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Tabellentipp</p>
                        {[
                          { pts: '1 Pkt.', label: 'Verein im richtigen Abschnitt' },
                          { pts: '2 Pkt.', label: 'Verein an exakter Position' },
                          { pts: '+2', label: '>50% eines Abschnitts richtig' },
                          { pts: '+3', label: 'Ganzer Abschnitt richtige Vereine' },
                          { pts: '+10', label: 'Abschnitt exakt richtig sortiert' },
                          { pts: '+36', label: 'Alle 36 Vereine exakt richtig' },
                        ].map(r => (
                          <div key={r.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 4 }}>
                            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>{r.label}</span>
                            <span style={{ fontSize: 12, fontWeight: 800, color: G.gold, flexShrink: 0 }}>{r.pts}</span>
                          </div>
                        ))}
                        <p style={{ fontSize: 10, color: G.muted, margin: '6px 0 0', fontStyle: 'italic' }}>Zwischenstand — endgültig nach Ligaphase</p>
                      </div>
                    </div>
                  </div>

                  <div style={{ ...G.card, overflow: 'hidden' }}>
                    <div style={{ ...G.cardHeader, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: G.gold }}>Zwischenstand</span>
                      <button onClick={() => setTab('leaderboard')} style={{ fontSize: 11, color: G.muted, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>Alle →</button>
                    </div>
                    {leaderboard.length === 0 ? (
                      <div style={{ padding: '24px 20px', textAlign: 'center', fontSize: 13, color: G.muted }}>Noch keine Tipps.</div>
                    ) : leaderboard.slice(0, 10).map((e, i) => (
                      <div key={e.name} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 20px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                        <div style={{ width: 22, height: 22, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, flexShrink: 0, background: i === 0 ? 'linear-gradient(135deg, #c9a84c, #e8c96a)' : i === 1 ? 'rgba(255,255,255,0.15)' : i === 2 ? 'rgba(205,127,50,0.4)' : 'rgba(255,255,255,0.06)', color: i < 3 ? '#05081a' : G.muted }}>{i + 1}</div>
                        {e.minecraft_username
                          ? <img src={`/api/player-heads/${e.minecraft_username}/24`} style={{ width: 24, height: 24, borderRadius: 3, flexShrink: 0 }} onError={ev => { (ev.target as HTMLImageElement).style.display='none' }} />
                          : <div style={{ width: 24, height: 24, borderRadius: 3, background: 'rgba(255,255,255,0.08)', flexShrink: 0 }} />
                        }
                        <span style={{ flex: 1, fontSize: 12, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.name}</span>
                        <span style={{ fontSize: 10, color: G.muted }}>{e.matchPoints}+{e.tablePoints}+{e.partnerPoints}</span>
                        <span style={{ fontSize: 13, fontWeight: 700, color: G.gold }}>{e.total}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* SPIELE */}
            {tab === 'spiele' && (
              <div>
                <div style={{ display: 'flex', gap: 6, marginBottom: 24, flexWrap: 'wrap' }}>
                  {[1,2,3,4,5,6,7,8].map(day => {
                    const dayMatches = matches.filter(m => m.matchday === day)
                    const tipped = dayMatches.filter(m => myTipFor(m.id)).length
                    const isPast = dayMatches.length > 0 && dayMatches.every(m => new Date(m.kickoff) <= new Date())
                    return (
                      <button key={day} onClick={() => setActiveMatchday(day)} style={{ padding: '10px 16px', borderRadius: 12, fontSize: 13, fontWeight: 600, cursor: 'pointer', border: 'none', transition: 'all 0.2s', background: activeMatchday === day ? 'linear-gradient(135deg, #1a237e, #3d5afe)' : 'rgba(255,255,255,0.06)', color: activeMatchday === day ? '#fff' : G.muted, boxShadow: activeMatchday === day ? '0 0 16px rgba(61,90,254,0.4)' : 'none', position: 'relative' as const }}>
                        <div>Spieltag {day}</div>
                        <div style={{ fontSize: 10, color: activeMatchday === day ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.3)', marginTop: 2 }}>
                          {isPast ? 'Beendet' : `${tipped}/${dayMatches.length} getippt`}
                        </div>
                      </button>
                    )
                  })}
                </div>

                {(() => {
                  const dayMatches = matches.filter(m => m.matchday === activeMatchday)
                  const byDate: Record<string, Match[]> = {}
                  dayMatches.forEach(m => {
                    const d = new Date(m.kickoff).toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: 'long', timeZone: 'UTC' })
                    if (!byDate[d]) byDate[d] = []
                    byDate[d].push(m)
                  })
                  return Object.entries(byDate).map(([date, ms]) => (
                    <div key={date} style={{ marginBottom: 24 }}>
                      <p style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: G.muted, marginBottom: 12, paddingLeft: 4 }}>{date}</p>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                        {ms.map(match => {
                          const home = clubMap[match.home_club_id]
                          const away = clubMap[match.away_club_id]
                          const tip = myTipFor(match.id)
                          const [h, a] = inputs[match.id] || ['', '']
                          const kickoffPassed = new Date(match.kickoff) <= new Date()
                          const hasResult = match.result_home !== null && match.result_away !== null
                          const allForMatch = (allTips.length ? allTips : myTips).filter(t => t.match_id === match.id)
                          const { points: rawPts } = tip && hasResult ? getMatchTipPoints(tip, match, allForMatch) : { points: null as null }
                          const isMyDouble = myDoubles[activeMatchday] === match.id
                          const pts = rawPts !== null ? rawPts * (isMyDouble ? 2 : 1) : null
                          const isOtherDouble = !isMyDouble && myDoubles[activeMatchday] !== undefined
                          const soon = !kickoffPassed && new Date(match.kickoff).getTime() - Date.now() < 3_600_000
                          const uhrzeit = new Date(match.kickoff).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' })

                          return (
                            <div key={match.id} style={{ ...G.card, padding: '16px', borderColor: soon && !tip ? 'rgba(239,83,80,0.35)' : tip ? 'rgba(61,90,254,0.3)' : undefined, display: 'flex', flexDirection: 'column', gap: 12 }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <span style={{ fontSize: 11, color: soon ? '#ef5350' : G.muted, fontWeight: 600 }}>{uhrzeit} Uhr{soon && !tip ? ' !' : ''}</span>
                                {tip && pts === null && (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                    {isMyDouble && <span style={{ fontSize: 11, color: G.gold }}>⚡</span>}
                                    <span style={{ fontSize: 13, fontWeight: 800, padding: '3px 12px', borderRadius: 12, background: 'rgba(61,90,254,0.25)', color: G.blueLight }}>{tip.tip_home} : {tip.tip_away}</span>
                                  </div>
                                )}
                                {pts !== null && (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <span style={{ fontSize: 13, fontWeight: 800, color: 'rgba(255,255,255,0.5)' }}>{tip?.tip_home} : {tip?.tip_away}</span>
                                    <span style={{ fontSize: 12, padding: '3px 10px', borderRadius: 10, fontWeight: 700, background: pts >= 10 ? 'rgba(201,168,76,0.3)' : pts >= 5 ? 'rgba(201,168,76,0.2)' : pts >= 3 ? 'rgba(76,175,80,0.2)' : pts >= 2 ? 'rgba(255,213,79,0.2)' : pts >= 1 ? 'rgba(33,150,243,0.2)' : 'rgba(239,83,80,0.2)', color: pts >= 5 ? G.gold : pts >= 3 ? G.green : pts >= 2 ? '#ffd54f' : pts >= 1 ? '#42a5f5' : '#ef5350' }}>+{pts}P{isMyDouble ? '⚡' : pts === 5 ? '🎯' : ''}</span>
                                  </div>
                                )}
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                  <ClubLogo club={home} size="md" />
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: 10, color: G.green, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Heim</div>
                                    <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{home?.name}</div>
                                  </div>
                                  {hasResult && <span style={{ fontSize: 18, fontWeight: 900, color: G.gold, minWidth: 20, textAlign: 'right' }}>{match.result_home}</span>}
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                  <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.06)' }} />
                                  <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', fontWeight: 700 }}>VS</span>
                                  <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.06)' }} />
                                  {hasResult && <span style={{ fontSize: 18, fontWeight: 900, color: G.gold, minWidth: 20, textAlign: 'right' }}>:</span>}
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                  <ClubLogo club={away} size="md" />
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: 10, color: G.blueLight, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Ausw.</div>
                                    <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{away?.name}</div>
                                  </div>
                                  {hasResult && <span style={{ fontSize: 18, fontWeight: 900, color: G.gold, minWidth: 20, textAlign: 'right' }}>{match.result_away}</span>}
                                </div>
                              </div>
                              {!kickoffPassed && (user || gastNameSet) && (
                                <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center' }}>
                                    <input type="number" min="0" value={h} onChange={e => setInputs(p => ({ ...p, [match.id]: [e.target.value, a] }))} style={{ width: 44, padding: '7px 4px', textAlign: 'center', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, color: '#fff', fontSize: 15, fontWeight: 700, outline: 'none' }} placeholder="0" />
                                    <span style={{ color: G.muted, fontSize: 16, fontWeight: 700 }}>:</span>
                                    <input type="number" min="0" value={a} onChange={e => setInputs(p => ({ ...p, [match.id]: [h, e.target.value] }))} style={{ width: 44, padding: '7px 4px', textAlign: 'center', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, color: '#fff', fontSize: 15, fontWeight: 700, outline: 'none' }} placeholder="0" />
                                    <button onClick={() => handleTip(match.id)} disabled={saving === match.id} style={{ padding: '7px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700, color: '#fff', background: saved === match.id ? G.green : 'linear-gradient(135deg, #1a237e, #3d5afe)', opacity: saving === match.id ? 0.5 : 1, flexShrink: 0 }}>
                                      {saved === match.id ? '✓' : tip ? '↺' : 'Tippen'}
                                    </button>
                                    {tip && <button onClick={() => handleDeleteTip(match.id)} style={{ fontSize: 13, color: '#ef5350', background: 'none', border: 'none', cursor: 'pointer', padding: '0 4px' }}>×</button>}
                                  </div>
                                  {/* Doppelgewichtung */}
                                  <button
                                    onClick={() => handleDouble(match.id, activeMatchday)}
                                    disabled={doubleSaving || (isOtherDouble && !isMyDouble)}
                                    title={isOtherDouble && !isMyDouble ? 'Doppel bereits für anderen Tipp vergeben' : isMyDouble ? 'Doppelgewichtung entfernen' : 'Dieses Spiel doppelt gewichten (×2 Punkte)'}
                                    style={{ width: '100%', padding: '5px', borderRadius: 7, border: `1px solid ${isMyDouble ? 'rgba(201,168,76,0.6)' : 'rgba(255,255,255,0.1)'}`, background: isMyDouble ? 'rgba(201,168,76,0.15)' : 'transparent', cursor: isOtherDouble && !isMyDouble ? 'not-allowed' : 'pointer', fontSize: 11, fontWeight: 700, color: isMyDouble ? G.gold : isOtherDouble ? 'rgba(255,255,255,0.2)' : G.muted, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, opacity: doubleSaving ? 0.5 : 1 }}
                                  >
                                    <span>⚡</span>
                                    <span>{isMyDouble ? 'Doppelt aktiv — klicken zum Entfernen' : isOtherDouble ? 'Doppel vergeben' : 'Doppelt gewichten'}</span>
                                  </button>
                                </div>
                              )}
                              {kickoffPassed && !hasResult && !tip && <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 8, textAlign: 'center', fontSize: 11, color: G.muted }}>Kein Tipp abgegeben</div>}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ))
                })()}
              </div>
            )}

            {/* KO */}
            {tab === 'ko' && (
              <div style={{ textAlign: 'center', padding: '80px 0' }}>
                <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(201,168,76,0.1)', border: '1px solid rgba(201,168,76,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                  <svg width="32" height="32" viewBox="0 0 24 24" fill={G.gold}><path d="M19 5h-2V3H7v2H5c-1.1 0-2 .9-2 2v1c0 2.55 1.92 4.63 4.39 4.94.63 1.5 1.98 2.63 3.61 2.96V17H9v2h6v-2h-2v-2.1c1.63-.33 2.98-1.46 3.61-2.96C19.08 11.63 21 9.55 21 7V7c0-1.1-.9-2-2-2z"/></svg>
                </div>
                <p style={{ fontSize: 20, fontWeight: 700, color: '#fff', margin: '0 0 8px' }}>K.O.-Phase</p>
                <p style={{ fontSize: 14, color: G.muted, margin: '0 0 20px' }}>Playoffs · Achtelfinale · Viertelfinale · Halbfinale · Finale</p>
                <div style={{ display: 'inline-block', padding: '8px 16px', borderRadius: 10, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', fontSize: 12, color: G.muted }}>Wird nach Abschluss der Ligaphase freigeschaltet</div>
              </div>
            )}

            {/* LEADERBOARD */}
            {tab === 'special' && (
              <div style={{ maxWidth: 800 }}>
                {/* Partnerverein */}
                {partnerClubs.length > 0 && (user || gastNameSet) && (
                  <div style={{ ...G.card, overflow: 'hidden', marginBottom: 20 }}>
                    <div style={{ ...G.cardHeader }}>
                      <p style={{ margin: 0, fontSize: 13, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: G.gold }}>🤝 Partnerverein</p>
                      <p style={{ margin: '2px 0 0', fontSize: 11, color: G.muted }}>+2 Pkt pro Sieg — Wahl ist endgültig</p>
                    </div>
                    <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {myPartner && (() => {
                        const club = partnerClubs.find(c => c.id === myPartner) || clubs.find(c => c.id === myPartner)
                        return club ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderRadius: 12, background: 'rgba(201,168,76,0.1)', border: '1px solid rgba(201,168,76,0.3)' }}>
                            <ClubLogo club={club as any} size="lg" />
                            <div style={{ flex: 1 }}>
                              <p style={{ margin: 0, fontSize: 15, fontWeight: 800, color: '#fff' }}>{club.name}</p>
                              <p style={{ margin: '2px 0 0', fontSize: 12, color: G.gold }}>{myPartnerPoints} Pkt erzielt · Partner gewählt ✓</p>
                            </div>
                          </div>
                        ) : null
                      })()}
                      {!myPartner && (
                        <>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                            {partnerClubs.map(club => (
                              <button key={club.id} onClick={() => handlePartner(club.id)} disabled={partnerSaving}
                                style={{ padding: '10px 6px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.03)', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                                <ClubLogo club={club as any} size="lg" />
                                <span style={{ fontSize: 10, fontWeight: 600, color: G.muted, textAlign: 'center' }}>{club.short}</span>
                              </button>
                            ))}
                          </div>
                          <p style={{ fontSize: 11, color: G.muted, textAlign: 'center', margin: 0 }}>Klicke einen Verein um ihn als Partner zu wählen</p>
                        </>
                      )}
                    </div>
                  </div>
                )}

                {/* Starspieler */}
                {(user || gastNameSet) && (
                  <div style={{ ...G.card, padding: '20px', marginBottom: 20 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                      <span style={{ fontSize: 22 }}>⭐</span>
                      <div>
                        <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#fff' }}>Starspieler — ST{activeMatchday}</p>
                        <p style={{ margin: '2px 0 0', fontSize: 11, color: G.muted }}>Tippe Spieler + Tore — 2 Pkt pro richtigem Tor</p>
                      </div>
                    </div>
                    {(() => {
                      const myTip = myStarTips.find(t => t.matchday === activeMatchday)
                      const result = starResults.find(r => r.matchday === activeMatchday)
                      const pts = myTip && result ? Math.min(myTip.goals, result.actual_goals) * 2 : null
                      return (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                          {myTip && (
                            <div style={{ padding: '10px 14px', borderRadius: 10, background: 'rgba(201,168,76,0.08)', border: '1px solid rgba(201,168,76,0.25)', display: 'flex', alignItems: 'center', gap: 10 }}>
                              <span style={{ fontSize: 16 }}>⭐</span>
                              <div style={{ flex: 1 }}>
                                <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#fff' }}>{myTip.player_name}</p>
                                <p style={{ margin: '2px 0 0', fontSize: 11, color: G.muted }}>Getippt: {myTip.goals} Tor{myTip.goals !== 1 ? 'e' : ''}</p>
                              </div>
                              {result && <div style={{ textAlign: 'right' }}>
                                <p style={{ margin: 0, fontSize: 11, color: G.muted }}>Tatsächlich: {result.actual_goals}</p>
                                <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: pts && pts > 0 ? G.green : G.muted }}>+{pts ?? 0} Pkt</p>
                              </div>}
                            </div>
                          )}
                          {!myTip ? (() => {
                            const day = new Date().getUTCDay()
                            const inWindow = day >= 4 || day <= 1
                            return (
                              <>
                                {!inWindow && <p style={{ margin: 0, fontSize: 12, color: G.muted, fontStyle: 'italic' }}>Eingabe nur Do–Mo möglich</p>}
                                {inWindow && (
                                  <div style={{ display: 'flex', gap: 8 }}>
                                    <input value={starPlayer} onChange={e => setStarPlayer(e.target.value)} placeholder="Spielername…"
                                      style={{ flex: 1, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, padding: '9px 12px', color: '#fff', fontSize: 13, outline: 'none' }} />
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, padding: '4px 10px' }}>
                                      <button onClick={() => setStarGoals(g => Math.max(0, g - 1))} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}>−</button>
                                      <span style={{ fontSize: 15, fontWeight: 700, color: '#fff', minWidth: 20, textAlign: 'center' }}>{starGoals}</span>
                                      <button onClick={() => setStarGoals(g => g + 1)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}>+</button>
                                    </div>
                                    <button onClick={handleStarTip} disabled={starSaving || !starPlayer.trim()}
                                      style={{ padding: '9px 18px', borderRadius: 10, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 13, background: `linear-gradient(135deg, #c9a84c, #e8c96a)`, color: '#05081a', opacity: starSaving || !starPlayer.trim() ? 0.5 : 1 }}>
                                      {starSaving ? '…' : '✓'}
                                    </button>
                                  </div>
                                )}
                                {starMsg && <p style={{ margin: 0, fontSize: 12, color: starMsg.type === 'ok' ? G.green : '#ef5350', fontWeight: 600 }}>{starMsg.text}</p>}
                              </>
                            )
                          })() : <p style={{ margin: 0, fontSize: 11, color: G.muted, fontStyle: 'italic' }}>Tipp abgegeben — kein Bearbeiten möglich</p>}
                        </div>
                      )
                    })()}
                  </div>
                )}

                {/* Einreichen */}
                {(user || gastNameSet) && myHottakes.length < 3 && (
                  <div style={{ ...G.card, padding: '20px', marginBottom: 20 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                      <span style={{ fontSize: 20 }}>🔥</span>
                      <div>
                        <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#fff' }}>Hottake einreichen</p>
                        <p style={{ margin: 0, fontSize: 11, color: G.muted }}>{3 - myHottakes.length} von 3 verbleibend · nur Do–Mo möglich</p>
                      </div>
                    </div>
                    <textarea
                      value={hottakeContent}
                      onChange={e => setHottakeContent(e.target.value)}
                      placeholder="Schreibe hier deinen Hottake..."
                      maxLength={280}
                      style={{ width: '100%', minHeight: 80, padding: '10px 12px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, color: '#fff', fontSize: 14, outline: 'none', resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit' }}
                    />
                    <div style={{ marginTop: 10 }}>
                      <label style={{ fontSize: 11, color: G.muted, display: 'block', marginBottom: 4 }}>Gültig bis</label>
                      <UCLCalendarPicker
                        matches={matches}
                        clubs={clubs}
                        value={hottakeUntil || null}
                        onChange={date => setHottakeUntil(date)}
                      />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
                      {hottakeMsg && <span style={{ fontSize: 12, color: hottakeMsg.type === 'ok' ? G.green : '#ef5350', fontWeight: 600 }}>{hottakeMsg.text}</span>}
                      <button onClick={handleHottake} disabled={hottakeSaving || !hottakeContent.trim() || !hottakeUntil}
                        style={{ padding: '8px 20px', borderRadius: 9, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 13, background: `linear-gradient(135deg, #ef5350, #ff7043)`, color: '#fff', opacity: hottakeSaving || !hottakeContent.trim() || !hottakeUntil ? 0.5 : 1 }}>
                        {hottakeSaving ? '…' : 'Einreichen 🔥'}
                      </button>
                    </div>
                  </div>
                )}

                {/* Meine Hottakes */}
                {myHottakes.length > 0 && (
                  <div style={{ marginBottom: 24 }}>
                    <p style={{ fontSize: 11, fontWeight: 700, color: G.muted, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>Meine Hottakes</p>
                    {myHottakes.map(h => {
                      const expired = new Date(h.valid_until) < new Date()
                      const hardnessColors = ['', '#ffd54f', '#ff8a65', '#ef5350']
                      const hardnessLabels = ['', 'Lauwarm 🌡', 'Heiß 🔥', 'Höllisch ☠️']
                      const hardnessPts = ['', '4 Pkt', '8 Pkt', '12 Pkt']
                      return (
                        <div key={h.id} style={{ ...G.card, padding: '16px 20px', marginBottom: 10, borderColor: h.status === 'accepted' ? 'rgba(76,175,80,0.3)' : h.status === 'rejected' ? 'rgba(239,83,80,0.3)' : undefined }}>
                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                            <div style={{ flex: 1 }}>
                              <p style={{ margin: '0 0 6px', fontSize: 14, color: '#fff', lineHeight: 1.5 }}>{h.content}</p>
                              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                                <span style={{ fontSize: 11, color: G.muted }}>
                                  Gültig bis {new Date(h.valid_until).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                  {expired ? ' — abgelaufen' : ''}
                                </span>
                                {h.status === 'pending' && <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, background: 'rgba(255,213,79,0.2)', color: '#ffd54f', fontWeight: 600 }}>Ausstehend</span>}
                                {h.status === 'accepted' && <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, background: 'rgba(76,175,80,0.2)', color: G.green, fontWeight: 600 }}>Angenommen ✓</span>}
                                {h.status === 'rejected' && <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, background: 'rgba(239,83,80,0.2)', color: '#ef5350', fontWeight: 600 }}>Abgelehnt</span>}
                                {h.hardness && (
                                  <span style={{ fontSize: 11, fontWeight: 700, color: hardnessColors[h.hardness] }}>
                                    {hardnessLabels[h.hardness]} — {hardnessPts[h.hardness]}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* Öffentliche Hottakes */}
                <p style={{ fontSize: 11, fontWeight: 700, color: G.muted, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>Abgelaufene Takes</p>
                {publicHottakes.length === 0 ? (
                  <div style={{ ...G.card, padding: '40px 20px', textAlign: 'center', color: G.muted, fontSize: 13 }}>Noch keine abgelaufenen Hottakes.</div>
                ) : publicHottakes.map(h => {
                  const hardnessColors = ['', '#ffd54f', '#ff8a65', '#ef5350']
                  const hardnessLabels = ['', 'Lauwarm 🌡', 'Heiß 🔥', 'Höllisch ☠️']
                  const hardnessPts = ['', '4 Pkt', '8 Pkt', '12 Pkt']
                  const author = h.username || h.gast_name || '?'
                  return (
                    <div key={h.id} style={{ ...G.card, padding: '16px 20px', marginBottom: 10 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: G.blueLight }}>{author}</span>
                        {h.hardness && <span style={{ fontSize: 11, fontWeight: 700, color: hardnessColors[h.hardness] }}>{hardnessLabels[h.hardness]} · {hardnessPts[h.hardness]}</span>}
                        <span style={{ marginLeft: 'auto', fontSize: 10, color: G.muted }}>
                          {new Date(h.valid_until).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })}
                        </span>
                      </div>
                      <p style={{ margin: 0, fontSize: 14, color: '#fff', lineHeight: 1.5 }}>{h.content}</p>
                    </div>
                  )
                })}
              </div>
            )}

            {tab === 'leaderboard' && (
              <div style={{ maxWidth: 700 }}>
                <div style={{ ...G.card, overflow: 'hidden' }}>
                  <div style={{ ...G.cardHeader }}>
                    <p style={{ fontWeight: 700, color: G.gold, margin: 0 }}>Gesamtleaderboard</p>
                    <p style={{ fontSize: 11, color: G.muted, margin: '2px 0 0' }}>Spieltipps + Tabellentipp (Zwischenstand)</p>
                  </div>
                  {/* Header */}
                  <div style={{ display: 'grid', gridTemplateColumns: '40px 32px 1fr 70px 70px 80px', padding: '8px 20px', background: 'rgba(0,0,0,0.2)', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: G.muted, gap: 8 }}>
                    <span>#</span><span></span><span>Name</span><span style={{ textAlign: 'center' }}>Spiele</span><span style={{ textAlign: 'center' }}>Tabelle</span><span style={{ textAlign: 'right' }}>Gesamt</span>
                  </div>
                  {leaderboard.length === 0 ? (
                    <div style={{ padding: '60px 20px', textAlign: 'center', color: G.muted, fontSize: 14 }}>Noch keine Tipps abgegeben.</div>
                  ) : leaderboard.map((e, i) => (
                    <div key={e.name} style={{ display: 'grid', gridTemplateColumns: '40px 32px 1fr 70px 70px 80px', alignItems: 'center', gap: 8, padding: '12px 20px', borderBottom: '1px solid rgba(255,255,255,0.04)', background: i === 0 ? 'rgba(201,168,76,0.05)' : undefined }}>
                      <div style={{ width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, background: i === 0 ? 'linear-gradient(135deg, #c9a84c, #e8c96a)' : i === 1 ? 'rgba(255,255,255,0.15)' : i === 2 ? 'rgba(205,127,50,0.35)' : 'rgba(255,255,255,0.06)', color: i < 3 ? '#05081a' : G.muted }}>{i + 1}</div>
                      {e.minecraft_username
                        ? <img src={`/api/player-heads/${e.minecraft_username}/32`} style={{ width: 32, height: 32, borderRadius: 4, flexShrink: 0 }} onError={ev => { (ev.target as HTMLImageElement).style.display='none' }} />
                        : <div style={{ width: 32, height: 32, borderRadius: 4, background: 'rgba(255,255,255,0.08)', flexShrink: 0 }} />
                      }
                      <div>
                        <span style={{ fontWeight: 500, color: '#fff', fontSize: 14 }}>{e.name}</span>
                        <div style={{ fontSize: 10, color: G.muted, marginTop: 1 }}>
                          {e.exact > 0 && <span style={{ color: G.green }}>{e.exact}× exakt </span>}
                          {e.alone > 0 && <span style={{ color: G.gold }}>{e.alone}× allein </span>}
                          {e.tendency > 0 && <span>{e.tendency}× tendenz</span>}
                        </div>
                      </div>
                      <span style={{ textAlign: 'center', fontSize: 13, color: G.muted }}>{e.matchPoints}</span>
                      <span style={{ textAlign: 'center', fontSize: 13, color: G.muted }}>{e.tablePoints}</span>
                      <span style={{ textAlign: 'right', fontSize: 18, fontWeight: 800, color: G.gold }}>{e.total}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ADMIN PANEL */}
      <UCLMusicPlayer />

      {isAdmin && (
        <UCLAdminPanel
          matches={matches}
          clubs={clubs}
          allTips={allTips}
          myTips={myTips}
          table={table}
          setMatches={setMatches}
          setTable={setTable}
          reloadTable={reloadTable}
        />
      )}
    </div>
  )
}