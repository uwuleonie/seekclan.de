import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'
import { mitRecht } from '@/app/lib/rechte'

async function checkRead(req: NextRequest) {
  return mitRecht(req, 'admin.zugang')
}

// DELETE /api/admin2/concept-tags/[tagId]
// Löscht den Tag global (inkl. aller Zuweisungen per ON DELETE CASCADE).
export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ tagId: string }> }
) {
  const user = await checkRead(req)
  if (!user) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })

  const { tagId } = await context.params

  try {
    await pool.query('DELETE FROM admin_concept_tags WHERE id = $1', [tagId])
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}