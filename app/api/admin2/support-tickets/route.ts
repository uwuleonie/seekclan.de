import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'
import { mitRecht } from '@/app/lib/rechte'

async function checkAccess(req: NextRequest) {
  return mitRecht(req, 'support.team')
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
         creator.username AS creator_username, COALESCE(creator.anzeigename, creator.username) AS creator_name,
         tu.username AS target_username, COALESCE(tu.anzeigename, tu.username) AS target_name,
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