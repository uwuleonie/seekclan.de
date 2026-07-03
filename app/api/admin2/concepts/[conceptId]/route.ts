import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'
import { canEditConcept } from '../../lib/conceptAccess'

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

// GET /api/admin2/concepts/[conceptId]
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ conceptId: string }> }
) {
  const user = await checkRead(req)
  if (!user) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })

  const { conceptId } = await context.params

  try {
    const conceptResult = await pool.query(
      `SELECT c.id, c.title, c.created_at, c.owner_id, u.username AS owner_username
       FROM admin_concepts c
       LEFT JOIN users u ON u.id = c.owner_id
       WHERE c.id = $1`,
      [conceptId]
    )
    const concept = conceptResult.rows[0]
    if (!concept) return NextResponse.json({ error: 'Konzept nicht gefunden' }, { status: 404 })

    concept.canEdit = await canEditConcept(user.id, user.clan_role, conceptId)

    const ownRequestResult = await pool.query(
      `SELECT id FROM admin_concept_access_requests WHERE concept_id = $1 AND requested_by = $2 AND status = 'pending'`,
      [conceptId, user.id]
    )
    concept.hasPendingRequest = ownRequestResult.rows.length > 0

    const nodesResult = await pool.query(
      `SELECT id, title, description, status, position_x, position_y
       FROM admin_concept_nodes WHERE concept_id = $1 ORDER BY created_at ASC`,
      [conceptId]
    )
    const outputsResult = await pool.query(
      `SELECT o.id, o.node_id, o.label, o.sort_order
       FROM admin_concept_node_outputs o
       JOIN admin_concept_nodes n ON n.id = o.node_id
       WHERE n.concept_id = $1
       ORDER BY o.sort_order ASC`,
      [conceptId]
    )
    const edgesResult = await pool.query(
      `SELECT id, source_output_id, target_node_id
       FROM admin_concept_edges WHERE concept_id = $1`,
      [conceptId]
    )

    concept.nodes = nodesResult.rows.map(node => ({
      ...node,
      outputs: outputsResult.rows.filter(o => o.node_id === node.id)
    }))
    concept.edges = edgesResult.rows

    return NextResponse.json({ concept })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// PATCH /api/admin2/concepts/[conceptId]
export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ conceptId: string }> }
) {
  const user = await checkRead(req)
  if (!user) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })

  const { conceptId } = await context.params
  if (!(await canEditConcept(user.id, user.clan_role, conceptId))) {
    return NextResponse.json({ error: 'Kein Bearbeitungszugriff auf dieses Konzept' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const { title } = body as { title?: string }

  try {
    await pool.query(
      `UPDATE admin_concepts SET title = COALESCE($1, title), updated_at = now() WHERE id = $2`,
      [title?.trim() || null, conceptId]
    )
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// DELETE /api/admin2/concepts/[conceptId]
export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ conceptId: string }> }
) {
  const user = await checkRead(req)
  if (!user) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })

  const { conceptId } = await context.params
  if (!(await canEditConcept(user.id, user.clan_role, conceptId))) {
    return NextResponse.json({ error: 'Kein Bearbeitungszugriff auf dieses Konzept' }, { status: 403 })
  }

  try {
    await pool.query('DELETE FROM admin_concepts WHERE id = $1', [conceptId])
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}