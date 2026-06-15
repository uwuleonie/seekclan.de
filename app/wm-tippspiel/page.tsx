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
    <div className="rounded-2xl p-6 mb-8 text-gray-700"
      style={{
        background: 'linear-gradient(135deg, #F59E0B, #FBBF24, #FDE68A)',
        boxShadow: '0 0 32px rgba(251,191,36,0.4)',
      }}>
      <p className="text-yellow-700 text-sm font-medium mb-3">⚽ Nächstes Spiel</p>
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <FlagOrUnknown name={game.team1} size="lg" />
          <span className="text-xl font-bold"><TeamName name={game.team1} /></span>
        </div>
        <div className="text-center flex-1">
          <p className="text-yellow-700 text-xs mb-1">
            {new Date(game.kickoff).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
            {game.gruppe && ` · ${game.gruppe}`}
          </p>
          <p className="text-4xl font-bold tabular-nums">{timeLeft}</p>
          <p className="text-yellow-700 text-xs mt-1">{game.runde}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xl font-bold"><TeamName name={game.team2} /></span>
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
    tips.find(t =>
      t.game_id === gameId &&
      (user ? t.user_id === user.id : t.gast_name === gastName)
    )

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

  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-400">Laden...</div>

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-8 py-10">
        <Link href="/" className="text-gray-500 text-sm flex items-center gap-1 mb-8 hover:text-gray-700">← Zurück</Link>

        <h1 className="text-4xl font-bold text-gray-900 mb-2">🏆 WM-Tippspiel</h1>
        <p className="text-gray-500 mb-8">Tippe alle Spiele und sammle Punkte. 3 Punkte für genaues Ergebnis, 1 Punkt für richtigen Ausgang.</p>

        {/* Statistiken */}
        {(user || gastNameSet) && (
          <div className="grid grid-cols-3 gap-4 mb-8">
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 text-center">
              <p className="text-3xl font-bold text-gray-900">
                {myTips.length}<span className="text-gray-400 text-lg font-normal"> / {games.length}</span>
              </p>
              <p className="text-gray-400 text-xs mt-1">Spiele getippt</p>
            </div>
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 text-center">
              <p className="text-3xl font-bold" style={{ color: '#D97706' }}>{myPoints}</p>
              <p className="text-gray-400 text-xs mt-1">Punkte</p>
            </div>
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 text-center">
              <p className="text-3xl font-bold text-gray-900">#{myRank || '—'}</p>
              <p className="text-gray-400 text-xs mt-1">Rang</p>
            </div>
          </div>
        )}

        {/* Gastname */}
        {!user && !gastNameSet && (
          <div className="bg-yellow-50 border-2 border-yellow-200 rounded-2xl p-6 mb-8">
            <p className="font-bold text-yellow-700 mb-1">Wie heißt du?</p>
            <p className="text-yellow-600 text-sm mb-4">Du bist nicht eingeloggt. Gib einen Namen ein um zu tippen.</p>
            <div className="flex gap-3">
              <input value={gastName} onChange={e => setGastName(e.target.value)}
                className="flex-1 border border-yellow-200 rounded-xl px-4 py-2.5 text-sm text-gray-900 outline-none focus:border-yellow-400"
                placeholder="Dein Name" />
              <button onClick={() => {
                if (!gastName.trim()) return
                localStorage.setItem('wm_gast_name', gastName.trim())
                setGastName(gastName.trim())
                setGastNameSet(true)
              }}
                className="text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-all"
                style={{ background: 'linear-gradient(135deg, #D97706, #FDE68A)' }}>
                Los geht's →
              </button>
            </div>
          </div>
        )}

        {!user && gastNameSet && (
          <div className="flex items-center gap-3 mb-8 bg-white border border-gray-100 rounded-xl px-4 py-3 shadow-sm">
            <span className="text-2xl">👤</span>
            <span className="text-gray-700 font-medium">Du tippst als: <span className="font-bold" style={{ color: '#D97706' }}>{gastName}</span></span>
            <button onClick={() => { setGastNameSet(false); setGastName(''); localStorage.removeItem('wm_gast_name') }}
              className="ml-auto text-xs text-gray-400 hover:text-gray-600">Ändern</button>
          </div>
        )}

        {/* Tabs + Filter */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex bg-white border border-gray-200 rounded-xl overflow-hidden text-sm">
            <button onClick={() => setActiveTab('spiele')}
              className={`px-6 py-2.5 font-medium transition-all ${activeTab === 'spiele' ? 'bg-gray-900 text-white' : 'text-gray-500 hover:text-gray-900'}`}>
              Spiele
            </button>
            <button onClick={() => setActiveTab('leaderboard')}
              className={`px-6 py-2.5 font-medium transition-all ${activeTab === 'leaderboard' ? 'bg-gray-900 text-white' : 'text-gray-500 hover:text-gray-900'}`}>
              Leaderboard
            </button>
          </div>
          {(user || gastNameSet) && activeTab === 'spiele' && (
            <div className="flex bg-white border border-gray-200 rounded-xl overflow-hidden text-sm">
              <button onClick={() => setTipFilter('alle')}
                className={`px-4 py-2.5 font-medium transition-all ${tipFilter === 'alle' ? 'bg-gray-900 text-white' : 'text-gray-500 hover:text-gray-900'}`}>
                Alle
              </button>
              <button onClick={() => setTipFilter('offen')}
                className={`px-4 py-2.5 font-medium transition-all ${tipFilter === 'offen' ? 'bg-gray-900 text-white' : 'text-gray-500 hover:text-gray-900'}`}>
                Noch offen
              </button>
              <button onClick={() => setTipFilter('getippt')}
                className={`px-4 py-2.5 font-medium transition-all ${tipFilter === 'getippt' ? 'bg-gray-900 text-white' : 'text-gray-500 hover:text-gray-900'}`}>
                Getippt
              </button>
            </div>
          )}
        </div>

        {/* Spiele Tab */}
        {activeTab === 'spiele' && (
          <div>
            {nextGame && <NextGameCountdown game={nextGame} />}

            {/* Team Filter Anzeige */}
            {teamFilter && (
              <div className="flex items-center gap-2 mb-4 bg-white border border-gray-200 rounded-xl px-4 py-2.5 w-fit">
                <FlagOrUnknown name={teamFilter} />
                <span className="text-sm font-medium text-gray-700">{teamFilter}</span>
                <button onClick={() => setTeamFilter(null)} className="ml-2 text-xs text-gray-400 hover:text-gray-600">✕</button>
              </div>
            )}

            <div className="space-y-8">
              {Object.keys(grouped).length === 0 && (
                <div className="bg-white rounded-2xl p-10 text-center text-gray-400 shadow-sm">Noch keine Spiele angelegt.</div>
              )}
              {RUNDEN.filter(r => grouped[r]).map(runde => {
                const filteredGames = grouped[runde].filter(game => {
                  const tip = myTip(game.id)
                  const kickoffPassed = new Date(game.kickoff) <= new Date()
                  if (tipFilter === 'offen' && (tip || kickoffPassed)) return false
                  if (tipFilter === 'getippt' && !tip) return false
                  if (teamFilter && game.team1 !== teamFilter && game.team2 !== teamFilter) return false
                  return true
                })
                if (filteredGames.length === 0) return null
                return (
                  <div key={runde}>
                    <div className="flex items-center gap-3 mb-4">
                      <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider text-white"
                        style={{ background: 'linear-gradient(135deg, #D97706, #FBBF24)' }}>
                        {runde}
                      </span>
                      <div className="flex-1 h-px bg-gray-200" />
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
                          <div key={game.id} className={`bg-white rounded-2xl px-6 py-5 shadow-sm border transition-all ${soonKickoff && !tip ? 'border-red-300 bg-red-50' : 'border-gray-100'}`}>
                            <div className="flex items-center gap-4">
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <button onClick={() => setTeamFilter(teamFilter === game.team1 ? null : game.team1)}
                                    className="flex items-center gap-1.5 hover:opacity-70 transition-all">
                                    <FlagOrUnknown name={game.team1} />
                                    <span className="font-bold text-gray-900"><TeamName name={game.team1} /></span>
                                  </button>
                                  <span className="text-gray-300 text-sm mx-1">vs</span>
                                  <button onClick={() => setTeamFilter(teamFilter === game.team2 ? null : game.team2)}
                                    className="flex items-center gap-1.5 hover:opacity-70 transition-all">
                                    <span className="font-bold text-gray-900"><TeamName name={game.team2} /></span>
                                    <FlagOrUnknown name={game.team2} />
                                  </button>
                                </div>
                                <p className="text-xs text-gray-400 mt-1">
                                  {new Date(game.kickoff).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                  {game.gruppe && ` · ${game.gruppe}`}
                                  {soonKickoff && !tip && <span className="text-red-400 ml-2 font-medium">⚠ Bald!</span>}
                                </p>
                              </div>

                              {hasResult && (
                                <div className="text-center">
                                  <p className="text-xs text-gray-400 mb-1">Ergebnis</p>
                                  <p className="font-bold text-gray-900">{game.result_team1} : {game.result_team2}</p>
                                </div>
                              )}

                              {tip && (
                                <div className="text-center">
                                  <p className="text-xs text-gray-400 mb-1">Dein Tipp</p>
                                  <p className="font-bold" style={{ color: '#D97706' }}>{tip.tip_team1} : {tip.tip_team2}</p>
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
                                    className="w-14 border border-gray-200 rounded-xl px-2 py-2 text-sm text-center text-gray-900 outline-none focus:border-yellow-400"
                                    placeholder="0" />
                                  <span className="text-gray-400">:</span>
                                  <input type="number" min="0" value={i2}
                                    onChange={e => setInputs(prev => ({ ...prev, [game.id]: [i1, e.target.value] }))}
                                    className="w-14 border border-gray-200 rounded-xl px-2 py-2 text-sm text-center text-gray-900 outline-none focus:border-yellow-400"
                                    placeholder="0" />
                                  <button onClick={() => handleTip(game.id)} disabled={saving === game.id}
                                    className="px-3 py-2 rounded-xl text-sm font-medium transition-all text-white disabled:opacity-50"
                                    style={{ background: saved === game.id ? '#22c55e' : 'linear-gradient(135deg, #D97706, #FBBF24)' }}>
                                    {saved === game.id ? '✓' : saving === game.id ? '...' : tip ? '↺' : '→'}
                                  </button>
                                </div>
                              )}

                              {kickoffPassed && !tip && (
                                <span className="text-xs text-gray-400 bg-gray-50 px-3 py-1.5 rounded-full">Kein Tipp</span>
                              )}

                              {kickoffPassed && (
                                <button
                                  onClick={() => setShowTipsFor(showTipsFor === game.id ? null : game.id)}
                                  className="text-xs text-gray-400 hover:text-gray-600 px-3 py-1.5 rounded-full hover:bg-gray-50 transition-all">
                                  {showTipsFor === game.id ? 'Verbergen' : `Tipps (${tips.filter(t => t.game_id === game.id).length})`}
                                </button>
                              )}
                            </div>

                            {showTipsFor === game.id && (
                              <div className="mt-3 pt-3 border-t border-gray-100 flex flex-wrap gap-2">
                                {tips.filter(t => t.game_id === game.id).length === 0 ? (
                                  <span className="text-xs text-gray-400">Keine Tipps abgegeben.</span>
                                ) : tips.filter(t => t.game_id === game.id).map(t => (
                                  <span key={t.id} className="text-xs bg-gray-50 px-3 py-1.5 rounded-full text-gray-600">
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

        {/* Leaderboard Tab */}
        {activeTab === 'leaderboard' && (
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100">
              <h2 className="font-bold text-lg text-gray-900">Leaderboard</h2>
            </div>
            {leaderboard.length === 0 ? (
              <div className="text-center py-10 text-gray-400">Noch keine Tipps abgegeben.</div>
            ) : (
              <div className="divide-y divide-gray-50">
                {leaderboard.map((entry, i) => (
                  <div key={entry.name} className="flex items-center gap-4 px-6 py-4">
                    <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                      i === 0 ? 'bg-yellow-100 text-yellow-600' :
                      i === 1 ? 'bg-gray-100 text-gray-600' :
                      i === 2 ? 'bg-orange-100 text-orange-600' :
                      'bg-gray-50 text-gray-400'
                    }`}>{i + 1}</span>
                    <span className="flex-1 font-medium text-gray-900">{entry.name}</span>
                    <span className="text-xs text-gray-400">{entry.correct} Treffer</span>
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