import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'

async function checkAdmin(req: NextRequest) {
  const token = req.cookies.get('session_token')?.value
  if (!token) return null
  const s = await pool.query('SELECT user_id FROM sessions WHERE token = $1', [token])
  if (!s.rows[0]) return null
  const u = await pool.query('SELECT clan_role FROM users WHERE id = $1', [s.rows[0].user_id])
  const user = u.rows[0]
  if (!user || (user.clan_role !== 'owner' && user.clan_role !== 'administrator')) return null
  return user
}

// GET /api/ucl2627/admin/player-tips
// ?name=username  oder  ?gast_name=Max  oder  (ohne params = alle Teilnehmer)
export async function GET(req: NextRequest) {
  const admin = await checkAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })

  const seasonRes = await pool.query("SELECT id FROM ucl_seasons WHERE slug = '2627'")
  const seasonId = seasonRes.rows[0]?.id
  if (!seasonId) return NextResponse.json({ tips: [], tableTip: null, player: null })

  const name     = req.nextUrl.searchParams.get('name')
  const gastName = req.nextUrl.searchParams.get('gast_name')

  // Alle Teilnehmer auflisten
  if (!name && !gastName) {
    const [matchTipCounts, tableTipUsers, gastCounts, gastTableTips] = await Promise.all([
      pool.query(
        `SELECT u.username, u.minecraft_username, COUNT(t.id)::int as match_tip_count
         FROM ucl_match_tips t
         JOIN users u ON u.id = t.user_id
         WHERE t.season_id = $1
         GROUP BY u.username, u.minecraft_username`,
        [seasonId]
      ),
      pool.query(
        `SELECT u.username, u.minecraft_username
         FROM ucl_table_tips t
         JOIN users u ON u.id = t.user_id
         WHERE t.season_id = $1`,
        [seasonId]
      ),
      pool.query(
        `SELECT gast_name, COUNT(id)::int as match_tip_count
         FROM ucl_match_tips
         WHERE season_id = $1 AND gast_name IS NOT NULL
         GROUP BY gast_name`,
        [seasonId]
      ),
      pool.query(
        `SELECT gast_name FROM ucl_table_tips
         WHERE season_id = $1 AND gast_name IS NOT NULL`,
        [seasonId]
      ),
    ])

    const tableTipSet = new Set(tableTipUsers.rows.map((r: any) => r.username))
    const gastTableSet = new Set(gastTableTips.rows.map((r: any) => r.gast_name))

    const participants = [
      ...matchTipCounts.rows.map((r: any) => ({
        name: r.username,
        minecraft_username: r.minecraft_username,
        type: 'user',
        match_tip_count: r.match_tip_count,
        has_table_tip: tableTipSet.has(r.username),
      })),
      ...gastCounts.rows.map((r: any) => ({
        name: r.gast_name,
        minecraft_username: null,
        type: 'gast',
        match_tip_count: r.match_tip_count,
        has_table_tip: gastTableSet.has(r.gast_name),
      })),
    ]

    // Auch Leute die nur Tabellentipp aber keine Spieltipps haben
    for (const r of tableTipUsers.rows) {
      if (!participants.find((p: any) => p.name === r.username)) {
        participants.push({ name: r.username, minecraft_username: r.minecraft_username, type: 'user', match_tip_count: 0, has_table_tip: true })
      }
    }
    for (const r of gastTableTips.rows) {
      if (!participants.find((p: any) => p.name === r.gast_name)) {
        participants.push({ name: r.gast_name, minecraft_username: null, type: 'gast', match_tip_count: 0, has_table_tip: true })
      }
    }

    return NextResponse.json({ participants })
  }

  // Einzelspieler laden
  let matchTips, tableTip, playerInfo

  if (name) {
    const userRes = await pool.query(
      'SELECT id, username, clan_role, minecraft_username FROM users WHERE username = $1',
      [name]
    )
    const user = userRes.rows[0]
    if (!user) return NextResponse.json({ error: 'User nicht gefunden' }, { status: 404 })
    playerInfo = { name: user.username, role: user.clan_role, type: 'user', minecraft_username: user.minecraft_username }

    const [tipsRes, tableRes] = await Promise.all([
      pool.query(
        `SELECT t.id, t.tip_home, t.tip_away, m.matchday, m.home_club_id, m.away_club_id, m.kickoff, m.result_home, m.result_away
         FROM ucl_match_tips t JOIN ucl_matches m ON m.id = t.match_id
         WHERE t.season_id = $1 AND t.user_id = $2 ORDER BY m.matchday ASC, m.kickoff ASC`,
        [seasonId, user.id]
      ),
      pool.query('SELECT ranking FROM ucl_table_tips WHERE season_id = $1 AND user_id = $2', [seasonId, user.id]),
    ])
    matchTips = tipsRes.rows
    tableTip  = tableRes.rows[0]?.ranking ?? null
  } else {
    playerInfo = { name: gastName, role: null, type: 'gast', minecraft_username: null }
    const [tipsRes, tableRes] = await Promise.all([
      pool.query(
        `SELECT t.id, t.tip_home, t.tip_away, m.matchday, m.home_club_id, m.away_club_id, m.kickoff, m.result_home, m.result_away
         FROM ucl_match_tips t JOIN ucl_matches m ON m.id = t.match_id
         WHERE t.season_id = $1 AND t.gast_name = $2 ORDER BY m.matchday ASC, m.kickoff ASC`,
        [seasonId, gastName]
      ),
      pool.query('SELECT ranking FROM ucl_table_tips WHERE season_id = $1 AND gast_name = $2', [seasonId, gastName]),
    ])
    matchTips = tipsRes.rows
    tableTip  = tableRes.rows[0]?.ranking ?? null
  }

  return NextResponse.json({ player: playerInfo, tips: matchTips, tableTip })
}