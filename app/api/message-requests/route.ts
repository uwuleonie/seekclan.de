import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'

async function getUser(req: NextRequest) {
  const token = req.cookies.get('session_token')?.value
  if (!token) return null
  const sessionResult = await pool.query('SELECT user_id FROM sessions WHERE token = $1', [token])
  const session = sessionResult.rows[0]
  if (!session) return null
  const userResult = await pool.query('SELECT id, username FROM users WHERE id = $1', [session.user_id])
  return userResult.rows[0] || null
}

async function isBlocked(userIdA: string, userIdB: string) {
  const result = await pool.query(
    `SELECT blocker_id FROM blocked_users
     WHERE (blocker_id = $1 AND blocked_id = $2) OR (blocker_id = $2 AND blocked_id = $1)
     LIMIT 1`,
    [userIdA, userIdB]
  )
  return result.rows.length > 0
}

// GET: Lädt eingehende (für mich) und ausgehende (von mir) Anfragen.
export async function GET(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })

  const incomingResult = await pool.query(
    `SELECT
       mr.id, mr.sender_id, mr.first_message, mr.status, mr.created_at,
       json_build_object('username', u.username, 'display_name', u.display_name, 'profile_picture_url', u.profile_picture_url) AS users
     FROM message_requests mr
     JOIN users u ON u.id = mr.sender_id
     WHERE mr.receiver_id = $1 AND mr.status = 'pending'
     ORDER BY mr.created_at DESC`,
    [user.id]
  )

  const outgoingResult = await pool.query(
    `SELECT
       mr.id, mr.receiver_id, mr.first_message, mr.status, mr.created_at,
       json_build_object('username', u.username, 'display_name', u.display_name, 'profile_picture_url', u.profile_picture_url) AS users
     FROM message_requests mr
     JOIN users u ON u.id = mr.receiver_id
     WHERE mr.sender_id = $1
     ORDER BY mr.created_at DESC`,
    [user.id]
  )

  return NextResponse.json({ incoming: incomingResult.rows || [], outgoing: outgoingResult.rows || [] })
}

// POST: Sendet eine einmalige Nachrichtenanfrage an einen Nicht-Freund.
// Body: { receiver_username, message }
export async function POST(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })

  const { receiver_username, message } = await req.json()
  if (!receiver_username || !message?.trim()) {
    return NextResponse.json({ error: 'Empfänger und Nachricht erforderlich' }, { status: 400 })
  }

  const receiverResult = await pool.query(
    'SELECT id, username FROM users WHERE username = $1',
    [receiver_username]
  )
  const receiver = receiverResult.rows[0]

  if (!receiver) return NextResponse.json({ error: 'Nutzer nicht gefunden' }, { status: 404 })
  if (receiver.id === user.id) return NextResponse.json({ error: 'Nicht möglich mit dir selbst' }, { status: 400 })

  if (await isBlocked(user.id, receiver.id)) {
    return NextResponse.json({ error: 'Nicht möglich' }, { status: 403 })
  }

  try {
    await pool.query(
      'INSERT INTO message_requests (sender_id, receiver_id, first_message) VALUES ($1, $2, $3)',
      [user.id, receiver.id, message.trim()]
    )
  } catch (err) {
    // unique(sender_id, receiver_id) verhindert Mehrfach-Anfragen an dieselbe Person
    return NextResponse.json({ error: 'Du hast dieser Person bereits eine Anfrage gesendet' }, { status: 400 })
  }

  await pool.query(
    `INSERT INTO notifications (user_id, category, title, body, link) VALUES ($1, $2, $3, $4, $5)`,
    [receiver.id, 'friends', `${user.username} möchte dir eine Nachricht senden`, message.trim().slice(0, 100), '/nachrichten/anfragen']
  )

  return NextResponse.json({ success: true })
}

// PATCH: Anfrage annehmen oder ablehnen. Bei "accept" wird eine echte Konversation
// erstellt und die Erstnachricht dort eingefügt.
// Body: { id, action: 'accept' | 'decline' }
export async function PATCH(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })

  const { id, action } = await req.json()
  if (!id || !['accept', 'decline'].includes(action)) {
    return NextResponse.json({ error: 'id und gültige action erforderlich' }, { status: 400 })
  }

  const requestResult = await pool.query(
    `SELECT id, sender_id, receiver_id, first_message, status FROM message_requests
     WHERE id = $1 AND receiver_id = $2`, // nur der Empfänger darf annehmen/ablehnen
    [id, user.id]
  )
  const request = requestResult.rows[0]

  if (!request) return NextResponse.json({ error: 'Anfrage nicht gefunden' }, { status: 404 })
  if (request.status !== 'pending') return NextResponse.json({ error: 'Anfrage bereits bearbeitet' }, { status: 400 })

  if (action === 'decline') {
    await pool.query(`UPDATE message_requests SET status = 'declined' WHERE id = $1`, [id])
    return NextResponse.json({ success: true })
  }

  // accept: Konversation erstellen, Erstnachricht übernehmen, Anfrage als angenommen markieren
  const newConvResult = await pool.query(
    `INSERT INTO conversations (type, created_by) VALUES ('direct', $1) RETURNING id`,
    [request.sender_id]
  )
  const newConv = newConvResult.rows[0]

  if (!newConv) return NextResponse.json({ error: 'Fehler beim Erstellen der Konversation' }, { status: 500 })

  await pool.query(
    `INSERT INTO conversation_members (conversation_id, user_id) VALUES ($1, $2), ($1, $3)`,
    [newConv.id, request.sender_id, request.receiver_id]
  )

  await pool.query(
    `INSERT INTO messages (conversation_id, sender_id, content) VALUES ($1, $2, $3)`,
    [newConv.id, request.sender_id, request.first_message]
  )

  await pool.query(`UPDATE message_requests SET status = 'accepted' WHERE id = $1`, [id])

  await pool.query(
    `INSERT INTO notifications (user_id, category, title, body, link) VALUES ($1, $2, $3, $4, $5)`,
    [request.sender_id, 'friends', `${user.username} hat deine Nachrichtenanfrage angenommen`, null, `/chat`]
  )

  return NextResponse.json({ success: true, conversation_id: newConv.id })
}