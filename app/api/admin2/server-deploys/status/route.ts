import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'
import { runRconCommand } from '@/app/lib/rcon'

// Nur owner UND administrator dürfen diese Seite überhaupt SEHEN (auch nur
// lesend) - Teammitglieder haben hier keinerlei Zugriff, nicht mal lesend,
// da es sich um eine sicherheitskritische Server-Fernsteuerung handelt.
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

// GET /api/admin2/server-deploys/status
// Liefert Live-Status des Minecraft-Servers über RCON. "list" gibt z.B.
// "There are 3 of a max of 40 players online: ..." zurück - wir parsen daraus
// die Spielerzahlen. "tps" gibt bei Paper eine formatierte TPS-Zeile zurück.
export async function GET(req: NextRequest) {
  const user = await checkAccess(req)
  if (!user) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })

  try {
    const listResponse = await runRconCommand('list')
    const tpsResponse = await runRconCommand('tps')

    const playerMatch = listResponse.match(/There are (\d+) of a max of (\d+) players online/)
    const online = playerMatch ? parseInt(playerMatch[1]) : 0
    const maxPlayers = playerMatch ? parseInt(playerMatch[2]) : 0

    // Paper's "tps" Antwort enthält typischerweise Werte wie "TPS from last
    // 1m, 5m, 15m: 20.0, 19.98, 19.95" - wir extrahieren nur den ersten Wert
    // (letzte Minute) als aktuellen Anzeigewert.
    const tpsMatch = tpsResponse.match(/[\d.]+/)
    const tps = tpsMatch ? parseFloat(tpsMatch[0]) : null

    return NextResponse.json({
      online: true,
      players: online,
      maxPlayers,
      tps,
      raw: { list: listResponse, tps: tpsResponse },
    })
  } catch (err: any) {
    // RCON-Verbindungsfehler bedeutet meistens: Server ist offline oder RCON
    // nicht erreichbar - das ist ein normaler, erwartbarer Zustand (kein
    // Absturz der Route), daher hier explizit "online: false" statt 500.
    return NextResponse.json({ online: false, error: err.message })
  }
}