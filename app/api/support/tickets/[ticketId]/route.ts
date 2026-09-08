import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'

async function getStaffUser(req: NextRequest) {
  const token = req.cookies.get('session_token')?.value
  if (!token) return null
  const sessionResult = await pool.query('SELECT user_id FROM sessions WHERE token = $1', [token])
  const session = sessionResult.rows[0]
  if (!session) return null
  const userResult = await pool.query('SELECT id, username, clan_role FROM users WHERE id = $1', [session.user_id])
  const user = userResult.rows[0]
  if (!user) return null
  const staff = user.clan_role?.toLowerCase() === 'admin' || user.clan_role?.toLowerCase() === 'mod'
    || user.clan_role?.toLowerCase() === 'administrator' || user.clan_role?.toLowerCase() === 'owner'
    || user.clan_role?.toLowerCase() === 'teammitglied'
  return staff ? user : null
}

async function getAnyUser(req: NextRequest) {
  const token = req.cookies.get('session_token')?.value
  if (!token) return null
  const s = await pool.query('SELECT user_id FROM sessions WHERE token = $1', [token])
  if (!s.rows[0]) return null
  const u = await pool.query('SELECT id, username, clan_role FROM users WHERE id = $1', [s.rows[0].user_id])
  return u.rows[0] || null
}

// GET: Ticket-Details inkl. Teilnehmer, Dateien
export async function GET(req: NextRequest, { params }: { params: Promise<{ ticketId: string }> }) {
  const { ticketId } = await params
  const user = await getAnyUser(req)
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })

  const ticketRes = await pool.query('SELECT * FROM support_tickets WHERE id = $1', [ticketId])
  const ticket = ticketRes.rows[0]
  if (!ticket) return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 })

  const isStaff = ['admin', 'mod', 'administrator', 'owner', 'teammitglied'].includes(user.clan_role?.toLowerCase() ?? '')
  const isOwner = ticket.user_id === user.id
  const participantRes = await pool.query('SELECT 1 FROM support_ticket_participants WHERE ticket_id = $1 AND user_id = $2', [ticketId, user.id])
  if (!isStaff && !isOwner && participantRes.rows.length === 0) {
    return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })
  }

  // Ersteller
  const creatorRes = await pool.query('SELECT id, username, minecraft_username FROM users WHERE id = $1', [ticket.user_id])
  const creator = creatorRes.rows[0]

  // Teilnehmer — added_at und invited_by optional (Spalten evtl. noch nicht migriert)
  let participantsRes
  try {
    participantsRes = await pool.query(
      `SELECT u.id, u.username, u.minecraft_username,
              p.added_at, p.invited_by,
              inv.username AS invited_by_username
       FROM support_ticket_participants p
       JOIN users u ON u.id = p.user_id
       LEFT JOIN users inv ON inv.id = p.invited_by
       WHERE p.ticket_id = $1
       ORDER BY p.added_at ASC`,
      [ticketId]
    )
  } catch {
    // Fallback ohne neue Spalten
    participantsRes = await pool.query(
      `SELECT u.id, u.username, u.minecraft_username,
              NULL AS added_at, NULL AS invited_by, NULL AS invited_by_username
       FROM support_ticket_participants p
       JOIN users u ON u.id = p.user_id
       WHERE p.ticket_id = $1`,
      [ticketId]
    )
  }

  // Dateien
  const filesRes = await pool.query(
    `SELECT f.*, u.username AS uploader_username
     FROM support_ticket_files f
     LEFT JOIN users u ON u.id = f.uploader_id
     WHERE f.ticket_id = $1
     ORDER BY f.uploaded_at ASC`,
    [ticketId]
  ).catch(() => ({ rows: [] }))

  return NextResponse.json({
    ticket,
    creator,
    participants: participantsRes.rows,
    files: filesRes.rows,
  })
}

// PATCH: Status/Priorität ändern (Staff only) — setzt closed_at automatisch
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ ticketId: string }> }) {
  const { ticketId } = await params
  const staffUser = await getStaffUser(req)
  if (!staffUser) return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })

  const body = await req.json()
  const update: Record<string, any> = { updated_at: new Date().toISOString() }
  if (body.status && ['open', 'in_progress', 'closed'].includes(body.status)) {
    update.status = body.status
    if (body.status === 'closed') update.closed_at = new Date().toISOString()
    if (body.status === 'open' || body.status === 'in_progress') update.closed_at = null
  }
  if (body.priority && ['low', 'normal', 'high'].includes(body.priority)) update.priority = body.priority

  const keys = Object.keys(update)
  const setClause = keys.map((key, i) => `${key} = $${i + 1}`).join(', ')
  const values = keys.map((key) => update[key])

  try {
    await pool.query(`UPDATE support_tickets SET ${setClause} WHERE id = $${keys.length + 1}`, [...values, ticketId])
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}