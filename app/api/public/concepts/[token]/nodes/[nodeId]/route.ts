import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'

async function checkLoggedIn(req: NextRequest) {
  const token = req.cookies.get('session_token')?.value
  if (!token) return null
  const sessionResult = await pool.query('SELECT user_id FROM sessions WHERE token = $1', [token])
  const session = sessionResult.rows[0]
  if (!session) return null
  const userResult = await pool.query('SELECT id FROM users WHERE id = $1', [session.user_id])
  return userResult.rows[0] || null
}

// PATCH /api/public/concepts/[token]/nodes/[nodeId]
// Body: { status?, description? } - nur wenn permission = 'edit'. Bewusst
// eingeschränkt auf Status/Beschreibung - Struktur (Verschieben, Verbindungen,
// neue Bausteine) bleibt Team-intern im echten Editor.
export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ token: string, nodeId: string }> }
) {
  const user = await checkLoggedIn(req)
  if (!user) return NextResponse.json({ error: 'Bitte einloggen' }, { status: 401 })

  const { token, nodeId } = await context.params
  const shareResult = await pool.query(
    `SELECT s.permission, c.id AS concept_id FROM admin_concept_shares s
     JOIN admin_concepts c ON c.id = s.concept_id WHERE s.token = $1`,
    [token]
  )
  const share = shareResult.rows[0]
  if (!share) return NextResponse.json({ error: 'Link ungültig oder abgelaufen' }, { status: 404 })
  if (share.permission !== 'edit') return NextResponse.json({ error: 'Nur Ansehen erlaubt' }, { status: 403 })

  const { status, description } = await req.json().catch(() => ({})) as { status?: string, description?: string }
  if (status !== undefined && !['offen', 'in_arbeit', 'fertig'].includes(status)) {
    return NextResponse.json({ error: 'Ungültiger Status' }, { status: 400 })
  }

  await pool.query(
    `UPDATE admin_concept_nodes SET
       status = COALESCE($1, status),
       description = COALESCE($2, description),
       updated_at = now()
     WHERE id = $3 AND concept_id = $4`,
    [status || null, description !== undefined ? description : null, nodeId, share.concept_id]
  )
  return NextResponse.json({ success: true })
}