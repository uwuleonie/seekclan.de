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

// GET /api/admin2/ideas
//
// Liefert eine vereinheitlichte Liste aus zwei Quellen:
// 1. admin_ideas - eigenständig auf dieser Seite erstellte Ideen
// 2. support_tickets mit category='suggestion' - Vorschläge, die Nutzer über
//    das normale Support-Ticket-System eingereicht haben
// Beide werden auf dieselbe Form gebracht (source-Feld unterscheidet sie) und
// zusammen nach created_at sortiert zurückgegeben, damit die Seite eine
// einzige gemischte Liste rendern kann.
//
// PERMISSIONS-HINWEIS: Claim-/Zugriffsanfrage-System kommt in einem separaten
// Schritt (siehe Besprechung) - aktuell darf jeder eingeloggte Admin jede Idee
// vollständig sehen und bearbeiten. claimed_by wird schon mitgespeichert und
// zurückgegeben, damit das UI dafür vorbereitet ist, aber noch nicht durchgesetzt.
export async function GET(req: NextRequest) {
  const admin = await checkAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })

  let ideas
  try {
    const ideasResult = await pool.query(
      `SELECT
         ai.id, ai.title, ai.description, ai.tag, ai.tag_color, ai.status,
         ai.created_at, ai.claimed_by,
         u.username AS author_username,
         claimer.username AS claimed_by_username,
         'idea' AS source,
         (SELECT COUNT(*) FROM admin_idea_comments c WHERE c.idea_id = ai.id) AS comment_count
       FROM admin_ideas ai
       JOIN users u ON u.id = ai.created_by
       LEFT JOIN users claimer ON claimer.id = ai.claimed_by
       ORDER BY ai.created_at DESC`
    )

    const suggestionsResult = await pool.query(
      `SELECT
         st.id, st.subject AS title,
         COALESCE(
           (SELECT sm.body FROM support_messages sm WHERE sm.ticket_id = st.id ORDER BY sm.created_at ASC LIMIT 1),
           ''
         ) AS description,
         'Vorschlag' AS tag, '#0EA5E9' AS tag_color,
         CASE st.status
           WHEN 'open' THEN 'idee'
           WHEN 'in_progress' THEN 'in_umsetzung'
           WHEN 'closed' THEN 'fertig'
           ELSE 'idee'
         END AS status,
         st.created_at, NULL::uuid AS claimed_by,
         u.username AS author_username,
         NULL AS claimed_by_username,
         'ticket' AS source,
         (SELECT COUNT(*) FROM support_messages m WHERE m.ticket_id = st.id) AS comment_count
       FROM support_tickets st
       JOIN users u ON u.id = st.user_id
       WHERE st.category = 'suggestion'
       ORDER BY st.created_at DESC`
    )

    ideas = [...ideasResult.rows, ...suggestionsResult.rows]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }

  return NextResponse.json({ ideas })
}

// POST /api/admin2/ideas
// Body: { title, description, tag?, tag_color? }
// Erstellt eine neue eigenständige Idee (source='idea'). Für Vorschläge aus dem
// normalen Support-System gibt es hier keinen POST - die entstehen weiterhin
// über /api/support/tickets.
export async function POST(req: NextRequest) {
  const admin = await checkAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })

  const body = await req.json()
  const { title, description, tag, tag_color } = body as {
    title: string, description: string, tag?: string, tag_color?: string
  }

  if (!title?.trim() || !description?.trim()) {
    return NextResponse.json({ error: 'Titel und Beschreibung erforderlich' }, { status: 400 })
  }

  try {
    const result = await pool.query(
      `INSERT INTO admin_ideas (title, description, tag, tag_color, created_by)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [title.trim(), description.trim(), tag?.trim() || 'Idee', tag_color || '#9CA3AF', admin.id]
    )
    return NextResponse.json({ id: result.rows[0].id })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}