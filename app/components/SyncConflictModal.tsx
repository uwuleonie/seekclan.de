'use client'

import { useState, useEffect, useCallback } from 'react'

type SyncConflictEntry = {
  id: number
  old_claim_id: number
  new_group_id: number
  old_claim_name: string | null
  old_claim_chunk_x: number
  old_claim_chunk_z: number
  new_group_name: string | null
}

type SyncConflictBatch = {
  id: number
  created_at: string
  first_warned_at: string | null
  conflicts: SyncConflictEntry[]
}

// Live-Updates laufen per Polling, wie auf der gesamten Website - ein neuer
// Konflikt (entstanden durch /claimarea im Spiel) soll möglichst sofort als
// aufpoppendes Modal sichtbar werden, auch während man schon auf /smp/claims ist.
const POLL_INTERVAL_MS = 3000

type Resolution = 'group_to_chunk' | 'chunk_to_group' | 'keep_separate'

function conflictDisplayName(conflict: SyncConflictEntry): string {
  return conflict.old_claim_name || `Chunk ${conflict.old_claim_chunk_x},${conflict.old_claim_chunk_z}`
}

export default function SyncConflictModal() {
  const [batches, setBatches] = useState<SyncConflictBatch[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [chosenResolution, setChosenResolution] = useState<Resolution | null>(null)
  const [syncTrusts, setSyncTrusts] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const fetchBatches = useCallback(async () => {
    try {
      const res = await fetch('/api/smp/claims/sync-conflicts')
      const data = await res.json()
      setBatches(data.batches || [])
    } catch {
      // Polling-Fehler einfach ignorieren, nächster Versuch folgt in 3s
    }
  }, [])

  useEffect(() => {
    fetchBatches()
    const interval = setInterval(fetchBatches, POLL_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [fetchBatches])

  const allConflicts = batches.flatMap(b => b.conflicts)
  if (allConflicts.length === 0) return null

  const toggleSelected = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectAll = () => {
    setSelectedIds(new Set(allConflicts.map(c => c.id)))
  }

  const applyResolution = async () => {
    if (selectedIds.size === 0 || !chosenResolution) return
    setSubmitting(true)
    setError('')
    try {
      const res = await fetch('/api/smp/claims/sync-conflicts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conflict_ids: Array.from(selectedIds),
          resolution: chosenResolution,
          sync_trusts: syncTrusts,
        }),
      })
      const data = await res.json()
      if (res.ok) {
        setSelectedIds(new Set())
        setChosenResolution(null)
        setSyncTrusts(false)
        fetchBatches()
      } else {
        setError(data.error || 'Fehler beim Speichern')
      }
    } catch {
      setError('Fehler beim Speichern')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
      <div className="rounded-2xl p-6 max-w-lg w-full max-h-[85vh] overflow-y-auto" style={{ background: 'var(--card)', border: '1px solid var(--card-border)' }}>
        <p className="text-2xl mb-2">⚠️</p>
        <p className="font-bold text-lg mb-2" style={{ color: 'var(--foreground)' }}>
          Chunk-Konflikte gefunden
        </p>
        <p className="text-sm mb-4" style={{ color: 'var(--muted)' }}>
          Du hast {allConflicts.length} Chunk(s), die direkt an eine neu erstellte Gruppe angrenzen,
          aber nicht automatisch übernommen wurden. Wähle aus, was damit passieren soll.
        </p>

        <div className="rounded-xl overflow-hidden mb-4" style={{ border: '1px solid var(--card-border)' }}>
          {allConflicts.map(conflict => (
            <label
              key={conflict.id}
              className="flex items-center gap-3 px-4 py-3 cursor-pointer"
              style={{ borderBottom: '1px solid var(--card-border)', background: selectedIds.has(conflict.id) ? 'var(--muted-bg)' : 'transparent' }}
            >
              <input
                type="checkbox"
                checked={selectedIds.has(conflict.id)}
                onChange={() => toggleSelected(conflict.id)}
              />
              <div className="flex-1 text-sm" style={{ color: 'var(--foreground)' }}>
                <strong>{conflictDisplayName(conflict)}</strong>
                <span style={{ color: 'var(--muted)' }}> grenzt an Gruppe </span>
                <strong>{conflict.new_group_name || `#${conflict.new_group_id}`}</strong>
              </div>
            </label>
          ))}
        </div>

        <button onClick={selectAll} className="text-xs mb-4 hover:opacity-70" style={{ color: 'var(--muted)' }}>
          Alle auswählen
        </button>

        {selectedIds.size > 0 && (
          <div className="rounded-xl p-4 mb-4" style={{ background: 'var(--muted-bg)', border: '1px solid var(--card-border)' }}>
            <p className="text-sm font-bold mb-3" style={{ color: 'var(--foreground)' }}>
              Was soll mit den {selectedIds.size} ausgewählten Chunk(s) passieren?
            </p>

            <label className="flex items-start gap-2 mb-2 cursor-pointer">
              <input type="radio" name="resolution" checked={chosenResolution === 'chunk_to_group'}
                onChange={() => setChosenResolution('chunk_to_group')} className="mt-1" />
              <span className="text-sm" style={{ color: 'var(--foreground)' }}>
                <strong>Chunk der Gruppe zuordnen</strong> — der Chunk wird Teil der Gruppe und übernimmt deren Berechtigungen.
              </span>
            </label>

            <label className="flex items-start gap-2 mb-2 cursor-pointer">
              <input type="radio" name="resolution" checked={chosenResolution === 'group_to_chunk'}
                onChange={() => setChosenResolution('group_to_chunk')} className="mt-1" />
              <span className="text-sm" style={{ color: 'var(--foreground)' }}>
                <strong>Gruppen-Berechtigungen auf den Chunk kopieren</strong> — der Chunk bleibt eigenständig, übernimmt aber die aktuellen Regeln der Gruppe.
                {chosenResolution === 'group_to_chunk' && (
                  <span className="block mt-1 text-xs" style={{ color: '#EAB308' }}>
                    ⚠️ Falls dieser Chunk bereits eigene Regeln hat, haben diese weiterhin Vorrang vor den kopierten Gruppen-Regeln.
                  </span>
                )}
              </span>
            </label>

            <label className="flex items-start gap-2 mb-3 cursor-pointer">
              <input type="radio" name="resolution" checked={chosenResolution === 'keep_separate'}
                onChange={() => setChosenResolution('keep_separate')} className="mt-1" />
              <span className="text-sm" style={{ color: 'var(--foreground)' }}>
                <strong>So lassen</strong> — nichts ändern, der Chunk bleibt unabhängig von der Gruppe.
              </span>
            </label>

            <label className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: 'var(--foreground)' }}>
              <input type="checkbox" checked={syncTrusts} onChange={e => setSyncTrusts(e.target.checked)} />
              Auch Trust-Einträge übernehmen
            </label>
          </div>
        )}

        {error && <p className="text-red-500 text-sm mb-3">{error}</p>}

        <div className="flex gap-2">
          <button
            onClick={applyResolution}
            disabled={selectedIds.size === 0 || !chosenResolution || submitting}
            className="flex-1 text-sm font-medium py-2.5 rounded-lg disabled:opacity-50"
            style={{ background: '#16A34A', color: 'white' }}
          >
            {submitting ? 'Speichert...' : 'Anwenden'}
          </button>
        </div>

        <p className="text-xs mt-4 text-center" style={{ color: 'var(--muted)' }}>
          Ungelöste Konflikte verfallen automatisch nach 96 Stunden (ab der ersten Erinnerung im Spiel) — die Chunks bleiben dann dauerhaft eigenständig.
        </p>
      </div>
    </div>
  )
}