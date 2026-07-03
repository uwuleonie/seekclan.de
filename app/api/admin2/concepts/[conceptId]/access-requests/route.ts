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

// POST /api/admin2/concepts/[conceptId]/access-requests
//
// Legt eine Zugriffsanfrage an und benachrichtigt den Konzept-Besitzer über
// das normale Benachrichtigungssystem (notifications-Tabelle, category
// 'system' - 'friends'/'leadership' passen inhaltlich nicht, und das ist der
// einzige weitere laut CHECK-Constraint erlaubte Wert). Der Link führt direkt
// zurück zum Konzept, wo die Annahme/Ablehnung passiert.
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ conceptId: string }> }
) {
  const user = await checkRead(req)
  if (!user) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })

  const { conceptId } = await context.params

  const conceptResult = await pool.query('SELECT owner_id, title FROM admin_concepts WHERE id = $1', [conceptId])
  const concept = conceptResult.rows[0]
  if (!concept) return NextResponse.json({ error: 'Konzept nicht gefunden' }, { status: 404 })

  if (concept.owner_id === user.id) {
    return NextResponse.json({ error: 'Du bist bereits Besitzer dieses Konzepts' }, { status: 400 })
  }

  const existingResult = await pool.query(
    `SELECT id FROM admin_concept_access_requests WHERE concept_id = $1 AND requested_by = $2 AND status = 'pending'`,
    [conceptId, user.id]
  )
  if (existingResult.rows[0]) {
    return NextResponse.json({ success: true, alreadyPending: true })
  }

  try {
    const requestResult = await pool.query(
      `INSERT INTO admin_concept_access_requests (concept_id, requested_by) VALUES ($1, $2) RETURNING id`,
      [conceptId, user.id]
    )

    if (concept.owner_id) {
      await pool.query(
        `INSERT INTO notifications (user_id, category, title, body, link) VALUES ($1, $2, $3, $4, $5)`,
        [
          concept.owner_id, 'system',
          `${user.username} möchte "${concept.title}" bearbeiten`,
          'Anfrage für Bearbeitungszugriff auf dein Update-Konzept.',
          `/admin2/update-konzepte/${conceptId}?accessRequest=${requestResult.rows[0].id}`,
        ]
      )
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}