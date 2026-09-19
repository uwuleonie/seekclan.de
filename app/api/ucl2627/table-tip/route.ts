import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'
import { getSeasonId, UCL_SLUG } from '@/app/lib/ucl-season'

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

export async function GET(req: NextRequest) {
  const sessionUserId = await getUserId(req.cookies.get('session_token')?.value)
  const gastName = req.nextUrl.searchParams.get('gast_name')
  const uclSeasonId = await getSeasonId(UCL_SLUG)
  if (!uclSeasonId) return NextResponse.json({ tip: null })

  let result
  if (sessionUserId) {
    result = await pool.query(
      'SELECT * FROM ucl_table_tips WHERE season_id = $1 AND user_id = $2',
      [uclSeasonId, sessionUserId]
    )
  } else if (gastName) {
    result = await pool.query(
      'SELECT * FROM ucl_table_tips WHERE season_id = $1 AND gast_name = $2',
      [uclSeasonId, gastName]
    )
  } else {
    return NextResponse.json({ tip: null })
  }

  return NextResponse.json({ tip: result.rows[0] || null })
}

export async function POST(req: NextRequest) {
  const { ranking, ranking_uwcl, gast_name, comp } = await req.json()

  const sessionUserId = await getUserId(req.cookies.get('session_token')?.value)
  if (!sessionUserId && !gast_name) {
    return NextResponse.json({ error: 'Gastname erforderlich wenn nicht eingeloggt' }, { status: 400 })
  }

  // UCL-Tipp
  if (comp === 'ucl' || (!comp && ranking)) {
    if (!ranking || !Array.isArray(ranking) || ranking.length !== 36) {
      return NextResponse.json({ error: 'ranking muss 36 Einträge haben' }, { status: 400 })
    }
    const uclSeasonId = await getSeasonId(UCL_SLUG)
    if (!uclSeasonId) return NextResponse.json({ error: 'UCL Season nicht gefunden' }, { status: 404 })

    try {
      if (sessionUserId) {
        await pool.query(
          `INSERT INTO ucl_table_tips (season_id, user_id, ranking, updated_at)
           VALUES ($1, $2, $3, NOW())
           ON CONFLICT (season_id, user_id) DO UPDATE SET ranking = EXCLUDED.ranking, updated_at = NOW()`,
          [uclSeasonId, sessionUserId, ranking]
        )
      } else {
        await pool.query(
          `INSERT INTO ucl_table_tips (season_id, gast_name, ranking, updated_at)
           VALUES ($1, $2, $3, NOW())
           ON CONFLICT (season_id, gast_name) DO UPDATE SET ranking = EXCLUDED.ranking, updated_at = NOW()`,
          [uclSeasonId, gast_name, ranking]
        )
      }
    } catch (err: any) {
      return NextResponse.json({ error: err.message }, { status: 500 })
    }
    return NextResponse.json({ success: true, comp: 'ucl' })
  }

  // UWCL-Tipp (ranking_uwcl Spalte)
  if (comp === 'uwcl' && ranking_uwcl) {
    if (!Array.isArray(ranking_uwcl) || ranking_uwcl.length !== 18) {
      return NextResponse.json({ error: 'ranking_uwcl muss 18 Einträge haben' }, { status: 400 })
    }
    const uclSeasonId = await getSeasonId(UCL_SLUG)
    if (!uclSeasonId) return NextResponse.json({ error: 'Season nicht gefunden' }, { status: 404 })

    try {
      if (sessionUserId) {
        await pool.query(
          `INSERT INTO ucl_table_tips (season_id, user_id, ranking, ranking_uwcl, updated_at)
           VALUES ($1, $2, '[]'::jsonb, $3, NOW())
           ON CONFLICT (season_id, user_id) DO UPDATE SET ranking_uwcl = EXCLUDED.ranking_uwcl, updated_at = NOW()`,
          [uclSeasonId, sessionUserId, JSON.stringify(ranking_uwcl)]
        )
      } else {
        await pool.query(
          `INSERT INTO ucl_table_tips (season_id, gast_name, ranking, ranking_uwcl, updated_at)
           VALUES ($1, $2, '[]'::jsonb, $3, NOW())
           ON CONFLICT (season_id, gast_name) DO UPDATE SET ranking_uwcl = EXCLUDED.ranking_uwcl, updated_at = NOW()`,
          [uclSeasonId, gast_name, JSON.stringify(ranking_uwcl)]
        )
      }
    } catch (err: any) {
      return NextResponse.json({ error: err.message }, { status: 500 })
    }
    return NextResponse.json({ success: true, comp: 'uwcl' })
  }

  return NextResponse.json({ error: 'Ungültige Anfrage' }, { status: 400 })
}