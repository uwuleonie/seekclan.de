import { NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'

export async function GET() {
  const result = await pool.query('SELECT * FROM smp_rules ORDER BY sort_order ASC')

  return NextResponse.json({ rules: result.rows || [] })
}