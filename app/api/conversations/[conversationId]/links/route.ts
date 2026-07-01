import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'

// Links-Übersicht (Konzeptdokument Abschnitt 5): alle in dieser Konversation
// gesendeten Links, filterbar nach Absender, sortierbar.
//
// GET /api/conversations/[conversationId]/links?sender=USERNAME&sort=asc|desc

async function getUser(req: NextRequest) {
  const token = req.cookies.get('session_token')?.value
  if (!token) return null
  const sessionResult = await pool.query('SELECT user_id FROM sessions WHERE token = $1', [token])
  const session = sessionResult.rows[0]
  if (!session) return null
  const userResult = await pool.query('SELECT id FROM users WHERE id = $1', [session.user_id])
  return userResult.rows[0] || null
}

async function isMember(conversationId: string, userId: string) {
  const result = await pool.query(
    'SELECT user_id FROM conversation_members WHERE conversation_id = $1 AND user_id = $2',
    [conversationId, userId]
  )
  return result.rows.length > 0
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ conversationId: string }> }
) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })

  const { conversationId } = await context.params
  if (!(await isMember(conversationId, user.id))) {
    return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })
  }

  const senderFilter = req.nextUrl.searchParams.get('sender')
  const sort = req.nextUrl.searchParams.get('sort') === 'asc' ? 'ASC' : 'DESC'

  const result = await pool.query(
    `SELECT
       cl.id, cl.url, cl.created_at, cl.message_id,
       COALESCE(u.username, sps.player_name, cl.sender_minecraft_username, 'Unbekannt') AS sender_username
     FROM chat_links cl
     LEFT JOIN users u ON u.id = cl.sender_id
     LEFT JOIN smp_player_stats sps ON sps.uuid = cl.sender_minecraft_uuid
     WHERE cl.conversation_id = $1
       AND ($2::text IS NULL OR COALESCE(u.username, sps.player_name, cl.sender_minecraft_username) ILIKE $2)
     ORDER BY cl.created_at ${sort}`,
    [conversationId, senderFilter ? `%${senderFilter}%` : null]
  )

  return NextResponse.json({ links: result.rows })
}