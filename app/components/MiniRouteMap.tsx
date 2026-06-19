'use client'

import { useState, useEffect } from 'react'
import { MapContainer } from 'react-leaflet'
import L from 'leaflet'
import DynmapLayerComponent from './DynmapLayer'
import PlayerRouteLayer from './PlayerRouteLayer'
import { DYNMAP_CONFIG, worldToLatLng } from '../lib/dynmap'

type LastKnown = { x: number; z: number; dimension: string; recorded_at: string; player_name: string }

export default function MiniRouteMap({ myUuid, myUsername }: { myUuid: string; myUsername: string }) {
  const [routeData, setRouteData] = useState<{ routes: any; playerNames: Record<string, string>; lastKnown: Record<string, LastKnown> }>({
    routes: {}, playerNames: {}, lastKnown: {},
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!myUuid) return
    const to = new Date()
    const from = new Date(to.getTime() - 24 * 60 * 60 * 1000)

    fetch(`/api/smp/route-positions?uuids=${myUuid}&from=${from.toISOString()}&to=${to.toISOString()}`)
      .then(r => r.json())
      .then(data => {
        setRouteData({
          routes: data.routes || {},
          playerNames: data.playerNames || {},
          lastKnown: data.lastKnown || {},
        })
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [myUuid])

  // Dimension automatisch auf die letzte bekannte Dimension des Spielers setzen
  const activeDimension = routeData.lastKnown[myUuid]?.dimension || 'overworld'

  const centerLatLng = worldToLatLng(DYNMAP_CONFIG.center.x, DYNMAP_CONFIG.center.z)

  return (
    <div className="card rounded-2xl p-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-bold text-lg" style={{ color: 'var(--foreground)' }}>📍 Position</h2>
        {loading && <span className="text-xs opacity-50">Lädt...</span>}
      </div>

      <div style={{ width: '100%', height: '320px', borderRadius: '0.75rem', overflow: 'hidden' }}>
        <MapContainer
          center={centerLatLng}
          zoom={0}
          minZoom={-3}
          maxZoom={DYNMAP_CONFIG.mapZoomIn + DYNMAP_CONFIG.mapZoomOut}
          crs={L.CRS.Simple}
          style={{ width: '100%', height: '100%', background: '#1a1a1a' }}
          attributionControl={false}
        >
          <DynmapLayerComponent />
          <PlayerRouteLayer
            routes={routeData.routes}
            playerNames={routeData.playerNames}
            selectedUuids={[myUuid]}
            activeDimension={activeDimension}
            lastKnown={routeData.lastKnown}
          />
        </MapContainer>
      </div>
    </div>
  )
}