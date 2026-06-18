'use client'

import dynamic from 'next/dynamic'
import { MapContainer, Rectangle, Tooltip } from 'react-leaflet'
import L from 'leaflet'
import DynmapLayerComponent from './DynmapLayer'
import PlayerMarkers from './PlayerMarkers'
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

export default function SatelliteMap({ claims, showPlayers }: { claims: Claim[]; showPlayers: boolean }) {
  const centerLatLng = worldToLatLng(DYNMAP_CONFIG.center.x, DYNMAP_CONFIG.center.z)

  return (
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
  )
}