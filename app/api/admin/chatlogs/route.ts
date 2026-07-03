import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'

// Admin-Chatlog-Übersicht (Konzeptdokument Abschnitt 10): Admins können
// grundsätzlich jede Konversation einsehen - auch private Website-Gruppen/DMs
// ohne Ingame-Bezug. Diese Route listet nur die Übersicht, die eigentlichen
// Nachrichten gibt's erst nach Begründungs-Eingabe über [conversationId]/view.

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

export async function GET(req: NextRequest) {
  const admin = await checkAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })

  const search = req.nextUrl.searchParams.get('search')?.trim() || null

  const result = await pool.query(
    `SELECT
       c.id, c.type, c.name, c.avatar_url,
       (SELECT COUNT(*) FROM conversation_members cm WHERE cm.conversation_id = c.id) AS member_count,
       (SELECT MAX(m.created_at) FROM messages m WHERE m.conversation_id = c.id) AS last_message_at,
       (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id) AS message_count,
       -- Bei direct-Konversationen die Namen der Teilnehmer für die Anzeige zusammenbauen,
       -- da c.name dort leer ist (nur bei 'group' gesetzt).
       (SELECT string_agg(COALESCE(u.username, sps.player_name, cm.member_minecraft_username, 'Unbekannt'), ' & ')
        FROM conversation_members cm
        LEFT JOIN users u ON u.id = cm.user_id
        LEFT JOIN smp_player_stats sps ON sps.uuid = cm.member_minecraft_uuid
        WHERE cm.conversation_id = c.id) AS participant_names
     FROM conversations c
     WHERE ($1::text IS NULL OR c.name ILIKE $1 OR EXISTS (
       SELECT 1 FROM conversation_members cm
       LEFT JOIN users u ON u.id = cm.user_id
       LEFT JOIN smp_player_stats sps ON sps.uuid = cm.member_minecraft_uuid
       WHERE cm.conversation_id = c.id
         AND COALESCE(u.username, sps.player_name, cm.member_minecraft_username, '') ILIKE $1
     ))
     ORDER BY last_message_at DESC NULLS LAST
     LIMIT 200`,
    [search ? `%${search}%` : null]
  )

  return NextResponse.json({ conversations: result.rows })
}