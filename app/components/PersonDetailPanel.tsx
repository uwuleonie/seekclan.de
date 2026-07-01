'use client'

import { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import InventoryView from './InventoryView'
import SavedPositions from './SavedPositions'

const MiniRouteMap = dynamic(() => import('./MiniRouteMap'), { ssr: false })

// Zeigt eine Person (Freund, Chat-Partner oder das eigene Profil) mit Kopf-Avatar,
// Online-Status und — NUR bei Freunden oder dem eigenen Profil — Inventar,
// Enderchest und Live-Position/Route vom SMP (Datenschutz: alle anderen sehen das
// nicht, exakt wie bisher schon bei /smp/[username] mit isOwnProfile gehandhabt,
// hier zusätzlich auf "ist Freund" erweitert).

type Props = {
  username: string
  userId?: string | null // website user_id, falls verknüpft (für Nachricht/Entfernen)
  isOwnProfile: boolean
  isFriend: boolean
  friendshipId?: string | null // friendships.id, für den "Entfernen"-Button
  friendsSince?: string | null // friendships.created_at, wird vom Elternteil übergeben
  onMessage?: (username: string, userId: string | null) => void
  onFriendRemoved?: () => void
}

export default function PersonDetailPanel({ username, userId, isOwnProfile, isFriend, friendshipId, friendsSince, onMessage, onFriendRemoved }: Props) {
  const [stats, setStats] = useState<any>(null)
  const [inventoryData, setInventoryData] = useState<any>(null)
  const [isOnline, setIsOnline] = useState(false)
  const [loading, setLoading] = useState(true)
  const [removing, setRemoving] = useState(false)

  const canSeePrivateData = isOwnProfile || isFriend

  useEffect(() => {
    setLoading(true)
    setInventoryData(null)

    fetch(`/api/smp/stats?username=${encodeURIComponent(username)}`)
      .then(r => r.json())
      .then(data => { setStats(data.stats || null); setLoading(false) })

    fetch(`/api/smp/online-status?usernames=${encodeURIComponent(username)}`)
      .then(r => r.json())
      .then(data => setIsOnline(!!data.status?.[username]))

    if (canSeePrivateData) {
      fetch(`/api/smp/inventory?username=${encodeURIComponent(username)}`)
        .then(r => r.json())
        .then(inv => setInventoryData(inv.inventory || null))
    }
  }, [username, canSeePrivateData])

  const removeFriend = async () => {
    if (!friendshipId) return
    setRemoving(true)
    await fetch('/api/friends', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: friendshipId, action: 'remove' }),
    })
    setRemoving(false)
    onFriendRemoved?.()
  }

  return (
    <div className="space-y-6">
      {/* Kopfbereich */}
      <div className="card rounded-2xl p-8 text-center">
        <div className="relative inline-block">
          <img src={`/api/player-heads/${username}/80`} alt="" className="w-20 h-20 rounded-2xl mx-auto" />
          <span className="absolute bottom-0 right-0 w-4 h-4 rounded-full border-2"
            style={{ background: isOnline ? '#22C55E' : 'var(--muted)', borderColor: 'var(--card)' }} />
        </div>
        <h2 className="font-bold text-xl mt-3" style={{ color: 'var(--foreground)' }}>{username}</h2>
        <p className="text-sm" style={{ color: isOnline ? '#22C55E' : 'var(--muted)' }}>
          {isOnline ? 'Online' : 'Offline'}
        </p>
        {!isOwnProfile && isFriend && friendsSince && (
          <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>
            Freunde seit {new Date(friendsSince).toLocaleDateString('de-DE')}
          </p>
        )}

        {!isOwnProfile && (
          <div className="flex gap-3 justify-center mt-5">
            <button onClick={() => onMessage?.(username, userId || null)}
              className="btn-gradient text-white px-5 py-2.5 rounded-xl text-sm font-medium">
              Nachricht
            </button>
            {isFriend && (
              <button onClick={removeFriend} disabled={removing}
                className="px-5 py-2.5 rounded-xl text-sm font-medium disabled:opacity-50"
                style={{ color: '#EF4444', background: 'rgba(239,68,68,0.1)' }}>
                {removing ? '...' : 'Entfernen'}
              </button>
            )}
          </div>
        )}
      </div>

      {!canSeePrivateData && !isOwnProfile && (
        <div className="card rounded-2xl p-6 text-center" style={{ color: 'var(--muted)' }}>
          <p className="text-sm">Inventar, Enderchest und Position sind nur für Freunde sichtbar.</p>
        </div>
      )}

      {canSeePrivateData && (
        <>
          <div className="flex flex-wrap items-stretch gap-4">
            {inventoryData && (
              <div style={{ flex: '1 1 520px', minWidth: 0 }}>
                <InventoryView data={inventoryData} />
              </div>
            )}
            {stats?.uuid && (
              <div style={{ flex: '1 1 360px', minWidth: 0 }}>
                <MiniRouteMap myUuid={stats.uuid} myUsername={username} />
              </div>
            )}
          </div>
          {/* Gespeicherte Wegpunkte (/savepos) bewusst NUR beim eigenen Profil -
              wurde nicht explizit angefragt (nur Inventar/Enderchest/Position/Route)
              und Wegpunkt-Namen könnten private Basis-Standorte verraten. */}
          {isOwnProfile && stats?.uuid && <SavedPositions myUuid={stats.uuid} />}
        </>
      )}
    </div>
  )
}