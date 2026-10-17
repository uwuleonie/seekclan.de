import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'
import { runRconCommand } from '@/app/lib/rcon'
import { darf, kontenMitRecht, mitRecht } from '@/app/lib/rechte'

async function checkAccess(req: NextRequest) {
  return mitRecht(req, 'admin.verwalten')
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

  if (darf(user, 'server.freigeben')) {
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

    // Benachrichtigung an alle, die Server-Aktionen freigeben dürfen
    for (const owner of await kontenMitRecht('server.freigeben')) {
      await pool.query(
        `INSERT INTO notifications (user_id, category, title, body, link) VALUES ($1, $2, $3, $4, $5)`,
        [
          owner.id, 'system',
          `${user.name} möchte den Server neustarten`,
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