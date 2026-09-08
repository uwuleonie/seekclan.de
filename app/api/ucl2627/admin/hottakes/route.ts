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

const POINTS_BY_HARDNESS: Record<number, number> = { 1: 4, 2: 8, 3: 12 }

// GET: Alle Hottakes für Admin
export async function GET(req: NextRequest) {
  try {
    const admin = await checkAdmin(req)
    if (!admin) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })

    const seasonId = await getSeasonId()
    if (!seasonId) return NextResponse.json({ hottakes: [] })

    const res = await pool.query(
      `SELECT h.*, u.username
       FROM ucl_hottakes h
       LEFT JOIN users u ON u.id = h.user_id
       WHERE h.season_id = $1
       ORDER BY h.created_at DESC`,
      [seasonId]
    )
    return NextResponse.json({ hottakes: res.rows })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// PATCH: Status, Härte setzen ODER Hottake als erfüllt/nicht erfüllt markieren + Punkte vergeben
// Body: { id, status?, hardness?, fulfilled? }
// fulfilled=true  → Punkte basierend auf hardness auf ucl_leaderboard addieren (einmalig)
// fulfilled=false → Punkte zurücknehmen falls bereits vergeben
export async function PATCH(req: NextRequest) {
  try {
    const admin = await checkAdmin(req)
    if (!admin) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })

    const { id, status, hardness, fulfilled } = await req.json()
    if (!id) return NextResponse.json({ error: 'id fehlt' }, { status: 400 })

    // Aktuellen Zustand des Hottakes laden
    const currentRes = await pool.query(
      'SELECT * FROM ucl_hottakes WHERE id = $1',
      [id]
    )
    const current = currentRes.rows[0]
    if (!current) return NextResponse.json({ error: 'Hottake nicht gefunden' }, { status: 404 })

    const updates: string[] = []
    const values: any[] = []
    let idx = 1

    if (status !== undefined)    { updates.push(`status = $${idx++}`);    values.push(status) }
    if (hardness !== undefined)  { updates.push(`hardness = $${idx++}`);  values.push(hardness) }
    if (fulfilled !== undefined) { updates.push(`fulfilled = $${idx++}`); values.push(fulfilled) }

    // Punkte-Logik
    if (fulfilled !== undefined && fulfilled !== current.fulfilled) {
      const effectiveHardness = hardness ?? current.hardness
      const seasonId = await getSeasonId()

      if (fulfilled === true && !current.points_awarded) {
        // Punkte vergeben
        if (!effectiveHardness || !POINTS_BY_HARDNESS[effectiveHardness]) {
          return NextResponse.json({ error: 'Härte muss gesetzt sein bevor Punkte vergeben werden' }, { status: 400 })
        }
        const pts = POINTS_BY_HARDNESS[effectiveHardness]

        if (current.user_id) {
          // Eingeloggter Nutzer — ucl_leaderboard updaten oder erstellen
          await pool.query(
            `INSERT INTO ucl_leaderboard (season_id, user_id, points)
             VALUES ($1, $2, $3)
             ON CONFLICT (season_id, user_id)
             DO UPDATE SET points = ucl_leaderboard.points + $3`,
            [seasonId, current.user_id, pts]
          )
        }
        // Gast-Hottakes bekommen keine Punkte (kein Account)
        updates.push(`points_awarded = $${idx++}`)
        values.push(true)

      } else if (fulfilled === false && current.points_awarded) {
        // Punkte zurücknehmen
        const effectiveH = hardness ?? current.hardness
        const pts = effectiveH ? (POINTS_BY_HARDNESS[effectiveH] ?? 0) : 0
        if (current.user_id && pts > 0) {
          await pool.query(
            `UPDATE ucl_leaderboard SET points = GREATEST(0, points - $1)
             WHERE season_id = $2 AND user_id = $3`,
            [pts, seasonId, current.user_id]
          )
        }
        updates.push(`points_awarded = $${idx++}`)
        values.push(false)
      }
    }

    if (!updates.length) return NextResponse.json({ error: 'Nichts zu updaten' }, { status: 400 })

    values.push(id)
    await pool.query(`UPDATE ucl_hottakes SET ${updates.join(', ')} WHERE id = $${idx}`, values)

    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}