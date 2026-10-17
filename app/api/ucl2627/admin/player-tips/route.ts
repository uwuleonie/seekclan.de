import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'
import { mitRecht, rangJoin, rangNameSql } from '@/app/lib/rechte'

async function checkAdmin(req: NextRequest) {
  return mitRecht(req, 'admin.verwalten')
}

export async function GET(req: NextRequest) {
  const admin = await checkAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })

  const [uclRes, uwclRes] = await Promise.all([
    pool.query("SELECT id FROM ucl_seasons WHERE slug = '2627'"),
    pool.query("SELECT id FROM ucl_seasons WHERE slug = 'uwcl2627'"),
  ])
  const uclSeasonId  = uclRes.rows[0]?.id
  const uwclSeasonId = uwclRes.rows[0]?.id
  if (!uclSeasonId) return NextResponse.json({ tips: [], tableTip: null, player: null })

  const name     = req.nextUrl.searchParams.get('name')
  const gastName = req.nextUrl.searchParams.get('gast_name')

  // ── Teilnehmerliste ──────────────────────────────────────────────────────
  if (!name && !gastName) {
    const [uclMatchTips, uclTableTips, uclGastTips, uclGastTable,
           uwclMatchTips, uwclTableTips, uwclGastTips, uwclGastTable] = await Promise.all([
      pool.query(
        `SELECT u.username, COALESCE(u.anzeigename, u.username) AS anzeigename, u.minecraft_username, COUNT(t.id)::int as cnt
         FROM ucl_match_tips t JOIN users u ON u.id = t.user_id
         WHERE t.season_id = $1 GROUP BY u.username, u.anzeigename, u.minecraft_username`, [uclSeasonId]),
      pool.query(
        `SELECT u.username, COALESCE(u.anzeigename, u.username) AS anzeigename, u.minecraft_username FROM ucl_table_tips t
         JOIN users u ON u.id = t.user_id WHERE t.season_id = $1 AND t.ranking IS NOT NULL AND array_length(t.ranking,1) > 0`, [uclSeasonId]),
      pool.query(
        `SELECT gast_name, COUNT(id)::int as cnt FROM ucl_match_tips
         WHERE season_id = $1 AND gast_name IS NOT NULL GROUP BY gast_name`, [uclSeasonId]),
      pool.query(
        `SELECT gast_name FROM ucl_table_tips WHERE season_id = $1 AND gast_name IS NOT NULL AND array_length(ranking,1) > 0`, [uclSeasonId]),
      uwclSeasonId ? pool.query(
        `SELECT u.username, COALESCE(u.anzeigename, u.username) AS anzeigename, COUNT(t.id)::int as cnt FROM ucl_match_tips t
         JOIN users u ON u.id = t.user_id WHERE t.season_id = $1 GROUP BY u.username, u.anzeigename`, [uwclSeasonId])
        : Promise.resolve({ rows: [] }),
      pool.query(
        `SELECT u.username FROM ucl_table_tips t JOIN users u ON u.id = t.user_id
         WHERE t.season_id = $1 AND t.ranking_uwcl IS NOT NULL AND jsonb_array_length(t.ranking_uwcl) > 0`, [uclSeasonId]),
      uwclSeasonId ? pool.query(
        `SELECT gast_name, COUNT(id)::int as cnt FROM ucl_match_tips
         WHERE season_id = $1 AND gast_name IS NOT NULL GROUP BY gast_name`, [uwclSeasonId])
        : Promise.resolve({ rows: [] }),
      pool.query(
        `SELECT gast_name FROM ucl_table_tips WHERE season_id = $1 AND gast_name IS NOT NULL AND ranking_uwcl IS NOT NULL AND jsonb_array_length(ranking_uwcl) > 0`, [uclSeasonId]),
    ])

    const uclTableSet  = new Set(uclTableTips.rows.map((r: any) => r.username))
    const uclGastTableSet = new Set(uclGastTable.rows.map((r: any) => r.gast_name))
    const uwclTipSet   = new Set(uwclMatchTips.rows.map((r: any) => r.username))
    const uwclTableSet = new Set(uwclTableTips.rows.map((r: any) => r.username))
    const uwclGastTipSet = new Set(uwclGastTips.rows.map((r: any) => r.gast_name))
    const uwclGastTableSet = new Set(uwclGastTable.rows.map((r: any) => r.gast_name))

    const byName = new Map<string, any>()

    const upsert = (key: string, data: any) => {
      if (!byName.has(key)) byName.set(key, data)
      else Object.assign(byName.get(key), data)
    }

    for (const r of uclMatchTips.rows) {
      upsert(r.username, { name: r.username, anzeigename: r.anzeigename, minecraft_username: r.minecraft_username, type: 'user',
        ucl_match_count: r.cnt, has_ucl_table: uclTableSet.has(r.username),
        has_uwcl_match: uwclTipSet.has(r.username), has_uwcl_table: uwclTableSet.has(r.username) })
    }
    for (const r of uclTableTips.rows) {
      upsert(r.username, { name: r.username, anzeigename: r.anzeigename, minecraft_username: r.minecraft_username, type: 'user',
        ucl_match_count: 0, has_ucl_table: true,
        has_uwcl_match: uwclTipSet.has(r.username), has_uwcl_table: uwclTableSet.has(r.username) })
    }
    for (const r of uwclMatchTips.rows) {
      if (!byName.has(r.username)) upsert(r.username, { name: r.username, anzeigename: r.anzeigename, minecraft_username: null, type: 'user',
        ucl_match_count: 0, has_ucl_table: uclTableSet.has(r.username),
        has_uwcl_match: true, has_uwcl_table: uwclTableSet.has(r.username) })
      else { byName.get(r.username).has_uwcl_match = true }
    }
    for (const r of uclGastTips.rows) {
      upsert('g:' + r.gast_name, { name: r.gast_name, anzeigename: r.gast_name, minecraft_username: null, type: 'gast',
        ucl_match_count: r.cnt, has_ucl_table: uclGastTableSet.has(r.gast_name),
        has_uwcl_match: uwclGastTipSet.has(r.gast_name), has_uwcl_table: uwclGastTableSet.has(r.gast_name) })
    }
    for (const r of uclGastTable.rows) {
      upsert('g:' + r.gast_name, { name: r.gast_name, anzeigename: r.gast_name, minecraft_username: null, type: 'gast',
        ucl_match_count: 0, has_ucl_table: true,
        has_uwcl_match: uwclGastTipSet.has(r.gast_name), has_uwcl_table: uwclGastTableSet.has(r.gast_name) })
    }

    return NextResponse.json({ participants: Array.from(byName.values()) })
  }

  // ── Einzelspieler ────────────────────────────────────────────────────────
  let playerInfo: any, uclTips: any[], uwclTips: any[], uclTable: any, uwclTable: any

  if (name) {
    const userRes = await pool.query(
      `SELECT u.id, u.username, COALESCE(u.anzeigename, u.username) AS anzeigename, ${rangNameSql('r')} AS rang, u.minecraft_username FROM users u ${rangJoin('u', 'r')} WHERE u.username = $1`, [name])
    const user = userRes.rows[0]
    if (!user) return NextResponse.json({ error: 'User nicht gefunden' }, { status: 404 })
    playerInfo = { name: user.username, anzeigename: user.anzeigename, role: user.rang, type: 'user', minecraft_username: user.minecraft_username }

    const [uclT, uwclT, uclTbl, uwclTbl] = await Promise.all([
      pool.query(
        `SELECT t.id, t.tip_home, t.tip_away, m.matchday, m.home_club_id, m.away_club_id, m.kickoff, m.result_home, m.result_away
         FROM ucl_match_tips t JOIN ucl_matches m ON m.id = t.match_id
         WHERE t.season_id = $1 AND t.user_id = $2 ORDER BY m.matchday, m.kickoff`, [uclSeasonId, user.id]),
      uwclSeasonId ? pool.query(
        `SELECT t.id, t.tip_home, t.tip_away, m.matchday, m.home_club_id, m.away_club_id, m.kickoff, m.result_home, m.result_away
         FROM ucl_match_tips t JOIN ucl_matches m ON m.id = t.match_id
         WHERE t.season_id = $1 AND t.user_id = $2 ORDER BY m.matchday, m.kickoff`, [uwclSeasonId, user.id])
        : Promise.resolve({ rows: [] }),
      pool.query('SELECT ranking FROM ucl_table_tips WHERE season_id = $1 AND user_id = $2', [uclSeasonId, user.id]),
      pool.query('SELECT ranking_uwcl FROM ucl_table_tips WHERE season_id = $1 AND user_id = $2', [uclSeasonId, user.id]),
    ])
    uclTips   = uclT.rows
    uwclTips  = uwclT.rows
    uclTable  = uclTbl.rows[0]?.ranking ?? null
    uwclTable = uwclTbl.rows[0]?.ranking_uwcl ?? null
  } else {
    playerInfo = { name: gastName, anzeigename: gastName, role: null, type: 'gast', minecraft_username: null }
    const [uclT, uwclT, uclTbl, uwclTbl] = await Promise.all([
      pool.query(
        `SELECT t.id, t.tip_home, t.tip_away, m.matchday, m.home_club_id, m.away_club_id, m.kickoff, m.result_home, m.result_away
         FROM ucl_match_tips t JOIN ucl_matches m ON m.id = t.match_id
         WHERE t.season_id = $1 AND t.gast_name = $2 ORDER BY m.matchday, m.kickoff`, [uclSeasonId, gastName]),
      uwclSeasonId ? pool.query(
        `SELECT t.id, t.tip_home, t.tip_away, m.matchday, m.home_club_id, m.away_club_id, m.kickoff, m.result_home, m.result_away
         FROM ucl_match_tips t JOIN ucl_matches m ON m.id = t.match_id
         WHERE t.season_id = $1 AND t.gast_name = $2 ORDER BY m.matchday, m.kickoff`, [uwclSeasonId, gastName])
        : Promise.resolve({ rows: [] }),
      pool.query('SELECT ranking FROM ucl_table_tips WHERE season_id = $1 AND gast_name = $2', [uclSeasonId, gastName]),
      pool.query('SELECT ranking_uwcl FROM ucl_table_tips WHERE season_id = $1 AND gast_name = $2', [uclSeasonId, gastName]),
    ])
    uclTips   = uclT.rows
    uwclTips  = uwclT.rows
    uclTable  = uclTbl.rows[0]?.ranking ?? null
    uwclTable = uwclTbl.rows[0]?.ranking_uwcl ?? null
  }

  return NextResponse.json({ player: playerInfo, tips: uclTips, uwclTips, tableTip: uclTable, uwclTableTip: uwclTable })
}