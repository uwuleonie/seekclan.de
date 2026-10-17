import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'
import { canEditConcept } from '../../../../lib/conceptAccess'
import { mitRecht } from '@/app/lib/rechte'

async function checkRead(req: NextRequest) {
  return mitRecht(req, 'admin.zugang')
}

// DELETE /api/admin2/concepts/[conceptId]/connections/[connectionId]
export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ conceptId: string, connectionId: string }> }
) {
  const user = await checkRead(req)
  if (!user) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })

  const { conceptId, connectionId } = await context.params
  if (!(await canEditConcept(user, conceptId))) {
    return NextResponse.json({ error: 'Kein Bearbeitungszugriff auf dieses Konzept' }, { status: 403 })
  }

  try {
    await pool.query('DELETE FROM admin_concept_edges WHERE id = $1', [connectionId])
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}