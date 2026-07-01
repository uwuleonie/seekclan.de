'use client'

import { useState, useEffect } from 'react'
import ClaimActivityDetailModal from '../../components/ClaimActivityDetailModal'

type PlayerStats = {
  uuid: string
  player_name: string
  playtime_minutes: number
  blocks_broken: number
  blocks_placed: number
  mob_kills: number
  deaths: number
  villager_trades: number
}

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

const PLAYER_LEADERBOARD_TYPES: { key: keyof PlayerStats, label: string, icon: string, format: (v: number) => string }[] = [
  { key: 'playtime_minutes', label: 'Spielzeit', icon: '⏱️', format: v => `${Math.floor(v / 60)}h ${v % 60}m` },
  { key: 'blocks_broken', label: 'Blöcke abgebaut', icon: '⛏️', format: v => v.toLocaleString('de-DE') },
  { key: 'mob_kills', label: 'Mob-Kills', icon: '⚔️', format: v => v.toLocaleString('de-DE') },
  { key: 'deaths', label: 'Tode', icon: '💀', format: v => v.toLocaleString('de-DE') },
  { key: 'villager_trades', label: 'Dorfbewohner-Handel', icon: '🧑‍🌾', format: v => v.toLocaleString('de-DE') },
]

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function formatDuration(totalSecondsStr: string): string {
  const totalSeconds = parseInt(totalSecondsStr, 10) || 0
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  return `${hours}h ${minutes}m`
}

export default function LeaderboardsPage() {
  const [allStats, setAllStats] = useState<PlayerStats[]>([])
  const [claimEntries, setClaimEntries] = useState<ClaimEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedType, setSelectedType] = useState<keyof PlayerStats | 'claims'>('playtime_minutes')
  const [selectedClaimId, setSelectedClaimId] = useState<number | null>(null)

  useEffect(() => {
    fetch('/api/smp/stats').then(r => r.json()).then(data => {
      setAllStats(Array.isArray(data.stats) ? data.stats : [])
      setLoading(false)
    })
  }, [])

  useEffect(() => {
    if (selectedType !== 'claims') return
    fetch('/api/smp/leaderboards/claims?mode=chunks')
      .then(r => r.json())
      .then(data => setClaimEntries(data.entries || []))
  }, [selectedType])

  const sortedPlayers = selectedType !== 'claims'
    ? [...allStats].sort((a, b) => (b[selectedType] as number) - (a[selectedType] as number)).slice(0, 20)
    : []

  return (
    <div>
      <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
        {PLAYER_LEADERBOARD_TYPES.map(lb => (
          <button key={lb.key} onClick={() => setSelectedType(lb.key)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all"
            style={selectedType === lb.key
              ? { background: '#16A34A', color: 'white' }
              : { background: 'var(--muted-bg)', border: '1px solid var(--card-border)', color: 'var(--muted)' }}>
            <span>{lb.icon}</span>{lb.label}
          </button>
        ))}
        <button onClick={() => setSelectedType('claims')}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all"
          style={selectedType === 'claims'
            ? { background: '#16A34A', color: 'white' }
            : { background: 'var(--muted-bg)', border: '1px solid var(--card-border)', color: 'var(--muted)' }}>
          <span>🏠</span>Claims
        </button>
      </div>

      <div className="card rounded-2xl p-6">
        {loading ? (
          <p style={{ color: 'var(--muted)' }}>Laden...</p>
        ) : selectedType === 'claims' ? (
          claimEntries.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-4xl mb-3">🏆</p>
              <p className="text-sm" style={{ color: 'var(--muted)' }}>Noch keine Daten vorhanden.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {claimEntries.map((entry, i) => (
                <button
                  key={entry.claim_id}
                  onClick={() => setSelectedClaimId(entry.claim_id)}
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
        ) : sortedPlayers.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-4xl mb-3">🏆</p>
            <p className="text-sm" style={{ color: 'var(--muted)' }}>Noch keine Daten vorhanden.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {sortedPlayers.map((s, i) => {
              const lb = PLAYER_LEADERBOARD_TYPES.find(l => l.key === selectedType)!
              return (
                <div key={s.uuid} className="flex items-center gap-3 px-3 py-2.5 rounded-xl" style={{ background: i < 3 ? 'rgba(22,163,74,0.08)' : 'transparent' }}>
                  <span className="font-bold w-6 text-center" style={{ color: i === 0 ? '#EAB308' : i === 1 ? '#94A3B8' : i === 2 ? '#B45309' : 'var(--muted)' }}>
                    {i + 1}
                  </span>
                  <img src={`/api/player-heads/${s.player_name}/28`} alt="" className="w-7 h-7 rounded-lg" />
                  <span className="flex-1 font-medium text-sm" style={{ color: 'var(--foreground)' }}>{s.player_name}</span>
                  <span className="font-bold text-sm" style={{ color: '#16A34A' }}>{lb.format(s[selectedType] as number)}</span>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {selectedClaimId !== null && (
        <ClaimActivityDetailModal claimId={selectedClaimId} onClose={() => setSelectedClaimId(null)} />
      )}
    </div>
  )
}