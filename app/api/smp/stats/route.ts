import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/app/lib/supabase'

export async function GET(req: NextRequest) {
  const username = req.nextUrl.searchParams.get('username')

  if (!username) {
    // Alle Stats (für Leaderboards)
    const { data: allStats } = await supabaseAdmin
      .from('smp_player_stats')
      .select('*')

    return NextResponse.json({ stats: allStats || [] })
  }

  // Eigene Stats
  const { data: stats } = await supabaseAdmin
    .from('smp_player_stats')
    .select('*')
    .ilike('player_name', username)
    .single()

  // Mob-Kills für diesen Spieler
  let mobKills: Record<string, number> = {}
  if (stats) {
    const { data: kills } = await supabaseAdmin
      .from('smp_mob_kills')
      .select('mob_type, kills')
      .eq('uuid', stats.uuid)

    mobKills = (kills || []).reduce((acc, k) => {
      acc[k.mob_type] = k.kills
      return acc
    }, {} as Record<string, number>)
  }

  // Block-Abbaus für diesen Spieler
  let blockBreaks: Record<string, number> = {}
  if (stats) {
    const { data: breaks } = await supabaseAdmin
      .from('smp_block_stats')
      .select('block_type, broken')
      .eq('uuid', stats.uuid)

    blockBreaks = (breaks || []).reduce((acc, b) => {
      acc[b.block_type] = b.broken
      return acc
    }, {} as Record<string, number>)
  }

  // Historie für Diagramme (letzte 30 Tage)
  let history: any[] = []
  if (stats) {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    const { data: hist } = await supabaseAdmin
      .from('smp_stats_history')
      .select('*')
      .eq('uuid', stats.uuid)
      .gte('date', thirtyDaysAgo)
      .order('date', { ascending: true })
    history = hist || []
  }

  // Clan-Durchschnitt berechnen
  const { data: allForAvg } = await supabaseAdmin
    .from('smp_player_stats')
    .select('playtime_minutes, blocks_broken, blocks_placed, mob_kills, deaths')

  const count = allForAvg?.length || 1
  const averages = (allForAvg || []).reduce(
    (acc, s) => ({
      playtime_minutes: acc.playtime_minutes + s.playtime_minutes,
      blocks_broken: acc.blocks_broken + s.blocks_broken,
      blocks_placed: acc.blocks_placed + s.blocks_placed,
      mob_kills: acc.mob_kills + s.mob_kills,
      deaths: acc.deaths + s.deaths,
    }),
    { playtime_minutes: 0, blocks_broken: 0, blocks_placed: 0, mob_kills: 0, deaths: 0 }
  )
  Object.keys(averages).forEach(k => {
    (averages as any)[k] = Math.round((averages as any)[k] / count)
  })

  // Eigenen Rang in jeder Kategorie berechnen
  const ranks: Record<string, number> = {}
  if (stats) {
    for (const field of ['playtime_minutes', 'blocks_broken', 'blocks_placed', 'mob_kills', 'deaths'] as const) {
      const { count: rankCount } = await supabaseAdmin
        .from('smp_player_stats')
        .select('uuid', { count: 'exact', head: true })
        .gt(field, (stats as any)[field])
      ranks[field] = (rankCount || 0) + 1
    }
  }

  return NextResponse.json({
    stats: stats || null,
    mobKills,
    blockBreaks,
    history,
    averages,
    ranks,
    totalPlayers: count,
  })
}