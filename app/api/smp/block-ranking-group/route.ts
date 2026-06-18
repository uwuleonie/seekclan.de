import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/app/lib/supabase'

export async function GET(req: NextRequest) {
  const blockTypes = req.nextUrl.searchParams.get('block_types')

  if (!blockTypes) {
    return NextResponse.json({ error: 'block_types fehlt' }, { status: 400 })
  }

  const types = blockTypes.split(',').map(t => t.trim()).filter(Boolean)

  if (types.length === 0) {
    return NextResponse.json({ ranking: [] })
  }

  // Alle Einträge für diese Block-Typen holen
  const { data: breaks, error } = await supabaseAdmin
    .from('smp_block_stats')
    .select('uuid, block_type, broken')
    .in('block_type', types)
    .gt('broken', 0)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!breaks || breaks.length === 0) {
    return NextResponse.json({ ranking: [] })
  }

  // Pro Spieler summieren
  const totalByUuid: Record<string, number> = {}
  for (const b of breaks) {
    totalByUuid[b.uuid] = (totalByUuid[b.uuid] || 0) + b.broken
  }

  // Spielernamen laden
  const uuids = Object.keys(totalByUuid)
  const { data: players } = await supabaseAdmin
    .from('smp_player_stats')
    .select('uuid, player_name')
    .in('uuid', uuids)

  const nameByUuid = (players || []).reduce((acc, p) => {
    acc[p.uuid] = p.player_name
    return acc
  }, {} as Record<string, string>)

  // Sortiert nach Gesamt-Abbaus
  const ranking = Object.entries(totalByUuid)
    .map(([uuid, count]) => ({ name: nameByUuid[uuid] || 'Unbekannt', count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)

  return NextResponse.json({ ranking })
}