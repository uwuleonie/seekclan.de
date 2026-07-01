import { pool } from './db'

// Erkennt und speichert Links aus Nachrichten (Konzeptdokument Abschnitt 5).
// Wird nach JEDEM Nachrichten-Insert aufgerufen (Website UND Plugin-Route),
// egal welcher Kanal - Global, GC, MSG, Gruppe, Web.

// Bewusst simple, robuste URL-Erkennung: http(s):// gefolgt von Nicht-Leerzeichen.
// Erkennt KEINE URLs ohne Protokoll (z.B. "seekclan.de" ohne https://) - das ist
// eine bewusste Vereinfachung, um False-Positives (z.B. "das ist mega.geil") zu
// vermeiden. Kann bei Bedarf später erweitert werden.
const URL_REGEX = /https?:\/\/[^\s<>"']+/g

export function extractUrls(text: string | null | undefined): string[] {
  if (!text) return []
  const matches = text.match(URL_REGEX)
  if (!matches) return []
  // Trailing Satzzeichen abschneiden (z.B. "https://seekclan.de." am Satzende, oder "(https://x.de)")
  return matches.map(url => url.replace(/[.,;:!?)\]]+$/, ''))
}

type LinkSender = { userId: string | null; minecraftUuid: string | null; minecraftUsername: string | null }

/**
 * Extrahiert Links aus dem Nachrichteninhalt und speichert sie in chat_links.
 * Wirft absichtlich keine Fehler nach außen (best effort) - ein fehlgeschlagener
 * Link-Index darf niemals das eigentliche Senden der Nachricht verhindern.
 */
export async function indexLinksInMessage(
  messageId: string,
  conversationId: string,
  content: string | null | undefined,
  sender: LinkSender
): Promise<void> {
  const urls = extractUrls(content)
  if (urls.length === 0) return

  try {
    for (const url of urls) {
      await pool.query(
        `INSERT INTO chat_links (message_id, conversation_id, sender_id, url, sender_minecraft_uuid, sender_minecraft_username)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [messageId, conversationId, sender.userId, url, sender.minecraftUuid, sender.minecraftUsername]
      )
    }
  } catch (err) {
    console.error('Link-Indexierung fehlgeschlagen für Nachricht', messageId, err)
  }
}