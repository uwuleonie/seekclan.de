import { NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'

export async function GET() {
  const result = await pool.query(
    'SELECT id, sort_order, category, title, content, updated_at FROM rules ORDER BY sort_order ASC, id ASC'
  )
  return NextResponse.json({ rules: result.rows })
}