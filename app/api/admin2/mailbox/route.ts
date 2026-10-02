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
// Admin legt ein Item in die Mailbox eines Spielers.
// Neu: receiver_name + template_id reichen — UUID (Mojang) und Item-Daten holt der Server selbst.
// Alt (weiterhin erlaubt): receiver_uuid + receiver_name + item_data
export async function POST(req: NextRequest) {
  const user = await checkAccess(req)
  if (!user) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Ungültige Anfrage' }, { status: 400 })
  }

  let { receiver_uuid, receiver_name, item_data } = body
  const { template_id, sender_name } = body

  if (!receiver_name) {
    return NextResponse.json({ error: 'Minecraft-Name fehlt' }, { status: 400 })
  }

  // Item-Daten aus Template holen
  if (!item_data) {
    if (!template_id) {
      return NextResponse.json({ error: 'Kein Item/Template gewählt' }, { status: 400 })
    }
    const t = await pool.query('SELECT item_data FROM admin_item_templates WHERE id = $1', [template_id])
    if (t.rows.length === 0) {
      return NextResponse.json({ error: 'Template nicht gefunden' }, { status: 404 })
    }
    item_data = t.rows[0].item_data
  }

  // UUID serverseitig bei Mojang holen
  if (!receiver_uuid) {
    try {
      const mojang = await fetch(
        `https://api.mojang.com/users/profiles/minecraft/${encodeURIComponent(receiver_name)}`,
        { cache: 'no-store' }
      )
      if (!mojang.ok) {
        return NextResponse.json({ error: `Spieler "${receiver_name}" nicht gefunden.` }, { status: 404 })
      }
      const data = await mojang.json()
      const id: string = data.id
      receiver_uuid = `${id.slice(0, 8)}-${id.slice(8, 12)}-${id.slice(12, 16)}-${id.slice(16, 20)}-${id.slice(20)}`
      receiver_name = data.name
    } catch {
      return NextResponse.json({ error: 'Mojang ist gerade nicht erreichbar. Versuch es gleich nochmal.' }, { status: 502 })
    }
  }

  const result = await pool.query(
    `INSERT INTO mailbox_items (receiver_uuid, receiver_name, item_data, sender_name)
     VALUES ($1, $2, $3, $4)
     RETURNING id`,
    [receiver_uuid, receiver_name, item_data, sender_name || user.username]
  )

  return NextResponse.json({ ok: true, id: result.rows[0].id, receiver_name })
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