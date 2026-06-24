import { NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'

export async function GET() {
  const result = await pool.query('SELECT * FROM wm_games ORDER BY kickoff ASC')

  return NextResponse.json({ games: result.rows || [] })
}