import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'
import { verifyPluginKey } from '@/app/lib/plugin-auth'

// In-Memory Store für Online-Spieler (reset bei Serverrestart der Website)
// Format: { playerName: { server, lastSeen } }
const onlinePlayers: Map<string, { server: string; skin_texture?: string; skin_signature?: string; lastSeen: number }> = new Map()

// Spieler die seit >60s keinen Heartbeat hatten als offline markieren
function pruneOffline() {
  const now = Date.now()
  for (const [name, data] of onlinePlayers.entries()) {
    if (now - data.lastSeen > 60000) onlinePlayers.delete(name)
  }
}

// GET — SeekTabsystem holt alle Online-Spieler
export async function GET(req: NextRequest) {
  if (!await verifyPluginKey(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  pruneOffline()

  const by_server: Record<string, string[]> = {}
  const skins: Record<string, { texture: string; signature: string }> = {}

  for (const [name, data] of onlinePlayers.entries()) {
    if (!by_server[data.server]) by_server[data.server] = []
    by_server[data.server].push(name)
    if (data.skin_texture) {
      skins[name] = { texture: data.skin_texture, signature: data.skin_signature || '' }
    }
  }

  return NextResponse.json({ by_server, skins })
}

// POST — SeekTabsystem sendet Heartbeat für Spieler
export async function POST(req: NextRequest) {
  if (!await verifyPluginKey(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json().catch(() => ({}))
  const { players, server } = body

  // players = [{ name, skin_texture?, skin_signature? }]
  if (!server || !Array.isArray(players)) return NextResponse.json({ error: 'Ungültige Daten' }, { status: 400 })

  pruneOffline()

  // Alle Spieler die jetzt NICHT mehr in diesem Heartbeat sind vom Server entfernen
  for (const [name, data] of onlinePlayers.entries()) {
    if (data.server === server && !players.find((p: any) => p.name === name)) {
      onlinePlayers.delete(name)
    }
  }

  // Aktive Spieler updaten
  for (const p of players) {
    onlinePlayers.set(p.name, {
      server,
      skin_texture: p.skin_texture,
      skin_signature: p.skin_signature,
      lastSeen: Date.now()
    })
  }

  return NextResponse.json({ success: true })
}