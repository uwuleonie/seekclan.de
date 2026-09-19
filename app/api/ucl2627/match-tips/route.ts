import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'
import { getSeasonId, getSlugFromParam } from '@/app/lib/ucl-season'

async function getUserId(token: string | undefined) {
  if (!token) return null
  const res = await pool.query(
    'SELECT user_id, expires_at FROM sessions WHERE token = $1',
    [token]
  )
  const session = res.rows[0]
  if (!session || new Date(session.expires_at) < new Date()) return null
  return session.user_id as string
}

// getSeasonId via ucl-season helper

export async function GET(req: NextRequest) {
  const sessionUserId = await getUserId(req.cookies.get('session_token')?.value)
  const gastName = req.nextUrl.searchParams.get('gast_name')
  const slug = getSlugFromParam(req.nextUrl.searchParams.get('comp'))
  const seasonId = await getSeasonId(slug)
  if (!seasonId) return NextResponse.json({ tips: [] })

  let result
  if (sessionUserId) {
    result = await pool.query(
      `SELECT t.*, u.username FROM ucl_match_tips t
       LEFT JOIN users u ON u.id = t.user_id
       WHERE t.season_id = $1 AND t.user_id = $2`,
      [seasonId, sessionUserId]
    )
  } else if (gastName) {
    result = await pool.query(
      'SELECT *, NULL as username FROM ucl_match_tips WHERE season_id = $1 AND gast_name = $2',
      [seasonId, gastName]
    )
  } else {
    return NextResponse.json({ tips: [] })
  }

  return NextResponse.json({ tips: result.rows })
}

export async function POST(req: NextRequest) {
  const { match_id, tip_home, tip_away, gast_name, comp } = await req.json()

  if (!match_id || tip_home === undefined || tip_away === undefined) {
    return NextResponse.json({ error: 'Fehlende Felder' }, { status: 400 })
  }

  const sessionUserId = await getUserId(req.cookies.get('session_token')?.value)

  if (!sessionUserId && !gast_name) {
    return NextResponse.json({ error: 'Gastname erforderlich wenn nicht eingeloggt' }, { status: 400 })
  }

  const matchResult = await pool.query('SELECT kickoff FROM ucl_matches WHERE id = $1', [match_id])
  const match = matchResult.rows[0]
  if (!match) return NextResponse.json({ error: 'Match nicht gefunden' }, { status: 404 })
  if (new Date(match.kickoff) <= new Date()) {
    return NextResponse.json({ error: 'Anpfiff bereits vorbei' }, { status: 400 })
  }

  const slug = getSlugFromParam(comp)
  const seasonId = await getSeasonId(slug)
  if (!seasonId) return NextResponse.json({ error: 'Season nicht gefunden' }, { status: 404 })

  try {
    if (sessionUserId) {
      await pool.query(
        `INSERT INTO ucl_match_tips (match_id, season_id, user_id, tip_home, tip_away)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (match_id, user_id) DO UPDATE SET tip_home = EXCLUDED.tip_home, tip_away = EXCLUDED.tip_away, updated_at = NOW()`,
        [match_id, seasonId, sessionUserId, tip_home, tip_away]
      )
    } else {
      await pool.query(
        `INSERT INTO ucl_match_tips (match_id, season_id, gast_name, tip_home, tip_away)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (match_id, gast_name) DO UPDATE SET tip_home = EXCLUDED.tip_home, tip_away = EXCLUDED.tip_away, updated_at = NOW()`,
        [match_id, seasonId, gast_name, tip_home, tip_away]
      )
    }
  } catch (err) {
    return NextResponse.json({ error: 'Fehler beim Speichern' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}

export async function DELETE(req: NextRequest) {
  const { match_id, gast_name, comp: delComp } = await req.json()
  if (!match_id) return NextResponse.json({ error: 'Fehlende Felder' }, { status: 400 })

  const sessionUserId = await getUserId(req.cookies.get('session_token')?.value)
  if (!sessionUserId && !gast_name) {
    return NextResponse.json({ error: 'Gastname erforderlich wenn nicht eingeloggt' }, { status: 400 })
  }

  const matchResult = await pool.query('SELECT kickoff FROM ucl_matches WHERE id = $1', [match_id])
  const match = matchResult.rows[0]
  if (!match) return NextResponse.json({ error: 'Match nicht gefunden' }, { status: 404 })
  if (new Date(match.kickoff) <= new Date()) {
    return NextResponse.json({ error: 'Spiel bereits angepfiffen — Tipp kann nicht zurückgezogen werden' }, { status: 400 })
  }

  const delSlug = getSlugFromParam(delComp)
  const seasonId = await getSeasonId(delSlug)

  try {
    if (sessionUserId) {
      await pool.query('DELETE FROM ucl_match_tips WHERE match_id = $1 AND user_id = $2 AND season_id = $3', [match_id, sessionUserId, seasonId])
    } else {
      await pool.query('DELETE FROM ucl_match_tips WHERE match_id = $1 AND gast_name = $2 AND season_id = $3', [match_id, gast_name, seasonId])
    }
  } catch (err) {
    return NextResponse.json({ error: 'Fehler beim Loeschen' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}