'use client'

// Ranglisten: Geografie-Level (alle Quizzes zusammen) und je Quiz (% entdeckt, Bestzeit).
// Wer nicht erscheinen möchte, blendet sich hier jederzeit aus.

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useGeo } from '../_components/GeoShell'
import Icon from '../_components/Icon'
import { countryName, isBuilt } from '../_lib/catalog'
import { normalize } from '../_lib/text'

type LevelRow = { rank: number; username: string; name?: string; xp: number; level: number; me: boolean }
type PctRow = { rank: number; username: string; name?: string; solved: number; pct: number; me: boolean }
type TimeRow = { rank: number; username: string; name?: string; accuracy: number; seconds: number; mode: string; me: boolean }

const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
const MODE_DE: Record<string, string> = { click: 'Finden', name: 'Zuordnen', type: 'Eintippen', text: 'Wissen', mixed: 'Gemischt' }

export default function RanglistePage() {
  const { loggedIn, profile, setHidden, catalog, status, loaded } = useGeo()
  const [tab, setTab] = useState<'level' | 'quiz'>('level')
  const [levelRows, setLevelRows] = useState<LevelRow[] | null>(null)
  const [off, setOff] = useState(false)
  const [slug, setSlug] = useState<string>('')
  const [q, setQ] = useState('')
  const [quizData, setQuizData] = useState<{ pct: PctRow[]; time: TimeRow[]; total: number } | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    fetch('/api/geo/leaderboard?type=level', { cache: 'no-store' })
      .then(r => r.json())
      .then(d => { setOff(!!d.off); setLevelRows(d.rows ?? []) })
      .catch(() => setLevelRows([]))
  }, [profile?.hidden])

  const quizzes = useMemo(() => catalog.filter(e => isBuilt(e) && status(e).open), [catalog, status])
  const shown = useMemo(() => {
    const n = normalize(q)
    return (n ? quizzes.filter(e => normalize(`${e.title} ${countryName(e.country)}`).includes(n)) : quizzes).slice(0, 40)
  }, [quizzes, q])

  useEffect(() => {
    if (!slug) return
    setQuizData(null)
    fetch(`/api/geo/leaderboard?type=quiz&slug=${encodeURIComponent(slug)}`, { cache: 'no-store' })
      .then(r => r.json())
      .then(d => setQuizData({ pct: d.pct ?? [], time: d.time ?? [], total: d.total ?? 0 }))
      .catch(() => setQuizData({ pct: [], time: [], total: 0 }))
  }, [slug])

  const toggleHidden = async () => {
    if (!profile) return
    setBusy(true)
    await setHidden(!profile.hidden).catch(() => {})
    setBusy(false)
  }

  const current = quizzes.find(e => e.slug === slug)

  return (
    <div className="ga-page" style={{ maxWidth: 980 }}>
      <Link href="/geo" className="ga-btn ghost sm" style={{ marginLeft: -10 }}><Icon name="back" size={15} /> Atlas</Link>
      <p className="ga-eyebrow" style={{ marginTop: 8 }}>Rangliste</p>
      <h1 className="ga-title">Wer kennt die Welt?</h1>
      <p className="ga-lead">Jeder Ort, den du zum ersten Mal richtig hast, bringt XP – je schwerer das Quiz, desto mehr. Dazu Bonus für 25, 50, 75 und 100 % eines Quiz.</p>

      {loggedIn && profile && (
        <div className="ga-card ga-me">
          <div className="ga-me-lvl"><small>Level</small><b>{profile.level.level}</b></div>
          <div className="ga-grow">
            <div className="ga-row" style={{ justifyContent: 'space-between' }}>
              <span><b>{profile.xp.toLocaleString('de-DE')} XP</b> gesamt</span>
              <span className="ga-muted">noch {profile.level.left.toLocaleString('de-DE')} XP bis Level {profile.level.level + 1}</span>
            </div>
            <span className="ga-xp-bar big"><span style={{ width: `${profile.level.pct}%` }} /></span>
          </div>
          <button className="ga-btn sm ghost" onClick={toggleHidden} disabled={busy} title="Du kannst das jederzeit ändern">
            <Icon name="eye" size={14} /> {profile.hidden ? 'Wieder in Ranglisten zeigen' : 'Aus Ranglisten ausblenden'}
          </button>
        </div>
      )}
      {loggedIn && profile?.hidden && <p className="ga-muted" style={{ fontSize: 13 }}>Du bist ausgeblendet – andere sehen dich in keiner Rangliste. Deine XP zählen trotzdem weiter.</p>}
      {!loggedIn && <p className="ga-muted"><Link href="/login" className="ga-link">Einloggen</Link>, um XP zu sammeln und in der Rangliste zu erscheinen.</p>}

      <div className="ga-chips" style={{ margin: '18px 0 14px' }}>
        <button className={`ga-chip ${tab === 'level' ? 'active' : ''}`} onClick={() => setTab('level')}><Icon name="trophy" size={15} /> Level</button>
        <button className={`ga-chip ${tab === 'quiz' ? 'active' : ''}`} onClick={() => setTab('quiz')}><Icon name="timer" size={15} /> Pro Quiz</button>
      </div>

      {off ? <p className="ga-muted">Ranglisten sind gerade ausgeschaltet.</p> : tab === 'level' ? (
        !levelRows ? <div className="ga-map-loading">Lädt …</div> : levelRows.length === 0 ? <p className="ga-muted">Noch niemand hat XP gesammelt.</p> : (
          <div className="ga-card ga-board-table">
            <table>
              <thead><tr><th>#</th><th>Name</th><th>Level</th><th className="r">XP</th></tr></thead>
              <tbody>
                {levelRows.map(r => (
                  <tr key={r.rank} className={r.me ? 'me' : ''}>
                    <td className="rank">{r.rank <= 3 ? <span className={`medal m${r.rank}`}>{r.rank}</span> : r.rank}</td>
                    <td>{r.name ?? r.username}</td>
                    <td>{r.level}</td>
                    <td className="r">{r.xp.toLocaleString('de-DE')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : (
        <>
          <div className="ga-lb-pick">
            <input className="ga-input" value={q} onChange={e => setQ(e.target.value)} placeholder="Quiz suchen, z.B. Bundesländer …" aria-label="Quiz suchen" />
            <div className="ga-chips">
              {!loaded ? <span className="ga-muted">Lädt …</span> : shown.map(e => (
                <button key={e.slug} className={`ga-chip sm ${e.slug === slug ? 'active' : ''}`} onClick={() => setSlug(e.slug)}>{e.title}</button>
              ))}
            </div>
          </div>
          {current && (
            <div className="ga-lb-two">
              <div className="ga-card ga-board-table">
                <p className="ga-eyebrow">% entdeckt · {current.title}</p>
                {!quizData ? <div className="ga-muted">Lädt …</div> : quizData.pct.length === 0 ? <p className="ga-muted">Noch keine Einträge.</p> : (
                  <table>
                    <thead><tr><th>#</th><th>Name</th><th className="r">Geschafft</th></tr></thead>
                    <tbody>
                      {quizData.pct.map(r => (
                        <tr key={r.rank} className={r.me ? 'me' : ''}>
                          <td className="rank">{r.rank}</td><td>{r.name ?? r.username}</td>
                          <td className="r">{r.pct} % <span className="ga-muted">({r.solved}/{quizData.total})</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
              <div className="ga-card ga-board-table">
                <p className="ga-eyebrow">Bestzeit · ganzes Quiz, normal</p>
                {!quizData ? <div className="ga-muted">Lädt …</div> : quizData.time.length === 0 ? <p className="ga-muted">Noch niemand hat das ganze Quiz gespielt.</p> : (
                  <table>
                    <thead><tr><th>#</th><th>Name</th><th>Treffer</th><th className="r">Zeit</th></tr></thead>
                    <tbody>
                      {quizData.time.map(r => (
                        <tr key={r.rank} className={r.me ? 'me' : ''}>
                          <td className="rank">{r.rank}</td><td>{r.name ?? r.username} <span className="ga-muted">· {MODE_DE[r.mode] ?? r.mode}</span></td>
                          <td>{r.accuracy} %</td><td className="r">{fmtTime(r.seconds)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}