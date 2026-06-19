'use client'

import { useState, useEffect } from 'react'

type Position = {
  id: number
  uuid: string
  player_name: string
  name: string
  x: number
  y: number
  z: number
  dimension: string
  is_public: boolean
  created_at: string
}

const DIMENSION_LABELS: Record<string, string> = {
  overworld: '🌍 Overworld',
  nether: '🔥 Nether',
  end: '🌌 End',
}

export default function SavedPositions({ myUuid }: { myUuid: string }) {
  const [positions, setPositions] = useState<Position[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editName, setEditName] = useState('')
  const [editPublic, setEditPublic] = useState(true)

  const load = () => {
    setLoading(true)
    fetch(`/api/smp/positions?uuid=${myUuid}`)
      .then(r => r.json())
      .then(data => {
        setPositions(data.positions || [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }

  useEffect(() => {
    if (myUuid) load()
  }, [myUuid])

  const startEdit = (pos: Position) => {
    setEditingId(pos.id)
    setEditName(pos.name)
    setEditPublic(pos.is_public)
  }

  const saveEdit = async () => {
    if (editingId === null) return
    await fetch('/api/smp/positions', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: editingId, uuid: myUuid, name: editName, is_public: editPublic }),
    })
    setEditingId(null)
    load()
  }

  const deletePosition = async (id: number) => {
    if (!confirm('Diesen Punkt wirklich löschen?')) return
    await fetch(`/api/smp/positions?id=${id}&uuid=${myUuid}`, { method: 'DELETE' })
    load()
  }

  if (loading) return null

  return (
    <div className="card rounded-2xl p-6">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-xl">📍</span>
        <h2 className="font-bold text-lg" style={{ color: 'var(--foreground)' }}>Gespeicherte Koordinaten</h2>
      </div>

      {positions.length === 0 ? (
        <p className="text-sm opacity-50">
          Noch keine Koordinaten gespeichert. Nutze <code>/savepos [Name]</code> im Spiel.
        </p>
      ) : (
        <div className="space-y-2">
          {positions.map(pos => {
            const isMine = pos.uuid === myUuid
            const isEditing = editingId === pos.id

            return (
              <div key={pos.id} className="rounded-xl px-4 py-3" style={{ background: 'var(--muted-bg)', border: '1px solid var(--card-border)' }}>
                {isEditing ? (
                  <div className="space-y-2">
                    <input
                      value={editName}
                      onChange={e => setEditName(e.target.value)}
                      className="w-full px-2 py-1 rounded-lg text-sm"
                      style={{ background: 'var(--card)', border: '1px solid var(--card-border)', color: 'var(--foreground)' }}
                    />
                    <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--foreground)' }}>
                      <input type="checkbox" checked={editPublic} onChange={e => setEditPublic(e.target.checked)} />
                      Für den Clan sichtbar
                    </label>
                    <div className="flex gap-2">
                      <button onClick={saveEdit} className="px-3 py-1 rounded-lg text-sm font-medium" style={{ background: '#16A34A', color: 'white' }}>Speichern</button>
                      <button onClick={() => setEditingId(null)} className="px-3 py-1 rounded-lg text-sm opacity-60 hover:opacity-100">Abbrechen</button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold" style={{ color: 'var(--foreground)' }}>{pos.name}</span>
                        {!pos.is_public && <span className="text-xs opacity-50">🔒 privat</span>}
                      </div>
                      <div className="text-sm opacity-60">
                        {DIMENSION_LABELS[pos.dimension] || pos.dimension} · X: {Math.round(pos.x)}, Y: {Math.round(pos.y)}, Z: {Math.round(pos.z)}
                        {!isMine && <span> · von {pos.player_name}</span>}
                      </div>
                    </div>
                    {isMine && (
                      <div className="flex gap-2">
                        <button onClick={() => startEdit(pos)} className="text-sm opacity-60 hover:opacity-100">✏️</button>
                        <button onClick={() => deletePosition(pos.id)} className="text-sm opacity-60 hover:opacity-100">🗑️</button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}