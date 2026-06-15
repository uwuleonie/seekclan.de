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
}

const RUNDEN = ['Gruppenphase', 'Sechzehntelfinale', 'Achtelfinale', 'Viertelfinale', 'Halbfinale', 'Spiel um Platz 3', 'Finale']

export default function AdminWMSpielePage() {
  const { user, loading } = useAuth()
  const [games, setGames] = useState<Game[]>([])
  const [loadingData, setLoadingData] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Neues Spiel
  const [newTeam1, setNewTeam1] = useState('')
  const [newTeam2, setNewTeam2] = useState('')
  const [newKickoff, setNewKickoff] = useState('')
  const [newGruppe, setNewGruppe] = useState('')
  const [newRunde, setNewRunde] = useState('Gruppenphase')
  const [saving, setSaving] = useState(false)

  // Edit Modal
  const [editGame, setEditGame] = useState<Game | null>(null)
  const [editTeam1, setEditTeam1] = useState('')
  const [editTeam2, setEditTeam2] = useState('')
  const [editKickoff, setEditKickoff] = useState('')
  const [editGruppe, setEditGruppe] = useState('')
  const [editRunde, setEditRunde] = useState('')
  const [editResult1, setEditResult1] = useState('')
  const [editResult2, setEditResult2] = useState('')
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
        kickoff: editKickoff,
        gruppe: editGruppe || null,
        runde: editRunde,
        result_team1: editResult1 !== '' ? parseInt(editResult1) : null,
        result_team2: editResult2 !== '' ? parseInt(editResult2) : null,
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

  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-900">Laden...</div>
  if (!user || user.clan_role !== 'admin') return <div className="min-h-screen flex items-center justify-center text-gray-900">Kein Zugriff</div>

  // Spiele nach Runde gruppieren
  const grouped = RUNDEN.reduce((acc, runde) => {
    const rundeGames = games.filter(g => g.runde === runde)
    if (rundeGames.length > 0) acc[runde] = rundeGames
    return acc
  }, {} as Record<string, Game[]>)

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-8 py-10">
        <Link href="/admin" className="text-gray-500 text-sm flex items-center gap-1 mb-8 hover:text-gray-700">← Zurück zum Admin</Link>

        <h1 className="text-3xl font-bold mb-8 text-gray-900">WM-Spiele</h1>

        {error && <p className="text-red-500 text-sm mb-4 bg-red-50 px-4 py-2 rounded-xl">{error}</p>}
        {success && <p className="text-green-600 text-sm mb-4 bg-green-50 px-4 py-2 rounded-xl">{success}</p>}

        {/* Neues Spiel */}
        <div className="bg-white rounded-2xl p-6 shadow-sm mb-6">
          <h2 className="font-bold text-lg mb-4 text-gray-900">Neues Spiel anlegen</h2>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Team 1</label>
              <input value={newTeam1} onChange={e => setNewTeam1(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900 outline-none focus:border-orange-400"
                placeholder="z.B. 🇩🇪 Deutschland" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Team 2</label>
              <input value={newTeam2} onChange={e => setNewTeam2(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900 outline-none focus:border-orange-400"
                placeholder="z.B. 🇫🇷 Frankreich" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Anpfiff</label>
              <input type="datetime-local" value={newKickoff} onChange={e => setNewKickoff(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900 outline-none focus:border-orange-400" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Runde</label>
              <select value={newRunde} onChange={e => setNewRunde(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900 outline-none focus:border-orange-400">
                {RUNDEN.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Gruppe (optional)</label>
              <input value={newGruppe} onChange={e => setNewGruppe(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900 outline-none focus:border-orange-400"
                placeholder="z.B. Gruppe A" />
            </div>
          </div>
          <button onClick={handleCreate} disabled={saving}
            className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-2.5 rounded-xl text-sm font-medium disabled:opacity-50 transition-all">
            {saving ? 'Erstellen...' : '+ Spiel anlegen'}
          </button>
        </div>

        {/* Spielliste nach Runde */}
        {loadingData ? (
          <div className="text-center py-10 text-gray-400">Laden...</div>
        ) : games.length === 0 ? (
          <div className="bg-white rounded-2xl p-10 text-center text-gray-400 shadow-sm">Noch keine Spiele angelegt</div>
        ) : (
          <div className="space-y-6">
            {RUNDEN.filter(r => grouped[r]).map(runde => (
              <div key={runde}>
                <div className="flex items-center gap-3 mb-3">
                  <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider text-white bg-orange-500">
                    {runde}
                  </span>
                  <div className="flex-1 h-px bg-gray-200" />
                  <span className="text-gray-400 text-sm">{grouped[runde].length} Spiele</span>
                </div>
                <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
                  <div className="divide-y divide-gray-50">
                    {grouped[runde].map(game => (
                      <div key={game.id} className="flex items-center gap-4 px-6 py-4 hover:bg-gray-50">
                        <div className="flex-1">
                          <p className="font-medium text-gray-900">
                            {game.team1} <span className="text-gray-400 mx-2">vs</span> {game.team2}
                          </p>
                          <p className="text-xs text-gray-400 mt-0.5">
                            {new Date(game.kickoff).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            {game.gruppe && ` · ${game.gruppe}`}
                          </p>
                        </div>
                        {game.result_team1 !== null && game.result_team2 !== null ? (
                          <span className="text-sm font-bold text-green-600 bg-green-50 px-3 py-1 rounded-full">
                            {game.result_team1} : {game.result_team2}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400 bg-gray-50 px-3 py-1 rounded-full">Kein Ergebnis</span>
                        )}
                        <button onClick={() => openEdit(game)}
                          className="text-orange-400 hover:text-orange-600 text-sm px-3 py-1.5 rounded-xl hover:bg-orange-50 transition-all">
                          Bearbeiten
                        </button>
                        <button onClick={() => handleDelete(game.id, game.team1, game.team2)}
                          className="text-red-400 hover:text-red-600 text-sm px-3 py-1.5 rounded-xl hover:bg-red-50 transition-all">
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
          <div className="relative p-8 h-full overflow-y-auto">
            <button onClick={() => setEditGame(null)}
              className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 text-sm">
              ✕
            </button>
            <h3 className="text-lg font-bold text-gray-900 mb-6">Spiel bearbeiten</h3>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Team 1</label>
                <input value={editTeam1} onChange={e => setEditTeam1(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900 outline-none focus:border-orange-400" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Team 2</label>
                <input value={editTeam2} onChange={e => setEditTeam2(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900 outline-none focus:border-orange-400" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Anpfiff</label>
                <input type="datetime-local" value={editKickoff} onChange={e => setEditKickoff(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900 outline-none focus:border-orange-400" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Runde</label>
                <select value={editRunde} onChange={e => setEditRunde(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900 outline-none focus:border-orange-400">
                  {RUNDEN.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Gruppe (optional)</label>
                <input value={editGruppe} onChange={e => setEditGruppe(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900 outline-none focus:border-orange-400"
                  placeholder="z.B. Gruppe A" />
              </div>
              <div className="border-t border-gray-100 pt-4">
                <label className="text-sm font-bold text-gray-700 block mb-3">Ergebnis eintragen</label>
                <div className="flex items-center gap-3">
                  <input type="number" min="0" value={editResult1} onChange={e => setEditResult1(e.target.value)}
                    className="w-20 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-orange-400 text-center"
                    placeholder="0" />
                  <span className="text-gray-400 font-bold">:</span>
                  <input type="number" min="0" value={editResult2} onChange={e => setEditResult2(e.target.value)}
                    className="w-20 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-orange-400 text-center"
                    placeholder="0" />
                </div>
                <p className="text-xs text-gray-400 mt-2">Leer lassen wenn das Spiel noch nicht gespielt wurde.</p>
              </div>
            </div>
            {error && <p className="text-red-500 text-sm mt-3">{error}</p>}
            <div className="flex gap-3 mt-6">
              <button onClick={() => setEditGame(null)}
                className="flex-1 border border-gray-200 text-gray-600 px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50">
                Abbrechen
              </button>
              <button onClick={handleSaveEdit} disabled={savingEdit}
                className="flex-1 bg-orange-500 hover:bg-orange-600 text-white px-4 py-2.5 rounded-xl text-sm font-medium disabled:opacity-50">
                {savingEdit ? 'Speichern...' : 'Speichern'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}