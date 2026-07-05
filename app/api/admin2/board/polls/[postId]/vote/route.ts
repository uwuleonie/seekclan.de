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
    if (post.channel === 'admin-chat' && user.clan_role !== 'administrator' && user.clan_role !== 'owner') {
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