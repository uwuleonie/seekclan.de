import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'

// Liefert die Positions-Route für einen oder mehrere Spieler innerhalb eines Zeitraums,
// sowie zusätzlich die jeweils letzte bekannte Position (unabhängig vom Zeitraum).
// Query-Params: uuids (comma-separated), from (ISO date), to (ISO date)
export async function GET(req: NextRequest) {
  const uuidsParam = req.nextUrl.searchParams.get('uuids')
  const from = req.nextUrl.searchParams.get('from')
  const to = req.nextUrl.searchParams.get('to')

  if (!uuidsParam || !from || !to) {
    return NextResponse.json({ error: 'uuids, from, to erforderlich' }, { status: 400 })
  }

  const uuids = uuidsParam.split(',').map(u => u.trim()).filter(Boolean)
  if (uuids.length === 0) {
    return NextResponse.json({ routes: {}, lastKnown: {} })
  }

  let data
  try {
    const result = await pool.query(
      `SELECT uuid, player_name, x, y, z, dimension, recorded_at
       FROM smp_player_positions
       WHERE uuid = ANY($1) AND recorded_at >= $2 AND recorded_at <= $3
       ORDER BY recorded_at ASC
       LIMIT 5000`,
      [uuids, from, to]
    )
    data = result.rows
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }

  const routes: Record<string, Record<string, { x: number; z: number; recorded_at: string }[]>> = {}
  const playerNames: Record<string, string> = {}

  for (const row of data || []) {
    playerNames[row.uuid] = row.player_name
    if (!routes[row.uuid]) routes[row.uuid] = {}
    if (!routes[row.uuid][row.dimension]) routes[row.uuid][row.dimension] = []
    routes[row.uuid][row.dimension].push({ x: row.x, z: row.z, recorded_at: row.recorded_at })
  }

  // DISTINCT ON bestimmt die jeweils neueste Zeile pro UUID direkt in der Datenbank —
  // es wird nur noch eine Zeile pro Spieler tatsächlich übertragen, unabhängig von
  // der Tabellengröße (das war der ursprüngliche Egress-Bug bei Supabase).
  const lastKnown: Record<string, { x: number; z: number; dimension: string; recorded_at: string; player_name: string }> = {}

  let lastData
  try {
    const result = await pool.query(
      `SELECT DISTINCT ON (uuid) uuid, player_name, x, y, z, dimension, recorded_at
       FROM smp_player_positions
       WHERE uuid = ANY($1)
       ORDER BY uuid, recorded_at DESC`,
      [uuids]
    )
    lastData = result.rows
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }

  for (const row of lastData || []) {
    lastKnown[row.uuid] = {
      x: row.x,
      z: row.z,
      dimension: row.dimension,
      recorded_at: row.recorded_at,
      player_name: row.player_name,
    }
  }

  return NextResponse.json({ routes, playerNames, lastKnown })
}