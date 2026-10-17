import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'
import { canEditConcept } from '../../../../lib/conceptAccess'
import { mitRecht } from '@/app/lib/rechte'

async function checkRead(req: NextRequest) {
  return mitRecht(req, 'admin.zugang')
}

// DELETE /api/admin2/concepts/[conceptId]/tags/[tagId]
export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ conceptId: string, tagId: string }> }
) {
  const user = await checkRead(req)
  if (!user) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })

  const { conceptId, tagId } = await context.params
  if (!(await canEditConcept(user, conceptId))) {
    return NextResponse.json({ error: 'Kein Bearbeitungszugriff auf dieses Konzept' }, { status: 403 })
  }

  try {
    await pool.query(
      'DELETE FROM admin_concept_tag_links WHERE concept_id = $1 AND tag_id = $2',
      [conceptId, tagId]
    )
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}