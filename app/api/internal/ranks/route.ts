import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'
import { verifyPluginKey } from '@/app/lib/plugin-auth'

// GET /api/internal/ranks
// Plugin lädt alle Ränge beim Start (gecacht im Plugin)
export async function GET(req: NextRequest) {
  if (!await verifyPluginKey(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const result = await pool.query('SELECT * FROM mc_ranks ORDER BY priority DESC')
  return NextResponse.json({ ranks: result.rows })
}