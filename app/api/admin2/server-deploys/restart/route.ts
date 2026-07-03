import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'
import { runRconCommand } from '@/app/lib/rcon'

async function checkAccess(req: NextRequest) {
  const token = req.cookies.get('session_token')?.value
  if (!token) return null
  const sessionResult = await pool.query('SELECT user_id FROM sessions WHERE token = $1', [token])
  const session = sessionResult.rows[0]
  if (!session) return null
  const userResult = await pool.query('SELECT id, username, clan_role FROM users WHERE id = $1', [session.user_id])
  const user = userResult.rows[0]
  if (!user || !['administrator', 'owner'].includes(user.clan_role)) return null
  return user
}

// POST /api/admin2/server-deploys/restart
//
// Nutzt den bereits vorhandenen ingame "/restart"-Befehl (übernimmt bereits
// den kompletten Ablauf: sauberes Herunterfahren UND automatisches
// Wiederhochfahren), statt einen eigenen stop/start-Zyklus nachzubauen.
//
// Owner führt sofort aus, Administrator legt eine Anfrage an (identisches
// Muster wie bei der Konsole).
export async function POST(req: NextRequest) {
  const user = await checkAccess(req)
  if (!user) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })

  if (user.clan_role === 'owner') {
    try {
      const response = await runRconCommand('restart')
      return NextResponse.json({ executed: true, response })
    } catch (err: any) {
      return NextResponse.json({ error: `RCON-Fehler: ${err.message}` }, { status: 500 })
    }
  }

  try {
    const requestResult = await pool.query(
      `INSERT INTO admin_server_action_requests (requested_by, action_type, payload)
       VALUES ($1, 'server_restart', 'Minecraft-Server neustarten')
       RETURNING id`,
      [user.id]
    )

    const ownerResult = await pool.query(`SELECT id FROM users WHERE clan_role = 'owner'`)
    for (const owner of ownerResult.rows) {
      await pool.query(
        `INSERT INTO notifications (user_id, category, title, body, link) VALUES ($1, $2, $3, $4, $5)`,
        [
          owner.id, 'system',
          `${user.username} möchte den Server neustarten`,
          null,
          `/admin2/server-deploys?actionRequest=${requestResult.rows[0].id}`,
        ]
      )
    }

    return NextResponse.json({ executed: false, pending: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}