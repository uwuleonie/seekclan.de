import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'
import { verifyPluginKey } from '@/app/lib/plugin-auth'

export async function GET(req: NextRequest) {
  if (!await verifyPluginKey(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const result = await pool.query('SELECT title, lines FROM lobby_scoreboard_config ORDER BY id DESC LIMIT 1')
  return NextResponse.json({ config: result.rows[0] || null })
}