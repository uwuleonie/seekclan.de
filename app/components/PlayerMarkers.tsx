'use client'

import { useEffect, useState } from 'react'
import { Marker, Tooltip } from 'react-leaflet'
import L from 'leaflet'
import { fetchDynmapPlayers, getPlayerHeadUrl, worldToLatLng, DynmapPlayer } from '../lib/dynmap'

function createHeadIcon(playerName: string) {
  return L.icon({
    iconUrl: getPlayerHeadUrl(playerName),
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    className: 'rounded',
  })
}

export default function PlayerMarkers() {
  const [players, setPlayers] = useState<DynmapPlayer[]>([])

  useEffect(() => {
    let active = true

    async function poll() {
      const data = await fetchDynmapPlayers()
      if (active) setPlayers(data)
    }

    poll()
    const interval = setInterval(poll, 3000)

    return () => {
      active = false
      clearInterval(interval)
    }
  }, [])

  return (
    <>
      {players.map(player => (
        <Marker
          key={player.account}
          position={worldToLatLng(player.x, player.z)}
          icon={createHeadIcon(player.name)}
        >
          <Tooltip permanent direction="top" offset={[0, -12]}>
            {player.name}
          </Tooltip>
        </Marker>
      ))}
    </>
  )
}