'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '../../lib/auth-context'
import PlaytimeCalendar from '../../components/PlaytimeCalendar'
import { ALL_MOBS, MOB_CATEGORIES, MobEntry } from '../../lib/mobs'
import MobDetailModal from '../../components/MobDetailModal'
import BlockStatsSection from '../../components/BlockStatsSection'
import InventoryView from '../../components/InventoryView'
import MobIcon from '../../components/MobIcon'
import StatsLineChart from '../../components/StatsLineChart'

type PlayerStats = {
  uuid: string
  player_name: string
  playtime_minutes: number
  blocks_broken: number
  blocks_placed: number
  mob_kills: number
  deaths: number
}

export default function StatistikenPage() {
  const { user } = useAuth()
  const [myStats, setMyStats] = useState<PlayerStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [mobKills, setMobKills] = useState<Record<string, number>>({})
  const [selectedMob, setSelectedMob] = useState<MobEntry | null>(null)
  const [blockBreaks, setBlockBreaks] = useState<Record<string, number>>({})
  const [inventoryData, setInventoryData] = useState<any>(null)
  const [mobRanking, setMobRanking] = useState<{ name: string; kills: number }[]>([])
  const [statsHistory, setStatsHistory] = useState<any[]>([])
  const [statsAverages, setStatsAverages] = useState<any>(null)
  const [statsRanks, setStatsRanks] = useState<Record<string, number>>({})
  const [totalPlayers, setTotalPlayers] = useState(0)
  const [mobSearch, setMobSearch] = useState('')

  useEffect(() => {
    if (!selectedMob) { setMobRanking([]); return }
    fetch(`/api/smp/mob-ranking?mob_type=${selectedMob.id}`)
      .then(r => r.json())
      .then(data => setMobRanking(data.ranking || []))
      .catch(() => setMobRanking([]))
  }, [selectedMob])

  useEffect(() => {
    if (!user) { setLoading(false); return }
    setLoading(true)
    const mcName = (user as any).minecraft_username || user.username
    fetch(`/api/smp/stats?username=${mcName}`).then(r => r.json()).then(data => {
      setMyStats(data.stats)
      setMobKills(data.mobKills || {})
      setBlockBreaks(data.blockBreaks || {})
      fetch(`/api/smp/inventory?username=${mcName}`).then(r => r.json()).then(inv => {
        setInventoryData(inv.inventory || null)
      })
      setStatsHistory(data.history || [])
      setStatsAverages(data.averages || null)
      setStatsRanks(data.ranks || {})
      setTotalPlayers(data.totalPlayers || 0)
      setLoading(false)
    })
  }, [user])

  if (!user) {
    return (
      <div className="card rounded-2xl p-12 text-center">
        <p className="text-5xl mb-4">🔒</p>
        <p className="font-bold" style={{ color: 'var(--foreground)' }}>Du musst eingeloggt sein.</p>
      </div>
    )
  }

  if (loading) return <p style={{ color: 'var(--muted)' }}>Laden...</p>

  if (!myStats) {
    return (
      <div className="card rounded-2xl p-12 text-center">
        <p className="text-5xl mb-4">📊</p>
        <p className="font-bold mb-2" style={{ color: 'var(--foreground)' }}>Noch keine Statistiken</p>
        <p className="text-sm" style={{ color: 'var(--muted)' }}>Spiel auf dem Server, um Statistiken zu sammeln.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="card rounded-2xl p-6">
        <h2 className="font-bold text-lg mb-4" style={{ color: 'var(--foreground)' }}>Aktivität (letzte 365 Tage)</h2>
        <PlaytimeCalendar history={statsHistory} accentColor={(user as any)?.accent_color || '#7C3AED'} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { key: 'playtime_minutes', label: 'Spielzeit', icon: '⏱️', format: (v: number) => `${Math.floor(v / 60)}h ${v % 60}m` },
          { key: 'blocks_broken', label: 'Abgebaut', icon: '⛏️', format: (v: number) => v.toLocaleString('de-DE') },
          { key: 'mob_kills', label: 'Mob-Kills', icon: '⚔️', format: (v: number) => v.toLocaleString('de-DE') },
          { key: 'deaths', label: 'Tode', icon: '💀', format: (v: number) => v.toLocaleString('de-DE') },
        ].map(stat => {
          const value = (myStats as any)[stat.key] as number
          const avg = statsAverages ? statsAverages[stat.key] : null
          const diff = avg ? Math.round(((value - avg) / Math.max(avg, 1)) * 100) : null
          const rank = statsRanks[stat.key]
          return (
            <div key={stat.key} className="card rounded-2xl p-5">
              <p className="text-xs font-medium mb-2" style={{ color: 'var(--muted)' }}>{stat.icon} {stat.label}</p>
              <p className="text-2xl font-bold mb-1" style={{ color: 'var(--foreground)' }}>{stat.format(value)}</p>
              <div className="flex items-center gap-2 text-xs">
                {rank && (
                  <span className="px-1.5 py-0.5 rounded" style={{ background: 'rgba(22,163,74,0.15)', color: '#16A34A' }}>
                    #{rank}{totalPlayers ? `/${totalPlayers}` : ''}
                  </span>
                )}
                {diff !== null && (
                  <span style={{ color: diff >= 0 ? '#16A34A' : '#EF4444' }}>
                    {diff >= 0 ? '+' : ''}{diff}% ggü. Ø
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {statsHistory.length > 1 && (
        <div className="card rounded-2xl p-6">
          <h2 className="font-bold text-lg mb-4" style={{ color: 'var(--foreground)' }}>Spielzeit-Verlauf (30 Tage)</h2>
          <StatsLineChart data={statsHistory} />
        </div>
      )}

      <div className="card rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <h2 className="font-bold text-lg" style={{ color: 'var(--foreground)' }}>Mob-Kills</h2>
          <input type="text" value={mobSearch} onChange={e => setMobSearch(e.target.value)}
            placeholder="Mob suchen..."
            className="rounded-xl px-3 py-2 text-sm outline-none"
            style={{ background: 'var(--muted-bg)', border: '1px solid var(--card-border)', color: 'var(--foreground)', width: '200px' }} />
        </div>

        {MOB_CATEGORIES.map(category => {
          const mobsInCategory = ALL_MOBS.filter(m =>
            m.category === category &&
            (mobSearch.trim() === '' || m.name.toLowerCase().includes(mobSearch.toLowerCase()))
          )
          if (mobsInCategory.length === 0) return null
          return (
            <div key={category} className="mb-5">
              <p className="text-xs font-bold mb-2 uppercase tracking-wide" style={{ color: 'var(--muted)' }}>{category}</p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {mobsInCategory.map(mob => {
                  const kills = mobKills[mob.id] || mobKills[mob.id.toUpperCase()] || 0
                  return (
                    <button key={mob.id} onClick={() => setSelectedMob(mob)}
                      className="flex items-center justify-between px-3 py-2 rounded-lg text-sm text-left hover:opacity-80 transition cursor-pointer"
                      style={{ background: kills > 0 ? 'rgba(22,163,74,0.08)' : 'var(--muted-bg)', border: '1px solid var(--card-border)' }}>
                      <span className="flex items-center gap-2" style={{ color: 'var(--foreground)' }}>
                        <MobIcon mobId={mob.id} fallbackEmoji={mob.icon} size={24} />
                        {mob.name}
                      </span>
                      <span className="font-bold" style={{ color: kills > 0 ? '#16A34A' : 'var(--muted)' }}>{kills}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      <BlockStatsSection blockBreaks={blockBreaks} />

      {inventoryData && (
        <InventoryView data={inventoryData} />
      )}

      {selectedMob && (
        <MobDetailModal
          mob={selectedMob}
          myKills={mobKills[selectedMob.id] || mobKills[selectedMob.id.toUpperCase()] || 0}
          ranking={mobRanking}
          onClose={() => setSelectedMob(null)}
        />
      )}
    </div>
  )
}
