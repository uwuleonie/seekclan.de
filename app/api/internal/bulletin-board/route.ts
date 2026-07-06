import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'
import { verifyPluginKey } from '@/app/lib/plugin-auth'

// GET /api/internal/bulletin-board — Plugin lädt Titel + Bullets
export async function GET(req: NextRequest) {
  if (!await verifyPluginKey(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const result = await pool.query('SELECT id, title, bullets FROM lobby_bulletin_board ORDER BY id DESC LIMIT 1')
  if (!result.rows[0]) return NextResponse.json({ board: null })
  return NextResponse.json({ board: result.rows[0] })
}

// POST /api/internal/bulletin-board — Plugin setzt Positionen
export async function POST(req: NextRequest) {
  if (!await verifyPluginKey(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { pos1x, pos1y, pos1z, pos2x, pos2y, pos2z, world } = await req.json().catch(() => ({}))
  if (pos1x === undefined) return NextResponse.json({ error: 'Positionen erforderlich' }, { status: 400 })

  await pool.query('UPDATE lobby_bulletin_board SET pos1x=$1, pos1y=$2, pos1z=$3, pos2x=$4, pos2y=$5, pos2z=$6, world=$7',
    [pos1x, pos1y, pos1z, pos2x, pos2y, pos2z, world])
  return NextResponse.json({ success: true })
}