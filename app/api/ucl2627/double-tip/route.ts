import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'

async function getUserId(token: string | undefined) {
  if (!token) return null
  const res = await pool.query('SELECT user_id, expires_at FROM sessions WHERE token = $1', [token])
  const session = res.rows[0]
  if (!session || new Date(session.expires_at) < new Date()) return null
  return session.user_id as string
}

async function getSeasonId() {
  const res = await pool.query("SELECT id FROM ucl_seasons WHERE slug = '2627'")
  return res.rows[0]?.id ?? null
}

// GET: Meine Doppeltipps laden
export async function GET(req: NextRequest) {
  try {
    const sessionUserId = await getUserId(req.cookies.get('session_token')?.value)
    const gastName = req.nextUrl.searchParams.get('gast_name')
    const seasonId = await getSeasonId()
    if (!seasonId) return NextResponse.json({ doubles: [] })

    let result
    if (sessionUserId) {
      result = await pool.query(
        'SELECT matchday, match_id FROM ucl_double_tips WHERE season_id = $1 AND user_id = $2',
        [seasonId, sessionUserId]
      )
    } else if (gastName) {
      result = await pool.query(
        'SELECT matchday, match_id FROM ucl_double_tips WHERE season_id = $1 AND gast_name = $2',
        [seasonId, gastName]
      )
    } else {
      return NextResponse.json({ doubles: [] })
    }
    return NextResponse.json({ doubles: result.rows })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// POST: Doppeltipp setzen (überschreibt vorherigen für diesen Spieltag)
export async function POST(req: NextRequest) {
  try {
    const sessionUserId = await getUserId(req.cookies.get('session_token')?.value)
    const { match_id, matchday, gast_name } = await req.json()

    if (!match_id || !matchday) return NextResponse.json({ error: 'match_id + matchday fehlt' }, { status: 400 })
    if (!sessionUserId && !gast_name) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })

    // Kickoff prüfen — nur vor Anpfiff
    const matchRes = await pool.query('SELECT kickoff FROM ucl_matches WHERE id = $1', [match_id])
    const match = matchRes.rows[0]
    if (!match) return NextResponse.json({ error: 'Match nicht gefunden' }, { status: 404 })
    if (new Date(match.kickoff) <= new Date()) return NextResponse.json({ error: 'Anpfiff bereits vorbei' }, { status: 400 })

    const seasonId = await getSeasonId()
    if (!seasonId) return NextResponse.json({ error: 'Season nicht gefunden' }, { status: 404 })

    if (sessionUserId) {
      await pool.query(
        `INSERT INTO ucl_double_tips (season_id, matchday, match_id, user_id)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (season_id, matchday, user_id) DO UPDATE SET match_id = EXCLUDED.match_id, created_at = NOW()`,
        [seasonId, matchday, match_id, sessionUserId]
      )
    } else {
      await pool.query(
        `INSERT INTO ucl_double_tips (season_id, matchday, match_id, gast_name)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (season_id, matchday, gast_name) DO UPDATE SET match_id = EXCLUDED.match_id, created_at = NOW()`,
        [seasonId, matchday, match_id, gast_name]
      )
    }
    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// DELETE: Doppeltipp für einen Spieltag entfernen
export async function DELETE(req: NextRequest) {
  try {
    const sessionUserId = await getUserId(req.cookies.get('session_token')?.value)
    const { matchday, gast_name } = await req.json()
    if (!matchday) return NextResponse.json({ error: 'matchday fehlt' }, { status: 400 })

    const seasonId = await getSeasonId()
    if (!seasonId) return NextResponse.json({ success: true })

    if (sessionUserId) {
      await pool.query(
        'DELETE FROM ucl_double_tips WHERE season_id = $1 AND matchday = $2 AND user_id = $3',
        [seasonId, matchday, sessionUserId]
      )
    } else if (gast_name) {
      await pool.query(
        'DELETE FROM ucl_double_tips WHERE season_id = $1 AND matchday = $2 AND gast_name = $3',
        [seasonId, matchday, gast_name]
      )
    }
    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// GET /all — alle Doppeltipps (für Punkteberechnung)