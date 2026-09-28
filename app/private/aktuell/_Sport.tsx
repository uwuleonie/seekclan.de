'use client'

// Fußball: Ergebnisse (auch live) und Tabellen – Männer und Frauen, u.a. NWSL, WSL und Liga F.
// Daten über /api/private/sport (ESPN). Lieblingsligen werden im Browser gemerkt.

import { useCallback, useEffect, useState } from 'react'
import Icon from '../_components/Icon'

interface Team { name: string; abbr: string; logo: string | null; score: string | null; winner: boolean }
interface Match { id: string; date: string; state: 'pre' | 'in' | 'post'; detail: string; clock: string; home: Team; away: Team; venue: string | null; round: string | null }
interface Row { rank: number | null; team: string; logo: string | null; played: number | null; won: number | null; draw: number | null; lost: number | null; goalsFor: number | null; goalsAgainst: number | null; diff: number | null; points: number | null }

const LEAGUES: { key: string; name: string; short: string; women?: boolean; cup?: boolean }[] = [
  { key: 'ger.1', name: 'Bundesliga', short: 'BL' },
  { key: 'ger.w.1', name: 'Frauen-Bundesliga', short: 'FBL', women: true },
  { key: 'eng.w.1', name: 'Women’s Super League', short: 'WSL', women: true },
  { key: 'esp.w.1', name: 'Liga F', short: 'Liga F', women: true },
  { key: 'usa.nwsl', name: 'NWSL', short: 'NWSL', women: true },
  { key: 'uefa.wchampions', name: 'Women’s Champions League', short: 'UWCL', women: true, cup: true },
  { key: 'uefa.champions', name: 'Champions League', short: 'UCL', cup: true },
  { key: 'ger.2', name: '2. Bundesliga', short: 'BL2' },
  { key: 'ger.dfb_pokal', name: 'DFB-Pokal', short: 'Pokal', cup: true },
  { key: 'eng.1', name: 'Premier League', short: 'PL' },
  { key: 'esp.1', name: 'LaLiga', short: 'LaLiga' },
  { key: 'ita.1', name: 'Serie A', short: 'Serie A' },
  { key: 'fra.1', name: 'Ligue 1', short: 'Ligue 1' },
]

const FAV_KEY = 'pv-sport-favs'
const pad = (n: number) => String(n).padStart(2, '0')
const ymd = (d: Date) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`

export default function Sport() {
  const [league, setLeague] = useState('ger.1')
  const [view, setView] = useState<'scores' | 'table'>('scores')
  const [offset, setOffset] = useState(0) // Wochen relativ zu heute
  const [matches, setMatches] = useState<Match[] | null>(null)
  const [groups, setGroups] = useState<{ name: string; rows: Row[] }[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [favs, setFavs] = useState<string[]>([])

  useEffect(() => {
    try {
      const f = JSON.parse(localStorage.getItem(FAV_KEY) || '[]') as string[]
      setFavs(f)
      if (f[0]) setLeague(f[0])
    } catch { /* egal */ }
  }, [])

  const range = (() => {
    const start = new Date(); start.setDate(start.getDate() - 3 + offset * 7)
    const end = new Date(start); end.setDate(end.getDate() + 6)
    return { start, end, q: `${ymd(start)}-${ymd(end)}` }
  })()

  const load = useCallback(async () => {
    setError(null)
    try {
      const url = view === 'table' ? `/api/private/sport?league=${league}&type=table` : `/api/private/sport?league=${league}&type=scores&date=${range.q}`
      const r = await fetch(url, { cache: 'no-store' })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(d.error || `Fehler ${r.status}`)
      if (view === 'table') setGroups(d.groups); else setMatches(d.matches)
    } catch (e) { setError((e as Error).message) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [league, view, range.q])

  useEffect(() => { setMatches(null); setGroups(null); load() }, [load])

  // Live-Spiele jede Minute aktualisieren
  const live = matches?.some(m => m.state === 'in')
  useEffect(() => {
    if (!live || view !== 'scores') return
    const iv = setInterval(load, 60_000)
    return () => clearInterval(iv)
  }, [live, view, load])

  function toggleFav(k: string) {
    const next = favs.includes(k) ? favs.filter(x => x !== k) : [...favs, k]
    setFavs(next)
    try { localStorage.setItem(FAV_KEY, JSON.stringify(next)) } catch { /* egal */ }
  }

  const sorted = [...LEAGUES].sort((a, b) => Number(favs.includes(b.key)) - Number(favs.includes(a.key)))
  const L = LEAGUES.find(l => l.key === league)!

  // Spiele nach Tag gruppieren
  const days: { label: string; items: Match[] }[] = []
  for (const m of matches ?? []) {
    const d = new Date(m.date)
    const label = d.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })
    if (!days.length || days[days.length - 1].label !== label) days.push({ label, items: [] })
    days[days.length - 1].items.push(m)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div className="pv-chips">
        {sorted.map(l => (
          <button key={l.key} className={`pv-chip ${league === l.key ? 'active' : ''}`} onClick={() => setLeague(l.key)}>
            {favs.includes(l.key) && <Icon name="star" size={12} />} {l.short}
          </button>
        ))}
      </div>

      <div className="pv-row pv-wrap" style={{ gap: 10 }}>
        <div className="pv-grow" style={{ minWidth: 0 }}>
          <div className="pv-h2 pv-ellipsis">{L.name}</div>
          {L.women && <span className="pv-badge" style={{ marginTop: 2 }}>Frauen</span>}
        </div>
        <button className={`pv-icon-btn ${favs.includes(league) ? 'active' : ''}`} aria-label="Als Lieblingsliga merken" title="Lieblingsliga (steht vorne)" onClick={() => toggleFav(league)}>
          <Icon name="star" size={18} />
        </button>
        <div className="pv-seg">
          <button className={view === 'scores' ? 'active' : ''} onClick={() => setView('scores')}>Spiele</button>
          <button className={view === 'table' ? 'active' : ''} onClick={() => setView('table')} disabled={L.cup && L.key === 'ger.dfb_pokal'}>Tabelle</button>
        </div>
      </div>

      {error && <div className="pv-glass pv-card" style={{ color: 'var(--pv-danger)' }}>{error}</div>}

      {view === 'scores' && (
        <>
          <div className="pv-row" style={{ gap: 8 }}>
            <button className="pv-icon-btn" aria-label="Woche zurück" onClick={() => setOffset(o => o - 1)}><Icon name="back" size={17} /></button>
            <div className="pv-grow" style={{ textAlign: 'center', fontSize: 14, fontWeight: 600 }}>
              {range.start.toLocaleDateString('de-DE', { day: 'numeric', month: 'short' })} – {range.end.toLocaleDateString('de-DE', { day: 'numeric', month: 'short' })}
              {offset !== 0 && <button className="pv-btn sm ghost" style={{ marginLeft: 8 }} onClick={() => setOffset(0)}>Heute</button>}
            </div>
            <button className="pv-icon-btn" aria-label="Woche vor" onClick={() => setOffset(o => o + 1)}><Icon name="next" size={17} /></button>
          </div>
          {matches === null && !error && <div className="pv-center" style={{ padding: 30 }}><div className="pv-spinner" /></div>}
          {matches && matches.length === 0 && <div className="pv-glass pv-empty">In dieser Woche keine Spiele.</div>}
          {days.map(d => (
            <section key={d.label}>
              <p className="pv-eyebrow" style={{ margin: '4px 4px 8px' }}>{d.label}</p>
              <div className="pv-match-list">
                {d.items.map(m => (
                  <div key={m.id} className={`pv-glass pv-match ${m.state}`}>
                    <div className="pv-match-time">
                      {m.state === 'pre'
                        ? new Date(m.date).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
                        : m.state === 'in' ? <span className="pv-live">{m.clock || 'Live'}</span> : 'Ende'}
                    </div>
                    <div className="pv-match-teams">
                      {[m.home, m.away].map((t, i) => (
                        <div key={i} className={`pv-match-team ${m.state === 'post' && t.winner ? 'win' : ''}`}>
                          {t.logo
                            // eslint-disable-next-line @next/next/no-img-element
                            ? <img src={t.logo} alt="" loading="lazy" referrerPolicy="no-referrer" />
                            : <span className="pv-match-nologo" />}
                          <span className="pv-grow pv-ellipsis">{t.name}</span>
                          <b>{m.state === 'pre' ? '' : t.score ?? '–'}</b>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </>
      )}

      {view === 'table' && (
        <>
          {groups === null && !error && <div className="pv-center" style={{ padding: 30 }}><div className="pv-spinner" /></div>}
          {groups && groups.length === 0 && <div className="pv-glass pv-empty">Für diesen Wettbewerb gibt es keine Tabelle.</div>}
          {groups?.map(g => (
            <section key={g.name} className="pv-glass pv-card" style={{ padding: '10px 6px', overflowX: 'auto' }}>
              {groups.length > 1 && <p className="pv-eyebrow" style={{ margin: '4px 10px 6px' }}>{g.name}</p>}
              <table className="pv-table">
                <thead><tr><th>#</th><th style={{ textAlign: 'left' }}>Team</th><th>Sp</th><th className="pv-desktop-only">S</th><th className="pv-desktop-only">U</th><th className="pv-desktop-only">N</th><th>Tore</th><th>Diff</th><th>Pkt</th></tr></thead>
                <tbody>
                  {g.rows.map((r, i) => (
                    <tr key={`${r.team}-${i}`}>
                      <td>{r.rank ?? i + 1}</td>
                      <td style={{ textAlign: 'left' }}>
                        <span className="pv-row" style={{ gap: 8, flexWrap: 'nowrap' }}>
                          {r.logo
                            // eslint-disable-next-line @next/next/no-img-element
                            ? <img src={r.logo} alt="" width={20} height={20} loading="lazy" referrerPolicy="no-referrer" />
                            : null}
                          <span className="pv-ellipsis" style={{ maxWidth: 180 }}>{r.team}</span>
                        </span>
                      </td>
                      <td>{r.played ?? '–'}</td>
                      <td className="pv-desktop-only">{r.won ?? '–'}</td>
                      <td className="pv-desktop-only">{r.draw ?? '–'}</td>
                      <td className="pv-desktop-only">{r.lost ?? '–'}</td>
                      <td>{r.goalsFor ?? '–'}:{r.goalsAgainst ?? '–'}</td>
                      <td>{r.diff !== null && r.diff > 0 ? `+${r.diff}` : r.diff ?? '–'}</td>
                      <td><b>{r.points ?? '–'}</b></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          ))}
        </>
      )}
      <p className="pv-muted" style={{ fontSize: 11.5, textAlign: 'center' }}>Daten: ESPN · Live-Spiele werden jede Minute aktualisiert</p>
    </div>
  )
}