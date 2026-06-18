import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/app/lib/supabase'

export async function GET(req: NextRequest) {
  const mobType = req.nextUrl.searchParams.get('mob_type')

  if (!mobType) {
    return NextResponse.json({ error: 'mob_type fehlt' }, { status: 400 })
  }

  // Kills für diesen Mob-Typ holen (case-insensitive, da Plugin-Werte
  // großgeschrieben sind, z.B. 'ZOMBIE', aber mob.id kleingeschrieben ist)
  const { data: kills, error } = await supabaseAdmin
    .from('smp_mob_kills')
    .select('uuid, kills')
    .ilike('mob_type', mobType)
    .gt('kills', 0)
    .order('kills', { ascending: false })
    .limit(10)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!kills || kills.length === 0) {
    return NextResponse.json({ ranking: [] })
  }

  // Spielernamen zu den UUIDs nachladen
  const uuids = kills.map(k => k.uuid)
  const { data: players } = await supabaseAdmin
    .from('smp_player_stats')
    .select('uuid, player_name')
    .in('uuid', uuids)

  const nameByUuid = (players || []).reduce((acc, p) => {
    acc[p.uuid] = p.player_name
    return acc
  }, {} as Record<string, string>)

  const ranking = kills.map(k => ({
    name: nameByUuid[k.uuid] || 'Unbekannt',
    kills: k.kills,
  }))

  return NextResponse.json({ ranking })
}