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
// LOGGING-HINWEIS (nach dem Debugging-Marathon vom 02.07.): Diese Route wird
// alle 5 Sekunden pro online Spieler vom Plugin-Poller aufgerufen und lief
// zuvor komplett stumm - ein Fehler hier war praktisch unsichtbar, weil weder
// diese Route noch der Poller irgendwas geloggt haben. Jetzt wird an jedem
// Entscheidungspunkt geloggt (Nutzer nicht gefunden/nicht verknüpft, keine
// Konversationen gefunden, wie viele Nachrichten gefunden wurden), damit ein
// künftiger Fehler in Sekunden statt Stunden sichtbar wird. Bei Bedarf können
// diese console.log-Zeilen später auf "nur bei Fehlern" reduziert werden,
// sobald das System eine Weile stabil lief.
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
// und überspringt sie. Bewusst noch nicht Teil dieser Änderung (siehe frühere
// Kommentare), aber jetzt mit sichtbarem Logging leichter nachzuholen.

async function resolveUser(minecraftUuid: string): Promise<{ userId: string | null; notificationsEnabled: boolean }> {
  const result = await pool.query(
    'SELECT id, ingame_chat_notifications_enabled FROM users WHERE minecraft_uuid = $1',
    [minecraftUuid]
  )
  const row = result.rows[0]
  if (!row) {
    console.log(`[pending-notifications] Kein Website-Account verknüpft für minecraft_uuid=${minecraftUuid} - läuft komplett über den Minecraft-UUID-Fallback.`)
    return { userId: null, notificationsEnabled: true } // nicht verknüpft: kein Opt-out möglich, daher an
  }
  // NULL (z.B. bei Bestandsnutzern ohne gesetzten Default) wird als "an" behandelt,
  // damit ein fehlender Wert nicht stillschweigend die gesamte Zustellung blockiert.
  const notificationsEnabled = row.ingame_chat_notifications_enabled !== false
  return { userId: row.id, notificationsEnabled }
}

export async function GET(req: NextRequest) {
  if (!await verifyPluginKey(req)) {
    console.warn('[pending-notifications] Ungültiger oder fehlender Plugin-Key.')
    return NextResponse.json({ error: 'Ungültiger API Key' }, { status: 401 })
  }

  const minecraftUuid = req.nextUrl.searchParams.get('minecraft_uuid')
  if (!minecraftUuid) {
    return NextResponse.json({ error: 'minecraft_uuid erforderlich' }, { status: 400 })
  }

  const { userId, notificationsEnabled } = await resolveUser(minecraftUuid)
  if (!notificationsEnabled) {
    console.log(`[pending-notifications] Benachrichtigungen deaktiviert für ${minecraftUuid}, liefere leer.`)
    return NextResponse.json({ notifications: [] })
  }

  let pendingResult
  try {
    // Alle Konversationen finden, in denen dieser Spieler Mitglied ist (verknüpft
    // über user_id ODER member_minecraft_uuid - beide Fälle abgedeckt).
    pendingResult = await pool.query(
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
         -- Nicht die eigene, selbst gesendete Nachricht benachrichtigen. Prüft den
         -- SENDER der Nachricht gegen die UUID/ID des Spielers, für den wir gerade
         -- pollen (also den EMPFÄNGER) - eine Nachricht wird nie an ihren eigenen
         -- Absender "zugestellt".
         AND m.sender_minecraft_uuid IS DISTINCT FROM $2
         AND ($1::uuid IS NULL OR m.sender_id IS DISTINCT FROM $1)
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
  } catch (err: any) {
    // Vorher: ein Fehler hier hätte die Route mit einem generischen 500 crashen
    // lassen, das der Poller stumm als "isSuccess() == false" verworfen hätte.
    console.error(`[pending-notifications] DB-Fehler bei der Suche nach Nachrichten für ${minecraftUuid}:`, err.message)
    return NextResponse.json({ error: `DB-Fehler: ${err.message}` }, { status: 500 })
  }

  const notifications = pendingResult.rows
  console.log(`[pending-notifications] ${minecraftUuid} (userId=${userId ?? 'null'}): ${notifications.length} neue Nachricht(en) gefunden.`)

  // Sofort als zugestellt markieren, damit der nächste Poll sie nicht erneut liefert.
  // displayed_at wird hier gesetzt (nicht erst beim tatsächlichen Rendern im Plugin) -
  // das ist eine bewusste Vereinfachung: sobald der Poller die Nachricht abholt, wird
  // sie so gut wie sofort (< 1 Sekunde später, im selben Tick) im Chat angezeigt, ein
  // zusätzlicher "hat der Client sie wirklich gerendert"-Bestätigungs-Roundtrip wäre
  // hier unnötige Komplexität für einen praktisch nicht messbaren Zeitunterschied.
  if (notifications.length > 0) {
    const values = notifications.map((n, i) => `($${i * 2 + 1}, $${i * 2 + 2}, now())`).join(', ')
    const params = notifications.flatMap(n => [n.message_id, minecraftUuid])
    try {
      await pool.query(
        `INSERT INTO message_ingame_deliveries (message_id, recipient_minecraft_uuid, displayed_at)
         VALUES ${values}
         ON CONFLICT (message_id, recipient_minecraft_uuid) DO NOTHING`,
        params
      )
    } catch (err: any) {
      console.error(`[pending-notifications] Konnte Zustellung nicht als erledigt markieren für ${minecraftUuid}:`, err.message)
      // Trotzdem die Nachrichten zurückgeben - besser doppelt angezeigt als gar nicht.
    }
  }

  return NextResponse.json({ notifications })
}