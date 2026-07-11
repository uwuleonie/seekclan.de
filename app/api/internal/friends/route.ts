import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'
import { verifyPluginKey } from '@/app/lib/plugin-auth'

// GET /api/internal/friends?uuid=... — Freundesliste + offene Anfragen
export async function GET(req: NextRequest) {
  if (!await verifyPluginKey(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const uuid = req.nextUrl.searchParams.get('uuid')
  if (!uuid) return NextResponse.json({ error: 'uuid erforderlich' }, { status: 400 })

  const userResult = await pool.query('SELECT id FROM users WHERE minecraft_uuid = $1', [uuid])
  const user = userResult.rows[0]
  if (!user) return NextResponse.json({ friends: [], requests_in: [], requests_out: [] })

  // Akzeptierte Freunde
  const friendsResult = await pool.query(
    `SELECT u.minecraft_username, u.minecraft_uuid, u.username,
            (SELECT last_heartbeat FROM lobby_online_sessions WHERE uuid = u.minecraft_uuid) as last_seen,
            (SELECT server FROM lobby_online_sessions WHERE uuid = u.minecraft_uuid 
             AND last_heartbeat > now() - INTERVAL '10 seconds') as online_server
     FROM friendships f
     JOIN users u ON u.id = (CASE WHEN f.sender_id = $1 THEN f.receiver_id ELSE f.sender_id END)
     WHERE f.status = 'accepted' AND (f.sender_id = $1 OR f.receiver_id = $1)
     ORDER BY u.minecraft_username ASC`,
    [user.id]
  )

  // Eingehende Anfragen
  const inResult = await pool.query(
    `SELECT f.id, u.minecraft_username, u.minecraft_uuid, f.created_at
     FROM friendships f
     JOIN users u ON u.id = f.sender_id
     WHERE f.receiver_id = $1 AND f.status = 'pending'
     ORDER BY f.created_at DESC`,
    [user.id]
  )

  // Ausgehende Anfragen
  const outResult = await pool.query(
    `SELECT f.id, u.minecraft_username, u.minecraft_uuid, f.created_at
     FROM friendships f
     JOIN users u ON u.id = f.receiver_id
     WHERE f.sender_id = $1 AND f.status = 'pending'
     ORDER BY f.created_at DESC`,
    [user.id]
  )

  return NextResponse.json({
    friends: friendsResult.rows,
    requests_in: inResult.rows,
    requests_out: outResult.rows,
  })
}

// POST /api/internal/friends — Freundschaftsanfrage senden
// Body: { uuid, player_name, target_username }
export async function POST(req: NextRequest) {
  if (!await verifyPluginKey(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { uuid, player_name, target_username } = await req.json().catch(() => ({}))
  if (!uuid || !target_username) return NextResponse.json({ error: 'uuid + target_username erforderlich' }, { status: 400 })

  // Sender-Account
  const senderResult = await pool.query('SELECT id FROM users WHERE minecraft_uuid = $1', [uuid])
  const sender = senderResult.rows[0]
  if (!sender) return NextResponse.json({ error: 'no_account' }, { status: 404 })

  // Ziel suchen (per minecraft_username oder username)
  const targetResult = await pool.query(
    `SELECT id, minecraft_uuid FROM users WHERE minecraft_username = $1 OR username = $1`,
    [target_username]
  )
  const target = targetResult.rows[0]
  if (!target) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  if (target.id === sender.id) return NextResponse.json({ error: 'self' }, { status: 400 })

  // Prüfen ob bereits Freunde oder Anfrage existiert
  const existing = await pool.query(
    `SELECT id, status, sender_id FROM friendships
     WHERE (sender_id = $1 AND receiver_id = $2) OR (sender_id = $2 AND receiver_id = $1)`,
    [sender.id, target.id]
  )

  if (existing.rows.length > 0) {
    const row = existing.rows[0]
    if (row.status === 'accepted') return NextResponse.json({ error: 'already_friends' }, { status: 400 })

    // Gegenläufige Anfrage → automatisch annehmen
    if (row.status === 'pending' && row.sender_id === target.id) {
      await pool.query(`UPDATE friendships SET status = 'accepted' WHERE id = $1`, [row.id])
      await pool.query(
        `INSERT INTO notifications (user_id, category, title, link) VALUES ($1, 'friends', $2, '/freunde')`,
        [target.id, `${player_name} hat deine Freundschaftsanfrage angenommen!`]
      )
      return NextResponse.json({ success: true, auto_accepted: true })
    }
    return NextResponse.json({ error: 'already_sent' }, { status: 400 })
  }

  await pool.query(
    `INSERT INTO friendships (sender_id, receiver_id, status) VALUES ($1, $2, 'pending')`,
    [sender.id, target.id]
  )
  await pool.query(
    `INSERT INTO notifications (user_id, category, title, link) VALUES ($1, 'friends', $2, '/freunde')`,
    [target.id, `${player_name} möchte mit dir befreundet sein!`]
  )

  return NextResponse.json({ success: true, auto_accepted: false })
}

// PATCH /api/internal/friends — Anfrage annehmen/ablehnen oder Freund entfernen
// Body: { uuid, action: 'accept'|'decline'|'remove', target_uuid }
export async function PATCH(req: NextRequest) {
  if (!await verifyPluginKey(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { uuid, action, target_uuid } = await req.json().catch(() => ({}))
  if (!uuid || !action || !target_uuid) return NextResponse.json({ error: 'uuid + action + target_uuid erforderlich' }, { status: 400 })

  const userResult = await pool.query('SELECT id FROM users WHERE minecraft_uuid = $1', [uuid])
  const user = userResult.rows[0]
  if (!user) return NextResponse.json({ error: 'no_account' }, { status: 404 })

  const targetResult = await pool.query('SELECT id, minecraft_username FROM users WHERE minecraft_uuid = $1', [target_uuid])
  const target = targetResult.rows[0]
  if (!target) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  if (action === 'accept') {
    await pool.query(
      `UPDATE friendships SET status = 'accepted'
       WHERE sender_id = $1 AND receiver_id = $2 AND status = 'pending'`,
      [target.id, user.id]
    )
    await pool.query(
      `INSERT INTO notifications (user_id, category, title, link) VALUES ($1, 'friends', $2, '/freunde')`,
      [target.id, `${(await pool.query('SELECT minecraft_username FROM users WHERE id = $1', [user.id])).rows[0]?.minecraft_username} hat deine Freundschaftsanfrage angenommen!`]
    )
  } else if (action === 'decline' || action === 'remove') {
    await pool.query(
      `DELETE FROM friendships WHERE (sender_id = $1 AND receiver_id = $2) OR (sender_id = $2 AND receiver_id = $1)`,
      [user.id, target.id]
    )
  }

  return NextResponse.json({ success: true })
}