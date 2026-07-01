'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useAuth } from '../../../lib/auth-context'

type TrustEntry = { scope: 'claim' | 'global'; claimId: number | null; label: string }
type PermEntry = { scope: string; claimId: number | null; groupId: number | null; label: string; permission: string; allowed: boolean }
type PlayerEntry = { uuid: string; name: string; trusts: TrustEntry[]; permissions: PermEntry[] }

const PERMISSION_LABELS: Record<string, string> = {
  BLOCK_BREAK: 'Blöcke abbauen', BLOCK_PLACE: 'Blöcke platzieren', BUCKET_USE: 'Eimer benutzen',
  CONTAINER_OPEN: 'Container öffnen', ITEM_PICKUP: 'Items aufheben', ITEM_FRAME: 'Item Frames',
  DOOR_USE: 'Türen benutzen', BUTTON_LEVER_USE: 'Buttons/Hebel', REDSTONE_USE: 'Redstone',
  CROP_HARVEST: 'Pflanzen ernten', ANIMAL_INTERACT: 'Tiere (füttern etc.)', MOB_KILL: 'Mobs töten',
  VEHICLE_USE: 'Boote/Minecarts', MOUNT_USE: 'Reiten',
}

export default function TrustedPlayersPage() {
  const { user } = useAuth()
  const [players, setPlayers] = useState<PlayerEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    setLoading(true)
    fetch('/api/smp/trusted-players')
      .then(r => r.json())
      .then(data => {
        setPlayers(data.players || [])
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

  // Gruppieren je nach Permission-Zielort, um Links anzubieten
  const linkFor = (p: PermEntry) => {
    if (p.scope === 'chunk_player' && p.claimId) return `/smp/claims?claim=${p.claimId}`
    if (p.scope === 'group_player' && p.groupId) return `/smp/claims?group=${p.groupId}`
    if (p.scope === 'global_player') return '/smp/claims/global'
    return null
  }

  return (
    <div className="space-y-4">
      <Link href="/smp/claims" className="text-sm flex items-center gap-1 hover:opacity-70" style={{ color: 'var(--muted)' }}>
        ← Zurück zu deinen Claims
      </Link>

      <div className="card rounded-2xl p-6">
        <h2 className="font-bold text-lg mb-1" style={{ color: 'var(--foreground)' }}>👥 Vertraute Spieler ({players.length})</h2>
        <p className="text-sm mb-4" style={{ color: 'var(--muted)' }}>
          🟢 Voller Trust (per <code>/trust</code>) · 🟡 Nur individuelle Rechte irgendwo gesetzt
        </p>

        {loading ? (
          <p className="text-sm" style={{ color: 'var(--muted)' }}>Lädt...</p>
        ) : players.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--muted)' }}>Noch niemand vertraut.</p>
        ) : (
          <div className="space-y-2">
            {players.map(p => {
              const hasTrust = p.trusts.length > 0
              const color = hasTrust ? '#16A34A' : '#EAB308'
              const isOpen = expanded === p.uuid
              return (
                <div key={p.uuid} className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--card-border)' }}>
                  <button
                    onClick={() => setExpanded(isOpen ? null : p.uuid)}
                    className="w-full flex items-center justify-between gap-3 px-4 py-3 transition"
                    style={{ background: 'var(--muted-bg)' }}
                  >
                    <span className="flex items-center gap-3">
                      <img src={`/api/player-heads/${p.name}/28`} alt="" className="w-7 h-7 rounded-lg flex-shrink-0" />
                      <span className="font-medium text-sm" style={{ color: 'var(--foreground)' }}>{p.name}</span>
                      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: color }} />
                    </span>
                    <span className="text-xs" style={{ color: 'var(--muted)' }}>
                      {hasTrust ? `Vertraut auf ${p.trusts.length} Ort${p.trusts.length === 1 ? '' : 'en'}` : `${p.permissions.length} individuelle Regel${p.permissions.length === 1 ? '' : 'n'}`}
                      {' '}{isOpen ? '▲' : '▼'}
                    </span>
                  </button>

                  {isOpen && (
                    <div className="px-4 py-3 space-y-3" style={{ background: 'var(--card)' }}>
                      {p.trusts.length > 0 && (
                        <div>
                          <p className="text-xs font-medium mb-1" style={{ color: '#16A34A' }}>🟢 Vollständig vertraut auf:</p>
                          <div className="flex flex-wrap gap-1.5">
                            {p.trusts.map((t, i) => (
                              <span key={i} className="text-xs px-2 py-1 rounded-lg" style={{ background: 'rgba(22,163,74,0.1)', color: '#16A34A' }}>
                                {t.label}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {p.permissions.length > 0 && (
                        <div>
                          <p className="text-xs font-medium mb-1" style={{ color: '#EAB308' }}>🟡 Individuelle Rechte:</p>
                          <div className="space-y-1">
                            {p.permissions.map((perm, i) => {
                              const href = linkFor(perm)
                              const content = (
                                <span className="text-xs px-2 py-1 rounded-lg flex items-center gap-1.5"
                                  style={{ background: perm.allowed ? 'rgba(22,163,74,0.1)' : 'rgba(239,68,68,0.1)', color: perm.allowed ? '#16A34A' : '#EF4444' }}>
                                  {perm.allowed ? '✓' : '✗'} {PERMISSION_LABELS[perm.permission] || perm.permission}
                                  <span style={{ color: 'var(--muted)' }}>· {perm.label}</span>
                                </span>
                              )
                              return href ? (
                                <Link key={i} href={href} className="block hover:opacity-80 w-fit">{content}</Link>
                              ) : (
                                <div key={i} className="w-fit">{content}</div>
                              )
                            })}
                          </div>
                        </div>
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