'use client'

import React, { useState, useEffect } from 'react'
import UCLTableTip from './components/UCLTableTip'
import { useAuth } from '../lib/auth-context'
import Link from 'next/link'

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
type TableRow = { club_id: string; played: number; won: number; drawn: number; lost: number; goals_for: number; goals_against: number; points: number }
type Tip = { id: string; match_id: string; user_id: string | null; gast_name: string | null; tip_home: number; tip_away: number }
type LeaderboardEntry = { name: string; points: number; exact: number; tendency: number }
type Tab = 'tabelle' | 'spiele' | 'ko' | 'leaderboard'

function getTipPoints(tip: Tip, match: Match): number {
  if (match.result_home === null || match.result_away === null) return 0
  if (tip.tip_home === match.result_home && tip.tip_away === match.result_away) return 5
  if (tip.tip_home - tip.tip_away === match.result_home - match.result_away) return 3
  if (Math.sign(tip.tip_home - tip.tip_away) === Math.sign(match.result_home - match.result_away)) return 2
  return 0
}

function getLeaderboard(tips: Tip[], matches: Match[]): LeaderboardEntry[] {
  const map: Record<string, LeaderboardEntry> = {}
  const matchMap = Object.fromEntries(matches.map(m => [m.id, m]))
  for (const tip of tips) {
    const key = tip.gast_name || tip.user_id || '?'
    if (!map[key]) map[key] = { name: key, points: 0, exact: 0, tendency: 0 }
    const m = matchMap[tip.match_id]
    if (!m) continue
    const pts = getTipPoints(tip, m)
    map[key].points += pts
    if (pts === 5) map[key].exact++
    else if (pts >= 2) map[key].tendency++
  }
  return Object.values(map).sort((a, b) => b.points - a.points || b.exact - a.exact)
}

function ClubLogo({ club, size = 'sm' }: { club: Club | undefined; size?: 'sm' | 'md' | 'lg' }) {
  const [err, setErr] = React.useState(false)
  const px = size === 'lg' ? 40 : size === 'md' ? 28 : 20
  const dim = { width: px, height: px, flexShrink: 0 }
  if (!club) return <div style={{ ...dim, borderRadius: '50%', background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, color: G.muted }}>?</div>
  if (club.logo_url && !err) return <img src={club.logo_url} alt={club.short} style={{ ...dim, objectFit: 'contain' }} onError={() => setErr(true)} />
  return <div style={{ ...dim, borderRadius: '50%', background: 'linear-gradient(135deg, #1a237e, #3d5afe)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size === 'lg' ? 10 : 8, color: '#fff', fontWeight: 700 }}>{club.short.slice(0, 3)}</div>
}

export default function UCL2627Page() {
  const { user } = useAuth()
  const [tab, setTab] = useState<Tab>('tabelle')
  const [clubs, setClubs] = useState<Club[]>([])
  const [matches, setMatches] = useState<Match[]>([])
  const [table, setTable] = useState<TableRow[]>([])
  const [tips, setTips] = useState<Tip[]>([])
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [tableTipDone, setTableTipDone] = useState(false)
  const [gastName, setGastName] = useState('')
  const [gastNameSet, setGastNameSet] = useState(false)
  const [inputs, setInputs] = useState<Record<string, [string, string]>>({})
  const [saving, setSaving] = useState<string | null>(null)
  const [saved, setSaved] = useState<string | null>(null)
  const [activeMatchday, setActiveMatchday] = useState(1)
  const [collapsedZones, setCollapsedZones] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [existingTableTip, setExistingTableTip] = useState<string[] | null>(null)

  const toggleZone = (zone: string) => setCollapsedZones(prev => { const n = new Set(prev); n.has(zone) ? n.delete(zone) : n.add(zone); return n })

  // LocalStorage
  useEffect(() => {
    const n = localStorage.getItem('ucl_gast_name')
    if (n) { setGastName(n); setGastNameSet(true) }
  }, [])

  // tableTipDone pro User prüfen
  useEffect(() => {
    if (!user && !gastNameSet) return
    const key = `ucl_table_tip_done_${user?.id || gastName}`
    const done = localStorage.getItem(key)
    if (done) setTableTipDone(true)
    else setTableTipDone(false)
  }, [user, gastNameSet, gastName])

  // API: Clubs + Matches laden
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
        setTable(newClubs.map((c: Club) => ({
          club_id: c.id, played: 0, won: 0, drawn: 0, lost: 0, goals_for: 0, goals_against: 0, points: 0,
        })))
        setMatches(newMatches)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  // Bestehenden Tabellen-Tipp laden
  useEffect(() => {
    if (!gastNameSet && !user) return
    const params = user ? '' : `?gast_name=${encodeURIComponent(gastName)}`
    fetch(`/api/ucl2627/table-tip${params}`)
      .then(r => r.json())
      .then(d => {
        if (d.tip?.ranking && Array.isArray(d.tip.ranking)) {
          setExistingTableTip(d.tip.ranking)
          setTableTipDone(true)
          localStorage.setItem(`ucl_table_tip_done_${user?.id || gastName}`, '1')
        } else {
          setExistingTableTip(null)
        }
      })
      .catch(console.error)
  }, [user, gastNameSet, gastName])

  // Match-Tips laden
  useEffect(() => {
    if (!gastNameSet && !user) return
    const params = user ? '' : `?gast_name=${encodeURIComponent(gastName)}`
    fetch(`/api/ucl2627/match-tips${params}`)
      .then(r => r.json())
      .then(d => {
        if (d.tips) setTips(d.tips.map((t: any) => ({
          id: String(t.id),
          match_id: t.match_id,
          user_id: t.user_id || null,
          gast_name: t.gast_name || null,
          tip_home: t.tip_home,
          tip_away: t.tip_away,
        })))
      })
      .catch(console.error)
  }, [user, gastNameSet, gastName])

  // Tabelle von API laden
  useEffect(() => {
    fetch('/api/ucl2627/table')
      .then(r => r.json())
      .then(d => { if (d.table && d.table.length > 0) setTable(d.table) })
      .catch(console.error)
  }, [matches])

  // Leaderboard updaten
  useEffect(() => { setLeaderboard(getLeaderboard(tips, matches)) }, [tips, matches])

  const clubMap = Object.fromEntries(clubs.map(c => [c.id, c]))
  const myTip = (mid: string) => tips.find(t => t.match_id === mid && (user ? t.user_id === user.id : t.gast_name === gastName))

  const handleTip = async (matchId: string) => {
    const [h, a] = inputs[matchId] || ['', '']
    if (h === '' || a === '' || (!user && !gastNameSet)) return
    setSaving(matchId)
    try {
      const body: any = { match_id: matchId, tip_home: parseInt(h), tip_away: parseInt(a) }
      if (!user) body.gast_name = gastName
      const res = await fetch('/api/ucl2627/match-tips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) {
        console.error('Tipp Fehler:', data.error)
        setSaving(null)
        return
      }
      const fake: Tip = { id: `t_${matchId}`, match_id: matchId, user_id: user?.id || null, gast_name: !user ? gastName : null, tip_home: parseInt(h), tip_away: parseInt(a) }
      setTips(prev => [...prev.filter(t => !(t.match_id === matchId && (user ? t.user_id === user.id : t.gast_name === gastName))), fake])
      setSaved(matchId); setTimeout(() => setSaved(null), 2000)
    } catch (e) {
      console.error('Tipp Error:', e)
    }
    setSaving(null)
  }

  const handleDeleteTip = async (matchId: string) => {
    const body: any = { match_id: matchId }
    if (!user) body.gast_name = gastName
    await fetch('/api/ucl2627/match-tips', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    setTips(prev => prev.filter(t => !(t.match_id === matchId && (user ? t.user_id === user.id : t.gast_name === gastName))))
    setInputs(prev => ({ ...prev, [matchId]: ['', ''] }))
  }

  const myTips = tips.filter(t => user ? t.user_id === user.id : t.gast_name === gastName)
  const myPoints = myTips.reduce((s, t) => { const m = matches.find(x => x.id === t.match_id); return s + (m ? getTipPoints(t, m) : 0) }, 0)
  const myRank = leaderboard.findIndex(e => e.name === (user?.username || gastName)) + 1

  const sortedTable = [...table].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points
    const da = a.goals_for - a.goals_against, db = b.goals_for - b.goals_against
    return db !== da ? db - da : b.goals_for - a.goals_for
  })

  function rowZone(pos: number) {
    if (pos <= 8)  return { border: G.green,  bg: 'rgba(76,175,80,0.07)' }
    if (pos <= 24) return { border: G.blue,   bg: 'rgba(61,90,254,0.05)' }
    return              { border: G.purple, bg: 'rgba(156,39,176,0.05)' }
  }

  const tableTipLabel = localStorage.getItem(`ucl_table_tip_done_${user?.id || gastName}`) ? 'Tipp bearbeiten' : 'Tipp abgeben'

  return (
    <div style={{ minHeight: '100vh', position: 'relative' }}>
      {/* Onboarding */}
      {!tableTipDone && clubs.length > 0 && (
        <UCLTableTip
          initialRanking={existingTableTip || undefined}
          clubs={clubs}
          matches={matches}
          canSkip={true}
          onSkip={() => { localStorage.setItem(`ucl_table_tip_done_${user?.id || gastName}`, 'skip'); setTableTipDone(true) }}
          onSubmit={async (ranking) => {
            const body: any = { ranking }
            if (!user) body.gast_name = gastName
            await fetch('/api/ucl2627/table-tip', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(body),
            })
            localStorage.setItem(`ucl_table_tip_done_${user?.id || gastName}`, '1')
            localStorage.setItem(`ucl_table_tip_${user?.id || gastName}`, JSON.stringify(ranking))
            setTableTipDone(true)
          }}
        />
      )}

      {/* Hintergrundbild */}
      <div style={{ position: 'fixed', inset: 0, zIndex: -2, backgroundImage: 'url(/ucl-bg.png)', backgroundSize: '150%', backgroundPosition: 'center center', backgroundRepeat: 'no-repeat', filter: 'brightness(0.55) saturate(1.4) blur(8px)' }} />
      <div style={{ position: 'fixed', inset: 0, zIndex: -1, background: 'linear-gradient(160deg, rgba(0,8,40,0.62) 0%, rgba(0,4,25,0.42) 50%, rgba(0,12,50,0.68) 100%)' }} />

      {/* Orbs + Ball */}
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
              </div>
              {(user || gastNameSet) && (
                <div style={{ marginLeft: 'auto', display: 'flex', gap: 10 }}>
                  {[
                    { label: 'Tipps', value: `${myTips.length}/${matches.length}` },
                    { label: 'Punkte', value: myPoints, accent: true },
                    { label: 'Rang', value: myRank ? `#${myRank}` : '—' },
                  ].map(s => (
                    <div key={s.label} style={{ ...G.card, textAlign: 'center', padding: '12px 16px', minWidth: 64 }}>
                      <p style={{ fontSize: 20, fontWeight: 700, color: s.accent ? G.gold : '#fff', margin: 0 }}>{s.value}</p>
                      <p style={{ fontSize: 11, color: G.muted, marginTop: 2 }}>{s.label}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div style={{ maxWidth: 1260, margin: '0 auto', padding: '0 24px' }}>

          {/* Gastname */}
          {!user && !gastNameSet && (
            <div style={{ margin: '24px 0 0', ...G.card, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 16, borderColor: 'rgba(201,168,76,0.25)' }}>
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(201,168,76,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill={G.gold}><path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z"/></svg>
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: G.gold, margin: 0 }}>Nicht eingeloggt</p>
                <p style={{ fontSize: 12, color: G.muted, margin: '2px 0 0' }}>Gib einen Namen ein oder <Link href="/login" style={{ color: G.blueLight }}>logge dich ein</Link>.</p>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <input value={gastName} onChange={e => setGastName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && gastName.trim()) { localStorage.setItem('ucl_gast_name', gastName.trim()); setGastNameSet(true) } }}
                  placeholder="Dein Name"
                  style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, padding: '8px 12px', color: '#fff', fontSize: 13, outline: 'none', width: 140 }} />
                <button onClick={() => { if (!gastName.trim()) return; localStorage.setItem('ucl_gast_name', gastName.trim()); setGastNameSet(true) }}
                  style={{ background: 'linear-gradient(135deg, #1a237e, #3d5afe)', color: '#fff', border: 'none', borderRadius: 10, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Los</button>
              </div>
            </div>
          )}

          {/* Tabs */}
          <div style={{ padding: '24px 0 0', display: 'flex', gap: 4 }}>
            {([
              { key: 'tabelle',     label: 'Tabelle' },
              { key: 'spiele',      label: 'Spiele' },
              { key: 'ko',          label: 'K.O.-Phase' },
              { key: 'leaderboard', label: 'Leaderboard' },
            ] as { key: Tab; label: string }[]).map(t => (
              <button key={t.key} onClick={() => setTab(t.key)}
                style={{ padding: '10px 20px', borderRadius: 12, fontSize: 13, fontWeight: 600, cursor: 'pointer', border: 'none', transition: 'all 0.2s', background: tab === t.key ? 'linear-gradient(135deg, rgba(201,168,76,0.25), rgba(61,90,254,0.2))' : 'rgba(255,255,255,0.04)', color: tab === t.key ? G.gold : G.muted, boxShadow: tab === t.key ? '0 0 16px rgba(201,168,76,0.15), inset 0 0 0 1px rgba(201,168,76,0.3)' : 'inset 0 0 0 1px rgba(255,255,255,0.06)', backdropFilter: 'blur(8px)' }}>
                {t.label}
              </button>
            ))}
          </div>

          <div style={{ padding: '20px 0 80px', position: 'relative' }}>

            {/* TABELLE */}
            {tab === 'tabelle' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 20, alignItems: 'start' }}>
                <div>
                  {/* CTA */}
                  <div style={{ ...G.cardStrong, padding: '16px 20px', marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
                    <p style={{ fontWeight: 700, color: '#fff', margin: 0, fontSize: 14 }}>Tabellenvorhersage</p>
                    <button onClick={() => {
                      const saved = localStorage.getItem(`ucl_table_tip_${user?.id || gastName}`)
                      if (saved) setExistingTableTip(JSON.parse(saved))
                      localStorage.removeItem(`ucl_table_tip_done_${user?.id || gastName}`)
                      setTableTipDone(false)
                    }}
                      style={{ background: 'linear-gradient(135deg, #c9a84c, #e8c96a)', color: '#05081a', border: 'none', borderRadius: 10, padding: '10px 18px', fontSize: 13, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}>
                      {tableTipLabel}
                    </button>
                  </div>

                  {/* Tabelle */}
                  <div style={{ ...G.card, overflow: 'hidden' }}>
                    <div style={{ ...G.cardHeader, display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: G.gold }}>Ligaphase – Tabelle</span>
                      <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: 'rgba(76,175,80,0.2)', color: '#4caf50', fontWeight: 600 }}>Live</span>
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
                            return (
                              <div key={row.club_id} style={{ display: 'grid', gridTemplateColumns: '24px 32px 1fr 40px 28px 28px 28px 58px 44px 44px', padding: '11px 18px', alignItems: 'center', gap: 2, background: bg, borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                                <div />
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
                        { pts: '2 Pkt.', label: 'Richtiger Sieger / Unentschieden', color: '#ffd54f' },
                        { pts: '3 Pkt.', label: 'Richtige Tordifferenz', color: '#ff8a65' },
                        { pts: '5 Pkt.', label: 'Richtiges Ergebnis (exakt)', color: G.green },
                      ].map(r => (
                        <div key={r.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)' }}>{r.label}</span>
                          <span style={{ fontSize: 13, fontWeight: 800, color: r.color, flexShrink: 0 }}>{r.pts}</span>
                        </div>
                      ))}
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
                      <div key={e.name} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 20px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                        <div style={{ width: 24, height: 24, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0, background: i === 0 ? 'linear-gradient(135deg, #c9a84c, #e8c96a)' : i === 1 ? 'rgba(255,255,255,0.15)' : i === 2 ? 'rgba(205,127,50,0.4)' : 'rgba(255,255,255,0.06)', color: i < 3 ? '#05081a' : G.muted }}>{i + 1}</div>
                        <span style={{ flex: 1, fontSize: 13, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.name}</span>
                        <span style={{ fontSize: 11, color: G.muted }}>{e.exact}×</span>
                        <span style={{ fontSize: 14, fontWeight: 700, color: G.gold }}>{e.points}</span>
                      </div>
                    ))}
                  </div>

                  <div style={{ ...G.card, overflow: 'hidden' }}>
                    <div style={{ ...G.cardHeader }}>
                      <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: G.gold }}>Notizen</span>
                    </div>
                    <div style={{ padding: '14px 20px' }}>
                      <textarea placeholder="Persönliche Notizen (lokal gespeichert)..." style={{ width: '100%', minHeight: 80, background: 'transparent', border: 'none', outline: 'none', resize: 'none', color: '#fff', fontSize: 13, lineHeight: 1.5 }} />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* SPIELE */}
            {tab === 'spiele' && (
              <div>
                {/* Spieltag-Auswahl */}
                <div style={{ display: 'flex', gap: 6, marginBottom: 24, flexWrap: 'wrap' }}>
                  {[1,2,3,4,5,6,7,8].map(day => {
                    const dayMatches = matches.filter(m => m.matchday === day)
                    const tipped = dayMatches.filter(m => myTip(m.id)).length
                    const isPast = dayMatches.length > 0 && dayMatches.every(m => new Date(m.kickoff) <= new Date())
                    return (
                      <button key={day} onClick={() => setActiveMatchday(day)} style={{
                        padding: '10px 16px', borderRadius: 12, fontSize: 13, fontWeight: 600, cursor: 'pointer', border: 'none', transition: 'all 0.2s',
                        background: activeMatchday === day ? 'linear-gradient(135deg, #1a237e, #3d5afe)' : 'rgba(255,255,255,0.06)',
                        color: activeMatchday === day ? '#fff' : G.muted,
                        boxShadow: activeMatchday === day ? '0 0 16px rgba(61,90,254,0.4)' : 'none',
                        position: 'relative' as const,
                      }}>
                        <div>Spieltag {day}</div>
                        <div style={{ fontSize: 10, color: activeMatchday === day ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.3)', marginTop: 2 }}>
                          {isPast ? 'Beendet' : `${tipped}/${dayMatches.length} getippt`}
                        </div>
                      </button>
                    )
                  })}
                </div>

                {/* Spiele Grid */}
                {(() => {
                  const dayMatches = matches.filter(m => m.matchday === activeMatchday)
                  // Gruppiere nach Datum
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
                          const tip = myTip(match.id)
                          const [h, a] = inputs[match.id] || ['', '']
                          const kickoffPassed = new Date(match.kickoff) <= new Date()
                          const hasResult = match.result_home !== null && match.result_away !== null
                          const pts = tip && hasResult ? getTipPoints(tip, match) : null
                          const soon = !kickoffPassed && new Date(match.kickoff).getTime() - Date.now() < 3_600_000
                          const uhrzeit = new Date(match.kickoff).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' })

                          return (
                            <div key={match.id} style={{
                              ...G.card,
                              padding: '16px',
                              borderColor: soon && !tip ? 'rgba(239,83,80,0.35)' : tip ? 'rgba(61,90,254,0.3)' : undefined,
                              display: 'flex', flexDirection: 'column', gap: 12,
                            }}>
                              {/* Uhrzeit + Status */}
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <span style={{ fontSize: 11, color: soon ? '#ef5350' : G.muted, fontWeight: 600 }}>
                                  {uhrzeit} Uhr{soon && !tip ? ' !' : ''}
                                </span>
                                {tip && pts === null && (
                                  <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, background: 'rgba(61,90,254,0.2)', color: G.blueLight, fontWeight: 600 }}>
                                    {tip.tip_home}:{tip.tip_away}
                                  </span>
                                )}
                                {pts !== null && (
                                  <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, fontWeight: 700, background: pts === 5 ? 'rgba(76,175,80,0.2)' : pts >= 2 ? 'rgba(255,213,79,0.2)' : 'rgba(239,83,80,0.2)', color: pts === 5 ? G.green : pts >= 2 ? '#ffd54f' : '#ef5350' }}>
                                    +{pts} Pkt
                                  </span>
                                )}
                              </div>

                              {/* Teams */}
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                {/* Heim */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                  <ClubLogo club={home} size="md" />
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: 10, color: G.green, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Heim</div>
                                    <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{home?.name}</div>
                                  </div>
                                  {hasResult && <span style={{ fontSize: 18, fontWeight: 900, color: G.gold, minWidth: 20, textAlign: 'right' }}>{match.result_home}</span>}
                                </div>
                                {/* VS Linie */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                  <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.06)' }} />
                                  <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', fontWeight: 700 }}>VS</span>
                                  <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.06)' }} />
                                  {hasResult && <span style={{ fontSize: 18, fontWeight: 900, color: G.gold, minWidth: 20, textAlign: 'right' }}>:</span>}
                                </div>
                                {/* Auswärts */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                  <ClubLogo club={away} size="md" />
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: 10, color: G.blueLight, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Ausw.</div>
                                    <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{away?.name}</div>
                                  </div>
                                  {hasResult && <span style={{ fontSize: 18, fontWeight: 900, color: G.gold, minWidth: 20, textAlign: 'right' }}>{match.result_away}</span>}
                                </div>
                              </div>

                              {/* Tipp-Input */}
                              {!kickoffPassed && (user || gastNameSet) && (
                                <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 10, display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center' }}>
                                  <input type="number" min="0" value={h}
                                    onChange={e => setInputs(p => ({ ...p, [match.id]: [e.target.value, a] }))}
                                    style={{ width: 44, padding: '7px 4px', textAlign: 'center', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, color: '#fff', fontSize: 15, fontWeight: 700, outline: 'none' }}
                                    placeholder="0" />
                                  <span style={{ color: G.muted, fontSize: 16, fontWeight: 700 }}>:</span>
                                  <input type="number" min="0" value={a}
                                    onChange={e => setInputs(p => ({ ...p, [match.id]: [h, e.target.value] }))}
                                    style={{ width: 44, padding: '7px 4px', textAlign: 'center', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, color: '#fff', fontSize: 15, fontWeight: 700, outline: 'none' }}
                                    placeholder="0" />
                                  <button onClick={() => handleTip(match.id)} disabled={saving === match.id}
                                    style={{ padding: '7px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700, color: '#fff', background: saved === match.id ? G.green : 'linear-gradient(135deg, #1a237e, #3d5afe)', opacity: saving === match.id ? 0.5 : 1, flexShrink: 0 }}>
                                    {saved === match.id ? '✓' : tip ? '↺' : 'Tippen'}
                                  </button>
                                  {tip && !kickoffPassed && (
                                    <button onClick={() => handleDeleteTip(match.id)} style={{ fontSize: 13, color: '#ef5350', background: 'none', border: 'none', cursor: 'pointer', padding: '0 4px' }}>×</button>
                                  )}
                                </div>
                              )}
                              {kickoffPassed && !hasResult && !tip && (
                                <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 8, textAlign: 'center', fontSize: 11, color: G.muted }}>Kein Tipp abgegeben</div>
                              )}
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
                <div style={{ display: 'inline-block', padding: '8px 16px', borderRadius: 10, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', fontSize: 12, color: G.muted }}>
                  Wird nach Abschluss der Ligaphase freigeschaltet
                </div>
              </div>
            )}

            {/* LEADERBOARD */}
            {tab === 'leaderboard' && (
              <div style={{ maxWidth: 600 }}>
                <div style={{ ...G.card, overflow: 'hidden' }}>
                  <div style={{ ...G.cardHeader }}>
                    <p style={{ fontWeight: 700, color: G.gold, margin: 0 }}>Gesamtleaderboard</p>
                    <p style={{ fontSize: 11, color: G.muted, margin: '2px 0 0' }}>Ligaphase + K.O.-Phase</p>
                  </div>
                  {leaderboard.length === 0 ? (
                    <div style={{ padding: '60px 20px', textAlign: 'center', color: G.muted, fontSize: 14 }}>Noch keine Tipps abgegeben.</div>
                  ) : leaderboard.map((e, i) => (
                    <div key={e.name} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,0.04)', background: i === 0 ? 'rgba(201,168,76,0.05)' : undefined }}>
                      <div style={{ width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, flexShrink: 0, background: i === 0 ? 'linear-gradient(135deg, #c9a84c, #e8c96a)' : i === 1 ? 'rgba(255,255,255,0.15)' : i === 2 ? 'rgba(205,127,50,0.35)' : 'rgba(255,255,255,0.06)', color: i < 3 ? '#05081a' : G.muted }}>{i + 1}</div>
                      <span style={{ flex: 1, fontWeight: 500, color: '#fff' }}>{e.name}</span>
                      <span style={{ fontSize: 12, color: G.muted }}>{e.exact} exakt</span>
                      <span style={{ fontSize: 12, color: G.muted }}>{e.tendency} tendenz</span>
                      <span style={{ fontSize: 18, fontWeight: 800, color: G.gold }}>{e.points}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}