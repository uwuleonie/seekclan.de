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

export async function PATCH(req: NextRequest) {
  try {
    const admin = await checkAdmin(req)
    if (!admin) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })

    const { club_id, logo_url } = await req.json()
    if (!club_id) return NextResponse.json({ error: 'club_id fehlt' }, { status: 400 })

    await pool.query(
      'UPDATE ucl_clubs SET logo_url = $1 WHERE id = $2',
      [logo_url || null, club_id]
    )
    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}