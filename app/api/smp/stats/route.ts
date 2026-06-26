import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'

// playtime_minutes wird NICHT mehr direkt aus smp_player_stats gelesen - die
// Spalte existiert zwar noch (für Abwärtskompatibilität), wird aber seit der
// Zusammenführung von SeekStats in SeekInventory nicht mehr beschrieben.
// Stattdessen wird die Spielzeit live aus smp_login_sessions aufsummiert
// (PlaytimeTracker schreibt dort eine Zeile pro Spieler und Kalendertag).
async function attachLivePlaytime(statsRows: any[]) {
  if (statsRows.length === 0) return statsRows
  const uuids = statsRows.map(s => s.uuid)
  const playtimeResult = await pool.query(
    `SELECT uuid, COALESCE(SUM(minutes), 0) AS total_minutes
     FROM smp_login_sessions WHERE uuid = ANY($1) GROUP BY uuid`,
    [uuids]
  )
  const playtimeByUuid = new Map(playtimeResult.rows.map(r => [r.uuid, parseInt(r.total_minutes, 10)]))
  return statsRows.map(s => ({ ...s, playtime_minutes: playtimeByUuid.get(s.uuid) || 0 }))
}

export async function GET(req: NextRequest) {
  const username = req.nextUrl.searchParams.get('username')

  if (!username) {
    const allStatsResult = await pool.query('SELECT * FROM smp_player_stats')
    const statsWithPlaytime = await attachLivePlaytime(allStatsResult.rows)
    return NextResponse.json({ stats: statsWithPlaytime || [] })
  }

  const statsResult = await pool.query(
    'SELECT * FROM smp_player_stats WHERE player_name ILIKE $1',
    [username]
  )
  let stats = statsResult.rows[0]

  if (stats) {
    const [withPlaytime] = await attachLivePlaytime([stats])
    stats = withPlaytime
  }

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
    'SELECT uuid, blocks_broken, blocks_placed, mob_kills, deaths FROM smp_player_stats'
  )
  const allForAvgWithPlaytime = await attachLivePlaytime(allForAvgResult.rows)

  const count = allForAvgWithPlaytime?.length || 1
  const averages = (allForAvgWithPlaytime || []).reduce(
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
    // playtime_minutes braucht jetzt einen eigenen Rang-Vergleich über die live
    // berechneten Werte, da es keine direkt abfragbare Spalte mehr ist.
    const playtimeRank = allForAvgWithPlaytime.filter(s => s.playtime_minutes > stats.playtime_minutes).length + 1
    ranks['playtime_minutes'] = playtimeRank

    for (const field of ['blocks_broken', 'blocks_placed', 'mob_kills', 'deaths'] as const) {
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