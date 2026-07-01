'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '../../lib/auth-context'
import Link from 'next/link'
import Modal from '../../components/Modal'

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
}

const RUNDEN = ['Gruppenphase', 'Sechzehntelfinale', 'Achtelfinale', 'Viertelfinale', 'Halbfinale', 'Spiel um Platz 3', 'Finale']

export default function AdminWMSpielePage() {
  const { user, loading } = useAuth()
  const [games, setGames] = useState<Game[]>([])
  const [loadingData, setLoadingData] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [newTeam1, setNewTeam1] = useState('')
  const [newTeam2, setNewTeam2] = useState('')
  const [newKickoff, setNewKickoff] = useState('')
  const [newGruppe, setNewGruppe] = useState('')
  const [newRunde, setNewRunde] = useState('Gruppenphase')
  const [saving, setSaving] = useState(false)

  const [editGame, setEditGame] = useState<Game | null>(null)
  const [editTeam1, setEditTeam1] = useState('')
  const [editTeam2, setEditTeam2] = useState('')
  const [editKickoff, setEditKickoff] = useState('')
  const [editGruppe, setEditGruppe] = useState('')
  const [editRunde, setEditRunde] = useState('')
  const [editResult1, setEditResult1] = useState('')
  const [editResult2, setEditResult2] = useState('')
  const [editPenalty1, setEditPenalty1] = useState('')
  const [editPenalty2, setEditPenalty2] = useState('')
  const [savingEdit, setSavingEdit] = useState(false)

  const fetchGames = async () => {
    const res = await fetch('/api/admin/wm-games')
    const data = await res.json()
    setGames(data.games || [])
    setLoadingData(false)
  }

  useEffect(() => {
    if (user) fetchGames()
  }, [user])

  const openEdit = (game: Game) => {
    setEditGame(game)
    setEditTeam1(game.team1)
    setEditTeam2(game.team2)
    setEditKickoff(game.kickoff.slice(0, 16))
    setEditGruppe(game.gruppe || '')
    setEditRunde(game.runde)
    setEditResult1(game.result_team1 !== null ? String(game.result_team1) : '')
    setEditResult2(game.result_team2 !== null ? String(game.result_team2) : '')
    setEditPenalty1(game.penalty_team1 !== null ? String(game.penalty_team1) : '')
    setEditPenalty2(game.penalty_team2 !== null ? String(game.penalty_team2) : '')
    setError('')
  }

  const handleCreate = async () => {
    if (!newTeam1 || !newTeam2 || !newKickoff) { setError('Team1, Team2 und Anpfiff erforderlich'); return }
    setSaving(true); setError(''); setSuccess('')
    const res = await fetch('/api/admin/wm-games', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ team1: newTeam1, team2: newTeam2, kickoff: newKickoff + ':00+02:00', gruppe: newGruppe || null, runde: newRunde }),
    })
    if (res.ok) {
      setSuccess('Spiel erstellt!')
      setNewTeam1(''); setNewTeam2(''); setNewKickoff(''); setNewGruppe('')
      fetchGames()
    } else setError('Fehler beim Erstellen')
    setSaving(false)
  }

  const handleSaveEdit = async () => {
    if (!editGame) return
    setSavingEdit(true); setError('')
    const res = await fetch('/api/admin/wm-games', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: editGame.id,
        team1: editTeam1,
        team2: editTeam2,
        kickoff: editKickoff + ':00+02:00',
        gruppe: editGruppe || null,
        runde: editRunde,
        result_team1: editResult1 !== '' ? parseInt(editResult1) : null,
        result_team2: editResult2 !== '' ? parseInt(editResult2) : null,
        penalty_team1: editPenalty1 !== '' ? parseInt(editPenalty1) : null,
        penalty_team2: editPenalty2 !== '' ? parseInt(editPenalty2) : null,
      }),
    })
    if (res.ok) {
      setSuccess('Gespeichert!')
      setEditGame(null)
      fetchGames()
    } else setError('Fehler beim Speichern')
    setSavingEdit(false)
  }

  const handleDelete = async (id: string, team1: string, team2: string) => {
    if (!confirm(`${team1} vs ${team2} wirklich löschen?`)) return
    const res = await fetch('/api/admin/wm-games', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    if (res.ok) fetchGames()
    else setError('Fehler beim Löschen')
  }

  const inputStyle = {
    background: 'var(--muted-bg)',
    border: '1px solid var(--card-border)',
    color: 'var(--foreground)',
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--background)', color: 'var(--foreground)' }}>Laden...</div>
  if (!user || user.clan_role !== 'admin') return <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--background)', color: 'var(--foreground)' }}>Kein Zugriff</div>

  const grouped = RUNDEN.reduce((acc, runde) => {
    const rundeGames = games.filter(g => g.runde === runde)
    if (rundeGames.length > 0) acc[runde] = rundeGames
    return acc
  }, {} as Record<string, Game[]>)

  return (
    <div className="min-h-screen" style={{ background: 'var(--background)' }}>
      <div className="max-w-4xl mx-auto px-8 py-10">
        <Link href="/admin" className="text-sm flex items-center gap-1 mb-8 hover:opacity-70" style={{ color: 'var(--muted)' }}>← Zurück zum Admin</Link>

        <h1 className="text-3xl font-bold mb-8" style={{ color: 'var(--foreground)' }}>WM-Spiele</h1>

        {error && <p className="text-red-500 text-sm mb-4 px-4 py-2 rounded-xl" style={{ background: 'rgba(239,68,68,0.1)' }}>{error}</p>}
        {success && <p className="text-green-500 text-sm mb-4 px-4 py-2 rounded-xl" style={{ background: 'rgba(34,197,94,0.1)' }}>{success}</p>}

        {/* Neues Spiel */}
        <div className="card rounded-2xl p-6 mb-6">
          <h2 className="font-bold text-lg mb-4" style={{ color: 'var(--foreground)' }}>Neues Spiel anlegen</h2>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="text-sm font-medium block mb-1" style={{ color: 'var(--muted)' }}>Team 1</label>
              <input value={newTeam1} onChange={e => setNewTeam1(e.target.value)}
                className="w-full rounded-xl px-4 py-2.5 text-sm outline-none" style={inputStyle} placeholder="z.B. 🇩🇪 Deutschland" />
            </div>
            <div>
              <label className="text-sm font-medium block mb-1" style={{ color: 'var(--muted)' }}>Team 2</label>
              <input value={newTeam2} onChange={e => setNewTeam2(e.target.value)}
                className="w-full rounded-xl px-4 py-2.5 text-sm outline-none" style={inputStyle} placeholder="z.B. 🇫🇷 Frankreich" />
            </div>
            <div>
              <label className="text-sm font-medium block mb-1" style={{ color: 'var(--muted)' }}>Anpfiff</label>
              <input type="datetime-local" value={newKickoff} onChange={e => setNewKickoff(e.target.value)}
                className="w-full rounded-xl px-4 py-2.5 text-sm outline-none" style={inputStyle} />
            </div>
            <div>
              <label className="text-sm font-medium block mb-1" style={{ color: 'var(--muted)' }}>Runde</label>
              <select value={newRunde} onChange={e => setNewRunde(e.target.value)}
                className="w-full rounded-xl px-4 py-2.5 text-sm outline-none" style={inputStyle}>
                {RUNDEN.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium block mb-1" style={{ color: 'var(--muted)' }}>Gruppe (optional)</label>
              <input value={newGruppe} onChange={e => setNewGruppe(e.target.value)}
                className="w-full rounded-xl px-4 py-2.5 text-sm outline-none" style={inputStyle} placeholder="z.B. Gruppe A" />
            </div>
          </div>
          <button onClick={handleCreate} disabled={saving}
            className="text-white px-6 py-2.5 rounded-xl text-sm font-medium disabled:opacity-50 transition-all"
            style={{ background: 'linear-gradient(135deg, #D97706, #FBBF24)' }}>
            {saving ? 'Erstellen...' : '+ Spiel anlegen'}
          </button>
        </div>

        {/* Spielliste */}
        {loadingData ? (
          <div className="text-center py-10" style={{ color: 'var(--muted)' }}>Laden...</div>
        ) : games.length === 0 ? (
          <div className="card rounded-2xl p-10 text-center" style={{ color: 'var(--muted)' }}>Noch keine Spiele angelegt</div>
        ) : (
          <div className="space-y-6">
            {RUNDEN.filter(r => grouped[r]).map(runde => (
              <div key={runde}>
                <div className="flex items-center gap-3 mb-3">
                  <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider text-white"
                    style={{ background: 'linear-gradient(135deg, #D97706, #FBBF24)' }}>{runde}</span>
                  <div className="flex-1 h-px" style={{ background: 'var(--card-border)' }} />
                  <span className="text-sm" style={{ color: 'var(--muted)' }}>{grouped[runde].length} Spiele</span>
                </div>
                <div className="card rounded-2xl overflow-hidden">
                  <div>
                    {grouped[runde].map(game => (
                      <div key={game.id} className="flex items-center gap-4 px-6 py-4" style={{ borderBottom: '1px solid var(--card-border)' }}>
                        <div className="flex-1">
                          <p className="font-medium" style={{ color: 'var(--foreground)' }}>
                            {game.team1} <span style={{ color: 'var(--muted)' }} className="mx-2">vs</span> {game.team2}
                          </p>
                          <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
                            {new Date(game.kickoff).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            {game.gruppe && ` · ${game.gruppe}`}
                          </p>
                        </div>
                        {game.result_team1 !== null && game.result_team2 !== null ? (
                          <span className="text-sm font-bold text-green-500 px-3 py-1 rounded-full" style={{ background: 'rgba(34,197,94,0.1)' }}>
                            {game.result_team1} : {game.result_team2}
                            {game.penalty_team1 !== null && game.penalty_team2 !== null && (
                              <span className="font-normal opacity-80"> (i.E. {game.penalty_team1}:{game.penalty_team2})</span>
                            )}
                          </span>
                        ) : (
                          <span className="text-xs px-3 py-1 rounded-full" style={{ color: 'var(--muted)', background: 'var(--muted-bg)' }}>Kein Ergebnis</span>
                        )}
                        <button onClick={() => openEdit(game)}
                          className="text-sm px-3 py-1.5 rounded-xl transition-all"
                          style={{ color: '#D97706', background: 'rgba(217,119,6,0.1)' }}>
                          Bearbeiten
                        </button>
                        <button onClick={() => handleDelete(game.id, game.team1, game.team2)}
                          className="text-sm px-3 py-1.5 rounded-xl transition-all"
                          style={{ color: '#ef4444', background: 'rgba(239,68,68,0.1)' }}>
                          Löschen
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {editGame && (
        <Modal onClose={() => setEditGame(null)}>
          <div className="relative p-8 h-full overflow-y-auto" style={{ background: 'var(--card)', color: 'var(--foreground)' }}>
            <button onClick={() => setEditGame(null)}
              className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full text-sm"
              style={{ background: 'var(--muted-bg)', color: 'var(--muted)' }}>✕</button>
            <h3 className="text-lg font-bold mb-6" style={{ color: 'var(--foreground)' }}>Spiel bearbeiten</h3>
            <div className="space-y-4">
              {[
                { label: 'Team 1', value: editTeam1, set: setEditTeam1 },
                { label: 'Team 2', value: editTeam2, set: setEditTeam2 },
              ].map(field => (
                <div key={field.label}>
                  <label className="text-sm font-medium block mb-1" style={{ color: 'var(--muted)' }}>{field.label}</label>
                  <input value={field.value} onChange={e => field.set(e.target.value)}
                    className="w-full rounded-xl px-4 py-2.5 text-sm outline-none" style={inputStyle} />
                </div>
              ))}
              <div>
                <label className="text-sm font-medium block mb-1" style={{ color: 'var(--muted)' }}>Anpfiff</label>
                <input type="datetime-local" value={editKickoff} onChange={e => setEditKickoff(e.target.value)}
                  className="w-full rounded-xl px-4 py-2.5 text-sm outline-none" style={inputStyle} />
              </div>
              <div>
                <label className="text-sm font-medium block mb-1" style={{ color: 'var(--muted)' }}>Runde</label>
                <select value={editRunde} onChange={e => setEditRunde(e.target.value)}
                  className="w-full rounded-xl px-4 py-2.5 text-sm outline-none" style={inputStyle}>
                  {RUNDEN.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium block mb-1" style={{ color: 'var(--muted)' }}>Gruppe (optional)</label>
                <input value={editGruppe} onChange={e => setEditGruppe(e.target.value)}
                  className="w-full rounded-xl px-4 py-2.5 text-sm outline-none" style={inputStyle} placeholder="z.B. Gruppe A" />
              </div>
              <div style={{ borderTop: '1px solid var(--card-border)', paddingTop: 16 }}>
                <label className="text-sm font-bold block mb-3" style={{ color: 'var(--foreground)' }}>Ergebnis</label>
                <div className="flex items-center gap-3">
                  <input type="number" min="0" value={editResult1} onChange={e => setEditResult1(e.target.value)}
                    className="w-20 rounded-xl px-3 py-2.5 text-sm text-center outline-none" style={inputStyle} placeholder="0" />
                  <span style={{ color: 'var(--muted)' }}>:</span>
                  <input type="number" min="0" value={editResult2} onChange={e => setEditResult2(e.target.value)}
                    className="w-20 rounded-xl px-3 py-2.5 text-sm text-center outline-none" style={inputStyle} placeholder="0" />
                </div>
                <p className="text-xs mt-2" style={{ color: 'var(--muted)' }}>Leer lassen wenn noch nicht gespielt.</p>
              </div>
              {editRunde !== 'Gruppenphase' && (
                <div style={{ borderTop: '1px solid var(--card-border)', paddingTop: 16 }}>
                  <label className="text-sm font-bold block mb-1" style={{ color: 'var(--foreground)' }}>⚽ Elfmeterschießen</label>
                  <p className="text-xs mb-3" style={{ color: 'var(--muted)' }}>Nur ausfüllen, wenn es nach Verlängerung zum Elfmeterschießen kam.</p>
                  <div className="flex items-center gap-3">
                    <input type="number" min="0" value={editPenalty1} onChange={e => setEditPenalty1(e.target.value)}
                      className="w-20 rounded-xl px-3 py-2.5 text-sm text-center outline-none" style={inputStyle} placeholder="—" />
                    <span style={{ color: 'var(--muted)' }}>:</span>
                    <input type="number" min="0" value={editPenalty2} onChange={e => setEditPenalty2(e.target.value)}
                      className="w-20 rounded-xl px-3 py-2.5 text-sm text-center outline-none" style={inputStyle} placeholder="—" />
                    {(editPenalty1 !== '' || editPenalty2 !== '') && (
                      <button onClick={() => { setEditPenalty1(''); setEditPenalty2('') }}
                        className="text-xs hover:opacity-70 transition-all" style={{ color: '#EF4444' }}>
                        Zurücksetzen
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
            {error && <p className="text-red-500 text-sm mt-3">{error}</p>}
            <div className="flex gap-3 mt-6">
              <button onClick={() => setEditGame(null)}
                className="flex-1 rounded-xl px-4 py-2.5 text-sm font-medium"
                style={{ border: '1px solid var(--card-border)', color: 'var(--muted)' }}>
                Abbrechen
              </button>
              <button onClick={handleSaveEdit} disabled={savingEdit}
                className="flex-1 text-white px-4 py-2.5 rounded-xl text-sm font-medium disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, #D97706, #FBBF24)' }}>
                {savingEdit ? 'Speichern...' : 'Speichern'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}