import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'
import { mitRecht, darf } from '@/app/lib/rechte'

async function checkRead(req: NextRequest) {
  return mitRecht(req, 'admin.zugang')
}

// POST /api/admin2/board/[postId]/vote
// Body: { optionId }
// Ein Stimme pro Nutzer und Abstimmung - erneutes Abstimmen ändert einfach
// die vorhandene Stimme (Umentscheiden ist erlaubt, kein "Stimme zurückziehen"
// nötig, weil ein Klick auf eine andere Option das automatisch übernimmt).
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ postId: string }> }
) {
  const user = await checkRead(req)
  if (!user) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })

  const { postId } = await context.params
  const { optionId } = await req.json().catch(() => ({})) as { optionId?: string }
  if (!optionId) return NextResponse.json({ error: 'optionId erforderlich' }, { status: 400 })

  try {
    const postResult = await pool.query(
      `SELECT type, ends_at, channel FROM admin_board_posts WHERE id = $1`,
      [postId]
    )
    const post = postResult.rows[0]
    if (!post || post.type !== 'poll') {
      return NextResponse.json({ error: 'Abstimmung nicht gefunden' }, { status: 404 })
    }
    if (post.channel === 'admin-chat' && !darf(user, 'admin.verwalten')) {
      return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })
    }
    if (post.ends_at && new Date(post.ends_at) < new Date()) {
      return NextResponse.json({ error: 'Diese Abstimmung ist bereits beendet' }, { status: 400 })
    }

    const optionResult = await pool.query(
      `SELECT id FROM admin_board_poll_options WHERE id = $1 AND post_id = $2`,
      [optionId, postId]
    )
    if (optionResult.rows.length === 0) {
      return NextResponse.json({ error: 'Ungültige Option' }, { status: 400 })
    }

    await pool.query(
      `INSERT INTO admin_board_poll_votes (post_id, option_id, user_id)
       VALUES ($1, $2, $3)
       ON CONFLICT (post_id, user_id) DO UPDATE SET option_id = $2, voted_at = now()`,
      [postId, optionId, user.id]
    )

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}