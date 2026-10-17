import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'
import { mitRecht } from '@/app/lib/rechte'

async function checkRead(req: NextRequest) {
  return mitRecht(req, 'admin.zugang')
}

async function checkWrite(req: NextRequest) {
  return mitRecht(req, 'admin.verwalten')
}

// GET /api/admin2/changelog/tags
export async function GET(req: NextRequest) {
  const user = await checkRead(req)
  if (!user) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })

  try {
    const result = await pool.query('SELECT * FROM changelog_tags ORDER BY created_at ASC')
    return NextResponse.json({ tags: result.rows })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// POST /api/admin2/changelog/tags
// Body: { name, color?, requires_version? }
export async function POST(req: NextRequest) {
  const user = await checkWrite(req)
  if (!user) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })

  const { name, color, requires_version } = await req.json().catch(() => ({}))
  if (!name?.trim()) return NextResponse.json({ error: 'Name erforderlich' }, { status: 400 })

  try {
    const result = await pool.query(
      'INSERT INTO changelog_tags (name, color, requires_version) VALUES ($1, $2, $3) RETURNING *',
      [name.trim(), color || '#7C3AED', !!requires_version]
    )
    return NextResponse.json({ success: true, tag: result.rows[0] })
  } catch (err: any) {
    return NextResponse.json({ error: 'Fehler beim Erstellen (Name evtl. schon vorhanden)' }, { status: 500 })
  }
}

// DELETE /api/admin2/changelog/tags
// Body: { id }
export async function DELETE(req: NextRequest) {
  const user = await checkWrite(req)
  if (!user) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })

  const { id } = await req.json().catch(() => ({}))
  if (!id) return NextResponse.json({ error: 'ID erforderlich' }, { status: 400 })

  try {
    await pool.query('DELETE FROM changelog_tags WHERE id = $1', [id])
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}