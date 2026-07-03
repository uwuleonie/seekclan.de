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

async function checkWrite(req: NextRequest) {
  const user = await checkRead(req)
  if (!user || (user.clan_role !== 'administrator' && user.clan_role !== 'owner')) return null
  return user
}

// GET /api/admin2/clan-members
// Liest die bestehende clan_members-Tabelle (gleiche Daten wie /admin/clan,
// aber mit dem neuen Rollen-System: teammitglied darf lesen, nur
// administrator/owner dürfen schreiben - siehe POST/PATCH/DELETE).
export async function GET(req: NextRequest) {
  const user = await checkRead(req)
  if (!user) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })

  try {
    const result = await pool.query(
      `SELECT id, display_name, role, join_date, discord_tag, has_seek_account, stufe_override
       FROM clan_members ORDER BY join_date ASC`
    )
    return NextResponse.json({ members: result.rows })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// POST /api/admin2/clan-members
// Body: { display_name, role, join_date, discord_tag? }
export async function POST(req: NextRequest) {
  const user = await checkWrite(req)
  if (!user) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const { display_name, role, join_date, discord_tag } = body as {
    display_name?: string, role?: string, join_date?: string, discord_tag?: string
  }

  if (!display_name?.trim() || !join_date) {
    return NextResponse.json({ error: 'Minecraft-Name und Beitrittsdatum erforderlich' }, { status: 400 })
  }

  try {
    const result = await pool.query(
      `INSERT INTO clan_members (display_name, role, join_date, discord_tag)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [display_name.trim(), role || 'Mitglied', join_date, discord_tag?.trim() || null]
    )
    return NextResponse.json({ id: result.rows[0].id })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}