'use client'

import { useState, useEffect, useRef } from 'react'
import type { Claim } from '../smp/claims/page'

type PermissionRule = {
  id: number
  scope: 'chunk_all' | 'chunk_player'
  target_uuid: string | null
  target_name: string | null
  permission: string
  allowed: boolean
}

type PlayerOption = { uuid: string; player_name: string }

// Drei Zustände pro Permission: true = erlaubt, false = verboten, null = nicht gesetzt
type PermState = boolean | null

const PERMISSIONS: { key: string; label: string; icon: string }[] = [
  { key: 'BLOCK_BREAK', label: 'Blöcke abbauen', icon: '⛏️' },
  { key: 'BLOCK_PLACE', label: 'Blöcke platzieren', icon: '🧱' },
  { key: 'BUCKET_USE', label: 'Eimer benutzen', icon: '🪣' },
  { key: 'CONTAINER_OPEN', label: 'Container öffnen', icon: '📦' },
  { key: 'ITEM_PICKUP', label: 'Items aufheben', icon: '🤲' },
  { key: 'ITEM_FRAME', label: 'Item Frames', icon: '🖼️' },
  { key: 'DOOR_USE', label: 'Türen benutzen', icon: '🚪' },
  { key: 'BUTTON_LEVER_USE', label: 'Buttons/Hebel', icon: '🔘' },
  { key: 'REDSTONE_USE', label: 'Redstone', icon: '🔴' },
  { key: 'CROP_HARVEST', label: 'Pflanzen ernten', icon: '🌾' },
  { key: 'ANIMAL_INTERACT', label: 'Tiere (füttern etc.)', icon: '🐄' },
  { key: 'MOB_KILL', label: 'Mobs töten', icon: '⚔️' },
  { key: 'VEHICLE_USE', label: 'Boote/Minecarts', icon: '🚤' },
  { key: 'MOUNT_USE', label: 'Reiten', icon: '🐴' },
]

function PermissionToggle({ state, onChange }: { state: PermState; onChange: (next: PermState) => void }) {
  const options: { value: PermState; label: string; color: string }[] = [
    { value: true, label: 'Erlaubt', color: '#16A34A' },
    { value: null, label: 'Erben', color: 'var(--muted)' },
    { value: false, label: 'Verboten', color: '#EF4444' },
  ]

  return (
    <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid var(--card-border)' }}>
      {options.map(opt => (
        <button
          key={String(opt.value)}
          onClick={() => onChange(opt.value)}
          className="px-2 py-1 text-xs font-medium transition flex-1"
          style={state === opt.value
            ? { background: opt.color, color: opt.value === null ? 'var(--background)' : 'white' }
            : { background: 'var(--muted-bg)', color: 'var(--muted)' }}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

export default function PermissionPanel({ claim, groupName }: { claim: Claim; groupName: string | null }) {
  const [rules, setRules] = useState<PermissionRule[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [suggestions, setSuggestions] = useState<PlayerOption[]>([])
  const [searchFocused, setSearchFocused] = useState(false)
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerOption | null>(null)
  const searchBoxRef = useRef<HTMLDivElement>(null)

  const loadRules = () => {
    setLoading(true)
    fetch(`/api/smp/claims/${claim.id}/permissions`)
      .then(r => r.json())
      .then(data => {
        setRules(data.rules || [])
        setLoading(false)
      })
  }

  useEffect(() => {
    loadRules()
    setSelectedPlayer(null)
    setSearch('')
  }, [claim.id])

  // Spielervorschläge laden, während getippt wird
  useEffect(() => {
    if (search.trim().length < 2) {
      setSuggestions([])
      return
    }
    const timeout = setTimeout(() => {
      fetch(`/api/smp/players-search?q=${encodeURIComponent(search.trim())}`)
        .then(r => r.json())
        .then(data => setSuggestions(data.players || []))
    }, 200)
    return () => clearTimeout(timeout)
  }, [search])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (searchBoxRef.current && !searchBoxRef.current.contains(e.target as Node)) {
        setSearchFocused(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const scope: 'chunk_all' | 'chunk_player' = selectedPlayer ? 'chunk_player' : 'chunk_all'

  const stateFor = (permissionKey: string): PermState => {
    const rule = rules.find(r =>
      r.scope === scope &&
      r.permission === permissionKey &&
      (scope === 'chunk_all' || r.target_uuid === selectedPlayer?.uuid)
    )
    return rule ? rule.allowed : null
  }

  const setPermission = async (permissionKey: string, value: PermState) => {
    // Optimistisches Update im UI, bevor die Antwort vom Server da ist
    setRules(prev => {
      const filtered = prev.filter(r => !(
        r.scope === scope &&
        r.permission === permissionKey &&
        (scope === 'chunk_all' || r.target_uuid === selectedPlayer?.uuid)
      ))
      if (value === null) return filtered
      return [...filtered, {
        id: -1,
        scope,
        target_uuid: scope === 'chunk_player' ? selectedPlayer!.uuid : null,
        target_name: scope === 'chunk_player' ? selectedPlayer!.player_name : null,
        permission: permissionKey,
        allowed: value,
      }]
    })

    await fetch(`/api/smp/claims/${claim.id}/permissions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        scope,
        targetUuid: scope === 'chunk_player' ? selectedPlayer?.uuid : undefined,
        targetName: scope === 'chunk_player' ? selectedPlayer?.player_name : undefined,
        permission: permissionKey,
        allowed: value,
      }),
    })
    loadRules() // mit Server-Stand synchronisieren (z.B. echte ID statt -1)
  }

  return (
    <div className="card rounded-2xl p-6">
      <div className="mb-4">
        <h2 className="font-bold text-lg" style={{ color: 'var(--foreground)' }}>
          📍 {claim.name || `Chunk ${claim.chunk_x}, ${claim.chunk_z}`}
        </h2>
        <p className="text-sm" style={{ color: 'var(--muted)' }}>
          {claim.world}{groupName ? ` · Gruppe: ${groupName}` : ''} · erstellt am {new Date(claim.claimed_at).toLocaleDateString('de-DE')}
        </p>
      </div>

      {/* Suchleiste für Spieler-spezifische Permissions */}
      <div ref={searchBoxRef} className="relative mb-4">
        {selectedPlayer ? (
          <div className="flex items-center justify-between px-3 py-2 rounded-lg" style={{ background: 'rgba(22,163,74,0.1)', border: '1px solid #16A34A' }}>
            <span className="text-sm font-medium" style={{ color: '#16A34A' }}>👤 Permissions für {selectedPlayer.player_name}</span>
            <button onClick={() => setSelectedPlayer(null)} className="text-xs hover:opacity-70" style={{ color: '#16A34A' }}>
              Zurück zu "Alle"
            </button>
          </div>
        ) : (
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            onFocus={() => setSearchFocused(true)}
            placeholder="Spielername eingeben, um individuelle Rechte zu setzen..."
            className="w-full px-3 py-2 rounded-lg text-sm"
            style={{ background: 'var(--muted-bg)', border: '1px solid var(--card-border)', color: 'var(--foreground)' }}
          />
        )}

        {searchFocused && !selectedPlayer && suggestions.length > 0 && (
          <div className="absolute left-0 right-0 mt-1 rounded-lg overflow-hidden z-10" style={{ background: 'var(--card)', border: '1px solid var(--card-border)' }}>
            {suggestions.map(p => (
              <button
                key={p.uuid}
                onClick={() => { setSelectedPlayer(p); setSearchFocused(false) }}
                onMouseDown={e => e.preventDefault()}
                className="w-full text-left px-3 py-1.5 text-sm transition"
                style={{ color: 'var(--foreground)' }}
              >
                {p.player_name}
              </button>
            ))}
          </div>
        )}
      </div>

      <p className="text-xs mb-3" style={{ color: 'var(--muted)' }}>
        {selectedPlayer
          ? 'Nicht gesetzte Rechte fallen zurück auf die "Alle"-Einstellung für diesen Chunk.'
          : 'Diese Rechte gelten für alle vertrauten Spieler in diesem Chunk (sofern nicht individuell überschrieben).'}
      </p>

      {loading ? (
        <p className="text-sm" style={{ color: 'var(--muted)' }}>Lädt...</p>
      ) : (
        <div className="space-y-2">
          {PERMISSIONS.map(perm => (
            <div key={perm.key} className="flex items-center justify-between gap-3 py-1.5">
              <span className="text-sm flex items-center gap-2" style={{ color: 'var(--foreground)' }}>
                <span>{perm.icon}</span> {perm.label}
              </span>
              <div className="w-56">
                <PermissionToggle state={stateFor(perm.key)} onChange={v => setPermission(perm.key, v)} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}