import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'
import { canEditConcept } from '../../../../../lib/conceptAccess'

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

// POST /api/admin2/concepts/[conceptId]/nodes/[nodeId]/outputs
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ conceptId: string, nodeId: string }> }
) {
  const user = await checkRead(req)
  if (!user) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })

  const { conceptId, nodeId } = await context.params
  if (!(await canEditConcept(user.id, user.clan_role, conceptId))) {
    return NextResponse.json({ error: 'Kein Bearbeitungszugriff auf dieses Konzept' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const { label } = body as { label?: string }

  if (!label?.trim()) {
    return NextResponse.json({ error: 'Label erforderlich' }, { status: 400 })
  }

  try {
    const maxSortResult = await pool.query(
      `SELECT COALESCE(MAX(sort_order), -1) AS max_sort FROM admin_concept_node_outputs WHERE node_id = $1`,
      [nodeId]
    )
    const nextSort = maxSortResult.rows[0].max_sort + 1

    const result = await pool.query(
      `INSERT INTO admin_concept_node_outputs (node_id, label, sort_order)
       VALUES ($1, $2, $3)
       RETURNING id, node_id, label, sort_order`,
      [nodeId, label.trim(), nextSort]
    )
    return NextResponse.json({ output: result.rows[0] })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}