import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'
import { canEditConcept } from '../../../lib/conceptAccess'
import { mitRecht } from '@/app/lib/rechte'

async function checkRead(req: NextRequest) {
  return mitRecht(req, 'admin.zugang')
}

// POST /api/admin2/concepts/[conceptId]/tags
// Body: { tagId }
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

  const { tagId } = await req.json().catch(() => ({}))
  if (!tagId) return NextResponse.json({ error: 'tagId erforderlich' }, { status: 400 })

  try {
    await pool.query(
      `INSERT INTO admin_concept_tag_links (concept_id, tag_id) VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [conceptId, tagId]
    )
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}