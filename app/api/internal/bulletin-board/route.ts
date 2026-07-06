import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'
import { verifyPluginKey } from '@/app/lib/plugin-auth'

// GET /api/internal/bulletin-board — Plugin lädt Map-Daten
export async function GET(req: NextRequest) {
  if (!await verifyPluginKey(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const result = await pool.query('SELECT id, title, map_data FROM lobby_bulletin_board ORDER BY id DESC LIMIT 1')
  if (!result.rows[0]) return NextResponse.json({ board: null })

  return NextResponse.json({ board: result.rows[0] })
}