import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'
import { verifyPluginKey } from '@/app/lib/plugin-auth'

// Liefert alle Notification-Einstellungen für den Cache-Sync im Plugin
// (NotificationSettingsManager.loadAllAsync).
export async function GET(req: NextRequest) {
  if (!await verifyPluginKey(req)) {
    return NextResponse.json({ error: 'Ungültiger API Key' }, { status: 401 })
  }

  let settings
  try {
    const result = await pool.query('SELECT * FROM claim_notification_settings')
    settings = result.rows
  } catch (err: any) {
    return NextResponse.json({ error: `Einstellungen konnten nicht geladen werden: ${err.message}` }, { status: 500 })
  }

  return NextResponse.json({ settings: settings || [] })
}

// Setzt/aktualisiert die Benachrichtigungs-Einstellung für einen Spieler
// (ersetzt den alten SupabaseClient.upsert("claim_notification_settings", ...)
// Aufruf aus ClaimMessagesCommand). Nutzt "uuid" als Konfliktschlüssel, NICHT
// "id" - diese Tabelle hat keine id-Spalte, siehe Sequenz-Check vom Vormittag.
export async function POST(req: NextRequest) {
  if (!await verifyPluginKey(req)) {
    return NextResponse.json({ error: 'Ungültiger API Key' }, { status: 401 })
  }

  const body = await req.json()
  const { uuid, ingame_messages_enabled } = body

  if (!uuid || typeof ingame_messages_enabled !== 'boolean') {
    return NextResponse.json(
      { error: 'uuid (string) und ingame_messages_enabled (boolean) sind erforderlich' },
      { status: 400 }
    )
  }

  try {
    await pool.query(
      `INSERT INTO claim_notification_settings (uuid, ingame_messages_enabled)
       VALUES ($1, $2)
       ON CONFLICT (uuid) DO UPDATE SET ingame_messages_enabled = EXCLUDED.ingame_messages_enabled`,
      [uuid, ingame_messages_enabled]
    )
  } catch (err: any) {
    return NextResponse.json({ error: `Einstellung konnte nicht gespeichert werden: ${err.message}` }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}   