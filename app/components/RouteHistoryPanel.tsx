'use client'

import { useState, useEffect } from 'react'

type PlayerOption = { uuid: string; player_name: string }

type Props = {
  myUuid: string | null
  onRoutesChange: (data: { routes: any; playerNames: Record<string, string>; selectedUuids: string[] }) => void
}

const QUICK_RANGES = [
  { key: 'today', label: 'Heute' },
  { key: '7days', label: 'Letzte 7 Tage' },
  { key: 'custom', label: 'Datum wählen' },
]

function todayInGermany(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(new Date())
  const get = (type: string) => parts.find(p => p.type === type)?.value
  return `${get('year')}-${get('month')}-${get('day')}`
}

export default function RouteHistoryPanel({ myUuid, onRoutesChange }: Props) {
  const [players, setPlayers] = useState<PlayerOption[]>([])
  const [selectedUuids, setSelectedUuids] = useState<string[]>(myUuid ? [myUuid] : [])
  const [quickRange, setQuickRange] = useState<string>('today')
  const [customDate, setCustomDate] = useState(todayInGermany())
  const [loading, setLoading] = useState(false)

  // Spielerliste laden
  useEffect(() => {
    fetch('/api/smp/stats')
      .then(r => r.json())
      .then(data => {
        const list = Array.isArray(data.stats) ? data.stats : []
        setPlayers(list.map((s: any) => ({ uuid: s.uuid, player_name: s.player_name })))
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (myUuid && selectedUuids.length === 0) setSelectedUuids([myUuid])
  }, [myUuid])

  const getRange = (): { from: string; to: string } => {
    const today = todayInGermany()
    if (quickRange === 'today') {
      return { from: `${today}T00:00:00`, to: `${today}T23:59:59` }
    }
    if (quickRange === '7days') {
      const d = new Date(today)
      d.setDate(d.getDate() - 7)
      const from = d.toISOString().slice(0, 10)
      return { from: `${from}T00:00:00`, to: `${today}T23:59:59` }
    }
    // custom
    return { from: `${customDate}T00:00:00`, to: `${customDate}T23:59:59` }
  }

  const loadRoutes = () => {
    if (selectedUuids.length === 0) {
      onRoutesChange({ routes: {}, playerNames: {}, selectedUuids: [] })
      return
    }
    setLoading(true)
    const { from, to } = getRange()
    fetch(`/api/smp/route-positions?uuids=${selectedUuids.join(',')}&from=${from}&to=${to}`)
      .then(r => r.json())
      .then(data => {
        onRoutesChange({ routes: data.routes || {}, playerNames: data.playerNames || {}, selectedUuids })
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }

  useEffect(() => {
    loadRoutes()
  }, [selectedUuids, quickRange, customDate])

  const togglePlayer = (uuid: string) => {
    setSelectedUuids(prev =>
      prev.includes(uuid) ? prev.filter(u => u !== uuid) : [...prev, uuid]
    )
  }

  return (
    <div className="card rounded-2xl p-4 mb-3">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <h3 className="font-bold text-sm" style={{ color: 'var(--foreground)' }}>📍 Bewegungsroute</h3>
        <div className="flex gap-1.5">
          {QUICK_RANGES.map(r => (
            <button
              key={r.key}
              onClick={() => setQuickRange(r.key)}
              className="px-2.5 py-1 rounded-lg text-xs font-medium transition"
              style={quickRange === r.key
                ? { background: '#16A34A', color: 'white' }
                : { background: 'var(--muted-bg)', border: '1px solid var(--card-border)', color: 'var(--muted)' }}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {quickRange === 'custom' && (
        <input
          type="date"
          value={customDate}
          onChange={e => setCustomDate(e.target.value)}
          className="mb-3 px-3 py-1.5 rounded-lg text-sm"
          style={{ background: 'var(--muted-bg)', border: '1px solid var(--card-border)', color: 'var(--foreground)' }}
        />
      )}

      <div className="flex flex-wrap gap-1.5">
        {players.map(p => {
          const isSelected = selectedUuids.includes(p.uuid)
          const isMe = myUuid === p.uuid
          return (
            <button
              key={p.uuid}
              onClick={() => togglePlayer(p.uuid)}
              className="px-2.5 py-1 rounded-lg text-xs font-medium transition"
              style={isSelected
                ? { background: 'rgba(22,163,74,0.15)', border: '1px solid #16A34A', color: '#16A34A' }
                : { background: 'var(--muted-bg)', border: '1px solid var(--card-border)', color: 'var(--muted)' }}
            >
              {isMe ? '⭐ ' : ''}{p.player_name}
            </button>
          )
        })}
      </div>

      {loading && <p className="text-xs opacity-50 mt-2">Lädt Route...</p>}
    </div>
  )
}
