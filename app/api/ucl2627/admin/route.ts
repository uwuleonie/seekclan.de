import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'
import { getSeasonId, getSlugFromParam } from '@/app/lib/ucl-season'

async function checkAdmin(req: NextRequest) {
  const token = req.cookies.get('session_token')?.value
  if (!token) return null
  const sessionResult = await pool.query('SELECT user_id FROM sessions WHERE token = $1', [token])
  const session = sessionResult.rows[0]
  if (!session) return null
  const userResult = await pool.query('SELECT username, clan_role FROM users WHERE id = $1', [session.user_id])
  const user = userResult.rows[0]
  if (!user || (user.clan_role !== 'administrator' && user.clan_role !== 'owner')) return null
  return user
}

export async function GET(req: NextRequest) {
  const admin = await checkAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })

  const slug = getSlugFromParam(req.nextUrl.searchParams.get('comp'))
  const seasonId = await getSeasonId(slug)
  if (!seasonId) return NextResponse.json({ error: 'Season nicht gefunden' }, { status: 404 })

  const [matches, clubs] = await Promise.all([
    pool.query(
      'SELECT * FROM ucl_matches WHERE season_id = $1 ORDER BY matchday ASC, kickoff ASC',
      [seasonId]
    ),
    pool.query('SELECT id, name, short FROM ucl_clubs WHERE season_id = $1 ORDER BY name', [seasonId]),
  ])

  return NextResponse.json({ matches: matches.rows, clubs: clubs.rows, slug })
}

export async function PATCH(req: NextRequest) {
  const admin = await checkAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })

  const { match_id, result_home, result_away, comp } = await req.json()
  if (!match_id || result_home === undefined || result_away === undefined) {
    return NextResponse.json({ error: 'Fehlende Felder' }, { status: 400 })
  }

  const rh = parseInt(result_home)
  const ra = parseInt(result_away)
  if (isNaN(rh) || isNaN(ra) || rh < 0 || ra < 0) {
    return NextResponse.json({ error: 'Ungültige Werte' }, { status: 400 })
  }

  await pool.query(
    'UPDATE ucl_matches SET result_home = $1, result_away = $2 WHERE id = $3',
    [rh, ra, match_id]
  )

  // H2H nur für UCL-Männer
  const slug = getSlugFromParam(comp)
  if (slug === '2627') {
    const matchRes = await pool.query(
      `SELECT m.home_club_id, m.away_club_id, m.kickoff, m.matchday,
              hc.name AS home_name, ac.name AS away_name
       FROM ucl_matches m
       JOIN ucl_clubs hc ON hc.id = m.home_club_id
       JOIN ucl_clubs ac ON ac.id = m.away_club_id
       WHERE m.id = $1`,
      [match_id]
    )
    const match = matchRes.rows[0]
    if (match) {
      await pool.query(
        `INSERT INTO ucl_h2h (home_id, away_id, date, competition, round, home_team, away_team, home_goals, away_goals, notes, logged_at)
         VALUES ($1, $2, $3, 'Champions League', $4, $5, $6, $7, $8, NULL, NOW())
         ON CONFLICT (home_id, away_id, date) DO UPDATE
           SET home_goals = EXCLUDED.home_goals,
               away_goals = EXCLUDED.away_goals,
               logged_at = COALESCE(ucl_h2h.logged_at, NOW())`,
        [match.home_club_id, match.away_club_id, match.kickoff,
         `Spieltag ${match.matchday}`, match.home_name, match.away_name, rh, ra]
      )
    }
  }

  return NextResponse.json({ success: true })
}

export async function DELETE(req: NextRequest) {
  const admin = await checkAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })

  const { match_id, comp } = await req.json()
  if (!match_id) return NextResponse.json({ error: 'match_id fehlt' }, { status: 400 })

  const slug = getSlugFromParam(comp)
  if (slug === '2627') {
    const matchRes = await pool.query(
      'SELECT home_club_id, away_club_id, kickoff FROM ucl_matches WHERE id = $1',
      [match_id]
    )
    const match = matchRes.rows[0]
    await pool.query('UPDATE ucl_matches SET result_home = NULL, result_away = NULL WHERE id = $1', [match_id])
    if (match) {
      await pool.query(
        'DELETE FROM ucl_h2h WHERE home_id = $1 AND away_id = $2 AND date = $3::date',
        [match.home_club_id, match.away_club_id, match.kickoff]
      )
    }
  } else {
    await pool.query('UPDATE ucl_matches SET result_home = NULL, result_away = NULL WHERE id = $1', [match_id])
  }

  return NextResponse.json({ success: true })
}