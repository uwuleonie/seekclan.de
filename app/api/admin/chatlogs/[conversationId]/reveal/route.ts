import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'

async function checkAdmin(req: NextRequest) {
  const token = req.cookies.get('session_token')?.value
  if (!token) return null
  const sessionResult = await pool.query('SELECT user_id FROM sessions WHERE token = $1', [token])
  const session = sessionResult.rows[0]
  if (!session) return null
  const userResult = await pool.query('SELECT id, clan_role FROM users WHERE id = $1', [session.user_id])
  const user = userResult.rows[0]
  if (!user || (user.clan_role !== 'administrator' && user.clan_role !== 'owner')) return null
  return user
}

// POST /api/admin/chatlogs/[conversationId]/reveal
// Body: { message_id }
// Markiert "aufgedeckt bis hier" (Konzept 13.7) auf der aktuellen (letzten) Ansicht
// des Admins - wirkt wie ein Lesezeichen, das den Teilnehmern zeigt, wie weit
// tatsächlich gelesen wurde.
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ conversationId: string }> }
) {
  const admin = await checkAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })

  const { conversationId } = await context.params
  const { message_id } = await req.json()
  if (!message_id) return NextResponse.json({ error: 'message_id erforderlich' }, { status: 400 })

  const lastViewResult = await pool.query(
    `SELECT id FROM admin_chatlog_views
     WHERE conversation_id = $1 AND admin_id = $2
     ORDER BY viewed_at DESC LIMIT 1`,
    [conversationId, admin.id]
  )
  const lastView = lastViewResult.rows[0]
  if (!lastView) return NextResponse.json({ error: 'Keine aktive Ansicht gefunden' }, { status: 404 })

  await pool.query(
    'UPDATE admin_chatlog_views SET revealed_up_to_message_id = $1 WHERE id = $2',
    [message_id, lastView.id]
  )

  return NextResponse.json({ success: true })
}