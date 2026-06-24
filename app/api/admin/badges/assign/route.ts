import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'

async function checkAdmin(req: NextRequest) {
  const token = req.cookies.get('session_token')?.value
  if (!token) return null

  const sessionResult = await pool.query('SELECT user_id FROM sessions WHERE token = $1', [token])
  const session = sessionResult.rows[0]
  if (!session) return null

  const userResult = await pool.query(
    'SELECT username, clan_role FROM users WHERE id = $1',
    [session.user_id]
  )
  const user = userResult.rows[0]

  if (!user || user.clan_role !== 'admin') return null
  return user
}

// Badge zuweisen
export async function POST(req: NextRequest) {
  const admin = await checkAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })

  const { member_id, badge_id } = await req.json()
  if (!member_id || !badge_id) return NextResponse.json({ error: 'Member-ID und Badge-ID erforderlich' }, { status: 400 })

  try {
    await pool.query(
      'INSERT INTO clan_member_badges (member_id, badge_id) VALUES ($1, $2)',
      [member_id, badge_id]
    )
  } catch (err) {
    return NextResponse.json({ error: 'Fehler beim Zuweisen' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}

// Badge entfernen
export async function DELETE(req: NextRequest) {
  const admin = await checkAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })

  const { member_id, badge_id } = await req.json()
  if (!member_id || !badge_id) return NextResponse.json({ error: 'Member-ID und Badge-ID erforderlich' }, { status: 400 })

  try {
    await pool.query(
      'DELETE FROM clan_member_badges WHERE member_id = $1 AND badge_id = $2',
      [member_id, badge_id]
    )
  } catch (err) {
    return NextResponse.json({ error: 'Fehler beim Entfernen' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}