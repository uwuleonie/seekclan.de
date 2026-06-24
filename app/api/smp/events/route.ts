import { NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'

export async function GET() {
  const result = await pool.query(
    'SELECT * FROM smp_events WHERE event_date >= $1 ORDER BY event_date ASC',
    [new Date().toISOString()]
  )

  return NextResponse.json({ events: result.rows || [] })
}