import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'
import { verifyPluginKey } from '@/app/lib/plugin-auth'

// POST /api/internal/admin-items/upload-template
// Plugin lädt Item-Template hoch (via /uploaditem <name> ingame)
export async function POST(req: NextRequest) {
  if (!await verifyPluginKey(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { name, item_data, uploaded_by } = await req.json()
  if (!name || !item_data) {
    return NextResponse.json({ error: 'name und item_data erforderlich' }, { status: 400 })
  }

  await pool.query(
    `INSERT INTO admin_item_templates (name, item_data, uploaded_by)
     VALUES ($1, $2, $3)`,
    [name, item_data, uploaded_by ?? 'unknown']
  )

  return NextResponse.json({ ok: true })
}