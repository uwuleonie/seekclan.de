'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '../../lib/auth-context'
import { hasWriteAccess } from '../layout'
import { usePathname } from 'next/navigation'

type Game = {
  id: string
  team1: string
  team2: string
  kickoff: string
  gruppe: string | null
  runde: string
  result_team1: number | null
  result_team2: number | null
  penalty_team1: number | null
  penalty_team2: number | null
  tip_count: string
  status: 'geplant' | 'live' | 'beendet'
}

type LeaderboardEntry = {
  name: string
  points: number
  exact: number
  tendency: number
  total: number
}

const RUNDEN = ['Gruppenphase', 'Sechzehntelfinale', 'Achtelfinale', 'Viertelfinale', 'Halbfinale', 'Spiel um Platz 3', 'Finale']

// Kurz-Codes für die Team-Badges (nur kosmetisch, keine echte Länder-Datenbank
// - fällt auf die ersten 3 Buchstaben des Teamnamens zurück, wenn kein
// bekanntes Kürzel hinterlegt ist).
const TEAM_CODES: Record<string, string> = {
  'Deutschland': 'DEU', 'Schottland': 'SCH', 'Spanien': 'SPA', 'Kroatien': 'KRO',
  'England': 'ENG', 'Serbien': 'SER', 'Frankreich': 'FRA', 'Niederlande': 'NIE',
  'Portugal': 'POR', 'Tschechien': 'TSC', 'Belgien': 'BEL', 'Senegal': 'SEN',
  'Brasilien': 'BRA', 'Argentinien': 'ARG', 'Italien': 'ITA', 'Polen': 'POL',
}
function teamCode(name: string): string {
  return TEAM_CODES[name] || name.slice(0, 3).toUpperCase()
}
// Deterministische Farbe pro Kürzel, damit Badges nicht alle gleich aussehen.
const BADGE_COLORS = ['#DC2626', '#2563EB', '#16A34A', '#CA8A04', '#7C3AED', '#DB2777', '#0891B2']
function badgeColor(code: string): string {
  let hash = 0
  for (let i = 0; i < code.length; i++) hash = code.charCodeAt(i) + ((hash << 5) - hash)
  return BADGE_COLORS[Math.abs(hash) % BADGE_COLORS.length]
}

const STATUS_STYLE = {
  geplant: { label: 'Geplant', color: '#3B82F6' },
  live: { label: 'Live', color: '#EF4444' },
  beendet: { label: 'Beendet', color: '#22C55E' },
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: 'long' }) + ', ' +
    new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) + ' Uhr'
}

export default function WMTippspielPage() {
  const { user } = useAuth()
  const pathname = usePathname()
  const canWrite = hasWriteAccess(user?.clan_role, pathname)

  const [tab, setTab] = useState<'spiele' | 'leaderboard'>('spiele')
  const [games, setGames] = useState<Game[]>([])
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)

  const [showNewForm, setShowNewForm] = useState(false)
  const [newTeam1, setNewTeam1] = useState('')
  const [newTeam2, setNewTeam2] = useState('')
  const [newKickoff, setNewKickoff] = useState('')
  const [newGruppe, setNewGruppe] = useState('')
  const [newRunde, setNewRunde] = useState('Gruppenphase')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTeam1, setEditTeam1] = useState('')
  const [editTeam2, setEditTeam2] = useState('')
  const [editResult1, setEditResult1] = useState('')
  const [editResult2, setEditResult2] = useState('')
  const [editPenalty1, setEditPenalty1] = useState('')
  const [editPenalty2, setEditPenalty2] = useState('')

  const loadGames = () => {
    setLoading(true)
    fetch('/api/admin2/wm-games')
      .then(r => r.json())
      .then(data => setGames(data.games || []))
      .finally(() => setLoading(false))
  }

  const loadLeaderboard = () => {
    fetch('/api/admin2/wm-leaderboard')
      .then(r => r.json())
      .then(data => setLeaderboard(data.leaderboard || []))
  }

  useEffect(() => {
    loadGames()
    loadLeaderboard()
  }, [])

  const createGame = async () => {
    if (!newTeam1.trim() || !newTeam2.trim() || !newKickoff) {
      setError('Team 1, Team 2 und Anpfiff sind erforderlich')
      return
    }
    setSaving(true)
    setError('')
    const res = await fetch('/api/admin2/wm-games', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ team1: newTeam1, team2: newTeam2, kickoff: newKickoff + ':00+02:00', gruppe: newGruppe || null, runde: newRunde }),
    })
    if (res.ok) {
      setShowNewForm(false)
      setNewTeam1(''); setNewTeam2(''); setNewKickoff(''); setNewGruppe(''); setNewRunde('Gruppenphase')
      loadGames()
    } else {
      const data = await res.json().catch(() => ({}))
      setError(data.error || 'Fehler beim Erstellen')
    }
    setSaving(false)
  }

  const startEdit = (game: Game) => {
    setEditingId(game.id)
    setEditTeam1(game.team1)
    setEditTeam2(game.team2)
    setEditResult1(game.result_team1 !== null ? String(game.result_team1) : '')
    setEditResult2(game.result_team2 !== null ? String(game.result_team2) : '')
    setEditPenalty1(game.penalty_team1 !== null ? String(game.penalty_team1) : '')
    setEditPenalty2(game.penalty_team2 !== null ? String(game.penalty_team2) : '')
  }

  const saveResult = async (gameId: string) => {
    await fetch(`/api/admin2/wm-games/${gameId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        team1: editTeam1,
        team2: editTeam2,
        result_team1: editResult1 !== '' ? parseInt(editResult1) : null,
        result_team2: editResult2 !== '' ? parseInt(editResult2) : null,
        penalty_team1: editPenalty1 !== '' ? parseInt(editPenalty1) : null,
        penalty_team2: editPenalty2 !== '' ? parseInt(editPenalty2) : null,
      }),
    })
    setEditingId(null)
    loadGames()
    loadLeaderboard()
  }

  const deleteGame = async (id: string, team1: string, team2: string) => {
    if (!confirm(`${team1} vs ${team2} wirklich löschen? Alle Tipps dazu gehen verloren.`)) return
    await fetch(`/api/admin2/wm-games/${id}`, { method: 'DELETE' })
    loadGames()
    loadLeaderboard()
  }

  const beendetCount = games.filter(g => g.status === 'beendet').length
  const offenCount = games.length - beendetCount

  return (
    <div className="max-w-5xl">
      <h1 className="text-3xl font-bold mb-1" style={{ color: 'var(--foreground)' }}>WM-Spiele</h1>
      <p className="mb-1" style={{ color: 'var(--muted)' }}>Spiele anlegen, Anpfiff setzen, Ergebnisse pflegen.</p>
      {!canWrite && <p className="text-xs mb-5" style={{ color: '#EAB308' }}>🔒 Nur Lesezugriff — Änderungen sind für deine Rolle nicht möglich.</p>}
      {canWrite && <div className="mb-5" />}

      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div className="flex gap-2">
          <button className="px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-2"
            style={{ background: 'var(--muted-bg)', color: 'var(--foreground)', border: '1px solid var(--card-border)' }}>
            WM 2026
            <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'var(--card-border)' }}>{games.length}</span>
          </button>
          <button disabled className="px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-2 cursor-not-allowed"
            style={{ color: 'var(--muted)', opacity: 0.5 }}>
            Champions League 25/26
            <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'var(--card-border)' }}>bald</span>
          </button>
        </div>
      </div>

      <div className="flex gap-1 mb-6" style={{ borderBottom: '1px solid var(--card-border)' }}>
        {(['spiele', 'leaderboard'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className="px-4 py-2.5 text-sm font-medium"
            style={tab === t
              ? { color: 'var(--foreground)', borderBottom: '2px solid #A855F7' }
              : { color: 'var(--muted)' }}>
            {t === 'spiele' ? 'Spiele' : 'Leaderboard'}
          </button>
        ))}
      </div>

      {tab === 'spiele' ? (
        <>
          <div className="card rounded-2xl p-5 mb-6 flex items-center justify-between">
            <div>
              <h2 className="font-bold" style={{ color: 'var(--foreground)' }}>WM 2026</h2>
              <p className="text-xs" style={{ color: 'var(--muted)' }}>FIFA Weltmeisterschaft · USA/Kanada/Mexiko</p>
            </div>
            <div className="flex items-center gap-6">
              <Stat value={games.length} label="Spiele" color="var(--foreground)" />
              <Stat value={beendetCount} label="Beendet" color="#22C55E" />
              <Stat value={offenCount} label="Offen" color="var(--muted)" />
              {canWrite && (
                <button onClick={() => setShowNewForm(v => !v)} className="btn-gradient text-white px-5 py-2.5 rounded-xl text-sm font-medium">
                  + Spiel
                </button>
              )}
            </div>
          </div>

          {showNewForm && canWrite && (
            <div className="card rounded-2xl p-6 mb-6">
              {error && <p className="text-red-500 text-sm mb-3">{error}</p>}
              <div className="grid grid-cols-2 gap-3 mb-3">
                <input value={newTeam1} onChange={e => setNewTeam1(e.target.value)} placeholder="Team 1"
                  className="rounded-xl px-4 py-2.5 text-sm outline-none" style={{ background: 'var(--muted-bg)', border: '1px solid var(--card-border)', color: 'var(--foreground)' }} />
                <input value={newTeam2} onChange={e => setNewTeam2(e.target.value)} placeholder="Team 2"
                  className="rounded-xl px-4 py-2.5 text-sm outline-none" style={{ background: 'var(--muted-bg)', border: '1px solid var(--card-border)', color: 'var(--foreground)' }} />
                <input type="datetime-local" value={newKickoff} onChange={e => setNewKickoff(e.target.value)}
                  className="rounded-xl px-4 py-2.5 text-sm outline-none" style={{ background: 'var(--muted-bg)', border: '1px solid var(--card-border)', color: 'var(--foreground)' }} />
                <select value={newRunde} onChange={e => setNewRunde(e.target.value)}
                  className="rounded-xl px-4 py-2.5 text-sm outline-none" style={{ background: 'var(--muted-bg)', border: '1px solid var(--card-border)', color: 'var(--foreground)' }}>
                  {RUNDEN.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
                <input value={newGruppe} onChange={e => setNewGruppe(e.target.value)} placeholder="Gruppe (optional)"
                  className="rounded-xl px-4 py-2.5 text-sm outline-none col-span-2" style={{ background: 'var(--muted-bg)', border: '1px solid var(--card-border)', color: 'var(--foreground)' }} />
              </div>
              <div className="flex gap-2">
                <button onClick={createGame} disabled={saving} className="btn-gradient text-white px-5 py-2.5 rounded-xl text-sm font-medium disabled:opacity-50">
                  {saving ? 'Wird erstellt...' : 'Spiel anlegen'}
                </button>
                <button onClick={() => setShowNewForm(false)} className="px-5 py-2.5 rounded-xl text-sm" style={{ color: 'var(--muted)' }}>Abbrechen</button>
              </div>
            </div>
          )}

          {loading ? (
            <p className="text-sm text-center py-10" style={{ color: 'var(--muted)' }}>Laden...</p>
          ) : games.length === 0 ? (
            <div className="card rounded-2xl p-10 text-center">
              <p className="text-3xl mb-3">⚽</p>
              <p style={{ color: 'var(--muted)' }}>Noch keine Spiele angelegt.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {games.map(game => {
                const s = STATUS_STYLE[game.status]
                const isEditing = editingId === game.id
                const code1 = teamCode(game.team1)
                const code2 = teamCode(game.team2)
                return (
                  <div key={game.id} className="card rounded-2xl p-5">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <span className="text-xs px-3 py-1 rounded-full font-medium" style={{ background: `${s.color}22`, color: s.color }}>{s.label}</span>
                        <span className="text-sm" style={{ color: 'var(--muted)' }}>{game.gruppe || game.runde} · {formatDate(game.kickoff)}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm" style={{ color: 'var(--muted)' }}>{game.tip_count} Tipps</span>
                        {canWrite && (
                          <>
                            <button onClick={() => isEditing ? setEditingId(null) : startEdit(game)}
                              className="text-sm px-3 py-1.5 rounded-xl" style={{ color: '#A855F7' }}>
                              {isEditing ? 'Schließen' : 'Bearbeiten'}
                            </button>
                            <button onClick={() => deleteGame(game.id, game.team1, game.team2)}
                              className="text-sm" style={{ color: 'var(--muted)' }}>✕</button>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-center gap-4">
                      <div className="flex items-center gap-2 flex-1 justify-end">
                        {isEditing ? (
                          <input value={editTeam1} onChange={e => setEditTeam1(e.target.value)}
                            className="w-32 rounded-lg px-2 py-1 text-sm text-right outline-none"
                            style={{ background: 'var(--muted-bg)', border: '1px solid var(--card-border)', color: 'var(--foreground)' }} />
                        ) : (
                          <span className="font-medium" style={{ color: 'var(--foreground)' }}>{game.team1}</span>
                        )}
                        <span className="text-xs px-2 py-1 rounded font-bold text-white flex-shrink-0" style={{ background: badgeColor(code1) }}>{code1}</span>
                      </div>

                      {isEditing ? (
                        <div className="flex items-center gap-2">
                          <input type="number" min="0" value={editResult1} onChange={e => setEditResult1(e.target.value)}
                            className="w-14 rounded-xl px-2 py-2 text-sm text-center outline-none" style={{ background: 'var(--muted-bg)', border: '1px solid var(--card-border)', color: 'var(--foreground)' }} placeholder="–" />
                          <span style={{ color: 'var(--muted)' }}>:</span>
                          <input type="number" min="0" value={editResult2} onChange={e => setEditResult2(e.target.value)}
                            className="w-14 rounded-xl px-2 py-2 text-sm text-center outline-none" style={{ background: 'var(--muted-bg)', border: '1px solid var(--card-border)', color: 'var(--foreground)' }} placeholder="–" />
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-xl font-bold" style={{ color: 'var(--foreground)' }}>
                          <span>{game.result_team1 ?? '–'}</span>
                          <span style={{ color: 'var(--muted)' }}>:</span>
                          <span>{game.result_team2 ?? '–'}</span>
                        </div>
                      )}

                      <div className="flex items-center gap-2 flex-1">
                        <span className="text-xs px-2 py-1 rounded font-bold text-white flex-shrink-0" style={{ background: badgeColor(code2) }}>{code2}</span>
                        {isEditing ? (
                          <input value={editTeam2} onChange={e => setEditTeam2(e.target.value)}
                            className="w-32 rounded-lg px-2 py-1 text-sm outline-none"
                            style={{ background: 'var(--muted-bg)', border: '1px solid var(--card-border)', color: 'var(--foreground)' }} />
                        ) : (
                          <span className="font-medium" style={{ color: 'var(--foreground)' }}>{game.team2}</span>
                        )}
                      </div>
                    </div>

                    {isEditing && (
                      <div className="mt-4 pt-4 flex items-center justify-center gap-4" style={{ borderTop: '1px solid var(--card-border)' }}>
                        <span className="text-xs" style={{ color: 'var(--muted)' }}>Elfmeter (optional):</span>
                        <input type="number" min="0" value={editPenalty1} onChange={e => setEditPenalty1(e.target.value)}
                          className="w-12 rounded-lg px-2 py-1.5 text-xs text-center outline-none" style={{ background: 'var(--muted-bg)', border: '1px solid var(--card-border)', color: 'var(--foreground)' }} placeholder="–" />
                        <span style={{ color: 'var(--muted)' }}>:</span>
                        <input type="number" min="0" value={editPenalty2} onChange={e => setEditPenalty2(e.target.value)}
                          className="w-12 rounded-lg px-2 py-1.5 text-xs text-center outline-none" style={{ background: 'var(--muted-bg)', border: '1px solid var(--card-border)', color: 'var(--foreground)' }} placeholder="–" />
                        <button onClick={() => saveResult(game.id)} className="btn-gradient text-white px-4 py-1.5 rounded-xl text-xs font-medium ml-2">
                          Speichern
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          <p className="text-xs mt-4 text-center" style={{ color: 'var(--muted)' }}>
            Ergebnis direkt in die Felder eintragen — beim Speichern wird das Spiel als „beendet" markiert und die Tipps werden ausgewertet.
          </p>
        </>
      ) : (
        <div className="card rounded-2xl overflow-hidden">
          <div className="grid grid-cols-[40px_2fr_1fr_1fr_1fr] gap-4 px-5 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--muted)', borderBottom: '1px solid var(--card-border)' }}>
            <span>#</span>
            <span>Spieler</span>
            <span>Punkte</span>
            <span>Exakt</span>
            <span>Tendenz</span>
          </div>
          {leaderboard.length === 0 ? (
            <p className="text-sm text-center py-10" style={{ color: 'var(--muted)' }}>Noch keine ausgewerteten Tipps.</p>
          ) : leaderboard.map((entry, i) => (
            <div key={entry.name} className="grid grid-cols-[40px_2fr_1fr_1fr_1fr] gap-4 px-5 py-3 items-center" style={{ borderBottom: '1px solid var(--card-border)' }}>
              <span className="font-bold" style={{ color: i < 3 ? '#F59E0B' : 'var(--muted)' }}>{i + 1}</span>
              <span style={{ color: 'var(--foreground)' }}>{entry.name}</span>
              <span className="font-bold" style={{ color: '#A855F7' }}>{entry.points}</span>
              <span style={{ color: 'var(--muted)' }}>{entry.exact}</span>
              <span style={{ color: 'var(--muted)' }}>{entry.tendency}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function Stat({ value, label, color }: { value: number, label: string, color: string }) {
  return (
    <div className="text-center">
      <p className="text-2xl font-bold" style={{ color }}>{value}</p>
      <p className="text-xs uppercase tracking-wider" style={{ color: 'var(--muted)' }}>{label}</p>
    </div>
  )
}