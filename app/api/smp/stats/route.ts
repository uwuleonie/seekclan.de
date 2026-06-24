import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'

export async function GET(req: NextRequest) {
  const username = req.nextUrl.searchParams.get('username')

  if (!username) {
    const allStatsResult = await pool.query('SELECT * FROM smp_player_stats')
    return NextResponse.json({ stats: allStatsResult.rows || [] })
  }

  const statsResult = await pool.query(
    'SELECT * FROM smp_player_stats WHERE player_name ILIKE $1',
    [username]
  )
  const stats = statsResult.rows[0]

  let mobKills: Record<string, number> = {}
  if (stats) {
    const killsResult = await pool.query(
      'SELECT mob_type, kills FROM smp_mob_kills WHERE uuid = $1',
      [stats.uuid]
    )
    mobKills = killsResult.rows.reduce((acc, k) => {
      acc[k.mob_type] = k.kills
      return acc
    }, {} as Record<string, number>)
  }

  let blockBreaks: Record<string, number> = {}
  if (stats) {
    const breaksResult = await pool.query(
      'SELECT block_type, broken FROM smp_block_stats WHERE uuid = $1',
      [stats.uuid]
    )
    blockBreaks = breaksResult.rows.reduce((acc, b) => {
      acc[b.block_type] = b.broken
      return acc
    }, {} as Record<string, number>)
  }

  let history: any[] = []
  if (stats) {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    const histResult = await pool.query(
      'SELECT * FROM smp_stats_history WHERE uuid = $1 AND date >= $2 ORDER BY date ASC',
      [stats.uuid, thirtyDaysAgo]
    )
    history = histResult.rows || []
  }

  const allForAvgResult = await pool.query(
    'SELECT playtime_minutes, blocks_broken, blocks_placed, mob_kills, deaths FROM smp_player_stats'
  )
  const allForAvg = allForAvgResult.rows

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

  const ranks: Record<string, number> = {}
  if (stats) {
    for (const field of ['playtime_minutes', 'blocks_broken', 'blocks_placed', 'mob_kills', 'deaths'] as const) {
      const rankResult = await pool.query(
        `SELECT COUNT(*) AS count FROM smp_player_stats WHERE ${field} > $1`,
        [stats[field]]
      )
      ranks[field] = parseInt(rankResult.rows[0]?.count || '0', 10) + 1
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