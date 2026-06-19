'use client'

import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../lib/auth-context'
import { supabaseBrowser as supabase } from '../lib/supabase-browser'
import ClaimMap from '../components/ClaimMap'
import PlaytimeCalendar from '../components/PlaytimeCalendar'
import { ALL_MOBS, MOB_CATEGORIES, getMobById, MobEntry } from '../lib/mobs'
import MobDetailModal from '../components/MobDetailModal'
import BlockStatsSection from '../components/BlockStatsSection'
import InventoryView from '../components/InventoryView'
import LoginCalendar from '../components/LoginCalendar'
import SavedPositions from '../components/SavedPositions'
import EventBanner from '../components/EventBanner'
import MobIcon from '../components/MobIcon'
import StatsLineChart from '../components/StatsLineChart'

type SmpEvent = {
  id: number
  title: string
  description: string | null
  event_date: string
}

type Rule = {
  id: number
  category: string
  title: string
  content: string
  sort_order: number
}

type Claim = {
  id: number
  owner_uuid: string
  owner_name: string
  world: string
  chunk_x: number
  chunk_z: number
  claimed_at: string
}

type Trust = {
  id: number
  owner_uuid: string
  trusted_uuid: string
  trusted_name: string
  claim_id: number | null
  perm_build: boolean
  perm_break: boolean
  perm_containers: boolean
  perm_doors: boolean
  perm_mobs: boolean
  perm_redstone: boolean
}

type ClaimSettings = {
  uuid: string
  sound_enabled: boolean
  public_build: boolean
  public_break: boolean
  public_containers: boolean
  public_doors: boolean
  public_mobs: boolean
  public_redstone: boolean
}

type PlayerStats = {
  uuid: string
  player_name: string
  playtime_minutes: number
  blocks_broken: number
  blocks_placed: number
  mob_kills: number
  deaths: number
}

type ChatMessage = {
  id: number
  sender_name: string
  sender_uuid: string | null
  message: string
  source: string
  created_at: string
}

type TabId = 'eigener-bereich' | 'livemap' | 'statistiken' | 'leaderboards' | 'claims' | 'chat' | 'regelwerk'

const TABS: { id: TabId, label: string, icon: string }[] = [
  { id: 'eigener-bereich', label: 'Eigener Bereich', icon: '🏠' },
  { id: 'livemap',      label: 'Livemap',      icon: '🗺️' },
  { id: 'statistiken',  label: 'Statistiken',  icon: '📊' },
  { id: 'leaderboards', label: 'Leaderboards', icon: '🏆' },
  { id: 'claims',       label: 'Claims',       icon: '📍' },
  { id: 'chat',         label: 'Chat',         icon: '💬' },
  { id: 'regelwerk',    label: 'Regelwerk',    icon: '📜' },
]

const PERM_LABELS: { key: keyof Pick<Trust, 'perm_build' | 'perm_break' | 'perm_containers' | 'perm_doors' | 'perm_mobs' | 'perm_redstone'>, label: string, icon: string }[] = [
  { key: 'perm_build', label: 'Bauen', icon: '🧱' },
  { key: 'perm_break', label: 'Abbauen', icon: '⛏️' },
  { key: 'perm_containers', label: 'Container', icon: '📦' },
  { key: 'perm_doors', label: 'Türen', icon: '🚪' },
  { key: 'perm_mobs', label: 'Tiere', icon: '🐄' },
  { key: 'perm_redstone', label: 'Redstone', icon: '🔴' },
]

const LEADERBOARD_TYPES: { key: keyof PlayerStats, label: string, icon: string, format: (v: number) => string }[] = [
  { key: 'playtime_minutes', label: 'Spielzeit', icon: '⏱️', format: v => `${Math.floor(v / 60)}h ${v % 60}m` },
  { key: 'blocks_broken', label: 'Blöcke abgebaut', icon: '⛏️', format: v => v.toLocaleString('de-DE') },
  { key: 'mob_kills', label: 'Mob-Kills', icon: '⚔️', format: v => v.toLocaleString('de-DE') },
  { key: 'deaths', label: 'Tode', icon: '💀', format: v => v.toLocaleString('de-DE') },
]

function useCountdown(targetDate: string | null) {
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 })

  useEffect(() => {
    if (!targetDate) return
    const update = () => {
      const diff = new Date(targetDate).getTime() - Date.now()
      if (diff <= 0) {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 })
        return
      }
      setTimeLeft({
        days: Math.floor(diff / 86400000),
        hours: Math.floor((diff % 86400000) / 3600000),
        minutes: Math.floor((diff % 3600000) / 60000),
        seconds: Math.floor((diff % 60000) / 1000),
      })
    }
    update()
    const interval = setInterval(update, 1000)
    return () => clearInterval(interval)
  }, [targetDate])

  return timeLeft
}

export default function SmpPage() {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState<TabId>('eigener-bereich')
  const [events, setEvents] = useState<SmpEvent[]>([])
  const [rules, setRules] = useState<Rule[]>([])
  const [loading, setLoading] = useState(true)

  // Claims-Tab State
  const [claims, setClaims] = useState<Claim[]>([])
  const [trusts, setTrusts] = useState<Trust[]>([])
  const [trustedBy, setTrustedBy] = useState<Trust[]>([])
  const [settings, setSettings] = useState<ClaimSettings | null>(null)
  const [linked, setLinked] = useState(true)
  const [claimsLoading, setClaimsLoading] = useState(true)
  const [selectedClaim, setSelectedClaim] = useState<Claim | 'global' | null>(null)
  const [newTrustName, setNewTrustName] = useState('')
  const [savingTrust, setSavingTrust] = useState(false)
  const [claimsError, setClaimsError] = useState('')
  const [claimsSuccess, setClaimsSuccess] = useState('')

  // Statistiken-Tab State
  const [myStats, setMyStats] = useState<PlayerStats | null>(null)
  const [statsLoading, setStatsLoading] = useState(true)
  const [mobKills, setMobKills] = useState<Record<string, number>>({})
  const [selectedMob, setSelectedMob] = useState<MobEntry | null>(null)
  const [blockBreaks, setBlockBreaks] = useState<Record<string, number>>({})
  const [mcUsername, setMcUsername] = useState<string>('')
  const [inventoryData, setInventoryData] = useState<any>(null)
const [mobRanking, setMobRanking] = useState<{ name: string; kills: number }[]>([])

useEffect(() => {
  if (!selectedMob) {
    setMobRanking([])
    return
  }
  fetch(`/api/smp/mob-ranking?mob_type=${selectedMob.id}`)
    .then(r => r.json())
    .then(data => setMobRanking(data.ranking || []))
    .catch(() => setMobRanking([]))
}, [selectedMob])
  const [statsHistory, setStatsHistory] = useState<any[]>([])
  const [statsAverages, setStatsAverages] = useState<any>(null)
  const [statsRanks, setStatsRanks] = useState<Record<string, number>>({})
  const [totalPlayers, setTotalPlayers] = useState(0)
  const [mobSearch, setMobSearch] = useState('')

  // Leaderboards-Tab State
  const [allStats, setAllStats] = useState<PlayerStats[]>([])
  const [leaderboardLoading, setLeaderboardLoading] = useState(true)
  const [leaderboardType, setLeaderboardType] = useState<keyof PlayerStats>('playtime_minutes')

  // Chat-Tab State
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [chatLoading, setChatLoading] = useState(true)
  const [chatInput, setChatInput] = useState('')
  const [sendingChat, setSendingChat] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    Promise.all([
      fetch('/api/smp/events').then(r => r.json()),
      fetch('/api/smp/rules').then(r => r.json()),
    ]).then(([eventsData, rulesData]) => {
      setEvents(eventsData.events || [])
      setRules(rulesData.rules || [])
      setLoading(false)
    })
  }, [])

  const loadClaimsData = () => {
    if (!user) return
    setClaimsLoading(true)
    fetch('/api/smp/claims').then(r => r.json()).then(data => {
      setClaims(data.claims || [])
      setTrusts(data.trusts || [])
      setTrustedBy(data.trustedBy || [])
      setSettings(data.settings)
      setLinked(data.linked)
      setClaimsLoading(false)
    })
  }

  useEffect(() => {
    if (activeTab === 'claims' && user) loadClaimsData()
  }, [activeTab, user])

  // Statistiken laden
  useEffect(() => {
    console.log('STATS EFFECT TRIGGERED', { activeTab, user: !!user })
  if ((activeTab !== 'statistiken' && activeTab !== 'eigener-bereich') || !user) return
  setStatsLoading(true)
  const mcName = (user as any).minecraft_username || user.username
  setMcUsername(mcName)
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
    setStatsLoading(false)
  })
}, [activeTab, user])

  // Leaderboards laden
  useEffect(() => {
    if (activeTab !== 'leaderboards') return
    setLeaderboardLoading(true)
    fetch('/api/smp/stats').then(r => r.json()).then(data => {
      setAllStats(Array.isArray(data.stats) ? data.stats : [])
      setLeaderboardLoading(false)
    })
  }, [activeTab])

  // Chat laden + Realtime
  useEffect(() => {
    if (activeTab !== 'chat') return
    setChatLoading(true)
    fetch('/api/smp/chat').then(r => r.json()).then(data => {
      setChatMessages(data.messages || [])
      setChatLoading(false)
    })

    const channel = supabase
      .channel('smp_chat')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'smp_chat_messages' }, (payload) => {
        setChatMessages(prev => [...prev, payload.new as ChatMessage])
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [activeTab])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages])

  const sendChatMessage = async () => {
    if (!chatInput.trim()) return
    setSendingChat(true)
    const res = await fetch('/api/smp/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: chatInput.trim() }),
    })
    if (res.ok) setChatInput('')
    setSendingChat(false)
  }

  const nextEvent = events[0] || null
  const countdown = useCountdown(nextEvent?.event_date || null)

  const rulesByCategory = rules.reduce((acc, rule) => {
    if (!acc[rule.category]) acc[rule.category] = []
    acc[rule.category].push(rule)
    return acc
  }, {} as Record<string, Rule[]>)

  const sortedLeaderboard = [...allStats]
    .sort((a, b) => (b[leaderboardType] as number) - (a[leaderboardType] as number))
    .slice(0, 20)

  // ---------- Claims-Tab Helpers ----------

  const getTrustsFor = (claimId: number | null) => {
    return trusts.filter(t => t.claim_id === claimId)
  }

  const updateSetting = async (key: keyof ClaimSettings, value: boolean) => {
    setClaimsError(''); setClaimsSuccess('')
    const res = await fetch('/api/smp/claims/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [key]: value }),
    })
    if (res.ok) {
      setSettings(prev => prev ? { ...prev, [key]: value } : prev)
      setClaimsSuccess('Gespeichert!')
    } else {
      setClaimsError('Fehler beim Speichern')
    }
  }

  const addTrust = async () => {
    if (!newTrustName.trim()) return
    setSavingTrust(true); setClaimsError(''); setClaimsSuccess('')
    try {
      const res = await fetch(`https://api.mojang.com/users/profiles/minecraft/${newTrustName.trim()}`)
      if (!res.ok) {
        setClaimsError('Spieler nicht gefunden (Minecraft-Username prüfen)')
        setSavingTrust(false)
        return
      }
      const data = await res.json()
      const uuid = data.id.replace(/(.{8})(.{4})(.{4})(.{4})(.{12})/, '$1-$2-$3-$4-$5')

      const claimId = selectedClaim === 'global' ? null : selectedClaim?.id

      const trustRes = await fetch('/api/smp/claims/trust', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trusted_uuid: uuid,
          trusted_name: data.name,
          claim_id: claimId,
          permissions: { build: true, break: true, containers: true, doors: true, mobs: true, redstone: true },
        }),
      })
      if (trustRes.ok) {
        setClaimsSuccess(`${data.name} wurde vertraut!`)
        setNewTrustName('')
        loadClaimsData()
      } else {
        const j = await trustRes.json()
        setClaimsError(j.error || 'Fehler beim Hinzufügen')
      }
    } catch {
      setClaimsError('Fehler beim Auflösen des Spielernamens')
    }
    setSavingTrust(false)
  }

  const togglePerm = async (trust: Trust, permKey: typeof PERM_LABELS[number]['key']) => {
    const newPerms = {
      build: trust.perm_build,
      break: trust.perm_break,
      containers: trust.perm_containers,
      doors: trust.perm_doors,
      mobs: trust.perm_mobs,
      redstone: trust.perm_redstone,
    }
    const apiKey = permKey.replace('perm_', '') as keyof typeof newPerms
    newPerms[apiKey] = !newPerms[apiKey]

    await fetch('/api/smp/claims/trust', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        trusted_uuid: trust.trusted_uuid,
        trusted_name: trust.trusted_name,
        claim_id: trust.claim_id,
        permissions: newPerms,
      }),
    })
    loadClaimsData()
  }

  const removeTrust = async (trust: Trust) => {
    await fetch('/api/smp/claims/trust', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ trusted_uuid: trust.trusted_uuid, claim_id: trust.claim_id }),
    })
    loadClaimsData()
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--background)' }}>
      {/* Header */}
      <div className="w-full relative" style={{ background: 'linear-gradient(135deg, #16A34A, #15803D, #166534)' }}>
        <div className="max-w-5xl mx-auto px-8 py-12">
          <h1 className="text-4xl font-bold text-white mb-2">Seek SMP</h1>
          <p className="text-white/80">Der zentrale Hub für unseren Survival-Multiplayer-Server.</p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-8 py-8">
        <EventBanner event={nextEvent} />

        {/* Tab-Navigation */}
        <div className="flex gap-2 mb-8 overflow-x-auto pb-2">
          {TABS.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm whitespace-nowrap transition-all"
              style={activeTab === tab.id
                ? { background: '#16A34A', color: 'white' }
                : { background: 'var(--muted-bg)', color: 'var(--muted)', border: '1px solid var(--card-border)' }}>
              <span>{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>

        {loading ? (
          <p style={{ color: 'var(--muted)' }}>Laden...</p>
        ) : (
          <>
            {activeTab === 'eigener-bereich' && (
              <div className="space-y-6">
                <div className="flex flex-wrap items-stretch gap-4">
                  <div style={{ flex: '0 1 360px' }}>
  <LoginCalendar username={mcUsername} />
</div>
<div style={{ flex: '1 1 520px', minWidth: 0 }}>
                    {inventoryData && (
                      <InventoryView data={inventoryData} />
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {myStats && (myStats as any).uuid && (
  <SavedPositions myUuid={(myStats as any).uuid} />
)}
                  <div className="card rounded-2xl p-6 opacity-60">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xl">⭐</span>
                      <h2 className="font-bold text-lg" style={{ color: 'var(--foreground)' }}>Seek-Level</h2>
                    </div>
                    <p className="text-sm" style={{ color: 'var(--muted)' }}>Folgt in Kürze</p>
                  </div>
                </div>

                <div className="card rounded-2xl p-6">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">🗺️</span>
                      <h2 className="font-bold text-lg" style={{ color: 'var(--foreground)' }}>Meine Claims</h2>
                    </div>
                    <button onClick={() => setActiveTab('claims')}
                      className="text-sm opacity-60 hover:opacity-100 transition">
                      Alle ansehen →
                    </button>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="rounded-xl p-3 text-center" style={{ background: 'var(--muted-bg)' }}>
                      <p className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>{claims.length}</p>
                      <p className="text-xs" style={{ color: 'var(--muted)' }}>Eigene Claims</p>
                    </div>
                    <div className="rounded-xl p-3 text-center" style={{ background: 'var(--muted-bg)' }}>
                      <p className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>{trusts.length}</p>
                      <p className="text-xs" style={{ color: 'var(--muted)' }}>Vertraute Spieler</p>
                    </div>
                    <div className="rounded-xl p-3 text-center" style={{ background: 'var(--muted-bg)' }}>
                      <p className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>{trustedBy.length}</p>
                      <p className="text-xs" style={{ color: 'var(--muted)' }}>Vertraut mir</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Statistiken */}
            {activeTab === 'statistiken' && (
              <div>
                {!user ? (
                  <div className="card rounded-2xl p-12 text-center">
                    <p className="text-5xl mb-4">🔒</p>
                    <p className="font-bold" style={{ color: 'var(--foreground)' }}>Du musst eingeloggt sein.</p>
                  </div>
                ) : statsLoading ? (
                  <p style={{ color: 'var(--muted)' }}>Laden...</p>
                ) : !myStats ? (
                  <div className="card rounded-2xl p-12 text-center">
                    <p className="text-5xl mb-4">📊</p>
                    <p className="font-bold mb-2" style={{ color: 'var(--foreground)' }}>Noch keine Statistiken</p>
                    <p className="text-sm" style={{ color: 'var(--muted)' }}>Spiel auf dem Server, um Statistiken zu sammeln.</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Login-Kalender */}
                    <div className="card rounded-2xl p-6">
                      <h2 className="font-bold text-lg mb-4" style={{ color: 'var(--foreground)' }}>Aktivität (letzte 365 Tage)</h2>
                      <PlaytimeCalendar history={statsHistory} accentColor={(user as any)?.accent_color || '#7C3AED'} />
                    </div>

                    {/* Basis-Stats mit Vergleich und Rang */}
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

                    {/* Verlaufs-Diagramm */}
                    {statsHistory.length > 1 && (
                      <div className="card rounded-2xl p-6">
                        <h2 className="font-bold text-lg mb-4" style={{ color: 'var(--foreground)' }}>Spielzeit-Verlauf (30 Tage)</h2>
                        <StatsLineChart data={statsHistory} />
                      </div>
                    )}

                    {/* Mob-Kill-Ranking mit Suche */}
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

                  </div>
                )}
              </div>
            )}  

            {/* Leaderboards */}
            {activeTab === 'leaderboards' && (
              <div>
                <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
                  {LEADERBOARD_TYPES.map(lb => (
                    <button key={lb.key} onClick={() => setLeaderboardType(lb.key)}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all"
                      style={leaderboardType === lb.key
                        ? { background: '#16A34A', color: 'white' }
                        : { background: 'var(--muted-bg)', border: '1px solid var(--card-border)', color: 'var(--muted)' }}>
                      <span>{lb.icon}</span>{lb.label}
                    </button>
                  ))}
                </div>

                <div className="card rounded-2xl p-6">
                  {leaderboardLoading ? (
                    <p style={{ color: 'var(--muted)' }}>Laden...</p>
                  ) : sortedLeaderboard.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-4xl mb-3">🏆</p>
                      <p className="text-sm" style={{ color: 'var(--muted)' }}>Noch keine Daten vorhanden.</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {sortedLeaderboard.map((s, i) => {
                        const lb = LEADERBOARD_TYPES.find(l => l.key === leaderboardType)!
                        return (
                          <div key={s.uuid} className="flex items-center gap-3 px-3 py-2.5 rounded-xl" style={{ background: i < 3 ? 'rgba(22,163,74,0.08)' : 'transparent' }}>
                            <span className="font-bold w-6 text-center" style={{ color: i === 0 ? '#EAB308' : i === 1 ? '#94A3B8' : i === 2 ? '#B45309' : 'var(--muted)' }}>
                              {i + 1}
                            </span>
                            <img src={`https://mc-heads.net/avatar/${s.player_name}/28`} alt="" className="w-7 h-7 rounded-lg" />
                            <span className="flex-1 font-medium text-sm" style={{ color: 'var(--foreground)' }}>{s.player_name}</span>
                            <span className="font-bold text-sm" style={{ color: '#16A34A' }}>{lb.format(s[leaderboardType] as number)}</span>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Claims */}
            {activeTab === 'claims' && (
              <div>
                {!user ? (
                  <div className="card rounded-2xl p-12 text-center">
                    <p className="text-5xl mb-4">🔒</p>
                    <p className="font-bold" style={{ color: 'var(--foreground)' }}>Du musst eingeloggt sein.</p>
                  </div>
                ) : claimsLoading ? (
                  <p style={{ color: 'var(--muted)' }}>Laden...</p>
                ) : !linked ? (
                  <div className="card rounded-2xl p-12 text-center">
                    <p className="text-5xl mb-4">🔗</p>
                    <p className="font-bold mb-2" style={{ color: 'var(--foreground)' }}>Kein Minecraft-Account verknüpft</p>
                    <p className="text-sm" style={{ color: 'var(--muted)' }}>Verknüpfe deinen Minecraft-Account in den Einstellungen, um deine Claims zu sehen.</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {claimsError && <p className="text-red-500 text-sm px-4 py-2 rounded-xl" style={{ background: 'rgba(239,68,68,0.1)' }}>{claimsError}</p>}
                    {claimsSuccess && <p className="text-green-500 text-sm px-4 py-2 rounded-xl" style={{ background: 'rgba(34,197,94,0.1)' }}>{claimsSuccess}</p>}

                    <div className="card rounded-2xl p-6">
                      <h2 className="font-bold text-lg mb-1" style={{ color: 'var(--foreground)' }}>Deine Claims ({claims.length})</h2>
                      <p className="text-sm mb-4" style={{ color: 'var(--muted)' }}>Claime Chunks ingame mit <code>/claim</code>. Hier verwaltest du die Berechtigungen.</p>

                      {claims.length === 0 ? (
                        <p className="text-sm" style={{ color: 'var(--muted)' }}>Du hast noch keine Chunks geclaimt.</p>
                      ) : (
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                          <button onClick={() => setSelectedClaim('global')}
                            className="rounded-xl p-3 text-left transition-all"
                            style={selectedClaim === 'global'
                              ? { background: '#16A34A', color: 'white' }
                              : { background: 'var(--muted-bg)', border: '1px solid var(--card-border)', color: 'var(--foreground)' }}>
                            <p className="font-bold text-sm">🌍 Alle Chunks</p>
                            <p className="text-xs opacity-80">Globale Permissions</p>
                          </button>
                          {claims.map(c => (
                            <button key={c.id} onClick={() => setSelectedClaim(c)}
                              className="rounded-xl p-3 text-left transition-all"
                              style={selectedClaim !== 'global' && selectedClaim?.id === c.id
                                ? { background: '#16A34A', color: 'white' }
                                : { background: 'var(--muted-bg)', border: '1px solid var(--card-border)', color: 'var(--foreground)' }}>
                              <p className="font-bold text-sm">📍 {c.chunk_x}, {c.chunk_z}</p>
                              <p className="text-xs opacity-80">{c.world}</p>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {selectedClaim && (
                      <div className="card rounded-2xl p-6">
                        <h2 className="font-bold text-lg mb-1" style={{ color: 'var(--foreground)' }}>
                          {selectedClaim === 'global' ? '🌍 Permissions für alle Chunks' : `📍 Permissions für Chunk ${selectedClaim.chunk_x}, ${selectedClaim.chunk_z}`}
                        </h2>
                        <p className="text-sm mb-4" style={{ color: 'var(--muted)' }}>Vertraue Spielern und stelle ein, was sie dürfen.</p>

                        <div className="flex gap-2 mb-4">
                          <input type="text" value={newTrustName} onChange={e => setNewTrustName(e.target.value)}
                            placeholder="Minecraft-Username..."
                            className="flex-1 rounded-xl px-4 py-2.5 text-sm outline-none"
                            style={{ background: 'var(--muted-bg)', border: '1px solid var(--card-border)', color: 'var(--foreground)' }} />
                          <button onClick={addTrust} disabled={savingTrust}
                            className="px-4 py-2.5 rounded-xl text-sm font-medium text-white disabled:opacity-50"
                            style={{ background: '#16A34A' }}>
                            {savingTrust ? 'Lädt...' : 'Vertrauen'}
                          </button>
                        </div>

                        {getTrustsFor(selectedClaim === 'global' ? null : selectedClaim.id).length === 0 ? (
                          <p className="text-sm" style={{ color: 'var(--muted)' }}>Noch niemand vertraut.</p>
                        ) : (
                          <div className="space-y-3">
                            {getTrustsFor(selectedClaim === 'global' ? null : selectedClaim.id).map(t => (
                              <div key={t.id} className="rounded-xl p-4" style={{ background: 'var(--muted-bg)', border: '1px solid var(--card-border)' }}>
                                <div className="flex items-center justify-between mb-3">
                                  <div className="flex items-center gap-2">
                                    <img src={`https://mc-heads.net/avatar/${t.trusted_name}/24`} alt="" className="w-6 h-6 rounded" />
                                    <span className="font-medium text-sm" style={{ color: 'var(--foreground)' }}>{t.trusted_name}</span>
                                  </div>
                                  <button onClick={() => removeTrust(t)} className="text-xs text-red-500 hover:opacity-70">Entfernen</button>
                                </div>
                                <div className="grid grid-cols-3 gap-2">
                                  {PERM_LABELS.map(perm => (
                                    <button key={perm.key} onClick={() => togglePerm(t, perm.key)}
                                      className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs transition-all"
                                      style={t[perm.key]
                                        ? { background: 'rgba(22,163,74,0.15)', border: '1px solid #16A34A', color: '#16A34A' }
                                        : { background: 'var(--card)', border: '1px solid var(--card-border)', color: 'var(--muted)' }}>
                                      <span>{perm.icon}</span>{perm.label}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {settings && (
                      <div className="card rounded-2xl p-6">
                        <h2 className="font-bold text-lg mb-1" style={{ color: 'var(--foreground)' }}>Öffentliche Permissions</h2>
                        <p className="text-sm mb-4" style={{ color: 'var(--muted)' }}>Was dürfen Spieler, die du NICHT vertraut hast, in deinen Chunks?</p>
                        <div className="grid grid-cols-3 gap-2">
                          {PERM_LABELS.map(perm => {
                            const settingKey = ('public_' + perm.key.replace('perm_', '')) as keyof ClaimSettings
                            return (
                              <button key={perm.key} onClick={() => updateSetting(settingKey, !settings[settingKey])}
                                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs transition-all"
                                style={settings[settingKey]
                                  ? { background: 'rgba(22,163,74,0.15)', border: '1px solid #16A34A', color: '#16A34A' }
                                  : { background: 'var(--muted-bg)', border: '1px solid var(--card-border)', color: 'var(--muted)' }}>
                                <span>{perm.icon}</span>{perm.label}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    )}

                    <div className="grid md:grid-cols-2 gap-6">
                      {settings && (
                        <div className="card rounded-2xl p-6">
                          <h2 className="font-bold text-lg mb-3" style={{ color: 'var(--foreground)' }}>Einstellungen</h2>
                          <button onClick={() => updateSetting('sound_enabled', !settings.sound_enabled)}
                            className="flex items-center justify-between w-full px-4 py-3 rounded-xl text-sm transition-all"
                            style={{ background: 'var(--muted-bg)', border: '1px solid var(--card-border)', color: 'var(--foreground)' }}>
                            <span>🔊 Claim-Sound</span>
                            <span style={{ color: settings.sound_enabled ? '#16A34A' : 'var(--muted)' }}>{settings.sound_enabled ? 'An' : 'Aus'}</span>
                          </button>
                        </div>
                      )}

                      {trustedBy.length > 0 && (
                        <div className="card rounded-2xl p-6">
                          <h2 className="font-bold text-lg mb-3" style={{ color: 'var(--foreground)' }}>Dir wird vertraut von</h2>
                          <div className="space-y-2">
                            {trustedBy.map(t => (
                              <div key={t.id} className="flex items-center gap-2 text-sm" style={{ color: 'var(--foreground)' }}>
                                <span>👤</span> Spieler ({t.claim_id ? 'ein Chunk' : 'alle Chunks'})
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Chat */}
            {activeTab === 'chat' && (
              <div className="card rounded-2xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="font-bold" style={{ color: 'var(--foreground)' }}>Server-Chat</h2>
                  <span className="text-xs" style={{ color: 'var(--muted)' }}>Live verbunden mit dem Minecraft-Server</span>
                </div>

                <div className="rounded-xl overflow-y-auto mb-3 p-4 flex flex-col gap-2"
                  style={{ height: '380px', background: 'var(--muted-bg)', border: '1px solid var(--card-border)' }}>
                  {chatLoading ? (
                    <p className="text-sm" style={{ color: 'var(--muted)' }}>Laden...</p>
                  ) : chatMessages.length === 0 ? (
                    <p className="text-sm" style={{ color: 'var(--muted)' }}>Noch keine Nachrichten. Schreib die erste!</p>
                  ) : (
                    chatMessages.map(m => (
                      <div key={m.id} className="flex items-start gap-2">
                        <img src={`https://mc-heads.net/avatar/${m.sender_name}/24`} alt="" className="w-6 h-6 rounded mt-0.5 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <span className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>{m.sender_name}</span>
                          {m.source === 'web' && (
                            <span className="text-xs ml-1.5 px-1.5 py-0.5 rounded" style={{ background: 'rgba(22,163,74,0.15)', color: '#16A34A' }}>Web</span>
                          )}
                          <span className="text-sm ml-2" style={{ color: 'var(--foreground)' }}>{m.message}</span>
                        </div>
                      </div>
                    ))
                  )}
                  <div ref={chatEndRef} />
                </div>

                {user ? (
                  <div className="flex gap-2">
                    <input type="text" value={chatInput} onChange={e => setChatInput(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') sendChatMessage() }}
                      placeholder="Nachricht schreiben..." maxLength={256}
                      className="flex-1 rounded-xl px-4 py-2.5 text-sm outline-none"
                      style={{ background: 'var(--muted-bg)', border: '1px solid var(--card-border)', color: 'var(--foreground)' }} />
                    <button onClick={sendChatMessage} disabled={sendingChat || !chatInput.trim()}
                      className="px-5 py-2.5 rounded-xl text-sm font-medium text-white disabled:opacity-50"
                      style={{ background: '#16A34A' }}>
                      Senden
                    </button>
                  </div>
                ) : (
                  <p className="text-sm text-center py-2" style={{ color: 'var(--muted)' }}>Du musst eingeloggt sein, um zu schreiben.</p>
                )}
              </div>
            )}

            {/* Regelwerk */}
            {activeTab === 'regelwerk' && (
              <div className="space-y-6">
                {Object.keys(rulesByCategory).length === 0 ? (
                  <p style={{ color: 'var(--muted)' }}>Noch keine Regeln vorhanden.</p>
                ) : (
                  Object.entries(rulesByCategory).map(([category, categoryRules]) => (
                    <div key={category} className="card rounded-2xl p-6">
                      <h2 className="font-bold text-lg mb-4 flex items-center gap-2" style={{ color: 'var(--foreground)' }}>
                        <span className="px-2 py-0.5 rounded-lg text-xs text-white" style={{ background: '#16A34A' }}>{category}</span>
                      </h2>
                      <div className="space-y-4">
                        {categoryRules.map(rule => (
                          <div key={rule.id}>
                            <p className="font-medium mb-1" style={{ color: 'var(--foreground)' }}>{rule.title}</p>
                            <p className="text-sm" style={{ color: 'var(--muted)' }}>{rule.content}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </>
        )}
      </div>

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