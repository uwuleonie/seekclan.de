import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'
import { mitRecht } from '@/app/lib/rechte'

async function checkRead(req: NextRequest) {
  return mitRecht(req, 'admin.zugang')
}

// GET /api/admin2/concept-tags
export async function GET(req: NextRequest) {
  const user = await checkRead(req)
  if (!user) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })

  try {
    const result = await pool.query('SELECT * FROM admin_concept_tags ORDER BY name ASC')
    return NextResponse.json({ tags: result.rows })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// POST /api/admin2/concept-tags
// Body: { name, color? }
export async function POST(req: NextRequest) {
  const user = await checkRead(req)
  if (!user) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })

  const { name, color } = await req.json().catch(() => ({}))
  if (!name?.trim()) return NextResponse.json({ error: 'Name erforderlich' }, { status: 400 })

  try {
    const result = await pool.query(
      `INSERT INTO admin_concept_tags (name, color, created_by) VALUES ($1, $2, $3) RETURNING *`,
      [name.trim(), color || '#7C3AED', user.id]
    )
    return NextResponse.json({ success: true, tag: result.rows[0] })
  } catch (err: any) {
    return NextResponse.json({ error: 'Fehler beim Erstellen (Name evtl. schon vorhanden)' }, { status: 500 })
  }
}