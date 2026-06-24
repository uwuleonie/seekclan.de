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
  return session.user_id as number
}

// Liefert, ob der eingeloggte Spieler das Claims-Tutorial schon gesehen hat.
export async function GET(req: NextRequest) {
  const userId = await getUserId(req.cookies.get('session_token')?.value)
  if (!userId) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })

  const userResult = await pool.query(
    'SELECT seen_claims_tutorial FROM users WHERE id = $1',
    [userId]
  )
  const user = userResult.rows[0]

  return NextResponse.json({ seen: !!user?.seen_claims_tutorial })
}

// Markiert das Tutorial als gesehen.
export async function POST(req: NextRequest) {
  const userId = await getUserId(req.cookies.get('session_token')?.value)
  if (!userId) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })

  try {
    await pool.query('UPDATE users SET seen_claims_tutorial = true WHERE id = $1', [userId])
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}