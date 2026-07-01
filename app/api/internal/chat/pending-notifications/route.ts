import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'
import { verifyPluginKey } from '@/app/lib/plugin-auth'

// GET /api/internal/chat/pending-notifications?minecraft_uuid=X
//
// Web->Ingame Zustellung (Konzeptdokument Abschnitt 4): liefert alle Nachrichten,
// die dieser Spieler noch nicht ingame angezeigt bekommen hat, und markiert sie
// sofort als zugestellt (message_ingame_deliveries) - macht den Poll idempotent,
// ein Aufruf liefert jede Nachricht nur genau einmal aus.
//
// Bewusst NUR für 'gc', 'direct' und 'group' Konversationen (nicht 'global'):
// der globale Chat wird bereits über den normalen Ingame-Chat live an alle Spieler
// verteilt, eine zusätzliche Benachrichtigung wäre dort nur Rauschen.
//
// WICHTIGER HINWEIS FÜR DIE WEITERE INTEGRATION: Für GC-Nachrichten, die von einem
// zum Sendezeitpunkt ONLINE Spieler ingame geschrieben werden, gibt es in
// GcCommand/ChatListener bereits eine SOFORTIGE Broadcast-Zustellung an andere
// online Claim-Gruppen-Mitglieder. Dieser Poller hier weiß nichts von diesem
// Sofort-Broadcast und würde dieselbe Nachricht ein paar Sekunden später ERNEUT
// als "neue Benachrichtigung" ausliefern (Doppel-Zustellung). Sauberste Lösung:
// GcCommand/ChatListener sollen nach ihrem bestehenden Sofort-Broadcast zusätzlich
// message_ingame_deliveries für die gerade benachrichtigten Empfänger befüllen
// (INSERT ... ON CONFLICT DO NOTHING) - dann sieht dieser Poller "schon zugestellt"
// und überspringt sie. Das ist eine kleine, risikoarme Ergänzung zum bereits
// funktionierenden Code, aber bewusst NICHT Teil dieser vorbereitenden Änderung,
// da GcCommand/ChatListener schon getestet laufen und ich das nicht ungetestet
// anfassen wollte, während niemand zum Gegenprüfen da war.

async function resolveUser(minecraftUuid: string): Promise<{ userId: string | null; notificationsEnabled: boolean }> {
  const result = await pool.query(
    'SELECT id, ingame_chat_notifications_enabled FROM users WHERE minecraft_uuid = $1',
    [minecraftUuid]
  )
  const row = result.rows[0]
  if (!row) return { userId: null, notificationsEnabled: true } // nicht verknüpft: kein Opt-out möglich, daher an
  // NULL (z.B. bei Bestandsnutzern ohne gesetzten Default) wird als "an" behandelt,
  // damit ein fehlender Wert nicht stillschweigend die gesamte Zustellung blockiert.
  const notificationsEnabled = row.ingame_chat_notifications_enabled !== false
  return { userId: row.id, notificationsEnabled }
}

export async function GET(req: NextRequest) {
  if (!await verifyPluginKey(req)) {
    return NextResponse.json({ error: 'Ungültiger API Key' }, { status: 401 })
  }

  const minecraftUuid = req.nextUrl.searchParams.get('minecraft_uuid')
  if (!minecraftUuid) {
    return NextResponse.json({ error: 'minecraft_uuid erforderlich' }, { status: 400 })
  }

  const { userId, notificationsEnabled } = await resolveUser(minecraftUuid)
  if (!notificationsEnabled) {
    return NextResponse.json({ notifications: [] })
  }

  // Alle Konversationen finden, in denen dieser Spieler Mitglied ist (verknüpft
  // über user_id ODER member_minecraft_uuid - beide Fälle abgedeckt).
  const pendingResult = await pool.query(
    `SELECT
       m.id AS message_id,
       m.conversation_id,
       c.type AS conversation_type,
       c.name AS group_name,
       COALESCE(u.username, sps.player_name, m.sender_minecraft_uuid, 'Unbekannt') AS sender_display_name,
       m.content,
       m.image_url,
       m.created_at
     FROM messages m
     JOIN conversations c ON c.id = m.conversation_id
     JOIN conversation_members cm ON cm.conversation_id = c.id
     LEFT JOIN users u ON u.id = m.sender_id
     LEFT JOIN smp_player_stats sps ON sps.uuid = m.sender_minecraft_uuid
     WHERE c.type IN ('gc', 'direct', 'group')
       AND (
         ($1::uuid IS NOT NULL AND cm.user_id = $1) OR cm.member_minecraft_uuid = $2
       )
       -- Nicht die eigene, selbst gesendete Nachricht benachrichtigen
       AND NOT (m.sender_minecraft_uuid = $2 OR ($1::uuid IS NOT NULL AND m.sender_id = $1))
       AND m.is_deleted = false
       -- Noch nicht zugestellt
       AND NOT EXISTS (
         SELECT 1 FROM message_ingame_deliveries mid
         WHERE mid.message_id = m.id AND mid.recipient_minecraft_uuid = $2
       )
     ORDER BY m.created_at ASC
     LIMIT 50`,
    [userId, minecraftUuid]
  )

  const notifications = pendingResult.rows

  // Sofort als zugestellt markieren, damit der nächste Poll sie nicht erneut liefert.
  if (notifications.length > 0) {
    const values = notifications.map((n, i) => `($${i * 2 + 1}, $${i * 2 + 2})`).join(', ')
    const params = notifications.flatMap(n => [n.message_id, minecraftUuid])
    await pool.query(
      `INSERT INTO message_ingame_deliveries (message_id, recipient_minecraft_uuid)
       VALUES ${values}
       ON CONFLICT (message_id, recipient_minecraft_uuid) DO NOTHING`,
      params
    )
  }

  return NextResponse.json({ notifications })
}