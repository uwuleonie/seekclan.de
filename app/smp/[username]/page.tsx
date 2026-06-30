'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import dynamic from 'next/dynamic'
import { useAuth } from '../../lib/auth-context'
import LoginCalendar from '../../components/LoginCalendar'
import InventoryView from '../../components/InventoryView'
import SavedPositions from '../../components/SavedPositions'

const MiniRouteMap = dynamic(() => import('../../components/MiniRouteMap'), { ssr: false })

export default function ProfilePage() {
  const params = useParams()
  const profileUsername = params.username as string
  const { user } = useAuth()

  const myUsername = user ? ((user as any).minecraft_username || user.username) : null
  const isOwnProfile = myUsername && myUsername.toLowerCase() === profileUsername.toLowerCase()

  const [myStats, setMyStats] = useState<any>(null)
  const [inventoryData, setInventoryData] = useState<any>(null)
  const [claims, setClaims] = useState<any[]>([])
  const [trusts, setTrusts] = useState<any[]>([])
  const [trustedBy, setTrustedBy] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/smp/stats?username=${profileUsername}`).then(r => r.json()).then(data => {
      setMyStats(data.stats)
      setLoading(false)
    })

    // Inventar nur laden, wenn es das eigene Profil ist (Datenschutz)
    if (isOwnProfile) {
      fetch(`/api/smp/inventory?username=${profileUsername}`).then(r => r.json()).then(inv => {
        setInventoryData(inv.inventory || null)
      })
    }
  }, [profileUsername, isOwnProfile])

  useEffect(() => {
    if (!isOwnProfile || !user) return
    fetch('/api/smp/claims').then(r => r.json()).then(data => {
      setClaims(data.claims || [])
      setTrusts(data.trusts || [])
      setTrustedBy(data.trustedBy || [])
    })
  }, [isOwnProfile, user])

  if (loading) return <p style={{ color: 'var(--muted)' }}>Laden...</p>

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <img src={`https://api.creepernation.net/avatar/${profileUsername}/48`} alt="" className="w-12 h-12 rounded-xl" />
        <div>
          <h2 className="font-bold text-xl" style={{ color: 'var(--foreground)' }}>{profileUsername}</h2>
          {!isOwnProfile && <p className="text-xs" style={{ color: 'var(--muted)' }}>Öffentliches Profil</p>}
        </div>
      </div>

      <div className="flex flex-wrap items-stretch gap-4">
        <div style={{ flex: '0 1 360px' }}>
          <LoginCalendar username={profileUsername} />
        </div>
        {isOwnProfile && (
          <div style={{ flex: '1 1 520px', minWidth: 0 }}>
            {inventoryData && (
              <InventoryView data={inventoryData} />
            )}
          </div>
        )}
        {isOwnProfile && myStats && (myStats as any).uuid && (
          <div style={{ flex: '1 1 360px', minWidth: 0 }}>
            <MiniRouteMap myUuid={(myStats as any).uuid} myUsername={profileUsername} />
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {isOwnProfile && myStats && (myStats as any).uuid && (
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

      {isOwnProfile && (
        <div className="card rounded-2xl p-6">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-xl">🗺️</span>
              <h2 className="font-bold text-lg" style={{ color: 'var(--foreground)' }}>Meine Claims</h2>
            </div>
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
      )}
    </div>
  )
}
