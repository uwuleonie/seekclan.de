import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'
import { verifyPluginKey } from '@/app/lib/plugin-auth'

// GET /api/internal/lobby-holograms
export async function GET(req: NextRequest) {
  if (!await verifyPluginKey(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const result = await pool.query('SELECT * FROM lobby_holograms ORDER BY id ASC')
  return NextResponse.json({ holograms: result.rows })
}

// POST /api/internal/lobby-holograms — setzt Position via /sethologramhere
export async function POST(req: NextRequest) {
  if (!await verifyPluginKey(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { hologram_id, world, pos_x, pos_y, pos_z } = await req.json().catch(() => ({}))
  if (!hologram_id || world === undefined || pos_x === undefined) {
    return NextResponse.json({ error: 'hologram_id, world, pos_x, pos_y, pos_z erforderlich' }, { status: 400 })
  }
  await pool.query(
    'UPDATE lobby_holograms SET world = $1, pos_x = $2, pos_y = $3, pos_z = $4 WHERE id = $5',
    [world, pos_x, pos_y, pos_z, hologram_id]
  )
  return NextResponse.json({ success: true })
}