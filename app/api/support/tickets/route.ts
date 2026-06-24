import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'

const VALID_CATEGORIES = [
  'bug', 'clan_application', 'complaint', 'suggestion', 'other',
  'missing_badge', 'whitelist', 'rollback_request', 'player_report', 'account_link',
]

async function getUser(req: NextRequest) {
  const token = req.cookies.get('session_token')?.value
  if (!token) return null
  const sessionResult = await pool.query('SELECT user_id FROM sessions WHERE token = $1', [token])
  const session = sessionResult.rows[0]
  if (!session) return null
  const userResult = await pool.query(
    'SELECT id, username, clan_role FROM users WHERE id = $1',
    [session.user_id]
  )
  return userResult.rows[0] || null
}

const isStaff = (user: { clan_role: string | null }) =>
  user.clan_role?.toLowerCase() === 'admin' || user.clan_role?.toLowerCase() === 'mod'

export async function GET(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })

  if (isStaff(user)) {
    let tickets
    try {
      const result = await pool.query(
        `SELECT
           st.*,
           json_build_object('username', creator.username) AS creator,
           CASE WHEN tu.id IS NOT NULL THEN json_build_object('username', tu.username) ELSE NULL END AS target_user,
           CASE WHEN tb.id IS NOT NULL THEN json_build_object('name', tb.name) ELSE NULL END AS target_badge
         FROM support_tickets st
         JOIN users creator ON creator.id = st.user_id
         LEFT JOIN users tu ON tu.id = st.target_user_id
         LEFT JOIN clan_badges tb ON tb.id = st.target_badge_id
         ORDER BY st.created_at DESC`
      )
      tickets = result.rows
    } catch (err: any) {
      return NextResponse.json({ error: err.message }, { status: 500 })
    }
    return NextResponse.json({ tickets: tickets || [], isStaff: true })
  }

  const participationsResult = await pool.query(
    'SELECT ticket_id FROM support_ticket_participants WHERE user_id = $1',
    [user.id]
  )
  const participantTicketIds = participationsResult.rows.map(p => p.ticket_id)

  let tickets
  try {
    const result = await pool.query(
      `SELECT
         st.*,
         CASE WHEN tu.id IS NOT NULL THEN json_build_object('username', tu.username) ELSE NULL END AS target_user,
         CASE WHEN tb.id IS NOT NULL THEN json_build_object('name', tb.name) ELSE NULL END AS target_badge
       FROM support_tickets st
       LEFT JOIN users tu ON tu.id = st.target_user_id
       LEFT JOIN clan_badges tb ON tb.id = st.target_badge_id
       WHERE st.user_id = $1 OR st.id = ANY($2)
       ORDER BY st.created_at DESC`,
      [user.id, participantTicketIds]
    )
    tickets = result.rows
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }

  return NextResponse.json({ tickets: tickets || [], isStaff: false })
}

export async function POST(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })

  const body = await req.json()
  const { category, subject, message, priority, targetUsername, targetBadgeId } = body

  if (!VALID_CATEGORIES.includes(category)) {
    return NextResponse.json({ error: 'Ungültige Kategorie' }, { status: 400 })
  }
  if (!subject?.trim() || !message?.trim()) {
    return NextResponse.json({ error: 'Betreff und Nachricht erforderlich' }, { status: 400 })
  }

  let targetUserId: string | null = null
  if ((category === 'complaint' || category === 'player_report') && targetUsername) {
    const targetResult = await pool.query('SELECT id FROM users WHERE username = $1', [targetUsername])
    const target = targetResult.rows[0]
    if (!target) return NextResponse.json({ error: 'Zielspieler nicht gefunden' }, { status: 404 })
    targetUserId = target.id
  }

  let ticket
  try {
    const result = await pool.query(
      `INSERT INTO support_tickets (user_id, category, subject, priority, target_user_id, target_badge_id)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [
        user.id, category, subject.trim(),
        priority && ['low', 'normal', 'high'].includes(priority) ? priority : 'normal',
        targetUserId,
        category === 'missing_badge' ? (targetBadgeId || null) : null,
      ]
    )
    ticket = result.rows[0]
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }

  await pool.query(
    'INSERT INTO support_messages (ticket_id, sender_id, is_staff, body) VALUES ($1, $2, $3, $4)',
    [ticket.id, user.id, false, message.trim()]
  )

  return NextResponse.json({ success: true, ticket })
}