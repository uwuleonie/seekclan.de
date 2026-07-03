import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'

// Lesezugriff: administrator, owner UND teammitglied (Teammitglieder dürfen
// überall in admin2 mitlesen, aber außerhalb der freigegebenen Bereiche
// - Updates/Ideen/Konzepte/Team-Chat - nichts verändern, siehe die
// checkWrite-Funktionen in den jeweiligen [accountId]/route.ts etc.)
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

// GET /api/admin2/accounts
export async function GET(req: NextRequest) {
  const user = await checkRead(req)
  if (!user) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })

  try {
    const result = await pool.query(
      `SELECT id, username, display_name, clan_role, is_banned, last_login_at
       FROM users
       ORDER BY
         CASE clan_role
           WHEN 'owner' THEN 0
           WHEN 'administrator' THEN 1
           WHEN 'teammitglied' THEN 2
           WHEN 'clanmoderator' THEN 3
           WHEN 'vip' THEN 4
           WHEN 'clanmitglied' THEN 5
           WHEN 'gast' THEN 6
           ELSE 7
         END,
         username ASC`
    )
    return NextResponse.json({ accounts: result.rows })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}