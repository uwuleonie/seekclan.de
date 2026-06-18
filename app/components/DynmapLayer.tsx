'use client'

import { useEffect } from 'react'
import { useMap } from 'react-leaflet'
import L from 'leaflet'
import { DYNMAP_BASE_URL, DYNMAP_CONFIG } from '../lib/dynmap'

function zoomPrefix(amount: number): string {
  // amount == 0 -> ''
  // amount == 1 -> 'z_'
  // amount == 2 -> 'zz_'
  return 'z'.repeat(amount) + (amount === 0 ? '' : '_')
}

const DynmapTileLayer = L.TileLayer.extend({
  getTileUrl: function (coords: { x: number; y: number; z: number }) {
    const izoom = (this as any)._getZoomForUrl ? (this as any)._getZoomForUrl() : coords.z
    const zoomoutlevel = Math.max(0, izoom - DYNMAP_CONFIG.mapZoomIn)
    const scale = 1 << zoomoutlevel

    // Dynmap multipliziert die Tile-Koordinaten mit `scale`, BEVOR die Region berechnet wird
    const x = scale * coords.x
    const y = scale * coords.y

    // Y ist bei Dynmaps HD-Maps invertiert (passiert NACH der scale-Multiplikation, siehe getTileName)
    const invY = -y
    const scaledX = x >> 5
    const scaledY = invY >> 5
    const prefix = zoomPrefix(zoomoutlevel)

    return `${DYNMAP_BASE_URL}/tiles/${DYNMAP_CONFIG.world}/${DYNMAP_CONFIG.prefix}/${scaledX}_${scaledY}/${prefix}${x}_${invY}.${DYNMAP_CONFIG.imageFormat}`
  },
})

export default function DynmapLayerComponent() {
  const map = useMap()

  useEffect(() => {
    const tileScale = 0
    const layer = new (DynmapTileLayer as any)('', {
      tileSize: 128 << tileScale,
      noWrap: true,
      minZoom: 0,
      maxZoom: DYNMAP_CONFIG.mapZoomIn + DYNMAP_CONFIG.mapZoomOut,
      maxNativeZoom: DYNMAP_CONFIG.mapZoomOut,
      zoomReverse: true,
      errorTileUrl: '',
    })
    layer.addTo(map)

    return () => {
      map.removeLayer(layer)
    }
  }, [map])

  return null
}