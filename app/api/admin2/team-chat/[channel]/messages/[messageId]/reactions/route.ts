import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'
import { mitRecht } from '@/app/lib/rechte'

const CHANNELS = ['admin-chat', 'team-lounge']

// Team-Lounge: alle mit Admin-Panel-Zugang. Admin-Chat: nur wer im Admin-Panel alles bearbeiten darf.
async function checkChannelAccess(req: NextRequest, channel: string) {
  return mitRecht(req, channel === 'admin-chat' ? 'admin.verwalten' : 'admin.zugang')
}

// POST /api/admin2/team-chat/[channel]/messages/[messageId]/reactions
// Body: { emoji }
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ channel: string, messageId: string }> }
) {
  const { channel, messageId } = await context.params
  if (!CHANNELS.includes(channel)) return NextResponse.json({ error: 'Ungültiger Kanal' }, { status: 400 })

  const user = await checkChannelAccess(req, channel)
  if (!user) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })

  const { emoji } = await req.json().catch(() => ({})) as { emoji?: string }
  if (!emoji) return NextResponse.json({ error: 'emoji erforderlich' }, { status: 400 })

  try {
    const existing = await pool.query(
      `SELECT 1 FROM admin_team_message_reactions WHERE message_id = $1 AND user_id = $2 AND emoji = $3`,
      [messageId, user.id, emoji]
    )
    if (existing.rows.length > 0) {
      await pool.query(
        `DELETE FROM admin_team_message_reactions WHERE message_id = $1 AND user_id = $2 AND emoji = $3`,
        [messageId, user.id, emoji]
      )
    } else {
      await pool.query(
        `INSERT INTO admin_team_message_reactions (message_id, user_id, emoji) VALUES ($1, $2, $3)`,
        [messageId, user.id, emoji]
      )
    }
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}