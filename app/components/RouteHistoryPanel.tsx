'use client'

import { useState, useEffect, useRef } from 'react'

type PlayerOption = { uuid: string; player_name: string }

type Props = {
  myUuid: string | null
  onRoutesChange: (data: { routes: any; playerNames: Record<string, string>; selectedUuids: string[]; lastKnown: Record<string, any> }) => void
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
  const [selectedUuids, setSelectedUuids] = useState<string[]>([])
  const [showMyRoute, setShowMyRoute] = useState(false)
  const [search, setSearch] = useState('')
  const [searchFocused, setSearchFocused] = useState(false)
  const [quickRange, setQuickRange] = useState<string>('today')
  const [customDate, setCustomDate] = useState(todayInGermany())
  const [loading, setLoading] = useState(false)
  const searchBoxRef = useRef<HTMLDivElement>(null)

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

  // Suchvorschläge: passende Spieler, die noch nicht ausgewählt sind
  const suggestions = search.trim().length === 0
    ? []
    : players
        .filter(p => !selectedUuids.includes(p.uuid))
        .filter(p => p.player_name.toLowerCase().includes(search.trim().toLowerCase()))
        .slice(0, 6)

  // Klick außerhalb der Suchbox schließt die Vorschlagsliste
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (searchBoxRef.current && !searchBoxRef.current.contains(e.target as Node)) {
        setSearchFocused(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const addPlayer = (uuid: string) => {
    setSelectedUuids(prev => prev.includes(uuid) ? prev : [...prev, uuid])
    setSearch('')
  }

  const removePlayer = (uuid: string) => {
    setSelectedUuids(prev => prev.filter(u => u !== uuid))
  }

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

  // Effektive Auswahl: gesuchte Spieler + ggf. ich selbst, wenn eingeblendet
  const effectiveUuids = (() => {
    const set = new Set(selectedUuids)
    if (showMyRoute && myUuid) set.add(myUuid)
    return Array.from(set)
  })()

  const loadRoutes = () => {
    if (effectiveUuids.length === 0) {
      onRoutesChange({ routes: {}, playerNames: {}, selectedUuids: [], lastKnown: {} })
      return
    }
    setLoading(true)
    const { from, to } = getRange()
    fetch(`/api/smp/route-positions?uuids=${effectiveUuids.join(',')}&from=${from}&to=${to}`)
      .then(r => r.json())
      .then(data => {
        onRoutesChange({
          routes: data.routes || {},
          playerNames: data.playerNames || {},
          selectedUuids: effectiveUuids,
          lastKnown: data.lastKnown || {},
        })
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }

  useEffect(() => {
    loadRoutes()
  }, [selectedUuids, showMyRoute, quickRange, customDate, myUuid])

  const nameForUuid = (uuid: string) => players.find(p => p.uuid === uuid)?.player_name || '?'

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

      {/* Eigene Route ein-/ausblenden */}
      {myUuid && (
        <button
          onClick={() => setShowMyRoute(!showMyRoute)}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition mb-3"
          style={showMyRoute
            ? { background: 'rgba(22,163,74,0.15)', border: '1px solid #16A34A', color: '#16A34A' }
            : { background: 'var(--muted-bg)', border: '1px solid var(--card-border)', color: 'var(--muted)' }}
        >
          {showMyRoute ? '👁️' : '🚫'} ⭐ Meine Route {showMyRoute ? 'ausblenden' : 'anzeigen'}
        </button>
      )}

      {/* Suchleiste */}
      <div ref={searchBoxRef} className="relative mb-3">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          onFocus={() => setSearchFocused(true)}
          placeholder="Spieler suchen..."
          className="w-full px-3 py-1.5 rounded-lg text-sm"
          style={{ background: 'var(--muted-bg)', border: '1px solid var(--card-border)', color: 'var(--foreground)' }}
        />
        {searchFocused && suggestions.length > 0 && (
          <div
            className="absolute left-0 right-0 mt-1 rounded-lg overflow-hidden z-10"
            style={{ background: 'var(--card)', border: '1px solid var(--card-border)' }}
          >
            {suggestions.map(p => (
              <button
                key={p.uuid}
                onClick={() => addPlayer(p.uuid)}
                className="w-full text-left px-3 py-1.5 text-sm transition"
                style={{ color: 'var(--foreground)' }}
                onMouseDown={e => e.preventDefault()}
              >
                {p.player_name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Ausgewählte Spieler als Chips */}
      {selectedUuids.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selectedUuids.map(uuid => (
            <span
              key={uuid}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium"
              style={{ background: 'rgba(22,163,74,0.15)', border: '1px solid #16A34A', color: '#16A34A' }}
            >
              {nameForUuid(uuid)}
              <button onClick={() => removePlayer(uuid)} className="hover:opacity-70">✕</button>
            </span>
          ))}
        </div>
      )}

      {loading && <p className="text-xs opacity-50 mt-2">Lädt Route...</p>}
    </div>
  )
}