import { NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'

export async function GET() {
  const result = await pool.query(
    'SELECT id, owner_uuid, owner_name, world, chunk_x, chunk_z FROM claims'
  )

  return NextResponse.json({ claims: result.rows || [] })
}