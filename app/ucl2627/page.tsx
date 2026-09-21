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
    return { points: isAlone ? 3 : 1, isExact: false, isAlone }
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
type TableTip = { user_id: string | null; username: string | null; gast_name: string | null; ranking: string[]; ranking_uwcl?: string[] | null }
type MatchTipDetail = { match_id: string; matchday: number; home: string; away: string; kickoff: string; tip_home: number; tip_away: number; result_home: number | null; result_away: number | null; points: number; multiplier: number; isExact: boolean; isAlone: boolean }
type StarTipDetail = { matchday: number; player_name: string; actual_goals: number | null; points: number }
type LeaderboardEntry = { name: string; minecraft_username?: string | null; matchPoints: number; tablePoints: number; partnerPoints: number; hottakePoints: number; starPoints: number; total: number; exact: number; alone: number; tendency: number; matchDetails: MatchTipDetail[]; starDetails: StarTipDetail[] }
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
type AllStarTip = { matchday: number; player_name: string; username: string | null; gast_name: string | null }
type AllStarResult = { matchday: number; player_name: string; actual_goals: number }

// Tabellentipp-Punkte für UWCL (18 Vereine, 3 Sektionen: Top4, 5-14, 15-18)
function calcTableTipPointsUwcl(ranking: string[], liveTable: TableRow[]): {
  total: number
  perClub: Record<string, { inSection: boolean; exactPos: boolean; sectionPoints: number; posPoints: number }>
  bonuses: { section1: number; section2: number; section3: number; allCorrect: boolean }
} {
  const liveClubIds = [...liveTable].sort((a, b) => a.position - b.position).map(r => r.club_id)
  const getSection = (pos: number): 1 | 2 | 3 => pos <= 4 ? 1 : pos <= 14 ? 2 : 3
  const perClub: Record<string, { inSection: boolean; exactPos: boolean; sectionPoints: number; posPoints: number }> = {}
  for (let i = 0; i < ranking.length; i++) {
    const clubId = ranking[i], tipPos = i + 1
    const livePos = liveClubIds.indexOf(clubId) + 1
    const inSection = livePos > 0 && getSection(tipPos) === getSection(livePos)
    const exactPos = tipPos === livePos
    perClub[clubId] = { inSection, exactPos, sectionPoints: inSection ? 1 : 0, posPoints: exactPos ? 2 : 0 }
  }
  let bonusSection1 = 0, bonusSection2 = 0, bonusSection3 = 0
  for (const { key, range: [from, to] } of [{ key: 1, range: [1, 4] }, { key: 2, range: [5, 14] }, { key: 3, range: [15, 18] }] as { key: 1|2|3; range: [number,number] }[]) {
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
  return { total: clubPoints + bonusSection1 + bonusSection2 + bonusSection3 + (allCorrect ? 18 : 0), perClub, bonuses: { section1: bonusSection1, section2: bonusSection2, section3: bonusSection3, allCorrect } }
}

function buildLeaderboard(
  allTips: Tip[],
  matches: Match[],
  tableTips: TableTip[],
  liveTable: TableRow[],
  allDoubles: DoubleTip[],
  allPartners: PartnerEntry[],
  allHottakes: HottakeEntry[],
  allStarTips: AllStarTip[],
  allStarResults: AllStarResult[],
  uwclTable: TableRow[] = [],
  myUwclTableTip: string[] | null = null
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
    const matchDetails: MatchTipDetail[] = []

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
      matchDetails.push({
        match_id: m.id,
        matchday: m.matchday,
        home: m.home_club_id,
        away: m.away_club_id,
        kickoff: m.kickoff,
        tip_home: tip.tip_home,
        tip_away: tip.tip_away,
        result_home: m.result_home,
        result_away: m.result_away,
        points,
        multiplier,
        isExact,
        isAlone,
      })
    }
    matchDetails.sort((a, b) => a.matchday - b.matchday || a.kickoff.localeCompare(b.kickoff))

    let tablePoints = 0
    const tableTip = tableTips.find(t => (t.gast_name || t.username || t.user_id) === key)
    if (tableTip && liveTable.length > 0) {
      const result = calcTableTipPoints(tableTip.ranking, liveTable)
      tablePoints = result.total
    }
    // UWCL-Tabellenpunkte addieren
    if (tableTip?.ranking_uwcl && Array.isArray(tableTip.ranking_uwcl) && uwclTable.length > 0) {
      const uwclResult = calcTableTipPointsUwcl(tableTip.ranking_uwcl as string[], uwclTable)
      tablePoints += uwclResult.total
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

    // Hottake-Punkte: accepted + fulfilled === true
    const userHottakes = allHottakes.filter(h =>
      (h.username || h.gast_name) === key && h.status === 'accepted' && (h as any).fulfilled === true
    )
    const hottakePoints = userHottakes.reduce((s, h) => {
      const pts = h.hardness === 1 ? 4 : h.hardness === 2 ? 8 : h.hardness === 3 ? 12 : 0
      return s + pts
    }, 0)

    // Starspieler-Punkte
    const userStarTips = allStarTips.filter(st => (st.gast_name || st.username) === key)
    let starPoints = 0
    const starDetails: StarTipDetail[] = []
    for (const st of userStarTips) {
      // Alle eingetragenen Ergebnisse für diesen Spieltag für diesen Spieler
      const result = allStarResults.find(r =>
        r.matchday === st.matchday &&
        r.player_name.trim().toLowerCase() === st.player_name.trim().toLowerCase()
      )
      // 2 Punkte pro Tor des getippten Spielers
      const pts = result ? result.actual_goals * 2 : 0
      starPoints += pts
      starDetails.push({
        matchday: st.matchday,
        player_name: st.player_name,
        actual_goals: result?.actual_goals ?? null,
        points: pts,
      })
    }
    starDetails.sort((a, b) => a.matchday - b.matchday)

    entries.push({ name: key, matchPoints, tablePoints, partnerPoints, hottakePoints, starPoints, total: matchPoints + tablePoints + partnerPoints + hottakePoints + starPoints, exact, alone, tendency, matchDetails, starDetails })
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
  const [myUwclDoubles, setMyUwclDoubles] = useState<Record<number, string>>({})
  const [allDoubles, setAllDoubles] = useState<{ match_id: string; username: string | null; gast_name: string | null }[]>([])
  const [doubleSaving, setDoubleSaving] = useState(false)
  // Partnerverein
  const [partnerClubs, setPartnerClubs] = useState<PartnerClub[]>([])
  const [myPartner, setMyPartner] = useState<string | null>(null)
  const [allPartners, setAllPartners] = useState<{ username: string | null; gast_name: string | null; club_id: string }[]>([])
  const [partnerSaving, setPartnerSaving] = useState(false)
  // Hottakes
  type Hottake = { id: number; content: string; valid_until: string; status: string; hardness: number | null; fulfilled: boolean | null; created_at: string; username?: string; gast_name?: string }
  const [myHottakes, setMyHottakes] = useState<Hottake[]>([])
  const [weekHottakeCount, setWeekCount] = useState(0)
  const [publicHottakes, setPublicHottakes] = useState<Hottake[]>([])
  const [allHottakesForLB, setAllHottakesForLB] = useState<any[]>([])
  const [hottakeContent, setHottakeContent] = useState('')
  const [hottakeUntil, setHottakeUntil] = useState('')
  const [hottakeSaving, setHottakeSaving] = useState(false)
  const [hottakeMsg, setHottakeMsg] = useState<{ type: 'ok'|'err'; text: string }|null>(null)
  const [hottakeMatchday, setHottakeMatchday] = useState<number>(1)
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
  // Alle Star-Tipps + Ergebnisse für Leaderboard-Detail
  const [allStarTips, setAllStarTips] = useState<AllStarTip[]>([])
  const [allStarResults, setAllStarResults] = useState<AllStarResult[]>([])
  // Leaderboard-Detailmodal
  const [detailEntry, setDetailEntry] = useState<LeaderboardEntry | null>(null)
  // H2H-Modal
  type H2HMatch = { date: string; competition: string; homeTeam: string; awayTeam: string; homeGoals: number | null; awayGoals: number | null }
  const [h2hMatch, setH2hMatch] = useState<{ home: string; away: string; homeClub: Club | undefined; awayClub: Club | undefined } | null>(null)
  const [h2hData, setH2hData] = useState<H2HMatch[]>([])
  const [h2hLoading, setH2hLoading] = useState(false)
  const [h2hError, setH2hError] = useState<string | null>(null)

  // UWCL
  const [uwclClubs, setUwclClubs] = useState<Club[]>([])
  const [uwclMatches, setUwclMatches] = useState<Match[]>([])
  const [uwclTable, setUwclTable] = useState<TableRow[]>([])
  const [uwclMyTips, setUwclMyTips] = useState<Tip[]>([])
  const [uwclAllTips, setUwclAllTips] = useState<Tip[]>([])
  const [activeComp, setActiveComp] = useState<'ucl' | 'uwcl'>(() => {
    if (typeof window === 'undefined') return 'ucl'
    const comp = localStorage.getItem('ucl_default_comp')
    return comp === 'uwcl' ? 'uwcl' : 'ucl'
  })
  const [uwclActiveMatchday, setUwclActiveMatchday] = useState(1)
  const [standardSaved, setStandardSaved] = useState(false)
  const [liveTableComp, setLiveTableComp] = useState<'ucl' | 'uwcl'>('ucl')
  // Tabellen-Tipp Step (ucl → uwcl → done)
  const [tableTipStep, setTableTipStep] = useState<'ucl' | 'uwcl' | null>(null)
  const [uwclTableTipDone, setUwclTableTipDone] = useState(false)
  const [myUwclTableTip, setMyUwclTableTip] = useState<string[] | null>(null)
  // Tabelle ansehen Modal
  const [viewTableComp, setViewTableComp] = useState<'ucl' | 'uwcl' | null>(null)

  const toggleZone = (zone: string) => setCollapsedZones(prev => { const n = new Set(prev); n.has(zone) ? n.delete(zone) : n.add(zone); return n })

  // LocalStorage
  useEffect(() => {
    const n = localStorage.getItem('ucl_gast_name')
    if (n) { setGastName(n); setGastNameSet(true) }
  }, [])



  // Clubs + Matches (UCL + UWCL parallel)
  useEffect(() => {
    Promise.all([
      fetch('/api/ucl2627/data?comp=2627').then(r => r.json()),
      fetch('/api/ucl2627/data?comp=uwcl2627').then(r => r.json()),
    ]).then(([ucl, uwcl]) => {
      const newClubs = ucl.clubs || []
      const newMatches = (ucl.matches || []).map((m: any) => ({
        ...m, result_home: m.result_home ?? null, result_away: m.result_away ?? null, phase: 'ligaphase' as const,
      }))
      setClubs(newClubs)
      setMatches(newMatches)
      const initAdmin: Record<string, { h: string; a: string }> = {}
      for (const m of newMatches) {
        initAdmin[m.id] = { h: m.result_home !== null ? String(m.result_home) : '', a: m.result_away !== null ? String(m.result_away) : '' }
      }
      setAdminInputs(initAdmin)
      setUwclClubs(uwcl.clubs || [])
      setUwclMatches((uwcl.matches || []).map((m: any) => ({
        ...m, result_home: m.result_home ?? null, result_away: m.result_away ?? null, phase: 'ligaphase' as const,
      })))
      setLoading(false)
    }).catch(() => setLoading(false))
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

  const reloadUwclTable = () => {
    fetch('/api/ucl2627/table?comp=uwcl2627')
      .then(r => r.json())
      .then(d => { if (!d.error) setUwclTable(d.table ?? []) })
      .catch(() => {})
  }
  useEffect(() => { reloadUwclTable() }, [uwclMatches])

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
        if (d.tip?.ranking_uwcl && Array.isArray(d.tip.ranking_uwcl)) {
          setMyUwclTableTip(d.tip.ranking_uwcl)
          setUwclTableTipDone(true)
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

  // UWCL eigene Match-Tipps laden
  useEffect(() => {
    if (!gastNameSet && !user) return
    const params = user ? '' : `?gast_name=${encodeURIComponent(gastName)}`
    fetch(`/api/ucl2627/match-tips${params}${params ? '&' : '?'}comp=uwcl2627`)
      .then(r => r.json())
      .then(d => {
        if (d.tips) {
          setUwclMyTips(d.tips.map((t: any) => ({
            id: String(t.id), match_id: t.match_id, user_id: t.user_id || null,
            username: t.username || null, gast_name: t.gast_name || null,
            tip_home: t.tip_home, tip_away: t.tip_away,
          })))
        }
      }).catch(console.error)
  }, [user, gastNameSet, gastName])

  // UWCL alle Match-Tipps für alone-Berechnung
  useEffect(() => {
    fetch('/api/ucl2627/match-tips/all?comp=uwcl2627')
      .then(r => r.json())
      .then(d => { if (d.tips) setUwclAllTips(d.tips.map((t: any) => ({ id: String(t.id), match_id: t.match_id, user_id: t.user_id || null, username: t.username || null, gast_name: t.gast_name || null, tip_home: t.tip_home, tip_away: t.tip_away }))) })
      .catch(() => {})
  }, [uwclMyTips])

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
    fetch(`/api/ucl2627/double-tip${params}${params ? '&' : '?'}comp=uwcl`)
      .then(r => r.json())
      .then(d => {
        if (d.doubles) {
          const map: Record<number, string> = {}
          for (const db of d.doubles) map[db.matchday] = db.match_id
          setMyUwclDoubles(map)
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

  // Alle Hottakes für Leaderboard + Archiv (ohne Auth)
  useEffect(() => {
    fetch('/api/ucl2627/hottakes')
      .then(r => r.json())
      .then(d => {
        if (d.public) {
          setAllHottakesForLB(d.public)
          // Archiv auch ohne Login befüllen (wird überschrieben wenn Auth vorhanden)
          setPublicHottakes(prev => prev.length === 0 ? d.public : prev)
        }
      })
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
        if (d.public) {
          setPublicHottakes(d.public)
          // Neuesten Spieltag vorauswählen — wird via getMatchdayForHottake berechnet sobald matches geladen
        }
        if (typeof d.week_count === 'number') setWeekCount(d.week_count)
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

  // Alle Star-Tipps + Ergebnisse für Leaderboard-Detail
  useEffect(() => {
    fetch('/api/ucl2627/star-tip/all')
      .then(r => r.json())
      .then(d => {
        if (d.tips) setAllStarTips(d.tips)
        if (d.results) setAllStarResults(d.results)
      })
      .catch(console.error)
  }, [])

  // MC-Heads für Leaderboard laden
  useEffect(() => {
    fetch('/api/ucl2627/participants')
      .then(r => r.json())
      .then(d => {
        if (d.participants) {
          const map: Record<string, string | null> = {}
          for (const p of d.participants) map[p.username] = p.profile_picture_url || p.minecraft_username
          setMcHeads(map)
        }
      })
      .catch(console.error)
  }, [])

  // Leaderboard — UCL + UWCL zusammen
  useEffect(() => {
    const combinedTips = [...(allTips.length ? allTips : myTips), ...uwclAllTips]
    const combinedMatches = [...matches, ...uwclMatches]
    const lb = buildLeaderboard(
      combinedTips, combinedMatches, tableTips, table, allDoubles, allPartners,
      allHottakesForLB, allStarTips, allStarResults,
      uwclTable, myUwclTableTip
    )
    setLeaderboard(lb.map(e => ({ ...e, minecraft_username: mcHeads[e.name] ?? null })))
  }, [allTips, myTips, uwclAllTips, matches, uwclMatches, tableTips, table, uwclTable, myUwclTableTip, mcHeads, allDoubles, allPartners, allHottakesForLB, allStarTips, allStarResults])

  const clubMap = Object.fromEntries([...clubs, ...uwclClubs].map(c => [c.id, c]))
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
      if (typeof r2.week_count === 'number') setWeekCount(r2.week_count)
    } catch { setHottakeMsg({ type: 'err', text: 'Netzwerkfehler' }) }
    setHottakeSaving(false)
  }

  const handleStarTip = async () => {
    if (!starPlayer.trim()) return
    const name = starPlayer.trim()
    // Denselben Spieler bereits für diesen Spieltag eingetragen?
    if (myStarTips.find(t => t.matchday === activeMatchday && t.player_name.toLowerCase() === name.toLowerCase())) {
      setStarMsg({ type: 'err', text: `${name} bereits eingetragen` }); return
    }
    setStarSaving(true); setStarMsg(null)
    try {
      const body: any = { matchday: activeMatchday, player_name: name }
      if (!user) body.gast_name = gastName
      const res = await fetch('/api/ucl2627/star-tip', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const d = await res.json()
      if (!res.ok) { setStarMsg({ type: 'err', text: d.error || 'Fehler' }); setStarSaving(false); return }
      setStarMsg({ type: 'ok', text: 'Gespeichert!' })
      setMyStarTips(prev => [...prev, { matchday: activeMatchday, player_name: name, goals: 0 }])
      setStarPlayer('')
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

  const handleDouble = async (matchId: string, matchday: number, comp: 'ucl' | 'uwcl' = 'ucl') => {
    if (!user && !gastNameSet) return
    const doublesForComp = comp === 'uwcl' ? myUwclDoubles : myDoubles
    const setDoublesForComp = comp === 'uwcl' ? setMyUwclDoubles : setMyDoubles
    const isCurrentDouble = doublesForComp[matchday] === matchId
    setDoubleSaving(true)
    try {
      if (isCurrentDouble) {
        const body: any = { matchday, comp }
        if (!user) body.gast_name = gastName
        await fetch('/api/ucl2627/double-tip', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
        setDoublesForComp(prev => { const n = { ...prev }; delete n[matchday]; return n })
      } else {
        const body: any = { match_id: matchId, matchday, comp }
        if (!user) body.gast_name = gastName
        const res = await fetch('/api/ucl2627/double-tip', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
        if (res.ok) setDoublesForComp(prev => ({ ...prev, [matchday]: matchId }))
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
  const myHottakePoints = myHottakes.filter(h => h.status === 'accepted' && h.fulfilled === true).reduce((s, h) => s + (h.hardness === 1 ? 4 : h.hardness === 2 ? 8 : h.hardness === 3 ? 12 : 0), 0)
  const myStarPoints = myStarTips.reduce((s, tip) => {
    const result = starResults.find(r =>
      r.matchday === tip.matchday &&
      r.player_name.trim().toLowerCase() === tip.player_name.trim().toLowerCase()
    )
    if (!result) return s
    return s + result.actual_goals * 2
  }, 0)
  const myTotal = myMatchPoints + myTablePoints + myPartnerPoints + myHottakePoints + myStarPoints
  const myRank = leaderboard.findIndex(e => e.name === (user?.username || gastName)) + 1

  // Tipp abgeben
  const handleTip = async (matchId: string, comp: 'ucl' | 'uwcl' = 'ucl') => {
    const [h, a] = inputs[matchId] || ['', '']
    if (h === '' || a === '' || (!user && !gastNameSet)) return
    setSaving(matchId)
    try {
      const body: any = { match_id: matchId, tip_home: parseInt(h), tip_away: parseInt(a), comp }
      if (!user) body.gast_name = gastName
      const res = await fetch('/api/ucl2627/match-tips', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const data = await res.json()
      if (!res.ok) { alert('Fehler beim Speichern: ' + (data?.error || res.status)); setSaving(null); return }
      const fake: Tip = { id: `t_${matchId}`, match_id: matchId, user_id: user?.id || null, username: user?.username || null, gast_name: !user ? gastName : null, tip_home: parseInt(h), tip_away: parseInt(a) }
      if (comp === 'uwcl') {
        setUwclMyTips(prev => [...prev.filter(t => t.match_id !== matchId), fake])
      } else {
        setMyTips(prev => [...prev.filter(t => t.match_id !== matchId), fake])
      }
      setSaved(matchId); setTimeout(() => setSaved(null), 2000)
    } catch {}
    setSaving(null)
  }

  const handleDeleteTip = async (matchId: string, comp: 'ucl' | 'uwcl' = 'ucl') => {
    const body: any = { match_id: matchId, comp }
    if (!user) body.gast_name = gastName
    await fetch('/api/ucl2627/match-tips', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    if (comp === 'uwcl') {
      setUwclMyTips(prev => prev.filter(t => t.match_id !== matchId))
    } else {
      setMyTips(prev => prev.filter(t => t.match_id !== matchId))
    }
    setInputs(prev => ({ ...prev, [matchId]: ['', ''] }))
  }

  // ── Leaderboard-Detailmodal ────────────────────────────────────────────────
  function LeaderboardDetailModal({ entry, onClose }: { entry: LeaderboardEntry; onClose: () => void }) {
    const mc = entry.minecraft_username
    const [cat, setCat] = React.useState<'spiele' | 'tabelle' | 'partner' | 'star' | 'hottakes' | null>(null)

    const now = new Date()
    const visibleMatches = entry.matchDetails.filter(d => new Date(d.kickoff) <= now)

    // Tabellentipp dieses Users
    const userKey = entry.name
    const tableTip = tableTips.find(t => (t.gast_name || t.username || t.user_id) === userKey)
    const tableTipResult = tableTip && table.length > 0 ? calcTableTipPoints(tableTip.ranking, table) : null

    // Partnerverein
    const partnerEntry = allPartners.find(p => (p.gast_name || p.username) === userKey)
    const partnerClub = partnerEntry ? (clubs.find(c => c.id === partnerEntry.club_id)) : null
    const partnerWins = partnerEntry ? matches.filter(m => {
      if (m.result_home === null || m.result_away === null) return false
      const isHome = m.home_club_id === partnerEntry.club_id
      const isAway = m.away_club_id === partnerEntry.club_id
      if (!isHome && !isAway) return false
      return isHome ? m.result_home > m.result_away : m.result_away > m.result_home
    }) : []

    // Hottakes dieses Users
    const userHottakes = allHottakesForLB.filter((h: any) =>
      (h.username || h.gast_name) === userKey && h.status === 'accepted' && h.fulfilled === true
    )
    const hardnessLabel = (n: number | null) => n === 1 ? 'Lauwarm' : n === 2 ? 'Heiß' : n === 3 ? 'Höllisch' : '?'
    const hardnessColor = (n: number | null) => n === 1 ? '#fbbf24' : n === 2 ? '#f97316' : n === 3 ? '#ef4444' : G.muted
    const hardnessPts  = (n: number | null) => n === 1 ? 4 : n === 2 ? 8 : n === 3 ? 12 : 0

    const CATS = [
      { key: 'spiele'   as const, label: 'Spieltipps',  val: entry.matchPoints,  color: G.blue     },
      { key: 'tabelle'  as const, label: 'Tabelle',      val: entry.tablePoints,  color: G.green    },
      { key: 'partner'  as const, label: 'Partner',      val: entry.partnerPoints,color: '#a78bfa'  },
      { key: 'star'     as const, label: 'Starspieler',  val: entry.starPoints,   color: G.gold     },
      { key: 'hottakes' as const, label: 'Hottakes',     val: entry.hottakePoints,color: '#f87171'  },
    ]

    function rowZoneColor(pos: number) {
      if (pos <= 8)  return G.green
      if (pos <= 24) return G.blue
      return '#a855f7'
    }

    return (
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 9000, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
        <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 640, maxHeight: '88vh', overflowY: 'auto', background: '#070f2a', border: '1px solid rgba(201,168,76,0.3)', borderRadius: 20, boxShadow: '0 24px 80px rgba(0,0,0,0.6)', scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.12) transparent' }}>

          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '20px 24px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
            {cat && (
              <button onClick={() => setCat(null)} style={{ background: 'none', border: 'none', color: G.muted, fontSize: 18, cursor: 'pointer', padding: 0, lineHeight: 1, marginRight: 4 }}>←</button>
            )}
            <PlayerAvatar name={entry.name} mcOrUrl={mc} size={48} />
            <div style={{ flex: 1 }}>
              <p style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#fff' }}>{entry.name}</p>
              <p style={{ margin: '3px 0 0', fontSize: 12, color: G.muted }}>
                {cat ? CATS.find(c => c.key === cat)?.label : 'Punkteaufschlüsselung'}
              </p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <p style={{ margin: 0, fontSize: 28, fontWeight: 900, background: 'linear-gradient(135deg,#c9a84c,#e8c96a)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>{entry.total}</p>
              <p style={{ margin: 0, fontSize: 10, color: G.muted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Gesamt</p>
            </div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: G.muted, fontSize: 22, cursor: 'pointer', lineHeight: 1, padding: '0 0 0 8px' }}>×</button>
          </div>

          {/* Übersicht — klickbare Kacheln */}
          {!cat && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8, padding: '16px 24px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
              {CATS.map(({ key, label, val, color }) => (
                <button key={key} onClick={() => setCat(key)}
                  style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid rgba(255,255,255,0.07)`, borderRadius: 10, padding: '12px 8px', textAlign: 'center', cursor: 'pointer', transition: 'background 0.15s' }}
                  onMouseEnter={ev => (ev.currentTarget.style.background = 'rgba(255,255,255,0.09)')}
                  onMouseLeave={ev => (ev.currentTarget.style.background = 'rgba(255,255,255,0.04)')}>
                  <p style={{ margin: 0, fontSize: 22, fontWeight: 800, color }}>{val}</p>
                  <p style={{ margin: '4px 0 0', fontSize: 9, color: G.muted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</p>
                  <p style={{ margin: '4px 0 0', fontSize: 9, color: 'rgba(255,255,255,0.2)' }}>Details →</p>
                </button>
              ))}
            </div>
          )}

          {/* ── SPIELTIPPS ── */}
          {cat === 'spiele' && (
            <div style={{ padding: '16px 24px' }}>
              {visibleMatches.length === 0 ? (
                <p style={{ color: G.muted, fontSize: 13, textAlign: 'center', padding: '32px 0' }}>Noch keine angepfiffenen Spiele getippt.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {visibleMatches.map(d => {
                    const home = clubMap[d.home]
                    const away = clubMap[d.away]
                    const hasResult = d.result_home !== null && d.result_away !== null
                    const ptColor = d.points === 0 ? G.muted : d.isExact ? G.green : d.points >= 2 ? G.gold : '#94a3b8'
                    const label = d.isExact ? 'Exakt' : d.points >= 2 ? (d.points >= 3 ? 'Torverhältnis' : 'Tendenz') : hasResult ? 'Daneben' : ''
                    return (
                      <div key={d.match_id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 8, background: d.points > 0 ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.05)' }}>
                        <span style={{ fontSize: 10, color: G.muted, minWidth: 24, flexShrink: 0 }}>ST{d.matchday}</span>
                        <ClubLogo club={home} size="sm" />
                        <span style={{ fontSize: 12, color: '#fff', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{home?.short ?? '?'} – {away?.short ?? '?'}</span>
                        <ClubLogo club={away} size="sm" />
                        <div style={{ textAlign: 'right', minWidth: 60 }}>
                          <div style={{ fontSize: 12, color: G.muted }}>{d.tip_home}:{d.tip_away} {hasResult ? `(${d.result_home}:${d.result_away})` : ''}</div>
                          {label && <div style={{ fontSize: 10, color: ptColor }}>{label}{d.multiplier === 2 ? ' ×2' : ''}</div>}
                        </div>
                        <span style={{ fontSize: 14, fontWeight: 800, color: ptColor, minWidth: 28, textAlign: 'right' }}>{hasResult ? `+${d.points * d.multiplier}` : '–'}</span>
                      </div>
                    )
                  })}
                </div>
              )}
              <div style={{ marginTop: 12, display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                {[{ label: 'Exakt', color: G.green }, { label: 'Torverhältnis', color: G.gold }, { label: 'Tendenz', color: '#94a3b8' }, { label: 'Daneben', color: G.muted }].map(({ label, color }) => (
                  <span key={label} style={{ fontSize: 10, color, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: color, display: 'inline-block' }} />{label}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* ── TABELLE ── */}
          {cat === 'tabelle' && (
            <div style={{ padding: '16px 24px' }}>
              {!tableTip ? (
                <p style={{ color: G.muted, fontSize: 13, textAlign: 'center', padding: '32px 0' }}>Kein Tabellentipp abgegeben.</p>
              ) : (
                <>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {[...table].sort((a, b) => a.position - b.position).map(row => {
                      const club = clubMap[row.club_id]
                      const tipPos = tableTip.ranking.indexOf(row.club_id) + 1
                      const { perClub } = tableTipResult || { perClub: {} as any }
                      const detail = perClub?.[row.club_id]
                      const pts = detail ? detail.sectionPoints + detail.posPoints : 0
                      const zoneColor = rowZoneColor(row.position)
                      return (
                        <div key={row.club_id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 8px', borderRadius: 6, background: pts > 0 ? 'rgba(255,255,255,0.04)' : 'transparent', borderLeft: `2px solid ${zoneColor}` }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: zoneColor, minWidth: 20, textAlign: 'right' }}>{row.position}.</span>
                          <ClubLogo club={club} size="sm" />
                          <span style={{ fontSize: 12, color: '#fff', flex: 1 }}>{club?.name ?? row.club_id}</span>
                          <span style={{ fontSize: 10, color: G.muted }}>Tipp: {tipPos > 0 ? `${tipPos}.` : '–'}</span>
                          <span style={{ fontSize: 13, fontWeight: 700, color: pts > 0 ? G.green : G.muted, minWidth: 24, textAlign: 'right' }}>{pts > 0 ? `+${pts}` : '0'}</span>
                        </div>
                      )
                    })}
                  </div>
                  {tableTipResult && (
                    <div style={{ marginTop: 12, padding: '10px 12px', borderRadius: 10, background: 'rgba(255,255,255,0.04)', display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 11, color: G.muted }}>
                      <span>Top 8 Bonus: <b style={{ color: '#fff' }}>+{tableTipResult.bonuses.section1}</b></span>
                      <span>9–24 Bonus: <b style={{ color: '#fff' }}>+{tableTipResult.bonuses.section2}</b></span>
                      <span>25–36 Bonus: <b style={{ color: '#fff' }}>+{tableTipResult.bonuses.section3}</b></span>
                      {tableTipResult.bonuses.allCorrect && <span style={{ color: G.gold }}>🎯 Perfekte Tabelle!</span>}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* ── PARTNER ── */}
          {cat === 'partner' && (
            <div style={{ padding: '16px 24px' }}>
              {!partnerClub ? (
                <p style={{ color: G.muted, fontSize: 13, textAlign: 'center', padding: '32px 0' }}>Kein Partnerverein gewählt.</p>
              ) : (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px', borderRadius: 12, background: 'rgba(167,139,250,0.08)', border: '1px solid rgba(167,139,250,0.2)', marginBottom: 14 }}>
                    <ClubLogo club={partnerClub} size="lg" />
                    <div>
                      <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#fff' }}>{partnerClub.name}</p>
                      <p style={{ margin: '2px 0 0', fontSize: 12, color: '#a78bfa' }}>{partnerWins.length} Sieg{partnerWins.length !== 1 ? 'e' : ''} × 2 Pkt = +{partnerWins.length * 2} Pkt</p>
                    </div>
                  </div>
                  {partnerWins.length === 0 ? (
                    <p style={{ color: G.muted, fontSize: 12 }}>Noch keine gewerteten Siege.</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {partnerWins.map(m => {
                        const home = clubMap[m.home_club_id]
                        const away = clubMap[m.away_club_id]
                        return (
                          <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 8, background: 'rgba(167,139,250,0.06)', border: '1px solid rgba(167,139,250,0.12)' }}>
                            <span style={{ fontSize: 10, color: G.muted, minWidth: 24 }}>ST{m.matchday}</span>
                            <ClubLogo club={home} size="sm" />
                            <span style={{ fontSize: 12, color: '#fff', flex: 1 }}>{home?.short ?? '?'} – {away?.short ?? '?'}</span>
                            <ClubLogo club={away} size="sm" />
                            <span style={{ fontSize: 12, color: G.muted }}>{m.result_home}:{m.result_away}</span>
                            <span style={{ fontSize: 13, fontWeight: 800, color: '#a78bfa' }}>+2</span>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* ── STARSPIELER ── */}
          {cat === 'star' && (
            <div style={{ padding: '16px 24px' }}>
              {entry.starDetails.length === 0 ? (
                <p style={{ color: G.muted, fontSize: 13, textAlign: 'center', padding: '32px 0' }}>Kein Starspieler-Tipp abgegeben.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {entry.starDetails.map((s, i) => {
                    const hasResult = s.actual_goals !== null
                    const ptColor = s.points > 0 ? G.green : hasResult ? G.muted : 'rgba(255,255,255,0.25)'
                    return (
                      <div key={i} style={{ padding: '10px 14px', borderRadius: 10, background: s.points > 0 ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.02)', border: `1px solid ${s.points > 0 ? 'rgba(201,168,76,0.2)' : 'rgba(255,255,255,0.06)'}`, display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontSize: 10, color: G.muted, minWidth: 24 }}>ST{s.matchday}</span>
                        <span style={{ flex: 1, fontSize: 13, fontWeight: 700, color: '#fff' }}>⭐ {s.player_name}</span>
                        {hasResult
                          ? <span style={{ fontSize: 12, color: G.muted }}>{s.actual_goals} Tor{s.actual_goals !== 1 ? 'e' : ''}</span>
                          : <span style={{ fontSize: 11, color: G.muted, fontStyle: 'italic' }}>ausstehend</span>
                        }
                        <span style={{ fontSize: 13, fontWeight: 800, color: ptColor, minWidth: 32, textAlign: 'right' }}>{hasResult ? `+${s.points}` : '–'}</span>
                      </div>
                    )
                  })}
                </div>
              )}
              <p style={{ margin: '12px 0 0', fontSize: 10, color: G.muted }}>2 Punkte pro Tor des getippten Spielers</p>
            </div>
          )}

          {/* ── HOTTAKES ── */}
          {cat === 'hottakes' && (
            <div style={{ padding: '16px 24px' }}>
              {userHottakes.length === 0 ? (
                <p style={{ color: G.muted, fontSize: 13, textAlign: 'center', padding: '32px 0' }}>Keine gewerteten Hottakes.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {userHottakes.map((h: any, i: number) => (
                    <div key={i} style={{ padding: '12px 14px', borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: `1px solid ${hardnessColor(h.hardness)}44` }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: hardnessColor(h.hardness), display: 'flex', alignItems: 'center', gap: 5 }}>
                          {h.hardness === 1 ? '🌶️' : h.hardness === 2 ? '🔥' : '☠️'} {hardnessLabel(h.hardness)}
                        </span>
                        <span style={{ fontSize: 14, fontWeight: 800, color: '#f87171' }}>+{hardnessPts(h.hardness)}</span>
                      </div>
                      <p style={{ margin: 0, fontSize: 13, color: '#fff', lineHeight: 1.5 }}>„{h.content}"</p>
                    </div>
                  ))}
                </div>
              )}
              <p style={{ margin: '12px 0 0', fontSize: 10, color: G.muted }}>Lauwarm: +4 · Heiß: +8 · Höllisch: +12 — nur abgelaufene & akzeptierte zählen</p>
            </div>
          )}

          {/* Footer */}
          <div style={{ padding: '10px 24px', borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'flex-end' }}>
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)' }}>Klick außerhalb zum Schließen</span>
          </div>
        </div>
      </div>
    )
  }
  // ──────────────────────────────────────────────────────────────────────────

  // Leaderboard hover state
  const [hoveredEntry, setHoveredEntry] = useState<LeaderboardEntry | null>(null)

  const isAdmin = !!(user && (user.clan_role === 'owner' || user.clan_role === 'administrator'))

  // Avatar: Profilbild > MC-Kopf > Initialen-Fallback
  function PlayerAvatar({ name, mcOrUrl, size }: { name: string; mcOrUrl: string | null | undefined; size: number }) {
    const radius = size <= 24 ? 3 : size <= 32 ? 4 : 8
    const isProfilePic = mcOrUrl?.startsWith('http') || mcOrUrl?.startsWith('/api/uploads')
    const src = isProfilePic ? mcOrUrl! : `/api/player-heads/${mcOrUrl || name}/${size}`
    const initials = (name || '?').slice(0, 2).toUpperCase()
    return (
      <div style={{ width: size, height: size, borderRadius: radius, flexShrink: 0, position: 'relative', overflow: 'hidden', background: 'rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontSize: size * 0.35, fontWeight: 700, color: G.muted, position: 'absolute' }}>{initials}</span>
        <img src={src} style={{ width: size, height: size, position: 'absolute', inset: 0, objectFit: 'cover' }}
          onError={ev => { (ev.target as HTMLImageElement).style.display = 'none' }} />
      </div>
    )
  }

  const sortedTable = [...table].sort((a, b) => a.position - b.position)
  const sortedUwclTable = [...uwclTable].sort((a, b) => a.position - b.position)
  const activeLiveTable = liveTableComp === 'ucl' ? sortedTable : sortedUwclTable
  const activeLiveClubMap = liveTableComp === 'ucl' ? clubMap : Object.fromEntries(uwclClubs.map(c => [c.id, c]))

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
      {/* UCL Tabellentipp Step */}
      {tableTipStep === 'ucl' && clubs.length > 0 && (
        <UCLTableTip
          initialRanking={existingTableTip || undefined}
          clubs={clubs}
          matches={matches}
          onClose={() => setTableTipStep(null)}
          readOnly={tableTipDone && !(user?.username === 'uwuleonie' || user?.clan_role === 'owner' || user?.clan_role === 'administrator')}
          canSkip={false}
          onSkip={() => {}}
          onSubmit={async (ranking) => {
            const body: any = { ranking, comp: 'ucl' }
            if (!user) body.gast_name = gastName
            try {
              const res = await fetch('/api/ucl2627/table-tip', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), credentials: 'include' })
              const d = await res.json()
              if (!res.ok) { console.error('[table-tip submit]', d.error); alert('Fehler: ' + (d.error || 'Unbekannt')); return }
              setMyTableTip(ranking)
              setTableTipDone(true)
              setExistingTableTip(ranking)
              setTableTipStep('uwcl') // → weiter zu UWCL
            } catch (e) { console.error('[table-tip submit]', e); alert('Netzwerkfehler') }
          }}
        />
      )}

      {/* UWCL Tabellentipp Step — optional, kann übersprungen werden */}
      {tableTipStep === 'uwcl' && uwclClubs.length > 0 && (
        <UCLTableTip
          initialRanking={myUwclTableTip || undefined}
          clubs={uwclClubs}
          matches={uwclMatches}
          onClose={() => setTableTipStep(null)}
          readOnly={false}
          canSkip={true}
          onSkip={() => setTableTipStep(null)}
          onSubmit={async (ranking) => {
            const body: any = { ranking_uwcl: ranking, comp: 'uwcl' }
            if (!user) body.gast_name = gastName
            try {
              const res = await fetch('/api/ucl2627/table-tip', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), credentials: 'include' })
              const d = await res.json()
              if (!res.ok) { alert('Fehler: ' + (d.error || 'Unbekannt')); return }
              setMyUwclTableTip(ranking)
              setUwclTableTipDone(true)
              setTableTipStep(null)
            } catch (e) { alert('Netzwerkfehler') }
          }}
        />
      )}

      {/* Tabelle ansehen Modals */}
      {viewTableComp === 'ucl' && clubs.length > 0 && (
        <UCLTableTip
          initialRanking={myTableTip || existingTableTip || undefined}
          clubs={clubs}
          matches={matches}
          onClose={() => setViewTableComp(null)}
          readOnly={true}
          canSkip={false}
          onSkip={() => {}}
          onSubmit={() => {}}
        />
      )}
      {viewTableComp === 'uwcl' && uwclClubs.length > 0 && (
        <UCLTableTip
          initialRanking={myUwclTableTip || undefined}
          clubs={uwclClubs}
          matches={uwclMatches}
          onClose={() => setViewTableComp(null)}
          readOnly={true}
          canSkip={false}
          onSkip={() => {}}
          onSubmit={() => {}}
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
                    <p style={{ fontSize: 22, fontWeight: 800, color: G.gold, margin: 0 }}>{myTips.length + uwclMyTips.length}<span style={{ fontSize: 13, color: G.muted, fontWeight: 400 }}>/{matches.length + uwclMatches.length}</span></p>
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

            {/* LIVE / NEXT Matches Widget */}
            {(() => {
              const now = new Date()
              const toLocal = (kickoff: string) => new Date(kickoff.replace(/Z$/, ''))
              const LIVE_WINDOW_MS = 2 * 60 * 60 * 1000
              const allUpcoming = [...matches, ...uwclMatches]
              const liveMatches = allUpcoming.filter(m => {
                const ko = toLocal(m.kickoff)
                return ko <= now && now.getTime() - ko.getTime() < LIVE_WINDOW_MS
              })
              const nextMatches = allUpcoming
                .filter(m => toLocal(m.kickoff) > now)
                .sort((a, b) => toLocal(a.kickoff).getTime() - toLocal(b.kickoff).getTime())
                .slice(0, 4)

              if (liveMatches.length === 0 && nextMatches.length === 0) return null

              const isLive = liveMatches.length > 0
              const displayMatches = isLive ? liveMatches : nextMatches

              const widgetClubMap = { ...clubMap, ...Object.fromEntries(uwclClubs.map(c => [c.id, c])) }

              const openH2H = async (m: Match) => {
                if (m.home_club_id.startsWith('uwcl_') || m.away_club_id.startsWith('uwcl_')) return
                const homeClub = clubMap[m.home_club_id]
                const awayClub = clubMap[m.away_club_id]
                setH2hMatch({ home: m.home_club_id, away: m.away_club_id, homeClub, awayClub })
                setH2hData([])
                setH2hError(null)
                setH2hLoading(true)
                try {
                  const res = await fetch(`/api/ucl2627/h2h?home=${m.home_club_id}&away=${m.away_club_id}`)
                  const d = await res.json()
                  setH2hData(d.matches || [])
                  if (d.error) setH2hError(d.error)
                  else if (d.note) setH2hError(d.note)
                } catch (e: any) {
                  setH2hError(e.message)
                }
                setH2hLoading(false)
              }

              return (
                <div style={{ marginBottom: 24, ...G.card, padding: '14px 20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                    {isLive
                      ? <><span style={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444', display: 'inline-block', boxShadow: '0 0 6px #ef4444', animation: 'pulse 1.5s infinite' }} /><span style={{ fontSize: 11, fontWeight: 800, color: '#ef4444', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Live</span></>
                      : <span style={{ fontSize: 11, fontWeight: 800, color: G.gold, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Nächste Spiele</span>
                    }
                    {!displayMatches.some(m => m.home_club_id.startsWith('uwcl_')) && (
                      <span style={{ fontSize: 10, color: G.muted, marginLeft: 4 }}>— Klick für H2H</span>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    {displayMatches.map(m => {
                      const home = widgetClubMap[m.home_club_id]
                      const away = widgetClubMap[m.away_club_id]
                      const ko = toLocal(m.kickoff)
                      const hasResult = m.result_home !== null && m.result_away !== null
                      const elapsed = isLive ? Math.floor((now.getTime() - toLocal(m.kickoff).getTime()) / 60000) : null
                      const elapsedDisplay = elapsed === null ? '' :
                        elapsed <= 45 ? `${elapsed}'` :
                        elapsed <= 60 ? 'HZ' :
                        `${Math.min(90, elapsed - 15)}'`
                      return (
                        <div key={m.id} onClick={() => openH2H(m)}
                          style={{ flex: '1 1 180px', minWidth: 160, maxWidth: 240, background: 'rgba(255,255,255,0.04)', border: isLive ? '1px solid rgba(239,68,68,0.3)' : '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '10px 14px', cursor: 'pointer', transition: 'background 0.15s' }}
                          onMouseEnter={ev => (ev.currentTarget.style.background = 'rgba(255,255,255,0.09)')}
                          onMouseLeave={ev => (ev.currentTarget.style.background = 'rgba(255,255,255,0.04)')}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                            <span style={{ fontSize: 9, color: G.muted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>ST{m.matchday}</span>
                            {isLive
                              ? <span style={{ fontSize: 10, fontWeight: 700, color: '#ef4444' }}>{elapsedDisplay}</span>
                              : <span style={{ fontSize: 10, color: G.muted }}>{ko.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit', timeZone: 'UTC' })} {ko.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' })}</span>
                            }
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <ClubLogo club={home} size="sm" />
                            <span style={{ fontSize: 12, fontWeight: 600, color: '#fff', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{home?.short ?? '?'}</span>
                            {hasResult
                              ? <span style={{ fontSize: 15, fontWeight: 900, color: G.gold, minWidth: 32, textAlign: 'center' }}>{m.result_home}:{m.result_away}</span>
                              : <span style={{ fontSize: 11, color: G.muted, minWidth: 32, textAlign: 'center' }}>vs</span>
                            }
                            <span style={{ fontSize: 12, fontWeight: 600, color: '#fff', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'right' }}>{away?.short ?? '?'}</span>
                            <ClubLogo club={away} size="sm" />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                  <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }`}</style>
                </div>
              )
            })()}

            {/* H2H Modal */}
            {h2hMatch && (
              <div onClick={() => setH2hMatch(null)} style={{ position: 'fixed', inset: 0, zIndex: 9000, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
                <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 520, background: '#070f2a', border: '1px solid rgba(201,168,76,0.3)', borderRadius: 20, boxShadow: '0 24px 80px rgba(0,0,0,0.6)', overflow: 'hidden' }}>
                  <div style={{ padding: '18px 24px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', gap: 12 }}>
                    <ClubLogo club={h2hMatch.homeClub} size="md" />
                    <div style={{ flex: 1, textAlign: 'center' }}>
                      <p style={{ margin: 0, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: G.muted }}>Head to Head</p>
                      <p style={{ margin: '3px 0 0', fontSize: 13, fontWeight: 700, color: '#fff' }}>{h2hMatch.homeClub?.name ?? h2hMatch.home} vs {h2hMatch.awayClub?.name ?? h2hMatch.away}</p>
                    </div>
                    <ClubLogo club={h2hMatch.awayClub} size="md" />
                    <button onClick={() => setH2hMatch(null)} style={{ background: 'none', border: 'none', color: G.muted, fontSize: 22, cursor: 'pointer', lineHeight: 1, marginLeft: 8 }}>×</button>
                  </div>
                  <div style={{ padding: '16px 24px' }}>
                    {h2hLoading ? (
                      <p style={{ color: G.muted, fontSize: 13, textAlign: 'center', padding: '32px 0' }}>Lade H2H-Daten…</p>
                    ) : h2hData.length === 0 ? (
                      <p style={{ color: G.muted, fontSize: 13, textAlign: 'center', padding: '32px 0' }}>
                        {h2hError ? `Fehler: ${h2hError}` : 'Keine Begegnungen gefunden.'}
                      </p>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <p style={{ margin: '0 0 10px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: G.muted }}>Letzte {h2hData.length} Begegnungen</p>
                        {h2hData.map((hm, i) => {
                          const date = new Date(hm.date).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' })
                          const homeWin = hm.homeGoals !== null && hm.awayGoals !== null && hm.homeGoals > hm.awayGoals
                          const awayWin = hm.homeGoals !== null && hm.awayGoals !== null && hm.awayGoals > hm.homeGoals
                          const isDraw = hm.homeGoals === hm.awayGoals && hm.homeGoals !== null
                          const ourHomeName = h2hMatch.homeClub?.name ?? ''
                          const isOurHomeWin = (hm.homeTeam === ourHomeName && homeWin) || (hm.awayTeam === ourHomeName && awayWin)
                          const isOurAwayWin = !isOurHomeWin && !isDraw && hm.homeGoals !== null
                          return (
                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                              <span style={{ fontSize: 10, color: G.muted, minWidth: 36 }}>{date}</span>
                              <span style={{ fontSize: 11, flex: 1, textAlign: 'right', color: hm.homeTeam === ourHomeName ? '#fff' : G.muted, fontWeight: hm.homeTeam === ourHomeName ? 700 : 400 }}>{hm.homeTeam}</span>
                              <span style={{ fontSize: 14, fontWeight: 900, minWidth: 36, textAlign: 'center', color: isDraw ? G.muted : isOurHomeWin ? G.green : isOurAwayWin ? '#ef4444' : G.gold }}>
                                {hm.homeGoals ?? '?'}:{hm.awayGoals ?? '?'}
                              </span>
                              <span style={{ fontSize: 11, flex: 1, color: hm.awayTeam === ourHomeName ? '#fff' : G.muted, fontWeight: hm.awayTeam === ourHomeName ? 700 : 400 }}>{hm.awayTeam}</span>
                              <span style={{ fontSize: 9, color: G.muted, maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{hm.competition}</span>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                  <div style={{ padding: '10px 24px', borderTop: '1px solid rgba(255,255,255,0.05)', textAlign: 'right' }}>
                    <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)' }}>Klick außerhalb zum Schließen · Daten: football-data.org</span>
                  </div>
                </div>
              </div>
            )}

            {/* TABELLE */}
            {tab === 'tabelle' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 20, alignItems: 'start' }}>
                <div>
                  {/* Mitmachen-Banner — UCL noch nicht getippt */}
                  {!tableTipDone && (user || gastNameSet) && (
                    <div style={{ marginBottom: 16, borderRadius: 14, background: 'linear-gradient(135deg, rgba(76,175,80,0.15), rgba(56,142,60,0.1))', border: '1px solid rgba(76,175,80,0.4)', padding: '18px 22px', display: 'flex', alignItems: 'center', gap: 16, cursor: 'pointer', boxShadow: '0 0 24px rgba(76,175,80,0.1)' }} onClick={() => setTableTipStep('ucl')}>
                      <div style={{ fontSize: 32 }}>⚽</div>
                      <div style={{ flex: 1 }}>
                        <p style={{ margin: 0, fontSize: 15, fontWeight: 800, color: '#fff' }}>Am Tippspiel mitmachen!</p>
                        <p style={{ margin: '3px 0 0', fontSize: 13, color: 'rgba(180,255,180,0.7)' }}>Erst UCL-Tabelle (36 Vereine), dann optional UWCL (18 Vereine)</p>
                      </div>
                      <div style={{ background: 'linear-gradient(135deg, #4caf50, #66bb6a)', color: '#fff', border: 'none', borderRadius: 10, padding: '10px 20px', fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap', flexShrink: 0 }}>
                        Jetzt tippen →
                      </div>
                    </div>
                  )}
                  {/* UWCL-Banner — UCL bereits getippt, UWCL noch nicht */}
                  {tableTipDone && !uwclTableTipDone && (user || gastNameSet) && (
                    <div style={{ marginBottom: 16, borderRadius: 14, background: 'linear-gradient(135deg, rgba(106,26,106,0.2), rgba(156,39,176,0.1))', border: '1px solid rgba(156,39,176,0.5)', padding: '18px 22px', display: 'flex', alignItems: 'center', gap: 16, cursor: 'pointer', boxShadow: '0 0 24px rgba(156,39,176,0.1)' }} onClick={() => setTableTipStep('uwcl')}>
                      <img src="/uwcl-badge.png" alt="UWCL" style={{ width: 36, height: 36, objectFit: 'contain', flexShrink: 0 }} />
                      <div style={{ flex: 1 }}>
                        <p style={{ margin: 0, fontSize: 15, fontWeight: 800, color: '#fff' }}>UWCL-Tabelle noch nicht getippt!</p>
                      </div>
                      <div style={{ background: 'linear-gradient(135deg, #6a1a6a, #9c27b0)', color: '#fff', border: 'none', borderRadius: 10, padding: '10px 20px', fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap', flexShrink: 0 }}>
                        Jetzt tippen →
                      </div>
                    </div>
                  )}

                  {/* Tabellenvorhersage Header (nur wenn bereits getippt) */}
                  {tableTipDone && (
                    <div style={{ ...G.cardStrong, padding: '16px 20px', marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                      <div>
                        <p style={{ fontWeight: 700, color: '#fff', margin: 0, fontSize: 14 }}>Tabellenvorhersage</p>
                        {myTableTipResult && (
                          <p style={{ margin: '2px 0 0', fontSize: 12, color: G.muted }}>
                            Aktuell: <span style={{ color: G.gold, fontWeight: 700 }}>{myTableTipResult.total} Pkt</span>
                            {myTableTipResult.bonuses.allCorrect && <span style={{ color: G.green, marginLeft: 6 }}>+36 Bonus!</span>}
                          </p>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <button onClick={() => setViewTableComp('ucl')}
                          style={{ display: 'flex', alignItems: 'center', gap: 7, background: 'linear-gradient(135deg, #1a237e, #3d5afe)', color: '#fff', border: 'none', borderRadius: 10, padding: '9px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                          <img src="/ucl-badge.png" alt="" style={{ width: 18, height: 18, objectFit: 'contain' }} />UCL
                        </button>
                        <button onClick={() => uwclTableTipDone ? setViewTableComp('uwcl') : setTableTipStep('uwcl')}
                          style={{ display: 'flex', alignItems: 'center', gap: 7, background: uwclTableTipDone ? 'linear-gradient(135deg, #6a1a6a, #9c27b0)' : 'rgba(255,255,255,0.08)', color: '#fff', border: uwclTableTipDone ? 'none' : '1px dashed rgba(156,39,176,0.5)', borderRadius: 10, padding: '9px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                          <img src="/uwcl-badge.png" alt="" style={{ width: 18, height: 18, objectFit: 'contain', filter: 'invert(1)' }} />{uwclTableTipDone ? 'UWCL' : 'UWCL tippen →'}
                        </button>
                        {user && (user.username === 'uwuleonie' || user.clan_role === 'owner' || user.clan_role === 'administrator') && (
                          <button onClick={() => setTableTipStep('ucl')}
                            style={{ background: 'linear-gradient(135deg, #c9a84c, #e8c96a)', color: '#05081a', border: 'none', borderRadius: 10, padding: '9px 16px', fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                            ✎ Bearbeiten
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  <div style={{ ...G.card, overflow: 'hidden' }}>
                    <div style={{ ...G.cardHeader, display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: G.gold }}>
                        {liveTableComp === 'ucl' ? 'UCL' : 'UWCL'} – Ligaphase
                      </span>
                      <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: 'rgba(76,175,80,0.2)', color: '#4caf50', fontWeight: 600 }}>Live</span>
                      {tableSource === 'override' && liveTableComp === 'ucl' && <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, background: 'rgba(201,168,76,0.2)', color: G.gold, fontWeight: 600 }}>Admin Override</span>}
                      <div style={{ marginLeft: 'auto', display: 'flex', gap: 3, background: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: 3 }}>
                        {(['ucl', 'uwcl'] as const).map(comp => (
                          <button key={comp} onClick={() => setLiveTableComp(comp)}
                            style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 7, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 700, transition: 'all 0.15s',
                              background: liveTableComp === comp ? 'rgba(201,168,76,0.25)' : 'transparent',
                              color: liveTableComp === comp ? G.gold : G.muted,
                              outline: liveTableComp === comp ? '1px solid rgba(201,168,76,0.35)' : 'none' }}>
                            <img src={comp === 'ucl' ? '/ucl-badge.png' : '/uwcl-badge.png'} alt={comp.toUpperCase()} style={{ width: 14, height: 14, objectFit: 'contain', filter: liveTableComp === comp ? 'none' : 'brightness(0.5)' }} />
                            {comp.toUpperCase()}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '24px 32px 1fr 40px 28px 28px 28px 58px 44px 44px', padding: '9px 18px', background: 'rgba(0,0,0,0.2)', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: G.muted, gap: 2 }}>
                      <span /><span style={{ textAlign: 'center' }}>#</span><span>Verein</span>
                      <span style={{ textAlign: 'center' }}>SP</span><span style={{ textAlign: 'center' }}>S</span><span style={{ textAlign: 'center' }}>U</span><span style={{ textAlign: 'center' }}>N</span>
                      <span style={{ textAlign: 'center' }}>Tore</span><span style={{ textAlign: 'center' }}>Diff</span><span style={{ textAlign: 'center' }}>Pkt</span>
                    </div>
                    {(liveTableComp === 'ucl' ? [
                      { key: 'top', label: 'Top 8 – Achtelfinale', range: [1, 8]   as [number,number], color: G.green  },
                      { key: 'mid', label: '9–24 – Playoffs',      range: [9, 24]  as [number,number], color: G.blue   },
                      { key: 'out', label: '25–36 – Ausscheiden',  range: [25, 36] as [number,number], color: G.purple },
                    ] : [
                      { key: 'top', label: 'Top 4 – Viertelfinale',  range: [1, 4]   as [number,number], color: G.green  },
                      { key: 'mid', label: '5–14 – Playoffs',         range: [5, 14]  as [number,number], color: G.blue   },
                      { key: 'out', label: '15–18 – Ausscheiden',     range: [15, 18] as [number,number], color: G.purple },
                    ]).map(zone => {
                      const rows = activeLiveTable.slice(zone.range[0] - 1, zone.range[1])
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
                            const club = activeLiveClubMap[row.club_id]
                            const diff = row.goals_for - row.goals_against
                            // Mein Tabellentipp-Indikator
                            const activeTip = liveTableComp === 'ucl' ? myTableTip : myUwclTableTip
                            const myTipPos = activeTip ? activeTip.indexOf(row.club_id) + 1 : 0
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
                        { pts: '3 Pkt.', label: 'Einziger mit richtigem Gewinner', color: '#ff8a65' },
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
                      <div key={e.name} onClick={() => setDetailEntry(e)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 20px', borderBottom: '1px solid rgba(255,255,255,0.04)', cursor: 'pointer', transition: 'background 0.15s' }}
                        onMouseEnter={ev => (ev.currentTarget.style.background = 'rgba(255,255,255,0.04)')}
                        onMouseLeave={ev => (ev.currentTarget.style.background = 'transparent')}>
                        <div style={{ width: 22, height: 22, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, flexShrink: 0, background: i === 0 ? 'linear-gradient(135deg, #c9a84c, #e8c96a)' : i === 1 ? 'rgba(255,255,255,0.15)' : i === 2 ? 'rgba(205,127,50,0.4)' : 'rgba(255,255,255,0.06)', color: i < 3 ? '#05081a' : G.muted }}>{i + 1}</div>
                        <PlayerAvatar name={e.name} mcOrUrl={e.minecraft_username} size={24} />
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
                {/* Wettbewerbs-Umschalter */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', gap: 4, background: 'rgba(255,255,255,0.04)', borderRadius: 14, padding: 4, border: '1px solid rgba(255,255,255,0.08)' }}>
                    {(['ucl', 'uwcl'] as const).map(comp => (
                      <button key={comp} onClick={() => setActiveComp(comp)}
                        style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', border: 'none', transition: 'all 0.2s',
                          background: activeComp === comp ? 'linear-gradient(135deg, rgba(201,168,76,0.3), rgba(61,90,254,0.25))' : 'transparent',
                          color: activeComp === comp ? G.gold : G.muted,
                          boxShadow: activeComp === comp ? 'inset 0 0 0 1px rgba(201,168,76,0.4)' : 'none' }}>
                        <img src={comp === 'ucl' ? '/ucl-badge.png' : '/uwcl-badge.png'} alt="" style={{ width: 16, height: 16, objectFit: 'contain', display: 'block' }} />
                        {comp === 'ucl' ? 'UCL' : 'UWCL'}
                      </button>
                    ))}
                  </div>
                  <button onClick={() => {
                    localStorage.setItem('ucl_default_comp', activeComp)
                    setStandardSaved(true)
                    setTimeout(() => setStandardSaved(false), 2000)
                  }} title={`${activeComp === 'ucl' ? 'UCL' : 'UWCL'} als Standard-Tab setzen`}
                    style={{ fontSize: 11, color: standardSaved ? G.green : G.muted, background: standardSaved ? 'rgba(76,175,80,0.12)' : 'rgba(255,255,255,0.04)', border: `1px solid ${standardSaved ? 'rgba(76,175,80,0.4)' : 'rgba(255,255,255,0.08)'}`, borderRadius: 10, padding: '6px 12px', cursor: 'pointer', transition: 'all 0.2s' }}>
                    {standardSaved ? '✓ Gespeichert' : '⭐ Als Standard'}
                  </button>
                </div>

                {/* Wettbewerbs-Label */}
                <div style={{ marginBottom: 8 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: activeComp === 'ucl' ? G.gold : '#ce93d8' }}>
                    {activeComp === 'ucl' ? '🏆 UEFA Champions League 26/27' : '⚽ UEFA Women\'s Champions League 26/27'}
                  </span>
                </div>
                {/* Spieltag-Selector */}
                <div style={{ display: 'flex', gap: 6, marginBottom: 24, flexWrap: 'wrap' }}>
                  {(activeComp === 'ucl' ? [1,2,3,4,5,6,7,8] : [1,2,3,4,5,6]).map(day => {
                    const dayMatches = activeComp === 'ucl'
                      ? matches.filter(m => m.matchday === day)
                      : uwclMatches.filter(m => m.matchday === day)
                    const currentDay = activeComp === 'ucl' ? activeMatchday : uwclActiveMatchday
                    const setDay = activeComp === 'ucl' ? setActiveMatchday : setUwclActiveMatchday
                    const myTipsForComp = activeComp === 'ucl' ? myTips : uwclMyTips
                    const tipped = dayMatches.filter(m => myTipsForComp.find(t => t.match_id === m.id)).length
                    const isPast = dayMatches.length > 0 && dayMatches.every(m => new Date(m.kickoff) <= new Date())
                    return (
                      <button key={day} onClick={() => setDay(day)} style={{ padding: '10px 16px', borderRadius: 12, fontSize: 13, fontWeight: 600, cursor: 'pointer', border: 'none', transition: 'all 0.2s', background: currentDay === day ? 'linear-gradient(135deg, #1a237e, #3d5afe)' : 'rgba(255,255,255,0.06)', color: currentDay === day ? '#fff' : G.muted, boxShadow: currentDay === day ? '0 0 16px rgba(61,90,254,0.4)' : 'none', position: 'relative' as const }}>
                        <div>Spieltag {day}</div>
                        <div style={{ fontSize: 10, color: currentDay === day ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.3)', marginTop: 2 }}>
                          {isPast ? 'Beendet' : `${tipped}/${dayMatches.length} getippt`}
                        </div>
                      </button>
                    )
                  })}
                </div>

                {(() => {
                  const currentMatchday = activeComp === 'ucl' ? activeMatchday : uwclActiveMatchday
                  const activeMatches = activeComp === 'ucl' ? matches : uwclMatches
                  const activeClubMap = activeComp === 'ucl' ? clubMap : Object.fromEntries(uwclClubs.map(c => [c.id, c]))
                  const activeMyTips = activeComp === 'ucl' ? myTips : uwclMyTips
                  const activeAllTips = activeComp === 'ucl' ? (allTips.length ? allTips : myTips) : (uwclAllTips.length ? uwclAllTips : uwclMyTips)
                  const myTipForActive = (mid: string) => activeMyTips.find(t => t.match_id === mid)

                  const dayMatches = activeMatches.filter(m => m.matchday === currentMatchday)
                  const byDate: Record<string, Match[]> = {}
                  dayMatches.forEach(m => {
                    const d = new Date(m.kickoff.replace(/Z$/, '')).toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: 'long', timeZone: 'UTC' })
                    if (!byDate[d]) byDate[d] = []
                    byDate[d].push(m)
                  })
                  return Object.entries(byDate).map(([date, ms]) => (
                    <div key={date} style={{ marginBottom: 24 }}>
                      <p style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: G.muted, marginBottom: 12, paddingLeft: 4 }}>{date}</p>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                        {ms.map(match => {
                          const home = activeClubMap[match.home_club_id]
                          const away = activeClubMap[match.away_club_id]
                          const tip = myTipForActive(match.id)
                          const [h, a] = inputs[match.id] || ['', '']
                          const kickoffPassed = new Date(match.kickoff) <= new Date()
                          const hasResult = match.result_home !== null && match.result_away !== null
                          const allForMatch = activeAllTips.filter(t => t.match_id === match.id)
                          const { points: rawPts } = tip && hasResult ? getMatchTipPoints(tip, match, allForMatch) : { points: null as null }
                          const activeDoubles = activeComp === 'uwcl' ? myUwclDoubles : myDoubles
                          const activeCurrentDay = activeComp === 'uwcl' ? uwclActiveMatchday : activeMatchday
                          const isMyDouble = activeDoubles[activeCurrentDay] === match.id
                          const pts = rawPts !== null ? rawPts * (isMyDouble ? 2 : 1) : null
                          const isOtherDouble = !isMyDouble && activeDoubles[activeCurrentDay] !== undefined
                          const soon = !kickoffPassed && new Date(match.kickoff).getTime() - Date.now() < 3_600_000
                          const uhrzeit = new Date(match.kickoff).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' })

                          const untipped = !tip && !kickoffPassed && (user || gastNameSet)
                          return (
                            <div key={match.id} style={{ ...G.card, padding: '16px',
                              borderColor: untipped ? 'rgba(239,83,80,0.5)' : tip ? 'rgba(61,90,254,0.3)' : undefined,
                              boxShadow: untipped ? '0 0 12px rgba(239,83,80,0.15), inset 0 0 20px rgba(239,83,80,0.04)' : undefined,
                              display: 'flex', flexDirection: 'column', gap: 12 }}>
                              {/* Klickbarer oberer Bereich → H2H */}
                              <div onClick={async () => {
                                    if (match.home_club_id.startsWith('uwcl_') || match.away_club_id.startsWith('uwcl_')) return
                                    const homeClub = activeClubMap[match.home_club_id]
                                    const awayClub = activeClubMap[match.away_club_id]
                                    setH2hMatch({ home: match.home_club_id, away: match.away_club_id, homeClub, awayClub })
                                    setH2hData([]); setH2hError(null); setH2hLoading(true)
                                    try {
                                      const res = await fetch(`/api/ucl2627/h2h?home=${match.home_club_id}&away=${match.away_club_id}`)
                                      const d = await res.json()
                                      setH2hData(d.matches || [])
                                      if (d.error) setH2hError(d.error)
                                    } catch (e: any) { setH2hError(e.message) }
                                    setH2hLoading(false)
                                  }} style={{ cursor: (match.home_club_id.startsWith('uwcl_') || match.away_club_id.startsWith('uwcl_')) ? 'default' : 'pointer' }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                                <span style={{ fontSize: 11, color: untipped ? '#ef5350' : G.muted, fontWeight: 600 }}>{uhrzeit} Uhr{untipped ? ' · Noch nicht getippt' : ''}</span>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
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
                                  <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)' }}>H2H →</span>
                                </div>
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
                              </div>
                              {!kickoffPassed && (user || gastNameSet) && (
                                <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center' }}>
                                    <input type="number" min="0" value={h} onChange={e => setInputs(p => ({ ...p, [match.id]: [e.target.value, a] }))} style={{ width: 44, padding: '7px 4px', textAlign: 'center', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, color: '#fff', fontSize: 15, fontWeight: 700, outline: 'none' }} placeholder="0" />
                                    <span style={{ color: G.muted, fontSize: 16, fontWeight: 700 }}>:</span>
                                    <input type="number" min="0" value={a} onChange={e => setInputs(p => ({ ...p, [match.id]: [h, e.target.value] }))} style={{ width: 44, padding: '7px 4px', textAlign: 'center', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, color: '#fff', fontSize: 15, fontWeight: 700, outline: 'none' }} placeholder="0" />
                                    <button onClick={() => handleTip(match.id, activeComp)} disabled={saving === match.id} style={{ padding: '7px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700, color: '#fff', background: saved === match.id ? G.green : 'linear-gradient(135deg, #1a237e, #3d5afe)', opacity: saving === match.id ? 0.5 : 1, flexShrink: 0 }}>
                                      {saved === match.id ? '✓' : tip ? '↺' : 'Tippen'}
                                    </button>
                                    {tip && !kickoffPassed && <button onClick={() => handleDeleteTip(match.id, activeComp)} style={{ fontSize: 13, color: '#ef5350', background: 'none', border: 'none', cursor: 'pointer', padding: '0 4px' }}>×</button>}
                                  </div>
                                  {/* Doppelgewichtung */}
                                  <button
                                    onClick={() => handleDouble(match.id, activeComp === 'uwcl' ? uwclActiveMatchday : activeMatchday, activeComp)}
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
                        <p style={{ margin: '2px 0 0', fontSize: 11, color: G.muted }}>Jeden getippten Spieler: 2 Pkt pro Tor. Spieler nur einmal eintragbar.</p>
                      </div>
                    </div>
                    {(() => {
                      const myDayTips = myStarTips.filter(t => t.matchday === activeMatchday)
                      const dayResults = starResults.filter(r => r.matchday === activeMatchday)
                      return (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                          {/* Bereits eingetragene Spieler */}
                          {myDayTips.map(tip => {
                            const result = dayResults.find(r => r.player_name.toLowerCase() === tip.player_name.toLowerCase())
                            const pts = result ? result.actual_goals * 2 : null
                            return (
                              <div key={tip.player_name} style={{ padding: '10px 14px', borderRadius: 10, background: 'rgba(201,168,76,0.08)', border: '1px solid rgba(201,168,76,0.25)', display: 'flex', alignItems: 'center', gap: 10 }}>
                                <span style={{ fontSize: 16 }}>⭐</span>
                                <span style={{ flex: 1, fontSize: 13, fontWeight: 700, color: '#fff' }}>{tip.player_name}</span>
                                {result !== undefined && (
                                  <span style={{ fontSize: 13, fontWeight: 700, color: pts && pts > 0 ? G.green : G.muted }}>
                                    {result.actual_goals} Tor{result.actual_goals !== 1 ? 'e' : ''} → +{pts ?? 0} Pkt
                                  </span>
                                )}
                                {result === undefined && <span style={{ fontSize: 11, color: G.muted }}>ausstehend</span>}
                              </div>
                            )
                          })}
                          {/* Neuer Spieler eintragen */}
                          <div style={{ display: 'flex', gap: 8 }}>
                            <input value={starPlayer} onChange={e => setStarPlayer(e.target.value)}
                              onKeyDown={e => e.key === 'Enter' && handleStarTip()}
                              placeholder="Spielername…"
                              style={{ flex: 1, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, padding: '9px 12px', color: '#fff', fontSize: 13, outline: 'none' }} />
                            <button onClick={handleStarTip} disabled={starSaving || !starPlayer.trim()}
                              style={{ padding: '9px 18px', borderRadius: 10, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 13, background: `linear-gradient(135deg, #c9a84c, #e8c96a)`, color: '#05081a', opacity: starSaving || !starPlayer.trim() ? 0.5 : 1 }}>
                              {starSaving ? '…' : '+'}
                            </button>
                          </div>
                          {starMsg && <p style={{ margin: 0, fontSize: 12, color: starMsg.type === 'ok' ? G.green : '#ef5350', fontWeight: 600 }}>{starMsg.text}</p>}
                        </div>
                      )
                    })()}
                  </div>
                )}

                {/* Einreichen */}
                {(user || gastNameSet) && weekHottakeCount < 3 && (
                  <div style={{ ...G.card, padding: '20px', marginBottom: 20 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                      <span style={{ fontSize: 20 }}>🔥</span>
                      <div>
                        <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#fff' }}>Hottake einreichen</p>
                        <p style={{ margin: 0, fontSize: 11, color: G.muted }}>{3 - weekHottakeCount} von 3 verbleibend diese Woche (Reset freitags)</p>
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
                {(() => {
                  const hardnessColors = ['', '#ffd54f', '#ff8a65', '#ef5350']
                  const hardnessLabels = ['', 'Lauwarm 🌡', 'Heiß 🔥', 'Höllisch ☠️']
                  const hardnessPts = ['', '4 Pkt', '8 Pkt', '12 Pkt']

                  // Hilfsfunktion: Spieltag für einen Hottake anhand von valid_until ermitteln.
                  // Wir suchen den Spieltag, dessen letztes Spiel-Kickoff am nächsten NACH oder gleich valid_until liegt.
                  // Fallback: letzter Spieltag.
                  const allMatchesForHottake = [...matches, ...uwclMatches]
                  const matchdays = [...new Set(allMatchesForHottake.map(m => m.matchday))].sort((a, b) => a - b)
                  function getMatchdayForHottake(validUntil: string): number {
                    const d = new Date(validUntil.replace(/Z$/, '')).getTime()
                    // Erstes Kickoff pro Spieltag — Hottake gehört zum Spieltag, der kurz danach beginnt
                    const firstKickoff: Record<number, number> = {}
                    for (const m of allMatchesForHottake) {
                      const t = new Date(m.kickoff.replace(/Z$/, '')).getTime()
                      if (!firstKickoff[m.matchday] || t < firstKickoff[m.matchday]) firstKickoff[m.matchday] = t
                    }
                    for (const md of matchdays) {
                      if (firstKickoff[md] > d) return md - 1 > 0 ? md - 1 : md
                    }
                    return matchdays[matchdays.length - 1] ?? 1
                  }

                  const renderHottakeCard = (h: Hottake, showAuthor: boolean) => {
                    const expired = new Date(h.valid_until) < new Date()
                    const author = h.username || h.gast_name || '?'
                    const borderColor = h.fulfilled === true
                      ? 'rgba(76,175,80,0.35)'
                      : h.fulfilled === false
                      ? 'rgba(239,83,80,0.35)'
                      : h.status === 'accepted'
                      ? 'rgba(76,175,80,0.2)'
                      : h.status === 'rejected'
                      ? 'rgba(239,83,80,0.2)'
                      : undefined
                    return (
                      <div key={h.id} style={{ ...G.card, padding: '14px 18px', marginBottom: 8, borderColor }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                          <div style={{ flex: 1 }}>
                            {showAuthor && (
                              <span style={{ fontSize: 11, fontWeight: 700, color: G.blueLight, display: 'block', marginBottom: 4 }}>{author}</span>
                            )}
                            <p style={{ margin: '0 0 6px', fontSize: 14, color: '#fff', lineHeight: 1.5 }}>{h.content}</p>
                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' as const, alignItems: 'center' }}>
                              <span style={{ fontSize: 10, color: G.muted }}>
                                bis {new Date(h.valid_until).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })}
                                {expired ? ' · abgelaufen' : ''}
                              </span>
                              {h.status === 'pending' && <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 20, background: 'rgba(255,213,79,0.15)', color: '#ffd54f', fontWeight: 600 }}>Ausstehend</span>}
                              {h.status === 'accepted' && h.fulfilled === null && <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 20, background: 'rgba(76,175,80,0.15)', color: G.green, fontWeight: 600 }}>Angenommen ✓</span>}
                              {h.status === 'rejected' && <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 20, background: 'rgba(239,83,80,0.15)', color: '#ef5350', fontWeight: 600 }}>Abgelehnt</span>}
                              {h.fulfilled === true && <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 20, background: 'rgba(76,175,80,0.2)', color: G.green, fontWeight: 700 }}>✅ Erfüllt</span>}
                              {h.fulfilled === false && <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 20, background: 'rgba(239,83,80,0.2)', color: '#ef5350', fontWeight: 700 }}>❌ Nicht erfüllt</span>}
                              {h.hardness && (
                                <span style={{ fontSize: 10, fontWeight: 700, color: hardnessColors[h.hardness] }}>
                                  {hardnessLabels[h.hardness]} · {hardnessPts[h.hardness]}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  }

                  return (
                    <>
                      {/* Meine Hottakes */}
                      {myHottakes.length > 0 && (
                        <div style={{ marginBottom: 24 }}>
                          <p style={{ fontSize: 11, fontWeight: 700, color: G.muted, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>Meine Hottakes</p>
                          {myHottakes.map(h => renderHottakeCard(h, false))}
                        </div>
                      )}

                      {/* Öffentliche Hottakes — Spieltag-Tabs */}
                      <p style={{ fontSize: 11, fontWeight: 700, color: G.muted, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>Abgelaufene Takes</p>
                      {publicHottakes.length === 0 ? (
                        <div style={{ ...G.card, padding: '40px 20px', textAlign: 'center', color: G.muted, fontSize: 13 }}>Noch keine abgelaufenen Hottakes.</div>
                      ) : (() => {
                        const byMatchday: Record<number, Hottake[]> = {}
                        for (const h of publicHottakes) {
                          const md = getMatchdayForHottake(h.valid_until)
                          if (!byMatchday[md]) byMatchday[md] = []
                          byMatchday[md].push(h)
                        }
                        const sortedMds = Object.keys(byMatchday).map(Number).sort((a, b) => b - a)
                        return (
                          <div>
                            {/* Spieltag-Tabs */}
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' as const, marginBottom: 14 }}>
                              {sortedMds.map(md => {
                                const isActive = md === hottakeMatchday
                                const fulfilled = byMatchday[md].filter(h => h.fulfilled === true).length
                                const total = byMatchday[md].length
                                return (
                                  <button key={md} onClick={() => setHottakeMatchday(md)}
                                    style={{ padding: '6px 14px', borderRadius: 20, border: `1px solid ${isActive ? G.gold : 'rgba(255,255,255,0.1)'}`, background: isActive ? 'rgba(201,168,76,0.15)' : 'rgba(255,255,255,0.03)', cursor: 'pointer', display: 'flex', flexDirection: 'column' as const, alignItems: 'center', gap: 1 }}>
                                    <span style={{ fontSize: 11, fontWeight: 700, color: isActive ? G.gold : G.muted }}>ST {md}</span>
                                    <span style={{ fontSize: 9, color: fulfilled > 0 ? G.green : G.muted }}>{fulfilled}/{total} ✓</span>
                                  </button>
                                )
                              })}
                            </div>
                            {/* Karten des aktiven Spieltags */}
                            {byMatchday[hottakeMatchday]
                              ? byMatchday[hottakeMatchday].map(h => renderHottakeCard(h, true))
                              : byMatchday[sortedMds[0]].map(h => renderHottakeCard(h, true))
                            }
                          </div>
                        )
                      })()}
                    </>
                  )
                })()}
              </div>
            )}

            {tab === 'leaderboard' && (() => {
              const previewEntry = hoveredEntry
              const previewTip = previewEntry
                ? tableTips.find(t => (t.gast_name || t.username || t.user_id) === previewEntry.name)
                : null
              const sortedTable = [...table].sort((a, b) => a.position - b.position)

              function zoneColor(pos: number) {
                if (pos <= 8) return G.green
                if (pos <= 24) return G.blue
                return '#a855f7'
              }

              return (
              <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                {/* Leaderboard links */}
                <div style={{ flex: '0 0 auto', width: 560 }}>
                  <div style={{ ...G.card, overflow: 'hidden' }}>
                    <div style={{ ...G.cardHeader }}>
                      <p style={{ fontWeight: 700, color: G.gold, margin: 0 }}>Gesamtleaderboard</p>
                      <p style={{ fontSize: 11, color: G.muted, margin: '2px 0 0' }}>Spieltipps + Tabellentipp (Zwischenstand)</p>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '40px 32px 1fr 70px 70px 80px', padding: '8px 20px', background: 'rgba(0,0,0,0.2)', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: G.muted, gap: 8 }}>
                      <span>#</span><span></span><span>Name</span><span style={{ textAlign: 'center' }}>Spiele</span><span style={{ textAlign: 'center' }}>Tabelle</span><span style={{ textAlign: 'right' }}>Gesamt</span>
                    </div>
                    {leaderboard.length === 0 ? (
                      <div style={{ padding: '60px 20px', textAlign: 'center', color: G.muted, fontSize: 14 }}>Noch keine Tipps abgegeben.</div>
                    ) : leaderboard.map((e, i) => (
                      <div key={e.name}
                        onClick={() => setDetailEntry(e)}
                        onMouseEnter={() => setHoveredEntry(e)}
                        onMouseLeave={() => setHoveredEntry(null)}
                        style={{ display: 'grid', gridTemplateColumns: '40px 32px 1fr 70px 70px 80px', alignItems: 'center', gap: 8, padding: '12px 20px', borderBottom: '1px solid rgba(255,255,255,0.04)', background: hoveredEntry?.name === e.name ? 'rgba(255,255,255,0.06)' : i === 0 ? 'rgba(201,168,76,0.05)' : undefined, cursor: 'pointer', transition: 'background 0.08s' }}>
                        <div style={{ width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, background: i === 0 ? 'linear-gradient(135deg, #c9a84c, #e8c96a)' : i === 1 ? 'rgba(255,255,255,0.15)' : i === 2 ? 'rgba(205,127,50,0.35)' : 'rgba(255,255,255,0.06)', color: i < 3 ? '#05081a' : G.muted }}>{i + 1}</div>
                        <PlayerAvatar name={e.name} mcOrUrl={e.minecraft_username} size={32} />
                        <div><span style={{ fontWeight: 500, color: '#fff', fontSize: 14 }}>{e.name}</span></div>
                        <span style={{ textAlign: 'center', fontSize: 13, color: G.muted }}>{e.matchPoints}</span>
                        <span style={{ textAlign: 'center', fontSize: 13, color: G.muted }}>{e.tablePoints}</span>
                        <span style={{ textAlign: 'right', fontSize: 18, fontWeight: 800, color: G.gold }}>{e.total}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Tabellen-Preview rechts — sticky */}
                <div style={{ flex: 1, minWidth: 180, maxWidth: 260, position: 'sticky', top: 20 }}>
                  <div style={{ ...G.card, overflow: 'hidden', transition: 'opacity 0.12s', opacity: previewTip ? 1 : 0.35 }}>
                    <div style={{ padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                      <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: G.gold }}>
                        {previewEntry ? previewEntry.name : '— Hover für Tabellentipp'}
                      </p>
                      {previewEntry && <p style={{ margin: '2px 0 0', fontSize: 10, color: G.muted }}>{previewEntry.tablePoints} Tabellenpunkte</p>}
                    </div>
                    {!previewTip ? (
                      <div style={{ padding: '20px 14px', textAlign: 'center', fontSize: 11, color: G.muted }}>
                        {previewEntry ? 'Kein Tabellentipp abgegeben' : 'Über einen Tipper hovern'}
                      </div>
                    ) : (() => {
                      const tipResult = calcTableTipPoints(previewTip.ranking, sortedTable)
                      return (
                        <div style={{ padding: '6px 0' }}>
                          {previewTip.ranking.map((clubId, tipPos) => {
                            const club = clubMap[clubId]
                            const actualRow = sortedTable.find(r => r.club_id === clubId)
                            const actualPos = actualRow?.position ?? null
                            const detail = tipResult.perClub[clubId]
                            const isExact = detail?.exactPos
                            const inSection = detail?.inSection && !isExact
                            const wrong = !detail?.inSection
                            const color = isExact ? G.green : inSection ? G.gold : wrong && actualPos !== null ? '#ef5350' : G.muted
                            return (
                              <div key={clubId} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 14px', transition: 'background 0.08s' }}>
                                <span style={{ fontSize: 10, fontWeight: 700, color, minWidth: 18, textAlign: 'right' }}>{tipPos + 1}.</span>
                                <ClubLogo club={club} size="sm" />
                                <span style={{ fontSize: 11, color: '#fff', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{club?.short ?? clubId}</span>
                                {actualPos !== null && (
                                  <span style={{ fontSize: 10, color, fontWeight: 700, minWidth: 20, textAlign: 'right' }}>
                                    {isExact ? '✓' : actualPos !== null ? `→${actualPos}` : ''}
                                  </span>
                                )}
                              </div>
                            )
                          })}
                          <div style={{ padding: '8px 14px', marginTop: 4, borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                            {[{ label: '✓ Exakt', color: G.green }, { label: '≈ Segment', color: G.gold }, { label: '✗ Falsch', color: '#ef5350' }].map(({ label, color }) => (
                              <span key={label} style={{ fontSize: 9, color }}>{label}</span>
                            ))}
                          </div>
                        </div>
                      )
                    })()}
                  </div>
                </div>
              </div>
              )
            })()}
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
          uwclMatches={uwclMatches}
          uwclClubs={uwclClubs}
          reloadUwclTable={reloadUwclTable}
          setUwclMatches={setUwclMatches}
        />
      )}

      {/* Leaderboard-Detailmodal */}
      {detailEntry && (
        <LeaderboardDetailModal entry={detailEntry} onClose={() => setDetailEntry(null)} />
      )}
    </div>
  )
}