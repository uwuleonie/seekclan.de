import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'
import { canEditConcept } from '../../../../../lib/conceptAccess'
import { mitRecht } from '@/app/lib/rechte'

async function checkRead(req: NextRequest) {
  return mitRecht(req, 'admin.zugang')
}

// POST /api/admin2/concepts/[conceptId]/nodes/[nodeId]/outputs
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ conceptId: string, nodeId: string }> }
) {
  const user = await checkRead(req)
  if (!user) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })

  const { conceptId, nodeId } = await context.params
  if (!(await canEditConcept(user, conceptId))) {
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