import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/app/lib/supabase'

// Liefert die Positions-Route für einen oder mehrere Spieler innerhalb eines Zeitraums.
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
    return NextResponse.json({ routes: {} })
  }

  const { data, error } = await supabaseAdmin
    .from('smp_player_positions')
    .select('uuid, player_name, x, y, z, dimension, recorded_at')
    .in('uuid', uuids)
    .gte('recorded_at', from)
    .lte('recorded_at', to)
    .order('recorded_at', { ascending: true })
    .limit(5000)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Pro Spieler gruppieren, und pro Spieler nochmal pro Dimension
  // (eine Route sollte nicht zwischen Overworld und Nether "springen")
  const routes: Record<string, Record<string, { x: number; z: number; recorded_at: string }[]>> = {}
  const playerNames: Record<string, string> = {}

  for (const row of data || []) {
    playerNames[row.uuid] = row.player_name
    if (!routes[row.uuid]) routes[row.uuid] = {}
    if (!routes[row.uuid][row.dimension]) routes[row.uuid][row.dimension] = []
    routes[row.uuid][row.dimension].push({ x: row.x, z: row.z, recorded_at: row.recorded_at })
  }

  return NextResponse.json({ routes, playerNames })
}
