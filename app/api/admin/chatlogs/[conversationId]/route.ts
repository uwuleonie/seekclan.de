import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'

async function checkAdmin(req: NextRequest) {
  const token = req.cookies.get('session_token')?.value
  if (!token) return null
  const sessionResult = await pool.query('SELECT user_id FROM sessions WHERE token = $1', [token])
  const session = sessionResult.rows[0]
  if (!session) return null
  const userResult = await pool.query('SELECT id, username, clan_role FROM users WHERE id = $1', [session.user_id])
  const user = userResult.rows[0]
  if (!user || (user.clan_role !== 'administrator' && user.clan_role !== 'owner')) return null
  return user
}

// GET /api/admin/chatlogs/[conversationId]
// Liefert alle Nachrichten (Admins sehen auch soft-gelöschte, Konzept 13.1) PLUS
// wie weit der Admin in dieser Konversation schon "aufgedeckt" hat
// (revealed_up_to_message_id der letzten eigenen Ansicht) - das Frontend blendet
// alles danach standardmäßig verdeckt aus (Konzept 13.7).
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ conversationId: string }> }
) {
  const admin = await checkAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })

  const { conversationId } = await context.params

  // Es muss zuerst eine protokollierte Ansicht existieren (Begründung eingegeben),
  // bevor überhaupt Nachrichten ausgeliefert werden - erzwingt den Begründungs-Flow.
  const lastViewResult = await pool.query(
    `SELECT id, revealed_up_to_message_id FROM admin_chatlog_views
     WHERE conversation_id = $1 AND admin_id = $2
     ORDER BY viewed_at DESC LIMIT 1`,
    [conversationId, admin.id]
  )
  const lastView = lastViewResult.rows[0]
  if (!lastView) {
    return NextResponse.json({ error: 'Erst eine Begründung über /view eingeben' }, { status: 403 })
  }

  const result = await pool.query(
    `SELECT
       m.id, m.sender_id, m.content, m.image_url, m.created_at, m.is_deleted,
       m.location_label, m.location_chunk_x, m.location_chunk_z, m.edited_at,
       COALESCE(u.username, sps.player_name, m.sender_minecraft_uuid, 'Unbekannt') AS sender_username
     FROM messages m
     LEFT JOIN users u ON u.id = m.sender_id
     LEFT JOIN smp_player_stats sps ON sps.uuid = m.sender_minecraft_uuid
     WHERE m.conversation_id = $1
     ORDER BY m.created_at ASC`,
    [conversationId]
  )

  return NextResponse.json({
    messages: result.rows,
    revealed_up_to_message_id: lastView.revealed_up_to_message_id,
    view_id: lastView.id,
  })
}