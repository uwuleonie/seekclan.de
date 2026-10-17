import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'
import { canEditConcept } from '../../../lib/conceptAccess'
import { mitRecht } from '@/app/lib/rechte'

async function checkRead(req: NextRequest) {
  return mitRecht(req, 'admin.zugang')
}

// POST /api/admin2/concepts/[conceptId]/nodes
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
  const { title, description, status, position_x, position_y, withOutput } = body as {
    title?: string, description?: string, status?: string, position_x?: number, position_y?: number, withOutput?: boolean
  }

  if (!title?.trim()) {
    return NextResponse.json({ error: 'Titel erforderlich' }, { status: 400 })
  }

  const validStatus = ['offen', 'in_arbeit', 'fertig'].includes(status || '') ? status : 'offen'

  try {
    const nodeResult = await pool.query(
      `INSERT INTO admin_concept_nodes (concept_id, title, description, status, position_x, position_y)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, title, description, status, position_x, position_y`,
      [conceptId, title.trim(), description?.trim() || '', validStatus, position_x ?? 0, position_y ?? 0]
    )
    const node = nodeResult.rows[0]

    if (withOutput !== false) {
      const outputResult = await pool.query(
        `INSERT INTO admin_concept_node_outputs (node_id, label, sort_order)
         VALUES ($1, '', 0)
         RETURNING id, node_id, label, sort_order`,
        [node.id]
      )
      node.outputs = [outputResult.rows[0]]
    } else {
      node.outputs = []
    }

    return NextResponse.json({ node })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}