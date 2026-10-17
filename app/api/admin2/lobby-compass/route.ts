import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'
import { mitRecht } from '@/app/lib/rechte'

async function checkRead(req: NextRequest) {
  return mitRecht(req, 'admin.zugang')
}

async function checkWrite(req: NextRequest) {
  return mitRecht(req, 'admin.verwalten')
}

// GET /api/admin2/lobby-compass
export async function GET(req: NextRequest) {
  const user = await checkRead(req)
  if (!user) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })

  try {
    const result = await pool.query(
      'SELECT id, label, server_id, material, lore, sort_order, enabled FROM lobby_compass_items ORDER BY sort_order ASC'
    )
    return NextResponse.json({ items: result.rows })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// POST /api/admin2/lobby-compass
// Body: { label, server_id, material?, lore?, sort_order?, enabled? }
export async function POST(req: NextRequest) {
  const user = await checkWrite(req)
  if (!user) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const { label, server_id, material, lore, sort_order, enabled } = body as {
    label?: string
    server_id?: string
    material?: string
    lore?: string
    sort_order?: number
    enabled?: boolean
  }

  if (!label?.trim() || !server_id?.trim()) {
    return NextResponse.json({ error: 'Label und Server-ID erforderlich' }, { status: 400 })
  }

  try {
    const maxResult = await pool.query('SELECT MAX(sort_order) as max FROM lobby_compass_items')
    const nextOrder = sort_order ?? ((maxResult.rows[0]?.max ?? -1) + 1)

    const result = await pool.query(
      `INSERT INTO lobby_compass_items (label, server_id, material, lore, sort_order, enabled)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [label.trim(), server_id.trim(), material || 'COMPASS', lore?.trim() || null, nextOrder, enabled ?? true]
    )
    return NextResponse.json({ id: result.rows[0].id })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// PATCH /api/admin2/lobby-compass
// Body: { id, ...fields } – einzelnes Item updaten
export async function PATCH(req: NextRequest) {
  const user = await checkWrite(req)
  if (!user) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const { id, label, server_id, material, lore, sort_order, enabled } = body as {
    id?: number
    label?: string
    server_id?: string
    material?: string
    lore?: string
    sort_order?: number
    enabled?: boolean
  }

  if (!id) return NextResponse.json({ error: 'ID erforderlich' }, { status: 400 })

  const updates: Record<string, any> = {}
  if (label !== undefined) updates.label = label.trim()
  if (server_id !== undefined) updates.server_id = server_id.trim()
  if (material !== undefined) updates.material = material
  if (lore !== undefined) updates.lore = lore.trim() || null
  if (sort_order !== undefined) updates.sort_order = sort_order
  if (enabled !== undefined) updates.enabled = enabled

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ success: true })
  }

  const setClauses = Object.keys(updates).map((k, i) => `${k} = $${i + 1}`).join(', ')
  const values = [...Object.values(updates), id]
  await pool.query(`UPDATE lobby_compass_items SET ${setClauses} WHERE id = $${values.length}`, values)
  return NextResponse.json({ success: true })
}

// DELETE /api/admin2/lobby-compass
// Body: { id }
export async function DELETE(req: NextRequest) {
  const user = await checkWrite(req)
  if (!user) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const { id } = body as { id?: number }
  if (!id) return NextResponse.json({ error: 'ID erforderlich' }, { status: 400 })

  await pool.query('DELETE FROM lobby_compass_items WHERE id = $1', [id])
  return NextResponse.json({ success: true })
}