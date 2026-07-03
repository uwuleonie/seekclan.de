import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'

async function checkAdmin(req: NextRequest) {
  const token = req.cookies.get('session_token')?.value
  if (!token) return null
  const sessionResult = await pool.query('SELECT user_id FROM sessions WHERE token = $1', [token])
  const session = sessionResult.rows[0]
  if (!session) return null
  const userResult = await pool.query('SELECT id, username, clan_role FROM users WHERE id = $1', [session.user_id])
  const user = userResult.rows[0]
  if (!user || (user.clan_role !== 'administrator' && user.clan_role !== 'owner')) return null
  return user
}

// POST /api/admin2/ideas/[ideaId]/comments
// Body: { content }
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ ideaId: string }> }
) {
  const admin = await checkAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })

  const { ideaId } = await context.params
  const body = await req.json().catch(() => ({}))
  const { content } = body as { content?: string }

  if (!content?.trim()) {
    return NextResponse.json({ error: 'Kommentar darf nicht leer sein' }, { status: 400 })
  }

  try {
    const result = await pool.query(
      `INSERT INTO admin_idea_comments (idea_id, author_id, content)
       VALUES ($1, $2, $3)
       RETURNING id, content, created_at`,
      [ideaId, admin.id, content.trim()]
    )
    return NextResponse.json({
      comment: { ...result.rows[0], author_username: admin.username }
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}