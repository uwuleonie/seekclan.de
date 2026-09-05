import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'

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

async function getSeasonId() {
  const res = await pool.query("SELECT id FROM ucl_seasons WHERE slug = '2627'")
  return res.rows[0]?.id ?? null
}

export async function GET(req: NextRequest) {
  const sessionUserId = await getUserId(req.cookies.get('session_token')?.value)
  const gastName = req.nextUrl.searchParams.get('gast_name')
  const seasonId = await getSeasonId()
  if (!seasonId) return NextResponse.json({ tip: null })

  let result
  if (sessionUserId) {
    result = await pool.query(
      'SELECT * FROM ucl_table_tips WHERE season_id = $1 AND user_id = $2',
      [seasonId, sessionUserId]
    )
  } else if (gastName) {
    result = await pool.query(
      'SELECT * FROM ucl_table_tips WHERE season_id = $1 AND gast_name = $2',
      [seasonId, gastName]
    )
  } else {
    return NextResponse.json({ tip: null })
  }

  return NextResponse.json({ tip: result.rows[0] || null })
}

export async function POST(req: NextRequest) {
  const { ranking, gast_name } = await req.json()

  if (!ranking || !Array.isArray(ranking) || ranking.length !== 36) {
    return NextResponse.json({ error: 'ranking muss 36 Eintraege haben' }, { status: 400 })
  }

  const sessionUserId = await getUserId(req.cookies.get('session_token')?.value)

  if (!sessionUserId && !gast_name) {
    return NextResponse.json({ error: 'Gastname erforderlich wenn nicht eingeloggt' }, { status: 400 })
  }

  const seasonId = await getSeasonId()
  if (!seasonId) return NextResponse.json({ error: 'Season nicht gefunden' }, { status: 404 })

  try {
    if (sessionUserId) {
      await pool.query(
        `INSERT INTO ucl_table_tips (season_id, user_id, ranking, updated_at)
         VALUES ($1, $2, $3, NOW())
         ON CONFLICT (season_id, user_id) DO UPDATE SET ranking = EXCLUDED.ranking, updated_at = NOW()`,
        [seasonId, sessionUserId, ranking]
      )
    } else {
      await pool.query(
        `INSERT INTO ucl_table_tips (season_id, gast_name, ranking, updated_at)
         VALUES ($1, $2, $3, NOW())
         ON CONFLICT (season_id, gast_name) DO UPDATE SET ranking = EXCLUDED.ranking, updated_at = NOW()`,
        [seasonId, gast_name, ranking]
      )
    }
  } catch (err: any) {
    console.error('[table-tip POST]', err)
    return NextResponse.json({ error: err.message || 'Fehler beim Speichern' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}