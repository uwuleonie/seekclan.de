import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'
import { mitRecht } from '@/app/lib/rechte'

async function checkRead(req: NextRequest) {
  return mitRecht(req, 'admin.zugang')
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