    import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/app/lib/supabase'

export async function GET(req: NextRequest) {
  const username = req.nextUrl.searchParams.get('username')
  if (!username) return NextResponse.json({ error: 'username fehlt' }, { status: 400 })

  // Erst UUID via player_name aus smp_player_stats holen
  const { data: stats } = await supabaseAdmin
    .from('smp_player_stats')
    .select('uuid')
    .ilike('player_name', username)
    .single()

  if (!stats) return NextResponse.json({ inventory: null })

  const { data: inv } = await supabaseAdmin
    .from('smp_player_inventory')
    .select('inventory, enderchest, armor, offhand, updated_at')
    .eq('uuid', stats.uuid)
    .single()

  return NextResponse.json({ inventory: inv || null })
}