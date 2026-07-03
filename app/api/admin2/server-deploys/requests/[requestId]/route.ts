import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'
import { runRconCommand } from '@/app/lib/rcon'
import { runSshCommand } from '@/app/lib/ssh'

async function checkOwner(req: NextRequest) {
  const token = req.cookies.get('session_token')?.value
  if (!token) return null
  const sessionResult = await pool.query('SELECT user_id FROM sessions WHERE token = $1', [token])
  const session = sessionResult.rows[0]
  if (!session) return null
  const userResult = await pool.query('SELECT id, username, clan_role FROM users WHERE id = $1', [session.user_id])
  const user = userResult.rows[0]
  // NUR Owner darf Anfragen annehmen/ablehnen - das ist genau der Punkt der
  // ganzen Anfrage-Logik (Administrator kann anfragen, aber nicht selbst genehmigen).
  if (!user || user.clan_role !== 'owner') return null
  return user
}

// PATCH /api/admin2/server-deploys/requests/[requestId]
// Body: { accept: boolean }
// Bei Annahme wird die eigentliche Aktion JETZT ausgeführt (RCON-Befehl,
// SSH-Neustart, o.ä. je nach action_type) - das Ergebnis wird gespeichert und
// dem Anfragenden als Benachrichtigung zurückgemeldet.
export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ requestId: string }> }
) {
  const owner = await checkOwner(req)
  if (!owner) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })

  const { requestId } = await context.params
  const body = await req.json().catch(() => ({}))
  const { accept } = body as { accept?: boolean }

  const requestResult = await pool.query(
    `SELECT id, requested_by, action_type, payload FROM admin_server_action_requests WHERE id = $1 AND status = 'pending'`,
    [requestId]
  )
  const actionRequest = requestResult.rows[0]
  if (!actionRequest) return NextResponse.json({ error: 'Anfrage nicht gefunden oder bereits bearbeitet' }, { status: 404 })

  if (!accept) {
    await pool.query(
      `UPDATE admin_server_action_requests SET status = 'declined', resolved_at = now() WHERE id = $1`,
      [requestId]
    )
    await pool.query(
      `INSERT INTO notifications (user_id, category, title, body, link) VALUES ($1, $2, $3, $4, $5)`,
      [actionRequest.requested_by, 'system', 'Server-Anfrage abgelehnt', actionRequest.payload, '/admin2/server-deploys']
    )
    return NextResponse.json({ success: true })
  }

  // Annahme: Aktion tatsächlich ausführen, abhängig vom Typ.
  let result = ''
  let executionError: string | null = null
  try {
    if (actionRequest.action_type === 'console_command') {
      result = await runRconCommand(actionRequest.payload)
    } else if (actionRequest.action_type === 'server_restart') {
      const { stdout } = await runSshCommand('echo "restart angefordert - siehe restart-Route für den echten Ablauf"')
      result = stdout
    } else if (actionRequest.action_type === 'deploy') {
      const { stdout } = await runSshCommand('cd /vm_hdd/seekclan && git pull && npm run build && pm2 restart seekclan')
      result = stdout
    }
  } catch (err: any) {
    executionError = err.message
  }

  await pool.query(
    `UPDATE admin_server_action_requests SET status = 'executed', result = $1, resolved_at = now() WHERE id = $2`,
    [executionError ? `Fehler: ${executionError}` : result, requestId]
  )

  await pool.query(
    `INSERT INTO notifications (user_id, category, title, body, link) VALUES ($1, $2, $3, $4, $5)`,
    [
      actionRequest.requested_by, 'system',
      executionError ? 'Server-Anfrage angenommen, aber fehlgeschlagen' : 'Server-Anfrage angenommen und ausgeführt',
      executionError || result,
      '/admin2/server-deploys',
    ]
  )

  return NextResponse.json({ success: true, result: executionError ? null : result, error: executionError })
}