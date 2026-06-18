import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/app/lib/supabase'

export async function GET(req: NextRequest) {
  const blockType = req.nextUrl.searchParams.get('block_type')

  if (!blockType) {
    return NextResponse.json({ error: 'block_type fehlt' }, { status: 400 })
  }

  const { data: breaks, error } = await supabaseAdmin
    .from('smp_block_stats')
    .select('uuid, broken')
    .ilike('block_type', blockType)
    .gt('broken', 0)
    .order('broken', { ascending: false })
    .limit(10)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!breaks || breaks.length === 0) {
    return NextResponse.json({ ranking: [] })
  }

  const uuids = breaks.map(b => b.uuid)
  const { data: players } = await supabaseAdmin
    .from('smp_player_stats')
    .select('uuid, player_name')
    .in('uuid', uuids)

  const nameByUuid = (players || []).reduce((acc, p) => {
    acc[p.uuid] = p.player_name
    return acc
  }, {} as Record<string, string>)

  const ranking = breaks.map(b => ({
    name: nameByUuid[b.uuid] || 'Unbekannt',
    count: b.broken,
  }))

  return NextResponse.json({ ranking })
}