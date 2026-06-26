'use client'

import { useState, useEffect } from 'react'

type ClaimEntry = {
  claim_id: number
  name: string | null
  world: string
  chunk_x: number
  chunk_z: number
  owner_uuid: string
  owner_name: string
  claimed_at: string
  group_id: number | null
  total_seconds: string
}

type GroupEntry = {
  group_id: number
  name: string | null
  owner_uuid: string
  owner_name: string
  created_at: string
  chunk_count: string
  total_seconds: string
}

type Props = {
  onSelectClaim: (claimId: number) => void
  onSelectGroup: (groupId: number) => void
}

function formatDuration(totalSecondsStr: string): string {
  const totalSeconds = parseInt(totalSecondsStr, 10) || 0
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  return `${hours}h ${minutes}m`
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export default function ClaimsLeaderboard({ onSelectClaim, onSelectGroup }: Props) {
  const [mode, setMode] = useState<'chunks' | 'groups'>('chunks')
  const [chunkEntries, setChunkEntries] = useState<ClaimEntry[]>([])
  const [groupEntries, setGroupEntries] = useState<GroupEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/smp/leaderboards/claims?mode=${mode}`)
      .then(r => r.json())
      .then(data => {
        if (mode === 'chunks') setChunkEntries(data.entries || [])
        else setGroupEntries(data.entries || [])
        setLoading(false)
      })
  }, [mode])

  return (
    <div>
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setMode('chunks')}
          className="flex-1 px-3 py-2 rounded-xl text-sm font-medium transition-all"
          style={mode === 'chunks'
            ? { background: '#16A34A', color: 'white' }
            : { background: 'var(--muted-bg)', border: '1px solid var(--card-border)', color: 'var(--muted)' }}
        >
          Einzelchunks
        </button>
        <button
          onClick={() => setMode('groups')}
          className="flex-1 px-3 py-2 rounded-xl text-sm font-medium transition-all"
          style={mode === 'groups'
            ? { background: '#16A34A', color: 'white' }
            : { background: 'var(--muted-bg)', border: '1px solid var(--card-border)', color: 'var(--muted)' }}
        >
          Gruppen
        </button>
      </div>

      <div className="card rounded-2xl p-6">
        {loading ? (
          <p style={{ color: 'var(--muted)' }}>Laden...</p>
        ) : mode === 'chunks' ? (
          chunkEntries.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-4xl mb-3">🏆</p>
              <p className="text-sm" style={{ color: 'var(--muted)' }}>Noch keine Daten vorhanden.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {chunkEntries.map((entry, i) => (
                <button
                  key={entry.claim_id}
                  onClick={() => onSelectClaim(entry.claim_id)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all hover:opacity-80"
                  style={{ background: i < 3 ? 'rgba(22,163,74,0.08)' : 'transparent' }}
                >
                  <span className="font-bold w-6 text-center" style={{ color: i === 0 ? '#EAB308' : i === 1 ? '#94A3B8' : i === 2 ? '#B45309' : 'var(--muted)' }}>
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm" style={{ color: 'var(--foreground)' }}>
                      {entry.name || `Chunk ${entry.chunk_x},${entry.chunk_z}`}
                    </p>
                    <p className="text-xs" style={{ color: 'var(--muted)' }}>
                      {entry.owner_name} · erstellt {formatDate(entry.claimed_at)}
                    </p>
                  </div>
                  <span className="font-bold text-sm flex-shrink-0" style={{ color: '#16A34A' }}>
                    {formatDuration(entry.total_seconds)}
                  </span>
                </button>
              ))}
            </div>
          )
        ) : groupEntries.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-4xl mb-3">🏆</p>
            <p className="text-sm" style={{ color: 'var(--muted)' }}>Noch keine Daten vorhanden.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {groupEntries.map((entry, i) => (
              <button
                key={entry.group_id}
                onClick={() => onSelectGroup(entry.group_id)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all hover:opacity-80"
                style={{ background: i < 3 ? 'rgba(22,163,74,0.08)' : 'transparent' }}
              >
                <span className="font-bold w-6 text-center" style={{ color: i === 0 ? '#EAB308' : i === 1 ? '#94A3B8' : i === 2 ? '#B45309' : 'var(--muted)' }}>
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm" style={{ color: 'var(--foreground)' }}>
                    {entry.name || `Gruppe #${entry.group_id}`}
                  </p>
                  <p className="text-xs" style={{ color: 'var(--muted)' }}>
                    {entry.owner_name} · {entry.chunk_count} Chunks · erstellt {formatDate(entry.created_at)}
                  </p>
                </div>
                <span className="font-bold text-sm flex-shrink-0" style={{ color: '#16A34A' }}>
                  {formatDuration(entry.total_seconds)}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}