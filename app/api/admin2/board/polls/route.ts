import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'
import { mitRecht, darf } from '@/app/lib/rechte'

async function checkRead(req: NextRequest) {
  return mitRecht(req, 'admin.zugang')
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
  if (channel === 'admin-chat' && !darf(user, 'admin.verwalten')) {
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