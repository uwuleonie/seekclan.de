import { pool } from './db'

// Zentrale Bearbeiten-Logik (Konzeptdokument Abschnitt 6 + 13.2): volle Historie,
// jede Bearbeitung wird als eigener Eintrag in message_edits protokolliert, die
// Nachricht selbst behält immer den aktuellen Inhalt + einen edited_at-Zeitstempel.
// Wird sowohl von der Website-Bearbeiten-Route als auch vom Plugin-/edit-last-
// Befehl genutzt, damit beide Wege exakt dasselbe Verhalten haben.

export type EditResult =
  | { success: true; messageId: string }
  | { success: false; error: string }

/**
 * Bearbeitet eine Nachricht: schreibt den bisherigen Inhalt in die Historie
 * (message_edits) und aktualisiert den Nachrichtentext. Prüft NICHT die
 * Berechtigung (wer darf bearbeiten) - das macht die aufrufende Route, da sich
 * das zwischen Website (eingeloggter Nutzer) und Plugin (Minecraft-Spieler)
 * unterscheidet.
 */
export async function editMessage(
  messageId: string,
  newContent: string,
  editor: { userId: string | null; minecraftUuid: string | null }
): Promise<EditResult> {
  const trimmed = newContent.trim()
  if (!trimmed) return { success: false, error: 'Neuer Inhalt darf nicht leer sein' }

  const current = await pool.query('SELECT content FROM messages WHERE id = $1 AND is_deleted = false', [messageId])
  if (current.rows.length === 0) {
    return { success: false, error: 'Nachricht nicht gefunden' }
  }
  const previousContent = current.rows[0].content

  try {
    await pool.query(
      `INSERT INTO message_edits (message_id, previous_content, new_content, edited_by, edited_by_minecraft_uuid)
       VALUES ($1, $2, $3, $4, $5)`,
      [messageId, previousContent, trimmed, editor.userId, editor.minecraftUuid]
    )
    await pool.query(
      `UPDATE messages SET content = $1, edited_at = now() WHERE id = $2`,
      [trimmed, messageId]
    )
  } catch (err: any) {
    return { success: false, error: err.message }
  }

  return { success: true, messageId }
}

/**
 * Findet die zuletzt gesendete (nicht gelöschte) Nachricht eines Spielers -
 * für /edit-last. Sucht sowohl über user_id (verknüpfte Accounts) als auch
 * über sender_minecraft_uuid (nicht verknüpfte Spieler).
 */
export async function findLastMessageBySender(
  userId: string | null,
  minecraftUuid: string | null
): Promise<{ id: string } | null> {
  const result = await pool.query(
    `SELECT id FROM messages
     WHERE is_deleted = false
       AND (($1::uuid IS NOT NULL AND sender_id = $1) OR ($2::text IS NOT NULL AND sender_minecraft_uuid = $2))
     ORDER BY created_at DESC
     LIMIT 1`,
    [userId, minecraftUuid]
  )
  return result.rows[0] || null
}