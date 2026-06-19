'use client'

import { useState } from 'react'
import { MapContainer, Rectangle, Tooltip } from 'react-leaflet'
import L from 'leaflet'
import DynmapLayerComponent from './DynmapLayer'
import PlayerMarkers from './PlayerMarkers'
import PlayerRouteLayer from './PlayerRouteLayer'
import RouteHistoryPanel from './RouteHistoryPanel'
import { DYNMAP_CONFIG, worldToLatLng } from '../lib/dynmap'

const PALETTE = ['#7F77DD', '#1D9E75', '#D85A30', '#D4537E', '#378ADD', '#639922', '#EF9F27', '#534AB7']
function colorForOwner(name: string) {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0
  return PALETTE[hash % PALETTE.length]
}

type Claim = {
  id: number
  owner_uuid: string
  owner_name: string
  world: string
  chunk_x: number
  chunk_z: number
}

const DIMENSIONS = [
  { key: 'overworld', label: '🌍 Overworld' },
  { key: 'nether', label: '🔥 Nether' },
  { key: 'end', label: '🌌 End' },
]

export default function SatelliteMap({ claims, showPlayers, myUuid }: { claims: Claim[]; showPlayers: boolean; myUuid?: string | null }) {
  const centerLatLng = worldToLatLng(DYNMAP_CONFIG.center.x, DYNMAP_CONFIG.center.z)
  const [showRoutes, setShowRoutes] = useState(false)
  const [activeDimension, setActiveDimension] = useState('overworld')
  const [routeData, setRouteData] = useState<{ routes: any; playerNames: Record<string, string>; selectedUuids: string[] }>({
    routes: {}, playerNames: {}, selectedUuids: [],
  })

  return (
    <div>
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <button
          onClick={() => setShowRoutes(!showRoutes)}
          className="px-3 py-1.5 rounded-lg text-sm font-medium transition"
          style={showRoutes
            ? { background: '#16A34A', color: 'white' }
            : { background: 'var(--muted-bg)', border: '1px solid var(--card-border)', color: 'var(--muted)' }}
        >
          📍 Bewegungsroute {showRoutes ? 'ausblenden' : 'anzeigen'}
        </button>

        {showRoutes && (
          <div className="flex gap-1.5">
            {DIMENSIONS.map(d => (
              <button
                key={d.key}
                onClick={() => setActiveDimension(d.key)}
                className="px-2.5 py-1 rounded-lg text-xs font-medium transition"
                style={activeDimension === d.key
                  ? { background: 'rgba(22,163,74,0.15)', border: '1px solid #16A34A', color: '#16A34A' }
                  : { background: 'var(--muted-bg)', border: '1px solid var(--card-border)', color: 'var(--muted)' }}
              >
                {d.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {showRoutes && (
        <RouteHistoryPanel myUuid={myUuid || null} onRoutesChange={setRouteData} />
      )}

      <div style={{ width: '100%', height: '600px', borderRadius: '0.5rem', overflow: 'hidden' }}>
        <MapContainer
          center={centerLatLng}
          zoom={0}
          minZoom={0}
          maxZoom={DYNMAP_CONFIG.mapZoomIn + DYNMAP_CONFIG.mapZoomOut}
          crs={L.CRS.Simple}
          style={{ width: '100%', height: '100%', background: '#1a1a1a' }}
          attributionControl={false}
        >
          <DynmapLayerComponent />
          {showPlayers && <PlayerMarkers />}
          {showRoutes && (
            <PlayerRouteLayer
              routes={routeData.routes}
              playerNames={routeData.playerNames}
              selectedUuids={routeData.selectedUuids}
              activeDimension={activeDimension}
            />
          )}
          {claims.map(claim => {
            const x1 = claim.chunk_x * 16
            const z1 = claim.chunk_z * 16
            const x2 = x1 + 16
            const z2 = z1 + 16
            const corner1 = worldToLatLng(x1, z1)
            const corner2 = worldToLatLng(x2, z2)
            const color = colorForOwner(claim.owner_name)

            return (
              <Rectangle
                key={claim.id}
                bounds={[corner1, corner2]}
                pathOptions={{ color, weight: 1, fillColor: color, fillOpacity: 0.35 }}
              >
                <Tooltip>{claim.owner_name}</Tooltip>
              </Rectangle>
            )
          })}
        </MapContainer>
      </div>
    </div>
  )
}
