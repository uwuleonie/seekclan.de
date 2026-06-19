'use client'

import { Polyline, CircleMarker, Tooltip } from 'react-leaflet'
import { worldToLatLng } from '../lib/dynmap'

type RoutePoint = { x: number; z: number; recorded_at: string }

const ROUTE_PALETTE = ['#3B82F6', '#EF4444', '#22C55E', '#F59E0B', '#A855F7', '#06B6D4', '#EC4899', '#84CC16']

export function colorForRouteIndex(index: number) {
  return ROUTE_PALETTE[index % ROUTE_PALETTE.length]
}

type Props = {
  routes: Record<string, Record<string, RoutePoint[]>> // uuid -> dimension -> points
  playerNames: Record<string, string>
  selectedUuids: string[]
  activeDimension: string
}

export default function PlayerRouteLayer({ routes, playerNames, selectedUuids, activeDimension }: Props) {
  return (
    <>
      {selectedUuids.map((uuid, index) => {
        const dimensionData = routes[uuid]?.[activeDimension]
        if (!dimensionData || dimensionData.length === 0) return null

        const color = colorForRouteIndex(index)
        const latLngs = dimensionData.map(p => worldToLatLng(p.x, p.z))
        const lastPoint = dimensionData[dimensionData.length - 1]
        const lastLatLng = worldToLatLng(lastPoint.x, lastPoint.z)

        return (
          <div key={uuid}>
            <Polyline
              positions={latLngs}
              pathOptions={{ color, weight: 3, opacity: 0.8 }}
            />
            {/* Endpunkt-Marker (letzte bekannte Position im Zeitraum) */}
            <CircleMarker
              center={lastLatLng}
              radius={6}
              pathOptions={{ color: '#fff', weight: 2, fillColor: color, fillOpacity: 1 }}
            >
              <Tooltip>{playerNames[uuid] || 'Unbekannt'}</Tooltip>
            </CircleMarker>
          </div>
        )
      })}
    </>
  )
}
