import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'
import { canEditConcept } from '../../../../../../lib/conceptAccess'
import { mitRecht } from '@/app/lib/rechte'

async function checkRead(req: NextRequest) {
  return mitRecht(req, 'admin.zugang')
}

// PATCH /api/admin2/concepts/[conceptId]/nodes/[nodeId]/outputs/[outputId]
export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ conceptId: string, nodeId: string, outputId: string }> }
) {
  const user = await checkRead(req)
  if (!user) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })

  const { conceptId, outputId } = await context.params
  if (!(await canEditConcept(user, conceptId))) {
    return NextResponse.json({ error: 'Kein Bearbeitungszugriff auf dieses Konzept' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const { label } = body as { label?: string }

  if (!label?.trim()) {
    return NextResponse.json({ error: 'Label erforderlich' }, { status: 400 })
  }

  try {
    await pool.query(`UPDATE admin_concept_node_outputs SET label = $1 WHERE id = $2`, [label.trim(), outputId])
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// DELETE /api/admin2/concepts/[conceptId]/nodes/[nodeId]/outputs/[outputId]
export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ conceptId: string, nodeId: string, outputId: string }> }
) {
  const user = await checkRead(req)
  if (!user) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })

  const { conceptId, outputId } = await context.params
  if (!(await canEditConcept(user, conceptId))) {
    return NextResponse.json({ error: 'Kein Bearbeitungszugriff auf dieses Konzept' }, { status: 403 })
  }

  try {
    await pool.query('DELETE FROM admin_concept_node_outputs WHERE id = $1', [outputId])
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}