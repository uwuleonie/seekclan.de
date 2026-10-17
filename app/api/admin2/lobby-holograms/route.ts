import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'
import { mitRecht } from '@/app/lib/rechte'

async function checkRead(req: NextRequest) {
  return mitRecht(req, 'admin.zugang')
}

async function checkWrite(req: NextRequest) {
  return mitRecht(req, 'admin.verwalten')
}

// GET /api/admin2/lobby-holograms
export async function GET(req: NextRequest) {
  const user = await checkRead(req)
  if (!user) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })
  const result = await pool.query('SELECT * FROM lobby_holograms ORDER BY id ASC')
  return NextResponse.json({ holograms: result.rows })
}

// POST /api/admin2/lobby-holograms
export async function POST(req: NextRequest) {
  const user = await checkWrite(req)
  if (!user) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })
  const { label, lines } = await req.json().catch(() => ({}))
  if (!label?.trim()) return NextResponse.json({ error: 'Label erforderlich' }, { status: 400 })
  const result = await pool.query(
    'INSERT INTO lobby_holograms (label, lines) VALUES ($1, $2) RETURNING id',
    [label.trim(), lines || []]
  )
  return NextResponse.json({ id: result.rows[0].id })
}