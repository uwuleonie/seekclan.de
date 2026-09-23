import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'
import { getBothSeasonIds, getSeasonId, getSlugFromParam, UWCL_SLUG } from '@/app/lib/ucl-season'

// Starspieler-Regeln:
// - Pro Wettbewerb (UCL / UWCL) und Spieltag genau EIN Starspieler pro Tipper
// - Ein Spieler darf vom selben Tipper nie ein zweites Mal verwendet werden (wettbewerbsübergreifend)
// - Ein Spieltag ist gesperrt, sobald das erste Spiel dieses Spieltags angepfiffen wurde

async function getUserId(token: string | undefined) {
  if (!token) return null
  const res = await pool.query('SELECT user_id, expires_at FROM sessions WHERE token = $1', [token])
  const s = res.rows[0]
  if (!s || new Date(s.expires_at) < new Date()) return null
  return s.user_id as string
}

const COMP_SQL = `CASE WHEN s.slug = '${UWCL_SLUG}' THEN 'uwcl' ELSE 'ucl' END`

async function getFirstKickoff(seasonId: number, matchday: number): Promise<Date | null> {
  const res = await pool.query(
    'SELECT MIN(kickoff) AS first FROM ucl_matches WHERE season_id = $1 AND matchday = $2',
    [seasonId, matchday]
  )
  return res.rows[0]?.first ? new Date(res.rows[0].first) : null
}

// GET: eigene Starspieler (UCL + UWCL) + alle Ergebnisse
export async function GET(req: NextRequest) {
  try {
    const { ucl, uwcl } = await getBothSeasonIds()
    const seasonIds = [ucl, uwcl].filter(Boolean)
    if (!seasonIds.length) return NextResponse.json({ tips: [], results: [] })

    const sessionUserId = await getUserId(req.cookies.get('session_token')?.value)
    const gastName = req.nextUrl.searchParams.get('gast_name')

    let tipsRes = { rows: [] as any[] }
    if (sessionUserId) {
      tipsRes = await pool.query(
        `SELECT st.matchday, st.player_name, ${COMP_SQL} AS comp
         FROM ucl_star_tips st JOIN ucl_seasons s ON s.id = st.season_id
         WHERE st.season_id = ANY($1) AND st.user_id = $2
         ORDER BY comp, st.matchday`,
        [seasonIds, sessionUserId]
      )
    } else if (gastName) {
      tipsRes = await pool.query(
        `SELECT st.matchday, st.player_name, ${COMP_SQL} AS comp
         FROM ucl_star_tips st JOIN ucl_seasons s ON s.id = st.season_id
         WHERE st.season_id = ANY($1) AND st.gast_name = $2
         ORDER BY comp, st.matchday`,
        [seasonIds, gastName]
      )
    }

    const resultsRes = await pool.query(
      `SELECT sr.matchday, sr.player_name, sr.actual_goals, ${COMP_SQL} AS comp
       FROM ucl_star_results sr JOIN ucl_seasons s ON s.id = sr.season_id
       WHERE sr.season_id = ANY($1)
       ORDER BY comp, sr.matchday, sr.player_name`,
      [seasonIds]
    )

    return NextResponse.json({ tips: tipsRes.rows, results: resultsRes.rows })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// POST: Starspieler für einen Spieltag setzen (ersetzt vorhandenen Starspieler dieses Spieltags)
export async function POST(req: NextRequest) {
  try {
    const sessionUserId = await getUserId(req.cookies.get('session_token')?.value)
    const body = await req.json()
    const matchday = Number(body.matchday)
    const name = String(body.player_name ?? '').trim()
    const gast_name: string | null = body.gast_name ?? null
    const compLabel = body.comp === 'uwcl' ? 'UWCL' : 'UCL'

    if (!matchday || !name) return NextResponse.json({ error: 'Spieltag und Spielername nötig' }, { status: 400 })
    if (!sessionUserId && !gast_name) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })

    const seasonId = await getSeasonId(getSlugFromParam(body.comp ?? null))
    if (!seasonId) return NextResponse.json({ error: 'Season nicht gefunden' }, { status: 404 })

    const firstKickoff = await getFirstKickoff(seasonId, matchday)
    if (!firstKickoff) return NextResponse.json({ error: `Spieltag ${matchday} existiert in der ${compLabel} nicht` }, { status: 400 })
    if (firstKickoff <= new Date()) return NextResponse.json({ error: `${compLabel} Spieltag ${matchday} hat bereits begonnen` }, { status: 400 })

    const who = sessionUserId ? 'st.user_id = $1' : 'st.gast_name = $1'
    const whoVal = sessionUserId ?? gast_name
    const { ucl, uwcl } = await getBothSeasonIds()
    const seasonIds = [ucl, uwcl].filter(Boolean)

    // Spieler schon an einem ANDEREN Spieltag / Wettbewerb verwendet?
    const reuse = await pool.query(
      `SELECT st.matchday, ${COMP_SQL} AS comp
       FROM ucl_star_tips st JOIN ucl_seasons s ON s.id = st.season_id
       WHERE ${who} AND st.season_id = ANY($2) AND LOWER(TRIM(st.player_name)) = LOWER($3)
         AND NOT (st.season_id = $4 AND st.matchday = $5)
       LIMIT 1`,
      [whoVal, seasonIds, name, seasonId, matchday]
    )
    if (reuse.rows.length) {
      const r = reuse.rows[0]
      return NextResponse.json({ error: `${name} hast du bereits an ${String(r.comp).toUpperCase()} Spieltag ${r.matchday} verwendet` }, { status: 400 })
    }

    // Vorhandenen Starspieler dieses Spieltags ersetzen
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      if (sessionUserId) {
        await client.query('DELETE FROM ucl_star_tips WHERE season_id = $1 AND matchday = $2 AND user_id = $3', [seasonId, matchday, sessionUserId])
        await client.query('INSERT INTO ucl_star_tips (season_id, matchday, user_id, player_name) VALUES ($1, $2, $3, $4)', [seasonId, matchday, sessionUserId, name])
      } else {
        await client.query('DELETE FROM ucl_star_tips WHERE season_id = $1 AND matchday = $2 AND gast_name = $3', [seasonId, matchday, gast_name])
        await client.query('INSERT INTO ucl_star_tips (season_id, matchday, gast_name, player_name) VALUES ($1, $2, $3, $4)', [seasonId, matchday, gast_name, name])
      }
      await client.query('COMMIT')
    } catch (e) {
      await client.query('ROLLBACK')
      throw e
    } finally {
      client.release()
    }

    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// DELETE: eigenen Starspieler eines Spieltags entfernen (nur vor Anpfiff)
export async function DELETE(req: NextRequest) {
  try {
    const sessionUserId = await getUserId(req.cookies.get('session_token')?.value)
    const body = await req.json()
    const matchday = Number(body.matchday)
    const gast_name: string | null = body.gast_name ?? null
    if (!matchday) return NextResponse.json({ error: 'Spieltag fehlt' }, { status: 400 })
    if (!sessionUserId && !gast_name) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })

    const seasonId = await getSeasonId(getSlugFromParam(body.comp ?? null))
    if (!seasonId) return NextResponse.json({ error: 'Season nicht gefunden' }, { status: 404 })

    const firstKickoff = await getFirstKickoff(seasonId, matchday)
    if (firstKickoff && firstKickoff <= new Date()) return NextResponse.json({ error: 'Spieltag hat bereits begonnen' }, { status: 400 })

    if (sessionUserId) {
      await pool.query('DELETE FROM ucl_star_tips WHERE season_id = $1 AND matchday = $2 AND user_id = $3', [seasonId, matchday, sessionUserId])
    } else {
      await pool.query('DELETE FROM ucl_star_tips WHERE season_id = $1 AND matchday = $2 AND gast_name = $3', [seasonId, matchday, gast_name])
    }
    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}