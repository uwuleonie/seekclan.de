import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'

async function checkRead(req: NextRequest) {
  const token = req.cookies.get('session_token')?.value
  if (!token) return null
  const sessionResult = await pool.query('SELECT user_id FROM sessions WHERE token = $1', [token])
  const session = sessionResult.rows[0]
  if (!session) return null
  const userResult = await pool.query('SELECT id, clan_role FROM users WHERE id = $1', [session.user_id])
  const user = userResult.rows[0]
  if (!user || !['administrator', 'owner', 'teammitglied'].includes(user.clan_role)) return null
  return user
}

// GET /api/admin2/team-chat/presence?channel=admin-chat
// Liefert alle Team-Mitglieder mit last_seen_at (aktualisiert sich schon bei
// jedem /api/auth/me-Aufruf, kein eigenes Presence-System nötig). Mit
// ?channel=admin-chat werden Teammitglieder rausgefiltert, weil die dort
// ohnehin keinen Zugriff haben - die Mitgliederliste soll das widerspiegeln.
export async function GET(req: NextRequest) {
  const user = await checkRead(req)
  if (!user) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })

  const channel = req.nextUrl.searchParams.get('channel')
  const roles = channel === 'admin-chat' ? ['administrator', 'owner'] : ['administrator', 'owner', 'teammitglied']

  try {
    const result = await pool.query(
      `SELECT id, username, clan_role, last_seen_at
       FROM users
       WHERE clan_role = ANY($1)
       ORDER BY last_seen_at DESC NULLS LAST`,
      [roles]
    )
    return NextResponse.json({ members: result.rows })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}