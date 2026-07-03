import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'

async function checkAccess(req: NextRequest) {
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

// GET /api/admin2/support-tickets
// Liefert alle Support-Tickets fürs neue Admin-Interface. Ersetzt die
// Staff-Ansicht von /api/support/tickets, die noch auf die alten Rollen-Werte
// ('admin'/'mod') prüfte und seit der Rollen-Migration niemanden mehr durchließ.
export async function GET(req: NextRequest) {
  const user = await checkAccess(req)
  if (!user) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })

  try {
    const result = await pool.query(
      `SELECT
         st.id, st.category, st.subject, st.priority, st.status, st.created_at,
         creator.username AS creator_username,
         tu.username AS target_username,
         tb.name AS target_badge_name,
         (SELECT COUNT(*) FROM support_messages sm WHERE sm.ticket_id = st.id) AS message_count
       FROM support_tickets st
       JOIN users creator ON creator.id = st.user_id
       LEFT JOIN users tu ON tu.id = st.target_user_id
       LEFT JOIN clan_badges tb ON tb.id = st.target_badge_id
       ORDER BY
         CASE st.status WHEN 'open' THEN 0 WHEN 'in_progress' THEN 1 ELSE 2 END,
         st.created_at DESC`
    )
    return NextResponse.json({ tickets: result.rows })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}