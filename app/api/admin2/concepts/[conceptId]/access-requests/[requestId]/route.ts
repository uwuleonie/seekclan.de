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

// PATCH /api/admin2/concepts/[conceptId]/access-requests/[requestId]
// Body: { accept: boolean }
// Nur der Konzept-Besitzer oder die Owner-Rolle (Leonie) dürfen annehmen/ablehnen.
export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ conceptId: string, requestId: string }> }
) {
  const user = await checkRead(req)
  if (!user) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })

  const { conceptId, requestId } = await context.params
  const body = await req.json().catch(() => ({}))
  const { accept } = body as { accept?: boolean }

  const conceptResult = await pool.query('SELECT owner_id, title FROM admin_concepts WHERE id = $1', [conceptId])
  const concept = conceptResult.rows[0]
  if (!concept) return NextResponse.json({ error: 'Konzept nicht gefunden' }, { status: 404 })

  if (concept.owner_id !== user.id && user.clan_role !== 'owner') {
    return NextResponse.json({ error: 'Nur der Besitzer kann Zugriffsanfragen bearbeiten' }, { status: 403 })
  }

  const requestResult = await pool.query(
    `SELECT id, requested_by FROM admin_concept_access_requests WHERE id = $1 AND concept_id = $2 AND status = 'pending'`,
    [requestId, conceptId]
  )
  const accessRequest = requestResult.rows[0]
  if (!accessRequest) return NextResponse.json({ error: 'Anfrage nicht gefunden oder bereits bearbeitet' }, { status: 404 })

  try {
    await pool.query(
      `UPDATE admin_concept_access_requests SET status = $1, resolved_at = now() WHERE id = $2`,
      [accept ? 'accepted' : 'declined', requestId]
    )

    if (accept) {
      await pool.query(
        `INSERT INTO admin_concept_editors (concept_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [conceptId, accessRequest.requested_by]
      )
    }

    await pool.query(
      `INSERT INTO notifications (user_id, category, title, body, link) VALUES ($1, $2, $3, $4, $5)`,
      [
        accessRequest.requested_by, 'system',
        accept ? `Zugriff auf "${concept.title}" gewährt` : `Zugriffsanfrage für "${concept.title}" abgelehnt`,
        accept ? 'Du kannst dieses Konzept jetzt bearbeiten.' : null,
        `/admin2/update-konzepte/${conceptId}`,
      ]
    )

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}