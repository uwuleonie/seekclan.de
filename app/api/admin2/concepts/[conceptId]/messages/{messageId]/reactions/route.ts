import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'

async function checkRead(req: NextRequest) {
  const token = req.cookies.get('session_token')?.value
  if (!token) return null
  const sessionResult = await pool.query('SELECT user_id FROM sessions WHERE token = $1', [token])
  const session = sessionResult.rows[0]
  if (!session) return null
  const userResult = await pool.query('SELECT id, username, clan_role FROM users WHERE id = $1', [session.user_id])
  const user = userResult.rows[0]
  if (!user || !['administrator', 'owner', 'teammitglied'].includes(user.clan_role)) return null
  return user
}

// POST /api/admin2/concepts/[conceptId]/messages/[messageId]/reactions
// Body: { emoji }
// Toggle: reagiert der Nutzer schon mit diesem Emoji, wird die Reaktion
// entfernt, sonst hinzugefügt.
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ conceptId: string, messageId: string }> }
) {
  const user = await checkRead(req)
  if (!user) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })

  const { messageId } = await context.params
  const { emoji } = await req.json().catch(() => ({})) as { emoji?: string }
  if (!emoji) return NextResponse.json({ error: 'emoji erforderlich' }, { status: 400 })

  try {
    const existing = await pool.query(
      `SELECT 1 FROM admin_concept_message_reactions WHERE message_id = $1 AND user_id = $2 AND emoji = $3`,
      [messageId, user.id, emoji]
    )
    if (existing.rows.length > 0) {
      await pool.query(
        `DELETE FROM admin_concept_message_reactions WHERE message_id = $1 AND user_id = $2 AND emoji = $3`,
        [messageId, user.id, emoji]
      )
    } else {
      await pool.query(
        `INSERT INTO admin_concept_message_reactions (message_id, user_id, emoji) VALUES ($1, $2, $3)`,
        [messageId, user.id, emoji]
      )
    }
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}