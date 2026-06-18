// app/lib/dynmap.ts

// Basis-URL deines Dynmap-Webservers
export const DYNMAP_BASE_URL = 'http://seekclan.de:4335'

// Konfiguration der "flat"-Map für die Hauptwelt (aus /up/configuration)
export const DYNMAP_CONFIG = {
  world: 'world',
  prefix: 'flat',
  imageFormat: 'jpg',
  scale: 4, // Pixel pro Block bei Zoom 0
  mapZoomIn: 1,
  mapZoomOut: 5,
  center: { x: 284, z: -716 },
}

/**
 * Berechnet die Dynmap-Tile-URL für gegebene Tile-Koordinaten (Pixel-Tile-Einheiten, nicht Blockkoordinaten)
 * und eine Zoom-Stufe (0 = am weitesten rausgezoomt im Dynmap-Sinn, siehe HDMapType-Logik).
 */
export function getDynmapTileUrl(tileX: number, tileY: number, zoomLevel: number): string {
  const regionX = tileX >> 5
  const regionY = tileY >> 5
  const zoomPrefix = zoomLevel > 0 ? 'z'.repeat(zoomLevel) + '_' : ''

  return `${DYNMAP_BASE_URL}/tiles/${DYNMAP_CONFIG.world}/${DYNMAP_CONFIG.prefix}/${regionX}_${regionY}/${zoomPrefix}${tileX}_${tileY}.${DYNMAP_CONFIG.imageFormat}`
}

/**
 * Wandelt Minecraft-Weltkoordinaten (X, Z) in Dynmap-"Pixel"-Koordinaten um,
 * basierend auf der maptoworld/worldtomap-Matrix der flat-Perspektive (reine Skalierung, keine Rotation).
 */
export function worldToDynmapPixel(worldX: number, worldZ: number): { px: number; py: number } {
  return {
    px: worldX * DYNMAP_CONFIG.scale,
    py: worldZ * -DYNMAP_CONFIG.scale,
  }
  
}
/**
 * Wandelt Minecraft-Weltkoordinaten in Leaflet-LatLng um (für CRS.Simple).
 * Bei Zoom-Stufe 0 entspricht 1 Tile-Pixel einem Wert von `scale` Blöcken (siehe DYNMAP_CONFIG.scale).
 * Leaflet mit CRS.Simple arbeitet in Pixel-Einheiten bei Zoom 0, daher skalieren wir entsprechend.
 */
// worldtomap-Matrix der "flat"-Perspektive aus /up/configuration (reine Skalierung, keine Rotation, da 90°-Top-Down)
const WORLD_TO_MAP = [4.0, 0.0, -2.4492935982947064e-16, -2.4492935982947064e-16, 0.0, -4.0, 0.0, 1.0, 0.0]
const TILE_SCALE = 0 // tilescale aus der Config (0 für die flat-Map)
const MAP_ZOOM_OUT = DYNMAP_CONFIG.mapZoomOut

/**
 * 1:1 nachgebaut aus Dynmaps eigenem hdmap.js (HDProjection.fromLocationToLatLng),
 * angepasst auf y=0 (wir brauchen nur X/Z für die Top-Down-Karte).
 */
export function worldToLatLng(worldX: number, worldZ: number): [number, number] {
  const wtp = WORLD_TO_MAP
  const locY = 0
  const lat = wtp[3] * worldX + wtp[4] * locY + wtp[5] * worldZ
  const lng = wtp[0] * worldX + wtp[1] * locY + wtp[2] * worldZ

  const finalLat = -(((128 << TILE_SCALE) - lat) / (1 << MAP_ZOOM_OUT))
  const finalLng = lng / (1 << MAP_ZOOM_OUT)

  return [finalLat, finalLng]
}

/**
 * Umkehrfunktion: Leaflet-LatLng zurück zu Minecraft-Weltkoordinaten.
 */
export function latLngToWorld(lat: number, lng: number): { x: number; z: number } {
  const px = lng
  const py = -lat
  return {
    x: px / DYNMAP_CONFIG.scale,
    z: py / DYNMAP_CONFIG.scale,
  }
  
}
export type DynmapPlayer = {
  name: string
  account: string
  x: number
  y: number
  z: number
  world: string
}

/**
 * Holt aktuelle Spielerpositionen direkt von Dynmaps eigenem Update-Endpunkt.
 */
export async function fetchDynmapPlayers(): Promise<DynmapPlayer[]> {
  try {
    const res = await fetch('/api/smp/dynmap-players')
    if (!res.ok) return []
    const data = await res.json()
    return (data.players || []).map((p: any) => ({
      name: p.name,
      account: p.account,
      x: p.x,
      y: p.y,
      z: p.z,
      world: p.world,
    }))
  } catch {
    return []
  }
}

export function getPlayerHeadUrl(playerName: string): string {
  return `${DYNMAP_BASE_URL}/tiles/faces/16x16/${playerName}.png`
}