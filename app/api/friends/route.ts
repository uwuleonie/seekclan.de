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

// Freundesliste + offene Anfragen laden
export async function GET(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })

  // Sender- und Receiver-Nutzerdaten werden über zwei separate JOINs auf die
  // users-Tabelle geholt (entspricht den verschachtelten "sender:sender_id (...)"
  // / "receiver:receiver_id (...)" Objekten, die Supabase automatisch erzeugt hat).
  const friendsResult = await pool.query(
    `SELECT
       f.id, f.status, f.created_at,
       json_build_object('id', s.id, 'username', s.username) AS sender,
       json_build_object('id', r.id, 'username', r.username) AS receiver
     FROM friendships f
     JOIN users s ON s.id = f.sender_id
     JOIN users r ON r.id = f.receiver_id
     WHERE f.sender_id = $1 OR f.receiver_id = $1
     ORDER BY f.created_at DESC`,
    [user.id]
  )

  return NextResponse.json({ friends: friendsResult.rows || [], userId: user.id })
}

// Anfrage senden
export async function POST(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })

  const { receiver_username } = await req.json()
  if (!receiver_username) return NextResponse.json({ error: 'Username erforderlich' }, { status: 400 })

  const receiverResult = await pool.query('SELECT id, username FROM users WHERE username = $1', [receiver_username])
  const receiver = receiverResult.rows[0]
  if (!receiver) return NextResponse.json({ error: 'Nutzer nicht gefunden' }, { status: 404 })
  if (receiver.id === user.id) return NextResponse.json({ error: 'Du kannst dir selbst keine Anfrage senden' }, { status: 400 })

  try {
    await pool.query('INSERT INTO friendships (sender_id, receiver_id) VALUES ($1, $2)', [user.id, receiver.id])
  } catch (err) {
    return NextResponse.json({ error: 'Anfrage bereits gesendet oder ihr seid bereits Freunde' }, { status: 400 })
  }

  await pool.query(
    `INSERT INTO notifications (user_id, category, title, body, link) VALUES ($1, $2, $3, $4, $5)`,
    [receiver.id, 'friends', `${user.username} möchte mit dir befreundet sein`, null, '/freunde']
  )

  return NextResponse.json({ success: true })
}

// Anfrage annehmen/ablehnen oder Freund entfernen
export async function PATCH(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })

  const { id, action } = await req.json()
  if (!id || !action) return NextResponse.json({ error: 'ID und Aktion erforderlich' }, { status: 400 })

  if (action === 'accept') {
    let friendship
    try {
      const updateResult = await pool.query(
        `UPDATE friendships SET status = 'accepted' WHERE id = $1 AND receiver_id = $2 RETURNING sender_id`,
        [id, user.id]
      )
      friendship = updateResult.rows[0]
    } catch (err) {
      return NextResponse.json({ error: 'Fehler' }, { status: 500 })
    }

    if (friendship) {
      await pool.query(
        `INSERT INTO notifications (user_id, category, title, body, link) VALUES ($1, $2, $3, $4, $5)`,
        [friendship.sender_id, 'friends', `${user.username} hat deine Freundschaftsanfrage angenommen`, null, '/freunde']
      )
    }
  } else if (action === 'decline' || action === 'remove') {
    try {
      await pool.query(
        `DELETE FROM friendships WHERE id = $1 AND (sender_id = $2 OR receiver_id = $2)`,
        [id, user.id]
      )
    } catch (err) {
      return NextResponse.json({ error: 'Fehler' }, { status: 500 })
    }
  }

  return NextResponse.json({ success: true })
}