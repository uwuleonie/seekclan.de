import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'
import { getBothSeasonIds, getSeasonId, getSlugFromParam, UWCL_SLUG } from '@/app/lib/ucl-season'

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

const COMP_SQL = `CASE WHEN s.slug = '${UWCL_SLUG}' THEN 'uwcl' ELSE 'ucl' END`

// Identifiziert genau einen Starspieler-Tipp
function whereTip(offset: number, t: { user_id?: string | null; gast_name?: string | null }) {
  return t.user_id
    ? { sql: `user_id = $${offset}`, val: t.user_id }
    : { sql: `gast_name = $${offset}`, val: t.gast_name }
}

// GET: alle Starspieler-Tipps (UCL + UWCL)
export async function GET(req: NextRequest) {
  try {
    const admin = await checkAdmin(req)
    if (!admin) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })

    const { ucl, uwcl } = await getBothSeasonIds()
    const seasonIds = [ucl, uwcl].filter(Boolean)
    if (!seasonIds.length) return NextResponse.json({ tips: [] })

    const res = await pool.query(
      `SELECT st.matchday, st.player_name, st.user_id, u.username, u.minecraft_username, st.gast_name, ${COMP_SQL} AS comp
       FROM ucl_star_tips st
       LEFT JOIN users u ON u.id = st.user_id
       JOIN ucl_seasons s ON s.id = st.season_id
       WHERE st.season_id = ANY($1)
       ORDER BY comp, st.matchday, st.player_name`,
      [seasonIds]
    )
    return NextResponse.json({ tips: res.rows })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// PATCH: Tipp verschieben (Wettbewerb und/oder Spieltag)
// body: { comp, matchday, player_name, user_id | gast_name, to_comp, to_matchday }
export async function PATCH(req: NextRequest) {
  try {
    const admin = await checkAdmin(req)
    if (!admin) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })

    const b = await req.json()
    const fromSeason = await getSeasonId(getSlugFromParam(b.comp ?? null))
    const toSeason   = await getSeasonId(getSlugFromParam(b.to_comp ?? b.comp ?? null))
    const toMatchday = Number(b.to_matchday)
    if (!fromSeason || !toSeason) return NextResponse.json({ error: 'Season nicht gefunden' }, { status: 404 })
    if (!toMatchday || !b.player_name || (!b.user_id && !b.gast_name))
      return NextResponse.json({ error: 'Fehlende Felder' }, { status: 400 })

    const w = whereTip(5, b)
    const res = await pool.query(
      `UPDATE ucl_star_tips SET season_id = $1, matchday = $2
       WHERE season_id = $3 AND matchday = $4 AND ${w.sql} AND player_name = $6`,
      [toSeason, toMatchday, fromSeason, Number(b.matchday), w.val, b.player_name]
    )
    if (res.rowCount === 0) return NextResponse.json({ error: 'Tipp nicht gefunden' }, { status: 404 })
    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// DELETE: Tipp löschen
// body: { comp, matchday, player_name, user_id | gast_name }
export async function DELETE(req: NextRequest) {
  try {
    const admin = await checkAdmin(req)
    if (!admin) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })

    const b = await req.json()
    const seasonId = await getSeasonId(getSlugFromParam(b.comp ?? null))
    if (!seasonId) return NextResponse.json({ error: 'Season nicht gefunden' }, { status: 404 })
    if (!b.player_name || (!b.user_id && !b.gast_name)) return NextResponse.json({ error: 'Fehlende Felder' }, { status: 400 })

    const w = whereTip(3, b)
    await pool.query(
      `DELETE FROM ucl_star_tips WHERE season_id = $1 AND matchday = $2 AND ${w.sql} AND player_name = $4`,
      [seasonId, Number(b.matchday), w.val, b.player_name]
    )
    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}