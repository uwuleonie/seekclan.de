'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '../lib/auth-context'
import Link from 'next/link'
import { getFlagUrl } from '../lib/flags'

type Game = {
  id: string
  team1: string
  team2: string
  kickoff: string
  gruppe: string | null
  runde: string
  result_team1: number | null
  result_team2: number | null
}

type Tip = {
  id: string
  game_id: string
  user_id: string | null
  gast_name: string | null
  tip_team1: number
  tip_team2: number
}

const RUNDEN = ['Gruppenphase', 'Sechzehntelfinale', 'Achtelfinale', 'Viertelfinale', 'Halbfinale', 'Spiel um Platz 3', 'Finale']

function getPoints(tip: Tip, game: Game): number {
  if (game.result_team1 === null || game.result_team2 === null) return 0
  if (tip.tip_team1 === game.result_team1 && tip.tip_team2 === game.result_team2) return 3
  const tipOutcome = Math.sign(tip.tip_team1 - tip.tip_team2)
  const realOutcome = Math.sign(game.result_team1 - game.result_team2)
  if (tipOutcome === realOutcome) return 1
  return 0
}

function getLeaderboard(tips: Tip[], games: Game[]) {
  const scores: Record<string, { name: string, points: number, correct: number }> = {}
  const gameMap = Object.fromEntries(games.map(g => [g.id, g]))
  for (const tip of tips) {
    const name = tip.gast_name || tip.user_id || ''
    if (!scores[name]) scores[name] = { name, points: 0, correct: 0 }
    const game = gameMap[tip.game_id]
    if (!game) continue
    const pts = getPoints(tip, game)
    scores[name].points += pts
    if (pts === 3) scores[name].correct++
  }
  return Object.values(scores).sort((a, b) => b.points - a.points)
}

function TeamName({ name }: { name: string }) {
  return <>{name.replace(/[\u{1F1E0}-\u{1F1FF}]{2}/gu, '').trim() || '?'}</>
}

function FlagOrUnknown({ name, size = 'sm' }: { name: string, size?: 'sm' | 'lg' }) {
  const flag = getFlagUrl(name)
  const w = size === 'lg' ? 'w-10 h-7' : 'w-7 h-5'
  if (flag) return <img src={flag} alt="" className={`${w} rounded object-cover shadow`} />
  return <span className={size === 'lg' ? 'text-2xl' : 'text-lg'}>❓</span>
}

function NextGameCountdown({ game }: { game: Game }) {
  const [timeLeft, setTimeLeft] = useState('')

  useEffect(() => {
    const update = () => {
      const diff = new Date(game.kickoff).getTime() - Date.now()
      if (diff <= 0) { setTimeLeft('Läuft!'); return }
      const totalSeconds = Math.floor(diff / 1000)
      const d = Math.floor(totalSeconds / 86400)
      const h = Math.floor((totalSeconds % 86400) / 3600)
      const m = Math.floor((totalSeconds % 3600) / 60)
      const s = totalSeconds % 60
      if (d > 0) setTimeLeft(`${d}T ${h}h ${m}m ${s}s`)
      else setTimeLeft(`${h}h ${m}m ${s}s`)
    }
    update()
    const timer = setInterval(update, 1000)
    return () => clearInterval(timer)
  }, [game])

  return (
    <div className="rounded-2xl p-6 mb-8" style={{ background: 'linear-gradient(135deg, #F59E0B, #FBBF24, #FDE68A)', boxShadow: '0 0 32px rgba(251,191,36,0.4)' }}>
      <p className="text-sm font-medium mb-3" style={{ color: '#78350F' }}>⚽ Nächstes Spiel</p>
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <FlagOrUnknown name={game.team1} size="lg" />
          <span className="text-xl font-bold" style={{ color: '#1c1917' }}><TeamName name={game.team1} /></span>
        </div>
        <div className="text-center flex-1">
          <p className="text-xs mb-1" style={{ color: '#78350F' }}>
            {new Date(game.kickoff).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
            {game.gruppe && ` · ${game.gruppe}`}
          </p>
          <p className="text-4xl font-bold tabular-nums" style={{ color: '#1c1917' }}>{timeLeft}</p>
          <p className="text-xs mt-1" style={{ color: '#78350F' }}>{game.runde}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xl font-bold" style={{ color: '#1c1917' }}><TeamName name={game.team2} /></span>
          <FlagOrUnknown name={game.team2} size="lg" />
        </div>
      </div>
    </div>
  )
}

export default function WMTippspielPage() {
  const { user } = useAuth()
  const [games, setGames] = useState<Game[]>([])
  const [tips, setTips] = useState<Tip[]>([])
  const [loading, setLoading] = useState(true)

  const [gastName, setGastName] = useState('')
  const [gastNameSet, setGastNameSet] = useState(false)

  const [inputs, setInputs] = useState<Record<string, [string, string]>>({})
  const [saving, setSaving] = useState<string | null>(null)
  const [saved, setSaved] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)

  const [activeTab, setActiveTab] = useState<'spiele' | 'leaderboard'>('spiele')
  const [tipFilter, setTipFilter] = useState<'alle' | 'offen' | 'getippt'>('alle')
  const [teamFilter, setTeamFilter] = useState<string | null>(null)
  const [showTipsFor, setShowTipsFor] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([
      fetch('/api/wm-games').then(r => r.json()),
      fetch('/api/wm-tips').then(r => r.json()),
    ]).then(([gamesData, tipsData]) => {
      setGames(gamesData.games || [])
      setTips(tipsData.tips || [])
      setLoading(false)
    })
    const savedName = localStorage.getItem('wm_gast_name')
    if (savedName) { setGastName(savedName); setGastNameSet(true) }
  }, [])

  const myTip = (gameId: string): Tip | undefined =>
    tips.find(t => t.game_id === gameId && (user ? t.user_id === user.id : t.gast_name === gastName))

  const handleTip = async (gameId: string) => {
    const [t1, t2] = inputs[gameId] || ['', '']
    if (t1 === '' || t2 === '') return
    if (!user && !gastNameSet) return
    setSaving(gameId)
    const res = await fetch('/api/wm-tips', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        game_id: gameId,
        tip_team1: parseInt(t1),
        tip_team2: parseInt(t2),
        user_id: user?.id || null,
        gast_name: !user ? gastName : null,
      }),
    })
    if (res.ok) {
      setSaved(gameId)
      setTimeout(() => setSaved(null), 2000)
      fetch('/api/wm-tips').then(r => r.json()).then(d => setTips(d.tips || []))
    }
    setSaving(null)
  }

  const handleDeleteTip = async (gameId: string) => {
    if (!user && !gastNameSet) return
    setDeleting(gameId)
    const res = await fetch('/api/wm-tips', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        game_id: gameId,
        gast_name: !user ? gastName : null,
      }),
    })
    if (res.ok) {
      setInputs(prev => ({ ...prev, [gameId]: ['', ''] }))
      fetch('/api/wm-tips').then(r => r.json()).then(d => setTips(d.tips || []))
    }
    setDeleting(null)
  }

  const myTips = tips.filter(t => user ? t.user_id === user.id : t.gast_name === gastName)
  const myPoints = myTips.reduce((sum, tip) => {
    const game = games.find(g => g.id === tip.game_id)
    return sum + (game ? getPoints(tip, game) : 0)
  }, 0)

  const grouped = RUNDEN.reduce((acc, runde) => {
    const rundeGames = games.filter(g => g.runde === runde)
    if (rundeGames.length > 0) acc[runde] = rundeGames
    return acc
  }, {} as Record<string, Game[]>)

  const leaderboard = getLeaderboard(tips, games)
  const myRank = leaderboard.findIndex(e => e.name === (user?.username || gastName)) + 1
  const nextGame = games.find(g => new Date(g.kickoff) > new Date())

  if (loading) return <div className="min-h-screen flex items-center justify-center" style={{ color: 'var(--muted)' }}>Laden...</div>

  return (
    <div className="min-h-screen" style={{ background: 'var(--background)' }}>
      <div className="max-w-4xl mx-auto px-8 py-10">
        <Link href="/" className="text-sm flex items-center gap-1 mb-8 hover:opacity-70" style={{ color: 'var(--muted)' }}>← Zurück</Link>

        <h1 className="text-4xl font-bold mb-2" style={{ color: 'var(--foreground)' }}>🏆 WM-Tippspiel</h1>
        <p className="mb-8" style={{ color: 'var(--muted)' }}>Tippe alle Spiele und sammle Punkte. 3 Punkte für genaues Ergebnis, 1 Punkt für richtigen Ausgang.</p>

        {/* Statistiken */}
        {(user || gastNameSet) && (
          <div className="grid grid-cols-3 gap-4 mb-8">
            <div className="card rounded-2xl p-5 text-center">
              <p className="text-3xl font-bold" style={{ color: 'var(--foreground)' }}>
                {myTips.length}<span className="text-lg font-normal" style={{ color: 'var(--muted)' }}> / {games.length}</span>
              </p>
              <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>Spiele getippt</p>
            </div>
            <div className="card rounded-2xl p-5 text-center">
              <p className="text-3xl font-bold" style={{ color: '#D97706' }}>{myPoints}</p>
              <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>Punkte</p>
            </div>
            <div className="card rounded-2xl p-5 text-center">
              <p className="text-3xl font-bold" style={{ color: 'var(--foreground)' }}>#{myRank || '—'}</p>
              <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>Rang</p>
            </div>
          </div>
        )}

        {/* Gastname */}
        {!user && !gastNameSet && (
          <div className="rounded-2xl p-6 mb-8" style={{ background: 'rgba(251,191,36,0.1)', border: '2px solid rgba(251,191,36,0.3)' }}>
            <p className="font-bold mb-1" style={{ color: '#D97706' }}>Wie heißt du?</p>
            <p className="text-sm mb-4" style={{ color: 'var(--muted)' }}>Du bist nicht eingeloggt. Gib einen Namen ein um zu tippen.</p>
            <div className="flex gap-3">
              <input value={gastName} onChange={e => setGastName(e.target.value)}
                className="flex-1 rounded-xl px-4 py-2.5 text-sm outline-none"
                style={{ background: 'var(--card)', border: '1px solid var(--card-border)', color: 'var(--foreground)' }}
                placeholder="Dein Name" />
              <button onClick={() => {
                if (!gastName.trim()) return
                localStorage.setItem('wm_gast_name', gastName.trim())
                setGastName(gastName.trim())
                setGastNameSet(true)
              }} className="text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-all"
                style={{ background: 'linear-gradient(135deg, #D97706, #FDE68A)' }}>
                Los geht's
              </button>
            </div>
          </div>
        )}

        {nextGame && <NextGameCountdown game={nextGame} />}

        {/* Tabs */}
        <div className="flex gap-1 mb-8 rounded-2xl p-1" style={{ background: 'var(--muted-bg)' }}>
          {(['spiele', 'leaderboard'] as const).map(t => (
            <button key={t} onClick={() => setActiveTab(t)}
              className="flex-1 py-2.5 rounded-xl text-sm font-medium transition-all"
              style={activeTab === t
                ? { background: 'var(--card)', color: 'var(--foreground)', boxShadow: '0 1px 4px rgba(0,0,0,0.1)' }
                : { color: 'var(--muted)' }}>
              {t === 'spiele' ? '⚽ Spiele' : '🏅 Leaderboard'}
            </button>
          ))}
        </div>

        {/* Spiele */}
        {activeTab === 'spiele' && (
          <div>
            {/* Filter */}
            <div className="flex flex-wrap gap-2 mb-6">
              {(['alle', 'offen', 'getippt'] as const).map(f => (
                <button key={f} onClick={() => setTipFilter(f)}
                  className="text-xs px-3 py-1.5 rounded-full font-medium transition-all"
                  style={tipFilter === f
                    ? { background: 'linear-gradient(135deg, #D97706, #FBBF24)', color: 'white' }
                    : { background: 'var(--muted-bg)', color: 'var(--muted)' }}>
                  {f === 'alle' ? 'Alle' : f === 'offen' ? 'Offen' : 'Getippt'}
                </button>
              ))}
              {teamFilter && (
                <button onClick={() => setTeamFilter(null)}
                  className="text-xs px-3 py-1.5 rounded-full font-medium transition-all flex items-center gap-1"
                  style={{ background: 'rgba(239,68,68,0.1)', color: '#EF4444' }}>
                  <TeamName name={teamFilter} /> ✕
                </button>
              )}
            </div>

            <div className="space-y-8">
              {Object.entries(grouped).map(([runde, rundeGames]) => {
                const filteredGames = rundeGames.filter(game => {
                  if (teamFilter && game.team1 !== teamFilter && game.team2 !== teamFilter) return false
                  const tip = myTip(game.id)
                  const kickoffPassed = new Date(game.kickoff) <= new Date()
                  if (tipFilter === 'offen' && (tip || kickoffPassed)) return false
                  if (tipFilter === 'getippt' && !tip) return false
                  return true
                })
                if (filteredGames.length === 0) return null

                return (
                  <div key={runde}>
                    <div className="flex items-center gap-3 mb-4">
                      <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider text-white"
                        style={{ background: 'linear-gradient(135deg, #D97706, #FBBF24)' }}>{runde}</span>
                      <div className="flex-1 h-px" style={{ background: 'var(--card-border)' }} />
                    </div>
                    <div className="space-y-3">
                      {filteredGames.map(game => {
                        const tip = myTip(game.id)
                        const kickoffPassed = new Date(game.kickoff) <= new Date()
                        const hasResult = game.result_team1 !== null && game.result_team2 !== null
                        const pts = tip && hasResult ? getPoints(tip, game) : null
                        const [i1, i2] = inputs[game.id] || ['', '']
                        const soonKickoff = !kickoffPassed && new Date(game.kickoff).getTime() - Date.now() < 60 * 60 * 1000

                        return (
                          <div key={game.id} className="rounded-2xl px-6 py-5 shadow-sm"
                            style={{
                              background: soonKickoff && !tip ? 'rgba(239,68,68,0.08)' : 'var(--card)',
                              border: soonKickoff && !tip ? '1px solid rgba(239,68,68,0.4)' : '1px solid var(--card-border)'
                            }}>
                            <div className="flex items-center gap-4">
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <button onClick={() => setTeamFilter(teamFilter === game.team1 ? null : game.team1)}
                                    className="flex items-center gap-1.5 hover:opacity-70 transition-all">
                                    <FlagOrUnknown name={game.team1} />
                                    <span className="font-bold" style={{ color: 'var(--foreground)' }}><TeamName name={game.team1} /></span>
                                  </button>
                                  <span className="text-sm mx-1" style={{ color: 'var(--muted)' }}>vs</span>
                                  <button onClick={() => setTeamFilter(teamFilter === game.team2 ? null : game.team2)}
                                    className="flex items-center gap-1.5 hover:opacity-70 transition-all">
                                    <span className="font-bold" style={{ color: 'var(--foreground)' }}><TeamName name={game.team2} /></span>
                                    <FlagOrUnknown name={game.team2} />
                                  </button>
                                </div>
                                <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>
                                  {new Date(game.kickoff).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                  {game.gruppe && ` · ${game.gruppe}`}
                                  {soonKickoff && !tip && <span className="text-red-400 ml-2 font-medium">⚠ Bald!</span>}
                                </p>
                              </div>

                              {hasResult && (
                                <div className="text-center">
                                  <p className="text-xs mb-1" style={{ color: 'var(--muted)' }}>Ergebnis</p>
                                  <p className="font-bold" style={{ color: 'var(--foreground)' }}>{game.result_team1} : {game.result_team2}</p>
                                </div>
                              )}

                              {tip && (
                                <div className="text-center relative">
                                  <p className="text-xs mb-1" style={{ color: 'var(--muted)' }}>Dein Tipp</p>
                                  <div className="flex items-center gap-1.5 justify-center">
                                    <p className="font-bold" style={{ color: '#D97706' }}>{tip.tip_team1} : {tip.tip_team2}</p>
                                    {!kickoffPassed && (
                                      <button onClick={() => handleDeleteTip(game.id)} disabled={deleting === game.id}
                                        title="Tipp löschen"
                                        className="text-xs hover:opacity-70 transition-all disabled:opacity-40"
                                        style={{ color: '#EF4444' }}>
                                        {deleting === game.id ? '...' : '🗑'}
                                      </button>
                                    )}
                                  </div>
                                  {pts !== null && (
                                    <p className={`text-xs font-bold mt-0.5 ${pts === 3 ? 'text-green-500' : pts === 1 ? 'text-yellow-500' : 'text-red-400'}`}>
                                      {pts === 3 ? '+3 🎯' : pts === 1 ? '+1 ✓' : '0 ✗'}
                                    </p>
                                  )}
                                </div>
                              )}

                              {!kickoffPassed && (user || gastNameSet) && (
                                <div className="flex items-center gap-2">
                                  <input type="number" min="0" value={i1}
                                    onChange={e => setInputs(prev => ({ ...prev, [game.id]: [e.target.value, i2] }))}
                                    className="w-14 rounded-xl px-2 py-2 text-sm text-center outline-none"
                                    style={{ background: 'var(--muted-bg)', border: '1px solid var(--card-border)', color: 'var(--foreground)' }}
                                    placeholder="0" />
                                  <span style={{ color: 'var(--muted)' }}>:</span>
                                  <input type="number" min="0" value={i2}
                                    onChange={e => setInputs(prev => ({ ...prev, [game.id]: [i1, e.target.value] }))}
                                    className="w-14 rounded-xl px-2 py-2 text-sm text-center outline-none"
                                    style={{ background: 'var(--muted-bg)', border: '1px solid var(--card-border)', color: 'var(--foreground)' }}
                                    placeholder="0" />
                                  <button onClick={() => handleTip(game.id)} disabled={saving === game.id}
                                    className="px-3 py-2 rounded-xl text-sm font-medium transition-all text-white disabled:opacity-50"
                                    style={{ background: saved === game.id ? '#22c55e' : 'linear-gradient(135deg, #D97706, #FBBF24)' }}>
                                    {saved === game.id ? '✓' : saving === game.id ? '...' : tip ? '↺' : '→'}
                                  </button>
                                </div>
                              )}

                              {kickoffPassed && !tip && (
                                <span className="text-xs px-3 py-1.5 rounded-full" style={{ color: 'var(--muted)', background: 'var(--muted-bg)' }}>Kein Tipp</span>
                              )}

                              {kickoffPassed && (
                                <button onClick={() => setShowTipsFor(showTipsFor === game.id ? null : game.id)}
                                  className="text-xs px-3 py-1.5 rounded-full hover:opacity-70 transition-all"
                                  style={{ color: 'var(--muted)' }}>
                                  {showTipsFor === game.id ? 'Verbergen' : `Tipps (${tips.filter(t => t.game_id === game.id).length})`}
                                </button>
                              )}
                            </div>

                            {showTipsFor === game.id && (
                              <div className="mt-3 pt-3 flex flex-wrap gap-2" style={{ borderTop: '1px solid var(--card-border)' }}>
                                {tips.filter(t => t.game_id === game.id).length === 0 ? (
                                  <span className="text-xs" style={{ color: 'var(--muted)' }}>Keine Tipps abgegeben.</span>
                                ) : tips.filter(t => t.game_id === game.id).map(t => (
                                  <span key={t.id} className="text-xs px-3 py-1.5 rounded-full" style={{ background: 'var(--muted-bg)', color: 'var(--foreground)' }}>
                                    <span className="font-medium">{t.gast_name || t.user_id}</span> — {t.tip_team1}:{t.tip_team2}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Leaderboard */}
        {activeTab === 'leaderboard' && (
          <div className="card rounded-2xl overflow-hidden">
            <div className="px-6 py-4" style={{ borderBottom: '1px solid var(--card-border)' }}>
              <h2 className="font-bold text-lg" style={{ color: 'var(--foreground)' }}>Leaderboard</h2>
            </div>
            {leaderboard.length === 0 ? (
              <div className="text-center py-10" style={{ color: 'var(--muted)' }}>Noch keine Tipps abgegeben.</div>
            ) : (
              <div>
                {leaderboard.map((entry, i) => (
                  <div key={entry.name} className="flex items-center gap-4 px-6 py-4" style={{ borderBottom: '1px solid var(--card-border)' }}>
                    <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                      i === 0 ? 'bg-yellow-100 text-yellow-600' :
                      i === 1 ? 'bg-gray-100 text-gray-600' :
                      i === 2 ? 'bg-orange-100 text-orange-600' :
                      ''}`}
                      style={i > 2 ? { background: 'var(--muted-bg)', color: 'var(--muted)' } : {}}>
                      {i + 1}
                    </span>
                    <span className="flex-1 font-medium" style={{ color: 'var(--foreground)' }}>{entry.name}</span>
                    <span className="text-xs" style={{ color: 'var(--muted)' }}>{entry.correct} Treffer</span>
                    <span className="font-bold" style={{ color: '#D97706' }}>{entry.points} Pkt</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}