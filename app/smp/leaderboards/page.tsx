'use client'

import { useState, useEffect } from 'react'
import ClaimsLeaderboard from '../../components/ClaimsLeaderboard'
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

const LEADERBOARD_TYPES: { key: keyof PlayerStats, label: string, icon: string, format: (v: number) => string }[] = [
  { key: 'playtime_minutes', label: 'Spielzeit', icon: '⏱️', format: v => `${Math.floor(v / 60)}h ${v % 60}m` },
  { key: 'blocks_broken', label: 'Blöcke abgebaut', icon: '⛏️', format: v => v.toLocaleString('de-DE') },
  { key: 'mob_kills', label: 'Mob-Kills', icon: '⚔️', format: v => v.toLocaleString('de-DE') },
  { key: 'deaths', label: 'Tode', icon: '💀', format: v => v.toLocaleString('de-DE') },
  { key: 'villager_trades', label: 'Dorfbewohner-Handel', icon: '🧑‍🌾', format: v => v.toLocaleString('de-DE') },
]

function PlayerLeaderboard() {
  const [allStats, setAllStats] = useState<PlayerStats[]>([])
  const [loading, setLoading] = useState(true)
  const [type, setType] = useState<keyof PlayerStats>('playtime_minutes')

  useEffect(() => {
    fetch('/api/smp/stats').then(r => r.json()).then(data => {
      setAllStats(Array.isArray(data.stats) ? data.stats : [])
      setLoading(false)
    })
  }, [])

  const sorted = [...allStats]
    .sort((a, b) => (b[type] as number) - (a[type] as number))
    .slice(0, 20)

  return (
    <div>
      <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
        {LEADERBOARD_TYPES.map(lb => (
          <button key={lb.key} onClick={() => setType(lb.key)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all"
            style={type === lb.key
              ? { background: '#16A34A', color: 'white' }
              : { background: 'var(--muted-bg)', border: '1px solid var(--card-border)', color: 'var(--muted)' }}>
            <span>{lb.icon}</span>{lb.label}
          </button>
        ))}
      </div>

      <div className="card rounded-2xl p-6">
        {loading ? (
          <p style={{ color: 'var(--muted)' }}>Laden...</p>
        ) : sorted.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-4xl mb-3">🏆</p>
            <p className="text-sm" style={{ color: 'var(--muted)' }}>Noch keine Daten vorhanden.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {sorted.map((s, i) => {
              const lb = LEADERBOARD_TYPES.find(l => l.key === type)!
              return (
                <div key={s.uuid} className="flex items-center gap-3 px-3 py-2.5 rounded-xl" style={{ background: i < 3 ? 'rgba(22,163,74,0.08)' : 'transparent' }}>
                  <span className="font-bold w-6 text-center" style={{ color: i === 0 ? '#EAB308' : i === 1 ? '#94A3B8' : i === 2 ? '#B45309' : 'var(--muted)' }}>
                    {i + 1}
                  </span>
                  <img src={`https://mc-heads.net/avatar/${s.player_name}/28`} alt="" className="w-7 h-7 rounded-lg" />
                  <span className="flex-1 font-medium text-sm" style={{ color: 'var(--foreground)' }}>{s.player_name}</span>
                  <span className="font-bold text-sm" style={{ color: '#16A34A' }}>{lb.format(s[type] as number)}</span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

export default function LeaderboardsPage() {
  const [mainTab, setMainTab] = useState<'players' | 'claims'>('players')
  const [selectedClaimId, setSelectedClaimId] = useState<number | null>(null)
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null)

  return (
    <div>
      <div className="flex gap-2 mb-5">
        <button
          onClick={() => setMainTab('players')}
          className="flex-1 px-4 py-2.5 rounded-xl text-sm font-bold transition-all"
          style={mainTab === 'players'
            ? { background: 'var(--foreground)', color: 'var(--background)' }
            : { background: 'var(--muted-bg)', border: '1px solid var(--card-border)', color: 'var(--muted)' }}
        >
          👤 Spieler
        </button>
        <button
          onClick={() => setMainTab('claims')}
          className="flex-1 px-4 py-2.5 rounded-xl text-sm font-bold transition-all"
          style={mainTab === 'claims'
            ? { background: 'var(--foreground)', color: 'var(--background)' }
            : { background: 'var(--muted-bg)', border: '1px solid var(--card-border)', color: 'var(--muted)' }}
        >
          🏠 Claims
        </button>
      </div>

      {mainTab === 'players' ? (
        <PlayerLeaderboard />
      ) : (
        <ClaimsLeaderboard
          onSelectClaim={id => setSelectedClaimId(id)}
          onSelectGroup={id => setSelectedGroupId(id)}
        />
      )}

      {selectedClaimId !== null && (
        <ClaimActivityDetailModal claimId={selectedClaimId} onClose={() => setSelectedClaimId(null)} />
      )}
      {selectedGroupId !== null && (
        <ClaimActivityDetailModal groupId={selectedGroupId} onClose={() => setSelectedGroupId(null)} />
      )}
    </div>
  )
}