import React from 'react'
import { Polyline, Marker, Tooltip } from 'react-leaflet'
import L from 'leaflet'
import { worldToLatLng } from '../lib/dynmap'
import { getPlayerHeadUrl } from '../lib/dynmap'

type RoutePoint = { x: number; z: number; recorded_at: string }

const ROUTE_PALETTE = ['#3B82F6', '#EF4444', '#22C55E', '#F59E0B', '#A855F7', '#06B6D4', '#EC4899', '#84CC16']

export function colorForRouteIndex(index: number) {
  return ROUTE_PALETTE[index % ROUTE_PALETTE.length]
}

function headIcon(playerName: string, color: string) {
  return L.divIcon({
    className: '',
    html: `<div style="
        width: 18px; height: 18px; border-radius: 5px;
        background: #1a1a1a; border: 1.5px solid ${color};
        display: flex; align-items: center; justify-content: center;
      ">
        <img src="${getPlayerHeadUrl(playerName)}" width="14" height="14" style="display:block; image-rendering: pixelated;" />
      </div>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  })
}

function timeAgo(isoString: string): string {
  const diffMs = Date.now() - new Date(isoString).getTime()
  const minutes = Math.floor(diffMs / 60000)
  if (minutes < 1) return 'gerade eben'
  if (minutes < 60) return `vor ${minutes} Min.`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `vor ${hours} Std.`
  const days = Math.floor(hours / 24)
  return `vor ${days} Tag${days === 1 ? '' : 'en'}`
}

type Props = {
  routes: Record<string, Record<string, RoutePoint[]>> // uuid -> dimension -> points
  playerNames: Record<string, string>
  selectedUuids: string[]
  activeDimension: string
  lastKnown?: Record<string, { x: number; z: number; dimension: string; recorded_at: string; player_name: string }>
}

export default function PlayerRouteLayer({ routes, playerNames, selectedUuids, activeDimension, lastKnown }: Props) {
  return (
    <>
      {selectedUuids.map((uuid, index) => {
        const dimensionData = routes[uuid]?.[activeDimension]
        const color = colorForRouteIndex(index)
        const playerName = playerNames[uuid] || lastKnown?.[uuid]?.player_name || 'Unbekannt'

        // Fall 1: Es gibt Routenpunkte im aktuellen Zeitraum/Dimension -> Linie + Kopf am Ende
        if (dimensionData && dimensionData.length > 0) {
          const latLngs = dimensionData.map(p => worldToLatLng(p.x, p.z))
          const lastPoint = dimensionData[dimensionData.length - 1]
          const lastLatLng = worldToLatLng(lastPoint.x, lastPoint.z)

          return (
            <React.Fragment key={uuid}>
              <Polyline
                positions={latLngs}
                pathOptions={{ color, weight: 3, opacity: 0.8 }}
              />
              <Marker position={lastLatLng} icon={headIcon(playerName, color)}>
                <Tooltip>{playerName} · {timeAgo(lastPoint.recorded_at)}</Tooltip>
              </Marker>
            </React.Fragment>
          )
        }

        // Fall 2: Keine Punkte im Zeitraum, aber wir kennen die letzte bekannte Position -> nur Kopf, keine Linie
        const last = lastKnown?.[uuid]
        if (last) {
          const lastLatLng = worldToLatLng(last.x, last.z)
          return (
            <Marker key={uuid} position={lastLatLng} icon={headIcon(playerName, color)}>
              <Tooltip>{playerName} · {timeAgo(last.recorded_at)}</Tooltip>
            </Marker>
          )
        }

        return null
      })}
    </>
  )
}