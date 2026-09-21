import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'

async function checkAccess(req: NextRequest) {
  const token = req.cookies.get('session_token')?.value
  if (!token) return null
  const sessionResult = await pool.query('SELECT user_id FROM sessions WHERE token = $1', [token])
  const session = sessionResult.rows[0]
  if (!session) return null
  const userResult = await pool.query(
    'SELECT id, username, clan_role FROM users WHERE id = $1',
    [session.user_id]
  )
  const user = userResult.rows[0]
  if (!user || !['administrator', 'owner', 'teammitglied'].includes(user.clan_role)) return null
  return user
}

// GET /api/admin2/mailbox
// Gibt alle Mailbox-Items zurück (mit Empfänger-Info)
export async function GET(req: NextRequest) {
  const user = await checkAccess(req)
  if (!user) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })

  const result = await pool.query(
    `SELECT id, receiver_uuid, receiver_name, item_data,
            sender_name, sent_at
     FROM mailbox_items
     ORDER BY sent_at DESC`
  )

  return NextResponse.json({ items: result.rows })
}

// POST /api/admin2/mailbox
// Admin legt ein Item in die Mailbox eines Spielers
// item_data = Base64-serialisierter ItemStack (vom Plugin-Format)
export async function POST(req: NextRequest) {
  const user = await checkAccess(req)
  if (!user) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })

  const { receiver_uuid, receiver_name, item_data, sender_name } = await req.json()
  if (!receiver_uuid || !receiver_name || !item_data) {
    return NextResponse.json({
      error: 'receiver_uuid, receiver_name und item_data erforderlich'
    }, { status: 400 })
  }

  const result = await pool.query(
    `INSERT INTO mailbox_items (receiver_uuid, receiver_name, item_data, sender_name)
     VALUES ($1, $2, $3, $4)
     RETURNING id`,
    [receiver_uuid, receiver_name, item_data, sender_name ?? user.username]
  )

  return NextResponse.json({ ok: true, id: result.rows[0].id })
}

// DELETE /api/admin2/mailbox
// Admin löscht ein Item aus der Mailbox (z.B. Fehler)
export async function DELETE(req: NextRequest) {
  const user = await checkAccess(req)
  if (!user) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })

  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: 'id fehlt' }, { status: 400 })

  await pool.query('DELETE FROM mailbox_items WHERE id = $1', [id])

  return NextResponse.json({ ok: true })
}