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

// PATCH: Status + Härte setzen
// Body: { id, status?, hardness? }
export async function PATCH(req: NextRequest) {
  try {
    const admin = await checkAdmin(req)
    if (!admin) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })

    const { id, status, hardness } = await req.json()
    if (!id) return NextResponse.json({ error: 'id fehlt' }, { status: 400 })

    const updates: string[] = []
    const values: any[] = []
    let idx = 1

    if (status !== undefined) { updates.push(`status = $${idx++}`); values.push(status) }
    if (hardness !== undefined) { updates.push(`hardness = $${idx++}`); values.push(hardness) }

    if (!updates.length) return NextResponse.json({ error: 'Nichts zu updaten' }, { status: 400 })

    values.push(id)
    await pool.query(`UPDATE ucl_hottakes SET ${updates.join(', ')} WHERE id = $${idx}`, values)

    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}