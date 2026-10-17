import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'
import { canEditConcept } from '../../../lib/conceptAccess'
import { mitRecht } from '@/app/lib/rechte'

async function checkRead(req: NextRequest) {
  return mitRecht(req, 'admin.zugang')
}

// POST /api/admin2/concepts/[conceptId]/connections
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ conceptId: string }> }
) {
  const user = await checkRead(req)
  if (!user) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })

  const { conceptId } = await context.params
  if (!(await canEditConcept(user, conceptId))) {
    return NextResponse.json({ error: 'Kein Bearbeitungszugriff auf dieses Konzept' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const { source_output_id, target_node_id } = body as {
    source_output_id?: string, target_node_id?: string
  }

  if (!source_output_id || !target_node_id) {
    return NextResponse.json({ error: 'source_output_id und target_node_id erforderlich' }, { status: 400 })
  }

  try {
    const result = await pool.query(
      `INSERT INTO admin_concept_edges (concept_id, source_output_id, target_node_id)
       VALUES ($1, $2, $3)
       RETURNING id, source_output_id, target_node_id`,
      [conceptId, source_output_id, target_node_id]
    )
    return NextResponse.json({ edge: result.rows[0] })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}