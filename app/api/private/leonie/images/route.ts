import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'

export async function GET(req: NextRequest) {
  const token = req.cookies.get('session_token')?.value
  if (!token) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })

  const sessionResult = await pool.query(
    `SELECT u.clan_role FROM sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.token = $1 AND s.expires_at > NOW()`,
    [token]
  )
  const session = sessionResult.rows[0]
  if (!session || !['administrator', 'owner'].includes(session.clan_role)) {
    return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })
  }

  const result = await pool.query(
    `SELECT id, tool, url, created_at FROM leonie_images ORDER BY created_at DESC LIMIT 100`
  )

  return NextResponse.json({ images: result.rows })
}