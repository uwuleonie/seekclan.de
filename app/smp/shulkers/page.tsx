'use client'

import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../../lib/auth-context'
import { ItemSlot, EnchantGlintStyle } from '../../components/ItemSlot'

type ShulkerItem = { slot: number; type: string; amount: number; name?: string; enchants?: Record<string, number> }

type Shulker = {
  id: number
  shulker_uid: string
  owner_uuid: string
  owner_name: string
  name: string | null
  world: string | null
  x: number | null
  y: number | null
  z: number | null
  placed_at: string
  contents: ShulkerItem[] | null
}

type ShulkerTrust = {
  id: number
  scope: 'shulker' | 'all'
  shulker_id: number | null
  trusted_uuid: string
  trusted_name: string
  permission: 'OPEN' | 'BREAK'
}

type PlayerOption = { uuid: string; player_name: string }

const PERMISSIONS: { key: 'OPEN' | 'BREAK'; label: string; icon: string }[] = [
  { key: 'OPEN', label: 'Öffnen', icon: '📦' },
  { key: 'BREAK', label: 'Abbauen', icon: '⛏️' },
]

function ShulkerContentsGrid({ contents }: { contents: ShulkerItem[] | null }) {
  if (!contents || contents.length === 0) {
    return <p className="text-xs" style={{ color: 'var(--muted)' }}>Leer (oder noch nie synchronisiert — öffne die Kiste ingame einmal).</p>
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(9, 40px)', gap: 2 }}>
      {Array.from({ length: 27 }).map((_, i) => {
        const item = contents.find(c => c.slot === i)
        return <ItemSlot key={i} item={item} />
      })}
    </div>
  )
}
function TrustToggle({ active, onChange }: { active: boolean; onChange: (next: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!active)}
      className="px-2 py-1 text-xs font-medium rounded-lg transition flex-1"
      style={active ? { background: '#16A34A', color: 'white' } : { background: 'var(--muted-bg)', color: 'var(--muted)' }}
    >
      {active ? 'Erlaubt' : 'Verboten'}
    </button>
  )
}

function PlayerSearchBox({ onSelect }: { onSelect: (p: PlayerOption) => void }) {
  const [search, setSearch] = useState('')
  const [suggestions, setSuggestions] = useState<PlayerOption[]>([])
  const [focused, setFocused] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (search.trim().length < 2) { setSuggestions([]); return }
    const timeout = setTimeout(() => {
      fetch(`/api/smp/players-search?q=${encodeURIComponent(search.trim())}`)
        .then(r => r.json())
        .then(data => setSuggestions(data.players || []))
    }, 200)
    return () => clearTimeout(timeout)
  }, [search])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setFocused(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  return (
    <div ref={ref} className="relative">
      <input
        type="text"
        value={search}
        onChange={e => setSearch(e.target.value)}
        onFocus={() => setFocused(true)}
        placeholder="Spielername eingeben, um zu vertrauen..."
        className="w-full px-3 py-2 rounded-lg text-sm"
        style={{ background: 'var(--muted-bg)', border: '1px solid var(--card-border)', color: 'var(--foreground)' }}
      />
      {focused && suggestions.length > 0 && (
        <div className="absolute left-0 right-0 mt-1 rounded-lg overflow-hidden z-10" style={{ background: 'var(--card)', border: '1px solid var(--card-border)' }}>
          {suggestions.map(p => (
            <button
              key={p.uuid}
              onClick={() => { onSelect(p); setSearch(''); setFocused(false) }}
              onMouseDown={e => e.preventDefault()}
              className="w-full text-left px-3 py-1.5 text-sm transition flex items-center gap-2"
              style={{ color: 'var(--foreground)' }}
            >
              <img src={`/api/player-heads/${p.player_name}/24`} alt="" className="w-6 h-6 rounded flex-shrink-0" />
              {p.player_name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default function ShulkersPage() {
  const { user } = useAuth()
  const [shulkers, setShulkers] = useState<Shulker[]>([])
  const [trusts, setTrusts] = useState<ShulkerTrust[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [renamingId, setRenamingId] = useState<number | null>(null)
  const [newName, setNewName] = useState('')
  const [globalExpanded, setGlobalExpanded] = useState(false)

  const load = () => {
    setLoading(true)
    fetch('/api/smp/shulkers')
      .then(r => r.json())
      .then(data => {
        setShulkers(data.shulkers || [])
        setTrusts(data.trusts || [])
        setLoading(false)
      })
  }

  useEffect(() => { if (user) load() }, [user])

  const trustsFor = (scope: 'shulker' | 'all', shulkerId: number | null) =>
    trusts.filter(t => t.scope === scope && t.shulker_id === shulkerId)

  const isTrusted = (scope: 'shulker' | 'all', shulkerId: number | null, uuid: string, permission: 'OPEN' | 'BREAK') =>
    trustsFor(scope, shulkerId).some(t => t.trusted_uuid === uuid && t.permission === permission)

  const setShulkerTrust = async (shulkerId: number, target: PlayerOption, permission: 'OPEN' | 'BREAK', value: boolean) => {
    setTrusts(prev => {
      const filtered = prev.filter(t => !(t.scope === 'shulker' && t.shulker_id === shulkerId && t.trusted_uuid === target.uuid && t.permission === permission))
      if (!value) return filtered
      return [...filtered, { id: -1, scope: 'shulker', shulker_id: shulkerId, trusted_uuid: target.uuid, trusted_name: target.player_name, permission }]
    })
    await fetch(`/api/smp/shulkers/${shulkerId}/trust`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetUuid: target.uuid, targetName: target.player_name, permission, trusted: value }),
    })
    load()
  }

  const setGlobalTrust = async (target: PlayerOption, permission: 'OPEN' | 'BREAK', value: boolean) => {
    setTrusts(prev => {
      const filtered = prev.filter(t => !(t.scope === 'all' && t.trusted_uuid === target.uuid && t.permission === permission))
      if (!value) return filtered
      return [...filtered, { id: -1, scope: 'all', shulker_id: null, trusted_uuid: target.uuid, trusted_name: target.player_name, permission }]
    })
    await fetch('/api/smp/shulkers/global-trust', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetUuid: target.uuid, targetName: target.player_name, permission, trusted: value }),
    })
    load()
  }

  const saveRename = async (id: number) => {
    if (!newName.trim()) return
    await fetch(`/api/smp/shulkers/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName.trim() }),
    })
    setRenamingId(null)
    setNewName('')
    load()
  }

  if (!user) {
    return (
      <div className="card rounded-2xl p-12 text-center">
        <p className="text-5xl mb-4">🔒</p>
        <p className="font-bold" style={{ color: 'var(--foreground)' }}>Du musst eingeloggt sein.</p>
      </div>
    )
  }

  const globalTrustedPlayers = Array.from(new Map(trustsFor('all', null).map(t => [t.trusted_uuid, t.trusted_name])).entries())

  return (
    <div className="space-y-4">
      <EnchantGlintStyle />
      <div className="card rounded-2xl p-6">
        <button onClick={() => setGlobalExpanded(prev => !prev)} className="w-full flex items-center justify-between">
          <h2 className="font-bold text-lg" style={{ color: 'var(--foreground)' }}>🌍 Global (alle meine Shulker)</h2>
          <span style={{ color: 'var(--muted)' }}>{globalExpanded ? '▲' : '▼'}</span>
        </button>
        <p className="text-sm mt-1 mb-3" style={{ color: 'var(--muted)' }}>
          Spieler, die für alle deine Shulkerkisten gleichzeitig vertraut werden.
        </p>

        {globalExpanded && (
          <>
            <PlayerSearchBox onSelect={p => setGlobalTrust(p, 'OPEN', true)} />
            <div className="space-y-2 mt-3">
              {globalTrustedPlayers.length === 0 ? (
                <p className="text-xs" style={{ color: 'var(--muted)' }}>Noch niemand global vertraut.</p>
              ) : (
                globalTrustedPlayers.map(([uuid, name]) => (
                  <div key={uuid} className="flex items-center justify-between gap-3 p-2 rounded-lg" style={{ background: 'var(--muted-bg)' }}>
                    <span className="text-sm flex items-center gap-2" style={{ color: 'var(--foreground)' }}>
                      <img src={`/api/player-heads/${name}/24`} alt="" className="w-6 h-6 rounded" />
                      {name}
                    </span>
                    <div className="flex gap-2">
                      {PERMISSIONS.map(p => (
                        <div key={p.key} className="flex items-center gap-1">
                          <span className="text-xs" style={{ color: 'var(--muted)' }}>{p.icon}</span>
                          <TrustToggle
                            active={isTrusted('all', null, uuid, p.key)}
                            onChange={v => setGlobalTrust({ uuid, player_name: name }, p.key, v)}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </div>

      <div className="card rounded-2xl p-6">
        <h2 className="font-bold text-lg mb-1" style={{ color: 'var(--foreground)' }}>📦 Deine Shulkerkisten ({shulkers.length})</h2>
        <p className="text-sm mb-4" style={{ color: 'var(--muted)' }}>
          Platziere eine Shulkerkiste ingame, um sie automatisch zu claimen. Klicke auf eine Kiste, um Trust einzustellen.
        </p>

        {loading ? (
          <p className="text-sm" style={{ color: 'var(--muted)' }}>Lädt...</p>
        ) : shulkers.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--muted)' }}>Du hast noch keine Shulkerkisten platziert.</p>
        ) : (
          <div className="space-y-2">
            {shulkers.map(s => {
              const isOpen = expandedId === s.id
              const shulkerTrusted = Array.from(new Map(trustsFor('shulker', s.id).map(t => [t.trusted_uuid, t.trusted_name])).entries())
              return (
                <div key={s.id} className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--card-border)' }}>
                  <div className="flex items-center justify-between gap-3 px-4 py-3" style={{ background: 'var(--muted-bg)' }}>
                    {renamingId === s.id ? (
                      <div className="flex items-center gap-2 flex-1">
                        <input
                          type="text"
                          value={newName}
                          onChange={e => setNewName(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && saveRename(s.id)}
                          placeholder={s.name || `Shulker #${s.id}`}
                          autoFocus
                          className="flex-1 px-2 py-1 rounded-lg text-sm"
                          style={{ background: 'var(--card)', border: '1px solid var(--card-border)', color: 'var(--foreground)' }}
                        />
                        <button onClick={() => saveRename(s.id)} className="text-xs font-medium px-2 py-1 rounded-lg" style={{ background: '#16A34A', color: 'white' }}>✓</button>
                        <button onClick={() => setRenamingId(null)} className="text-xs px-2 py-1" style={{ color: 'var(--muted)' }}>✕</button>
                      </div>
                    ) : (
                      <button onClick={() => setExpandedId(isOpen ? null : s.id)} className="flex-1 text-left">
                        <p className="font-medium text-sm" style={{ color: 'var(--foreground)' }}>
                          📦 {s.name || `Shulker #${s.id}`}
                        </p>
                        <p className="text-xs" style={{ color: 'var(--muted)' }}>
                          {s.world} · {s.x !== null ? `${Math.round(s.x)}, ${Math.round(s.y!)}, ${Math.round(s.z!)}` : 'Position unbekannt'}
                        </p>
                      </button>
                    )}
                    {renamingId !== s.id && (
                      <button onClick={() => { setRenamingId(s.id); setNewName(s.name || '') }} className="text-xs hover:opacity-70 flex-shrink-0" style={{ color: 'var(--muted)' }}>
                        ✏️
                      </button>
                    )}
                  </div>

                  {isOpen && (
                    <div className="px-4 py-3 space-y-3" style={{ background: 'var(--card)' }}>
                      <div>
                        <p className="text-xs font-medium mb-2" style={{ color: 'var(--foreground)' }}>📦 Inhalt</p>
                        <ShulkerContentsGrid contents={s.contents} />
                      </div>

                      <PlayerSearchBox onSelect={p => setShulkerTrust(s.id, p, 'OPEN', true)} />
                      {shulkerTrusted.length === 0 ? (
                        <p className="text-xs" style={{ color: 'var(--muted)' }}>Noch niemand für diese Kiste vertraut.</p>
                      ) : (
                        shulkerTrusted.map(([uuid, name]) => (
                          <div key={uuid} className="flex items-center justify-between gap-3 p-2 rounded-lg" style={{ background: 'var(--muted-bg)' }}>
                            <span className="text-sm flex items-center gap-2" style={{ color: 'var(--foreground)' }}>
                              <img src={`/api/player-heads/${name}/24`} alt="" className="w-6 h-6 rounded" />
                              {name}
                            </span>
                            <div className="flex gap-2">
                              {PERMISSIONS.map(p => (
                                <div key={p.key} className="flex items-center gap-1">
                                  <span className="text-xs" style={{ color: 'var(--muted)' }}>{p.icon}</span>
                                  <TrustToggle
                                    active={isTrusted('shulker', s.id, uuid, p.key)}
                                    onChange={v => setShulkerTrust(s.id, { uuid, player_name: name }, p.key, v)}
                                  />
                                </div>
                              ))}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}