import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'
import { checkOrigin } from '@/app/lib/csrf'
import { getLeonieUser } from '@/app/lib/leonie-auth'

// GET /api/private/leonie/folders
export async function GET(req: NextRequest) {
  const user = await getLeonieUser(req)
  if (!user) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })

  const result = await pool.query(
    `SELECT id, name, color, sort_order, created_at
     FROM leonie_folders
     ORDER BY sort_order ASC, created_at ASC`
  )
  return NextResponse.json(result.rows)
}

// POST /api/private/leonie/folders
export async function POST(req: NextRequest) {
  if (!checkOrigin(req)) return NextResponse.json({ error: 'CSRF' }, { status: 403 })
  const user = await getLeonieUser(req)
  if (!user) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })

  const body = await req.json()
  const { name, color } = body
  if (!name?.trim()) return NextResponse.json({ error: 'Name fehlt' }, { status: 400 })

  const result = await pool.query(
    `INSERT INTO leonie_folders (name, color)
     VALUES ($1, $2)
     RETURNING id, name, color, sort_order, created_at`,
    [name.trim(), color || '#c9b99a']
  )
  return NextResponse.json(result.rows[0])
}