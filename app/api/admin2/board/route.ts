import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'

const CATEGORIES = ['wichtig', 'todo', 'idee', 'event', 'info']

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

// GET /api/admin2/board
// Liefert Notizen UND Abstimmungen gemeinsam (unterschieden über "type"),
// neueste zuerst. Abstimmungen bekommen zusätzlich ihre Optionen inkl.
// Stimmenzahl/Prozent sowie die eigene abgegebene Stimme mit ausgeliefert,
// damit das Frontend nicht pro Post extra nachfragen muss.
export async function GET(req: NextRequest) {
  const user = await checkRead(req)
  if (!user) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })

  try {
    const postsResult = await pool.query(
      `SELECT p.id, p.type, p.category, p.title, p.content, p.ends_at, p.is_pinned,
              p.created_at, p.created_by, cu.username AS created_by_username,
              p.pinned_by, pu.username AS pinned_by_username
       FROM admin_board_posts p
       JOIN users cu ON cu.id = p.created_by
       LEFT JOIN users pu ON pu.id = p.pinned_by
       WHERE p.concept_id IS NULL
       ORDER BY p.created_at DESC`
    )

    const optionsResult = await pool.query(
      `SELECT id, post_id, label, sort_order FROM admin_board_poll_options ORDER BY sort_order ASC`
    )
    const votesResult = await pool.query(
      `SELECT post_id, option_id, user_id FROM admin_board_poll_votes`
    )

    const posts = postsResult.rows.map(post => {
      if (post.type !== 'poll') return { ...post, options: null, totalVotes: null, myVoteOptionId: null }

      const options = optionsResult.rows.filter(o => o.post_id === post.id)
      const votes = votesResult.rows.filter(v => v.post_id === post.id)
      const totalVotes = votes.length
      const myVote = votes.find(v => v.user_id === user.id)

      return {
        ...post,
        options: options.map(o => {
          const count = votes.filter(v => v.option_id === o.id).length
          return {
            id: o.id, label: o.label,
            count,
            percent: totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0,
          }
        }),
        totalVotes,
        myVoteOptionId: myVote?.option_id || null,
      }
    })

    return NextResponse.json({ posts })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// POST /api/admin2/board
// Body: { title, content?, category, pinned? }
// Legt eine normale Notiz an (für Abstimmungen siehe /api/admin2/board/polls).
export async function POST(req: NextRequest) {
  const user = await checkRead(req)
  if (!user) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })

  const { title, content, category, pinned } = await req.json().catch(() => ({})) as {
    title?: string, content?: string, category?: string, pinned?: boolean
  }
  if (!title?.trim()) return NextResponse.json({ error: 'Titel erforderlich' }, { status: 400 })
  if (!category || !CATEGORIES.includes(category)) {
    return NextResponse.json({ error: 'Ungültige Kategorie' }, { status: 400 })
  }

  try {
    const result = await pool.query(
      `INSERT INTO admin_board_posts (type, category, title, content, created_by, is_pinned, pinned_by, pinned_at)
       VALUES ('note', $1, $2, $3, $4, $5, $6, $7)
       RETURNING id`,
      [category, title.trim(), content?.trim() || null, user.id, !!pinned, pinned ? user.id : null, pinned ? new Date() : null]
    )
    return NextResponse.json({ success: true, id: result.rows[0].id })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}