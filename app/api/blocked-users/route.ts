import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'

async function getUser(req: NextRequest) {
  const token = req.cookies.get('session_token')?.value
  if (!token) return null
  const sessionResult = await pool.query('SELECT user_id FROM sessions WHERE token = $1', [token])
  const session = sessionResult.rows[0]
  if (!session) return null
  const userResult = await pool.query('SELECT id, username FROM users WHERE id = $1', [session.user_id])
  return userResult.rows[0] || null
}

// GET: Liste der von mir blockierten Nutzer
export async function GET(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })

  const blockedResult = await pool.query(
    `SELECT
       bu.blocked_id, bu.created_at,
       json_build_object('username', u.username, 'display_name', u.display_name) AS users
     FROM blocked_users bu
     JOIN users u ON u.id = bu.blocked_id
     WHERE bu.blocker_id = $1
     ORDER BY bu.created_at DESC`,
    [user.id]
  )

  return NextResponse.json({ blocked: blockedResult.rows || [] })
}

// POST: Nutzer blockieren. Body: { user_id }
export async function POST(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })

  const { user_id } = await req.json()
  if (!user_id) return NextResponse.json({ error: 'user_id erforderlich' }, { status: 400 })
  if (user_id === user.id) return NextResponse.json({ error: 'Nicht möglich mit dir selbst' }, { status: 400 })

  try {
    await pool.query(
      'INSERT INTO blocked_users (blocker_id, blocked_id) VALUES ($1, $2)',
      [user.id, user_id]
    )
  } catch (err) {
    return NextResponse.json({ error: 'Bereits blockiert' }, { status: 400 })
  }

  return NextResponse.json({ success: true })
}

// DELETE: Nutzer entblockieren. Query-Param: ?user_id=
export async function DELETE(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })

  const userId = req.nextUrl.searchParams.get('user_id')
  if (!userId) return NextResponse.json({ error: 'user_id erforderlich' }, { status: 400 })

  await pool.query(
    'DELETE FROM blocked_users WHERE blocker_id = $1 AND blocked_id = $2',
    [user.id, userId]
  )

  return NextResponse.json({ success: true })
}