import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'
import { mitRecht } from '@/app/lib/rechte'

export async function GET(req: NextRequest) {
  const token = req.cookies.get('session_token')?.value
  if (!token) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })

  const nutzer = await mitRecht(req, 'privat.zugang')
  if (!nutzer) {
    return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })
  }

  const result = await pool.query(
    `SELECT id, tool, url, created_at FROM leonie_images ORDER BY created_at DESC LIMIT 100`
  )

  return NextResponse.json({ images: result.rows })
}