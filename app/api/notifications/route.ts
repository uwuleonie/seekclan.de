import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'

async function getUserId(token: string | undefined) {
  if (!token) return null
  const sessionResult = await pool.query(
    'SELECT user_id, expires_at FROM sessions WHERE token = $1',
    [token]
  )
  const session = sessionResult.rows[0]
  if (!session || new Date(session.expires_at) < new Date()) return null
  return session.user_id as string
}

export async function GET(req: NextRequest) {
  const userId = await getUserId(req.cookies.get('session_token')?.value)
  if (!userId) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })

  let result
  try {
    result = await pool.query(
      'SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 100',
      [userId]
    )
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }

  return NextResponse.json({ notifications: result.rows || [] })
}

export async function PATCH(req: NextRequest) {
  const userId = await getUserId(req.cookies.get('session_token')?.value)
  if (!userId) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })

  const body = await req.json()

  if (body.markAllRead) {
    try {
      await pool.query('UPDATE notifications SET read = true WHERE user_id = $1 AND read = false', [userId])
    } catch (err: any) {
      return NextResponse.json({ error: err.message }, { status: 500 })
    }
    return NextResponse.json({ success: true })
  }

  if (body.id) {
    try {
      await pool.query('UPDATE notifications SET read = true WHERE id = $1 AND user_id = $2', [body.id, userId])
    } catch (err: any) {
      return NextResponse.json({ error: err.message }, { status: 500 })
    }
    return NextResponse.json({ success: true })
  }

  return NextResponse.json({ error: 'id oder markAllRead erforderlich' }, { status: 400 })
}