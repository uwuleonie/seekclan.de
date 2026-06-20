'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useAuth } from '../../lib/auth-context'
import PermissionPanel from '../../components/PermissionPanel'
import GroupPanel from '../../components/GroupPanel'

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
  const searchParams = useSearchParams()
  const [claims, setClaims] = useState<Claim[]>([])
  const [groups, setGroups] = useState<ClaimGroup[]>([])
  const [linked, setLinked] = useState(true)
  const [loading, setLoading] = useState(true)
  const [selectedClaim, setSelectedClaim] = useState<Claim | null>(null)
  const [selectedGroup, setSelectedGroup] = useState<ClaimGroup | null>(null)
  const [draggedClaim, setDraggedClaim] = useState<Claim | null>(null)
  const [dragOverGroupId, setDragOverGroupId] = useState<number | 'none' | null>(null)
  const [confirmMove, setConfirmMove] = useState<{ claim: Claim; targetGroupId: number | null; targetGroupName: string } | null>(null)
  const [showNewGroupBox, setShowNewGroupBox] = useState(false)
  const [newGroupName, setNewGroupName] = useState('')
  const [creatingGroup, setCreatingGroup] = useState(false)

  const loadClaimsData = () => {
    if (!user) return
    setLoading(true)
    fetch('/api/smp/claims').then(r => r.json()).then(data => {
      const loadedClaims: Claim[] = data.claims || []
      const loadedGroups: ClaimGroup[] = data.groups || []
      setClaims(loadedClaims)
      setGroups(loadedGroups)
      setLinked(data.linked)
      setLoading(false)

      const claimParam = searchParams.get('claim')
      const groupParam = searchParams.get('group')
      if (claimParam) {
        const c = loadedClaims.find(c => c.id === Number(claimParam))
        if (c) { setSelectedGroup(null); setSelectedClaim(c) }
      } else if (groupParam) {
        const g = loadedGroups.find(g => g.id === Number(groupParam))
        if (g) { setSelectedClaim(null); setSelectedGroup(g) }
      }
    })
  }

  useEffect(() => {
    if (user) loadClaimsData()
  }, [user])

  const groupNameFor = (groupId: number | null) => {
    if (groupId === null) return null
    return groups.find(g => g.id === groupId)?.name || `Gruppe #${groupId}`
  }

  const selectClaim = (c: Claim) => {
    setSelectedGroup(null)
    setSelectedClaim(c)
  }

  const selectGroup = (g: ClaimGroup) => {
    setSelectedClaim(null)
    setSelectedGroup(g)
  }
  const requestMove = (claim: Claim, targetGroupId: number | null) => {
    if (claim.group_id === targetGroupId) return // schon dort, nichts zu tun
    const targetGroupName = targetGroupId === null
      ? 'Einzelne Claims (keine Gruppe)'
      : (groups.find(g => g.id === targetGroupId)?.name || `Gruppe #${targetGroupId}`)
    setConfirmMove({ claim, targetGroupId, targetGroupName })
  }

  const confirmMoveClaim = async () => {
    if (!confirmMove) return
    const { claim, targetGroupId } = confirmMove
    setConfirmMove(null)
    await fetch(`/api/smp/claims/${claim.id}/group`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ groupId: targetGroupId }),
    })
    loadClaimsData()
  }

  const createGroup = async () => {
    if (!newGroupName.trim()) return
    setCreatingGroup(true)
    await fetch('/api/smp/claim-groups', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newGroupName.trim() }),
    })
    setNewGroupName('')
    setShowNewGroupBox(false)
    setCreatingGroup(false)
    loadClaimsData()
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

  const ungroupedClaims = claims.filter(c => c.group_id === null)
  const groupedCount = (groupId: number) => claims.filter(c => c.group_id === groupId).length

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Link href="/smp/claims/global" className="card rounded-2xl p-4 flex items-center justify-between transition hover:opacity-80">
          <span className="font-medium text-sm flex items-center gap-2" style={{ color: 'var(--foreground)' }}>
            🌍 Globale Einstellungen
          </span>
          <span className="text-xs" style={{ color: 'var(--muted)' }}>→</span>
        </Link>
        <Link href="/smp/claims/trusted" className="card rounded-2xl p-4 flex items-center justify-between transition hover:opacity-80">
          <span className="font-medium text-sm flex items-center gap-2" style={{ color: 'var(--foreground)' }}>
            👥 Vertraute Spieler
          </span>
          <span className="text-xs" style={{ color: 'var(--muted)' }}>→</span>
        </Link>
        <Link href="/smp/claims/transfers" className="card rounded-2xl p-4 flex items-center justify-between transition hover:opacity-80">
          <span className="font-medium text-sm flex items-center gap-2" style={{ color: 'var(--foreground)' }}>
            📨 Übertragungsanfragen
          </span>
          <span className="text-xs" style={{ color: 'var(--muted)' }}>→</span>
        </Link>
      </div>

      <div className="card rounded-2xl p-6">
        <h2 className="font-bold text-lg mb-1" style={{ color: 'var(--foreground)' }}>Deine Chunk-Gruppen ({groups.length})</h2>
        <p className="text-sm mb-4" style={{ color: 'var(--muted)' }}>
          Zusammenhängende Claims werden automatisch gruppiert. Klicke auf eine Gruppe, um Berechtigungen für alle Chunks darin einzustellen. Ziehe einen Claim per Drag &amp; Drop auf eine Gruppe, um ihn zuzuordnen.
        </p>

        {showNewGroupBox && (
          <div className="flex gap-2 mb-4">
            <input
              type="text"
              value={newGroupName}
              onChange={e => setNewGroupName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && createGroup()}
              placeholder="Name der neuen Gruppe..."
              autoFocus
              className="flex-1 px-3 py-2 rounded-lg text-sm"
              style={{ background: 'var(--muted-bg)', border: '1px solid var(--card-border)', color: 'var(--foreground)' }}
            />
            <button onClick={createGroup} disabled={!newGroupName.trim() || creatingGroup}
              className="text-xs font-medium px-3 py-2 rounded-lg disabled:opacity-40" style={{ background: '#16A34A', color: 'white' }}>
              {creatingGroup ? '...' : 'Erstellen'}
            </button>
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {groups.map(g => (
            <button key={g.id} onClick={() => selectGroup(g)}
              onDragOver={e => { e.preventDefault(); setDragOverGroupId(g.id) }}
              onDragLeave={() => setDragOverGroupId(prev => prev === g.id ? null : prev)}
              onDrop={e => {
                e.preventDefault()
                setDragOverGroupId(null)
                if (draggedClaim) requestMove(draggedClaim, g.id)
              }}
              className="rounded-xl p-3 text-left transition-all"
              style={{
                ...(selectedGroup?.id === g.id
                  ? { background: '#16A34A', color: 'white' }
                  : { background: 'var(--muted-bg)', color: 'var(--foreground)' }),
                border: dragOverGroupId === g.id ? '2px dashed #16A34A' : '1px solid var(--card-border)',
              }}>
              <p className="font-bold text-sm">🗂️ {g.name || `Gruppe #${g.id}`}</p>
              <p className="text-xs opacity-80">{groupedCount(g.id)} Chunk{groupedCount(g.id) === 1 ? '' : 's'}</p>
            </button>
          ))}

          <button onClick={() => setShowNewGroupBox(prev => !prev)}
            className="rounded-xl p-3 text-left transition-all flex flex-col items-center justify-center gap-1"
            style={{ background: 'var(--muted-bg)', border: '1px dashed var(--card-border)', color: 'var(--muted)' }}>
            <span className="text-lg">➕</span>
            <span className="text-xs font-medium">Neue Gruppe</span>
          </button>
        </div>
      </div>

      <div className="card rounded-2xl p-6"
        onDragOver={e => { e.preventDefault(); setDragOverGroupId('none') }}
        onDragLeave={() => setDragOverGroupId(prev => prev === 'none' ? null : prev)}
        onDrop={e => {
          e.preventDefault()
          setDragOverGroupId(null)
          if (draggedClaim) requestMove(draggedClaim, null)
        }}
        style={dragOverGroupId === 'none' ? { outline: '2px dashed #16A34A', outlineOffset: '-2px' } : undefined}
      >
        <h2 className="font-bold text-lg mb-1" style={{ color: 'var(--foreground)' }}>Einzelne Claims ({ungroupedClaims.length})</h2>
        <p className="text-sm mb-4" style={{ color: 'var(--muted)' }}>
          Claime Chunks ingame mit <code>/claim</code>. Klicke auf einen Claim, um die Berechtigungen einzustellen. Ziehe einen Claim hierhin, um ihn aus seiner Gruppe zu entfernen.
        </p>

        {ungroupedClaims.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--muted)' }}>Du hast keine ungruppierten Claims.</p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {ungroupedClaims.map(c => (
              <button key={c.id} onClick={() => selectClaim(c)}
                draggable
                onDragStart={() => setDraggedClaim(c)}
                onDragEnd={() => setDraggedClaim(null)}
                className="rounded-xl p-3 text-left transition-all cursor-grab active:cursor-grabbing"
                style={selectedClaim?.id === c.id
                  ? { background: '#16A34A', color: 'white' }
                  : { background: 'var(--muted-bg)', border: '1px solid var(--card-border)', color: 'var(--foreground)' }}>
                <p className="font-bold text-sm">📍 {c.name || `Chunk ${c.chunk_x},${c.chunk_z}`}</p>
                <p className="text-xs opacity-80">{c.world}</p>
              </button>
            ))}
          </div>
        )}
      </div>

      {selectedClaim && (
        <PermissionPanel claim={selectedClaim} groupName={groupNameFor(selectedClaim.group_id)} />
      )}

      {selectedGroup && (
        <GroupPanel
          group={selectedGroup}
          claims={claims.filter(c => c.group_id === selectedGroup.id)}
          onRenamed={(groupId, newName) => {
            setGroups(prev => prev.map(g => g.id === groupId ? { ...g, name: newName } : g))
            setSelectedGroup(prev => prev && prev.id === groupId ? { ...prev, name: newName } : prev)
          }}
          draggedClaim={draggedClaim}
          setDraggedClaim={setDraggedClaim}
          onRequestMove={requestMove}
        />
      )}

            <div className="text-center">
        <Link href="/smp/claims/trash" className="text-xs hover:opacity-70" style={{ color: 'var(--muted)' }}>
          🗑️ Papierkorb
        </Link>
      </div>
      {confirmMove && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="rounded-2xl p-6 max-w-sm w-full" style={{ background: 'var(--card)', border: '1px solid var(--card-border)' }}>
            <p className="font-bold mb-2" style={{ color: 'var(--foreground)' }}>Claim verschieben?</p>
            <p className="text-sm mb-5" style={{ color: 'var(--muted)' }}>
              "{confirmMove.claim.name || `Chunk ${confirmMove.claim.chunk_x},${confirmMove.claim.chunk_z}`}" wird nach <strong>{confirmMove.targetGroupName}</strong> verschoben.
              {confirmMove.claim.group_id !== null && ' Die aktuelle Gruppe wird dadurch verlassen.'}
            </p>
            <div className="flex gap-2">
              <button onClick={() => setConfirmMove(null)} className="flex-1 text-sm py-2 rounded-lg" style={{ background: 'var(--muted-bg)', color: 'var(--foreground)' }}>
                Abbrechen
              </button>
              <button onClick={confirmMoveClaim} className="flex-1 text-sm font-medium py-2 rounded-lg" style={{ background: '#16A34A', color: 'white' }}>
                Bestätigen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}