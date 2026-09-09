import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'

async function checkWrite(req: NextRequest) {
  const token = req.cookies.get('session_token')?.value
  if (!token) return null
  const s = await pool.query('SELECT user_id FROM sessions WHERE token = $1', [token])
  if (!s.rows[0]) return null
  const u = await pool.query('SELECT id, username, clan_role FROM users WHERE id = $1', [s.rows[0].user_id])
  const user = u.rows[0]
  if (!user || !['administrator', 'owner'].includes(user.clan_role)) return null
  return user
}

// GET — alle Spieler-Rang-Zuweisungen laden
export async function GET(req: NextRequest) {
  const token = req.cookies.get('session_token')?.value
  if (!token) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })
  const s = await pool.query('SELECT user_id FROM sessions WHERE token = $1', [token])
  if (!s.rows[0]) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })
  const u = await pool.query('SELECT clan_role FROM users WHERE id = $1', [s.rows[0].user_id])
  if (!['administrator', 'owner', 'teammitglied'].includes(u.rows[0]?.clan_role)) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })

  const result = await pool.query(
    `SELECT pr.uuid, pr.player_name, pr.assigned_by, pr.assigned_at,
            r.id as rank_id, r.name, r.display_name, r.color, r.tab_prefix, r.chat_prefix, r.priority
     FROM mc_player_ranks pr
     JOIN mc_ranks r ON pr.rank_id = r.id
     ORDER BY r.priority DESC, pr.player_name ASC`
  )
  return NextResponse.json({ players: result.rows })
}

// POST — Rang an Spieler vergeben
export async function POST(req: NextRequest) {
  const user = await checkWrite(req)
  if (!user) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })
  const { uuid, player_name, rank_id } = await req.json().catch(() => ({}))
  if (!uuid || !rank_id) return NextResponse.json({ error: 'uuid und rank_id erforderlich' }, { status: 400 })
  const rankCheck = await pool.query('SELECT id, is_default FROM mc_ranks WHERE id = $1', [rank_id])
  if (!rankCheck.rows[0]) return NextResponse.json({ error: 'Rang nicht gefunden' }, { status: 404 })
  if (rankCheck.rows[0].is_default) {
    // Standard-Rang = Eintrag löschen (Fallback greift automatisch)
    await pool.query('DELETE FROM mc_player_ranks WHERE uuid = $1', [uuid])
  } else {
    await pool.query(
      `INSERT INTO mc_player_ranks (uuid, player_name, rank_id, assigned_by)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (uuid) DO UPDATE SET rank_id = $3, assigned_by = $4, assigned_at = now(), player_name = $2`,
      [uuid, player_name || uuid, rank_id, user.username]
    )
  }
  return NextResponse.json({ success: true })
}

// DELETE — Rang entziehen (zurück auf Standard)
export async function DELETE(req: NextRequest) {
  const user = await checkWrite(req)
  if (!user) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })
  const { uuid } = await req.json().catch(() => ({}))
  if (!uuid) return NextResponse.json({ error: 'uuid erforderlich' }, { status: 400 })
  await pool.query('DELETE FROM mc_player_ranks WHERE uuid = $1', [uuid])
  return NextResponse.json({ success: true })
}