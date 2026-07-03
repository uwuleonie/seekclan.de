import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'

async function checkRead(req: NextRequest) {
  const token = req.cookies.get('session_token')?.value
  if (!token) return null
  const sessionResult = await pool.query('SELECT user_id FROM sessions WHERE token = $1', [token])
  const session = sessionResult.rows[0]
  if (!session) return null
  const userResult = await pool.query('SELECT id, username, clan_role FROM users WHERE id = $1', [session.user_id])
  const user = userResult.rows[0]
  if (!user || !['administrator', 'owner', 'teammitglied'].includes(user.clan_role)) return null
  return user
}

// POST /api/admin2/concepts/[conceptId]/claim
// Übernimmt die Besitzerschaft eines noch unbesitzten Konzepts (owner_id IS NULL).
// Für Konzepte mit bereits vorhandenem Besitzer gibt es stattdessen den
// Zugriffsanfrage-Flow unter /access-requests - Claimen ist nur für
// "herrenlose" Konzepte gedacht, kein Besitzer-Klau.
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ conceptId: string }> }
) {
  const user = await checkRead(req)
  if (!user) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })

  const { conceptId } = await context.params

  const conceptResult = await pool.query('SELECT owner_id FROM admin_concepts WHERE id = $1', [conceptId])
  const concept = conceptResult.rows[0]
  if (!concept) return NextResponse.json({ error: 'Konzept nicht gefunden' }, { status: 404 })

  if (concept.owner_id) {
    return NextResponse.json({ error: 'Dieses Konzept hat bereits einen Besitzer' }, { status: 400 })
  }

  try {
    await pool.query('UPDATE admin_concepts SET owner_id = $1 WHERE id = $2', [user.id, conceptId])
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}