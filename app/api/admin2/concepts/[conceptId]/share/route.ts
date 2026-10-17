import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'
import { canEditConcept } from '../../../lib/conceptAccess'
import { randomUUID } from 'crypto'
import { mitRecht } from '@/app/lib/rechte'

async function checkRead(req: NextRequest) {
  return mitRecht(req, 'admin.zugang')
}

// GET /api/admin2/concepts/[conceptId]/share
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ conceptId: string }> }
) {
  const user = await checkRead(req)
  if (!user) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })
  const { conceptId } = await context.params

  const result = await pool.query('SELECT token, permission FROM admin_concept_shares WHERE concept_id = $1', [conceptId])
  return NextResponse.json({ share: result.rows[0] || null })
}

// POST /api/admin2/concepts/[conceptId]/share
// Body: { permission: 'view' | 'edit' }
// Legt einen Freigabe-Link an, oder aktualisiert dessen Berechtigung, falls
// schon einer existiert (ein Link pro Konzept).
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ conceptId: string }> }
) {
  const user = await checkRead(req)
  if (!user) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })
  const { conceptId } = await context.params
  if (!(await canEditConcept(user, conceptId))) {
    return NextResponse.json({ error: 'Kein Bearbeitungszugriff auf dieses Konzept' }, { status: 403 })
  }

  const { permission } = await req.json().catch(() => ({})) as { permission?: string }
  const perm = permission === 'edit' ? 'edit' : 'view'

  const existing = await pool.query('SELECT token FROM admin_concept_shares WHERE concept_id = $1', [conceptId])
  if (existing.rows.length > 0) {
    await pool.query('UPDATE admin_concept_shares SET permission = $1 WHERE concept_id = $2', [perm, conceptId])
    return NextResponse.json({ token: existing.rows[0].token, permission: perm })
  }

  const token = randomUUID().replace(/-/g, '')
  await pool.query(
    `INSERT INTO admin_concept_shares (concept_id, token, permission, created_by) VALUES ($1, $2, $3, $4)`,
    [conceptId, token, perm, user.id]
  )
  return NextResponse.json({ token, permission: perm })
}

// DELETE /api/admin2/concepts/[conceptId]/share
export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ conceptId: string }> }
) {
  const user = await checkRead(req)
  if (!user) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })
  const { conceptId } = await context.params
  if (!(await canEditConcept(user, conceptId))) {
    return NextResponse.json({ error: 'Kein Bearbeitungszugriff auf dieses Konzept' }, { status: 403 })
  }

  await pool.query('DELETE FROM admin_concept_shares WHERE concept_id = $1', [conceptId])
  return NextResponse.json({ success: true })
}