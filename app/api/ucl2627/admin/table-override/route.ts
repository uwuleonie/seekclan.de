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

async function getSeasonId() {
  const res = await pool.query("SELECT id FROM ucl_seasons WHERE slug = '2627'")
  return res.rows[0]?.id ?? null
}

// GET: aktuellen Override laden
export async function GET(req: NextRequest) {
  const admin = await checkAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })
  const seasonId = await getSeasonId()
  if (!seasonId) return NextResponse.json({ override: [] })
  const res = await pool.query(
    'SELECT club_id, position FROM ucl_table_override WHERE season_id = $1 ORDER BY position ASC',
    [seasonId]
  )
  return NextResponse.json({ override: res.rows })
}

// POST: Override speichern — ranking = array of club_ids in order (position 1 = index 0)
export async function POST(req: NextRequest) {
  const admin = await checkAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })
  const { ranking } = await req.json()
  if (!Array.isArray(ranking) || ranking.length !== 36) {
    return NextResponse.json({ error: 'ranking muss 36 club_ids enthalten' }, { status: 400 })
  }
  const seasonId = await getSeasonId()
  if (!seasonId) return NextResponse.json({ error: 'Season nicht gefunden' }, { status: 404 })

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query('DELETE FROM ucl_table_override WHERE season_id = $1', [seasonId])
    for (let i = 0; i < ranking.length; i++) {
      await client.query(
        'INSERT INTO ucl_table_override (season_id, club_id, position) VALUES ($1, $2, $3)',
        [seasonId, ranking[i], i + 1]
      )
    }
    await client.query('COMMIT')
  } catch (e) {
    await client.query('ROLLBACK')
    return NextResponse.json({ error: 'Fehler beim Speichern' }, { status: 500 })
  } finally {
    client.release()
  }

  return NextResponse.json({ success: true })
}

// DELETE: Override komplett löschen → zurück zur automatischen Berechnung
export async function DELETE(req: NextRequest) {
  const admin = await checkAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })
  const seasonId = await getSeasonId()
  if (!seasonId) return NextResponse.json({ success: true })
  await pool.query('DELETE FROM ucl_table_override WHERE season_id = $1', [seasonId])
  return NextResponse.json({ success: true })
}