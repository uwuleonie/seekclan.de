'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '../../lib/auth-context'
import PermissionPanel from '../../components/PermissionPanel'

export type Claim = {
  id: number
  owner_uuid: string
  owner_name: string
  world: string
  chunk_x: number
  chunk_z: number
  name: string | null
  group_id: number | null
  is_admin_claim: boolean
  keep_loaded: boolean
  fire_spread_protection: boolean
  tnt_explosion_protection: boolean
  claimed_at: string
}

export type ClaimGroup = {
  id: number
  owner_uuid: string
  owner_name: string
  name: string | null
  is_auto: boolean
  created_at: string
}

export default function ClaimsPage() {
  const { user } = useAuth()
  const [claims, setClaims] = useState<Claim[]>([])
  const [groups, setGroups] = useState<ClaimGroup[]>([])
  const [linked, setLinked] = useState(true)
  const [loading, setLoading] = useState(true)
  const [selectedClaim, setSelectedClaim] = useState<Claim | null>(null)

  const loadClaimsData = () => {
    if (!user) return
    setLoading(true)
    fetch('/api/smp/claims').then(r => r.json()).then(data => {
      setClaims(data.claims || [])
      setGroups(data.groups || [])
      setLinked(data.linked)
      setLoading(false)
    })
  }

  useEffect(() => {
    if (user) loadClaimsData()
  }, [user])

  const groupNameFor = (groupId: number | null) => {
    if (groupId === null) return null
    return groups.find(g => g.id === groupId)?.name || `Gruppe #${groupId}`
  }

  if (!user) {
    return (
      <div className="card rounded-2xl p-12 text-center">
        <p className="text-5xl mb-4">🔒</p>
        <p className="font-bold" style={{ color: 'var(--foreground)' }}>Du musst eingeloggt sein.</p>
      </div>
    )
  }

  if (loading) return <p style={{ color: 'var(--muted)' }}>Laden...</p>

  if (!linked) {
    return (
      <div className="card rounded-2xl p-12 text-center">
        <p className="text-5xl mb-4">🔗</p>
        <p className="font-bold mb-2" style={{ color: 'var(--foreground)' }}>Kein Minecraft-Account verknüpft</p>
        <p className="text-sm" style={{ color: 'var(--muted)' }}>Verknüpfe deinen Minecraft-Account in den Einstellungen, um deine Claims zu sehen.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="card rounded-2xl p-6">
        <h2 className="font-bold text-lg mb-1" style={{ color: 'var(--foreground)' }}>Deine Claims ({claims.length})</h2>
        <p className="text-sm mb-4" style={{ color: 'var(--muted)' }}>
          Claime Chunks ingame mit <code>/claim</code>. Klicke auf einen Claim, um die Berechtigungen einzustellen.
        </p>

        {claims.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--muted)' }}>Du hast noch keine Chunks geclaimt.</p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {claims.map(c => {
              const groupName = groupNameFor(c.group_id)
              return (
                <button key={c.id} onClick={() => setSelectedClaim(c)}
                  className="rounded-xl p-3 text-left transition-all"
                  style={selectedClaim?.id === c.id
                    ? { background: '#16A34A', color: 'white' }
                    : { background: 'var(--muted-bg)', border: '1px solid var(--card-border)', color: 'var(--foreground)' }}>
                  <p className="font-bold text-sm">📍 {c.name || `Chunk ${c.chunk_x},${c.chunk_z}`}</p>
                  <p className="text-xs opacity-80">{c.world}{groupName ? ` · ${groupName}` : ''}</p>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {selectedClaim && (
        <PermissionPanel claim={selectedClaim} groupName={groupNameFor(selectedClaim.group_id)} />
      )}
    </div>
  )
}