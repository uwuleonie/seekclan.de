import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'
import { mitRecht } from '@/app/lib/rechte'

async function checkAdmin(req: NextRequest) {
  return mitRecht(req, 'admin.verwalten')
}

const VALID_STATUSES = ['idee', 'geplant', 'in_umsetzung', 'fertig']

// GET /api/admin2/ideas/[ideaId]
// Liefert eine einzelne eigenständige Idee mit allen Kommentaren.
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ ideaId: string }> }
) {
  const admin = await checkAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })

  const { ideaId } = await context.params

  let idea
  try {
    const ideaResult = await pool.query(
      `SELECT
         ai.id, ai.title, ai.description, ai.tag, ai.tag_color, ai.status,
         ai.created_at, ai.claimed_by,
         u.username AS author_username, COALESCE(u.anzeigename, u.username) AS author_name,
         claimer.username AS claimed_by_username, COALESCE(claimer.anzeigename, claimer.username) AS claimed_by_name
       FROM admin_ideas ai
       JOIN users u ON u.id = ai.created_by
       LEFT JOIN users claimer ON claimer.id = ai.claimed_by
       WHERE ai.id = $1`,
      [ideaId]
    )
    idea = ideaResult.rows[0]
    if (!idea) return NextResponse.json({ error: 'Idee nicht gefunden' }, { status: 404 })

    const commentsResult = await pool.query(
      `SELECT c.id, c.content, c.created_at, u.username AS author_username,
              COALESCE(u.anzeigename, u.username) AS author_name
       FROM admin_idea_comments c
       JOIN users u ON u.id = c.author_id
       WHERE c.idea_id = $1
       ORDER BY c.created_at ASC`,
      [ideaId]
    )
    idea.comments = commentsResult.rows
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }

  return NextResponse.json({ idea })
}

// PATCH /api/admin2/ideas/[ideaId]
// Body: { title?, description?, tag?, tag_color?, status?, claim?: boolean, unclaim?: boolean }
// Aktuell darf jeder Admin alles ändern (siehe Permissions-Hinweis in der
// Listen-Route) - claim/unclaim wird schon geschrieben, damit das UI vollständig
// funktioniert, die eigentliche Zugriffsbeschränkung kommt im nächsten Schritt.
export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ ideaId: string }> }
) {
  const admin = await checkAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })

  const { ideaId } = await context.params
  const body = await req.json().catch(() => ({}))
  const { title, description, tag, tag_color, status, claim, unclaim } = body as {
    title?: string, description?: string, tag?: string, tag_color?: string,
    status?: string, claim?: boolean, unclaim?: boolean
  }

  if (status !== undefined && !VALID_STATUSES.includes(status)) {
    return NextResponse.json({ error: 'Ungültiger Status' }, { status: 400 })
  }

  try {
    if (claim) {
      await pool.query(
        `UPDATE admin_ideas SET claimed_by = $1, updated_at = now() WHERE id = $2`,
        [admin.id, ideaId]
      )
    } else if (unclaim) {
      await pool.query(
        `UPDATE admin_ideas SET claimed_by = NULL, updated_at = now() WHERE id = $1`,
        [ideaId]
      )
    }

    if (title !== undefined || description !== undefined || tag !== undefined || tag_color !== undefined || status !== undefined) {
      await pool.query(
        `UPDATE admin_ideas SET
           title = COALESCE($1, title),
           description = COALESCE($2, description),
           tag = COALESCE($3, tag),
           tag_color = COALESCE($4, tag_color),
           status = COALESCE($5, status),
           updated_at = now()
         WHERE id = $6`,
        [title?.trim() || null, description?.trim() || null, tag?.trim() || null, tag_color || null, status || null, ideaId]
      )
    }
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}

// DELETE /api/admin2/ideas/[ideaId]
export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ ideaId: string }> }
) {
  const admin = await checkAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })

  const { ideaId } = await context.params
  try {
    await pool.query('DELETE FROM admin_ideas WHERE id = $1', [ideaId])
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
  return NextResponse.json({ success: true })
}