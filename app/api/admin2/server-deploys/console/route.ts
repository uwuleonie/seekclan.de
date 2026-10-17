import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'
import { runRconCommand } from '@/app/lib/rcon'
import { validateMcCommand } from '@/app/lib/mcCommandWhitelist'
import { darf, kontenMitRecht, mitRecht } from '@/app/lib/rechte'

async function checkAccess(req: NextRequest) {
  return mitRecht(req, 'admin.verwalten')
}

// POST /api/admin2/server-deploys/console
// Body: { command: string }
//
// Owner (Leonie) führt Befehle SOFORT aus. Administrator legt stattdessen
// eine Anfrage an, die Leonie über das normale Benachrichtigungssystem
// bekommt und explizit annehmen/ablehnen muss (siehe requests/[requestId]/
// route.ts) - erst nach Annahme wird der Befehl tatsächlich ausgeführt.
// Die Whitelist-Prüfung gilt in JEDEM Fall, unabhängig von der Rolle.
export async function POST(req: NextRequest) {
  const user = await checkAccess(req)
  if (!user) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const { command } = body as { command?: string }

  if (!command?.trim()) {
    return NextResponse.json({ error: 'Befehl darf nicht leer sein' }, { status: 400 })
  }

  const validation = validateMcCommand(command)
  if (!validation.valid) {
    return NextResponse.json({ error: validation.error }, { status: 400 })
  }

  if (darf(user, 'server.freigeben')) {
    try {
      const response = await runRconCommand(command.trim())
      return NextResponse.json({ executed: true, response })
    } catch (err: any) {
      return NextResponse.json({ error: `RCON-Fehler: ${err.message}` }, { status: 500 })
    }
  }

  // Administrator: Anfrage anlegen statt direkt auszuführen.
  try {
    const requestResult = await pool.query(
      `INSERT INTO admin_server_action_requests (requested_by, action_type, payload)
       VALUES ($1, 'console_command', $2)
       RETURNING id`,
      [user.id, command.trim()]
    )

    // Benachrichtigung an alle, die Server-Aktionen freigeben dürfen
    for (const owner of await kontenMitRecht('server.freigeben')) {
      await pool.query(
        `INSERT INTO notifications (user_id, category, title, body, link) VALUES ($1, $2, $3, $4, $5)`,
        [
          owner.id, 'system',
          `${user.name} möchte einen Server-Befehl ausführen`,
          `Befehl: ${command.trim()}`,
          `/admin2/server-deploys?actionRequest=${requestResult.rows[0].id}`,
        ]
      )
    }

    return NextResponse.json({ executed: false, pending: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}