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

// POST /api/admin2/board/polls
// Body: { title, options: string[], endsAt?: string, pinned?, conceptId?, channel? }
// Ohne conceptId/channel landet die Abstimmung auf dem globalen Schwarzen
// Brett, mit conceptId nur im Chat des jeweiligen Update-Konzepts, mit
// channel nur im jeweiligen Team-Chat-Kanal ('admin-chat' oder 'team-lounge').
export async function POST(req: NextRequest) {
  const user = await checkRead(req)
  if (!user) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })

  const { title, options, endsAt, pinned, conceptId, channel } = await req.json().catch(() => ({})) as {
    title?: string, options?: string[], endsAt?: string, pinned?: boolean, conceptId?: string, channel?: string
  }
  if (!title?.trim()) return NextResponse.json({ error: 'Frage erforderlich' }, { status: 400 })

  if (channel && !['admin-chat', 'team-lounge'].includes(channel)) {
    return NextResponse.json({ error: 'Ungültiger Kanal' }, { status: 400 })
  }
  if (channel === 'admin-chat' && user.clan_role !== 'administrator' && user.clan_role !== 'owner') {
    return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })
  }

  const cleanOptions = (options || []).map(o => o.trim()).filter(Boolean)
  if (cleanOptions.length < 2) {
    return NextResponse.json({ error: 'Mindestens 2 Antwortoptionen erforderlich' }, { status: 400 })
  }

  try {
    const postResult = await pool.query(
      `INSERT INTO admin_board_posts (type, title, ends_at, created_by, is_pinned, pinned_by, pinned_at, concept_id, channel)
       VALUES ('poll', $1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id`,
      [title.trim(), endsAt || null, user.id, !!pinned, pinned ? user.id : null, pinned ? new Date() : null, conceptId || null, channel || null]
    )
    const postId = postResult.rows[0].id

    for (let i = 0; i < cleanOptions.length; i++) {
      await pool.query(
        `INSERT INTO admin_board_poll_options (post_id, label, sort_order) VALUES ($1, $2, $3)`,
        [postId, cleanOptions[i], i]
      )
    }

    return NextResponse.json({ success: true, id: postId })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}