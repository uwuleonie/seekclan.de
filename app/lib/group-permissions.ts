import { pool } from '@/app/lib/db'

/**
 * Prüft, ob der Nutzer in dieser Konversation (Gruppe) ein bestimmtes Recht hat.
 * Holt die Rolle des Nutzers und schaut im permissions-JSONB nach dem Key.
 * Gibt false zurück, wenn der Nutzer gar keine Rolle in der Gruppe hat (sollte
 * eigentlich nicht vorkommen, da jedes Mitglied bei Erstellung/Beitritt eine
 * Rolle bekommen sollte - sicherheitshalber aber defensiv behandelt).
 */
export async function hasGroupPermission(
  conversationId: string,
  userId: string,
  permission: string
): Promise<boolean> {
  const result = await pool.query(
    `SELECT cr.permissions, cr.is_owner_role
     FROM conversation_role_members crm
     JOIN conversation_roles cr ON cr.id = crm.role_id
     WHERE crm.user_id = $1 AND cr.conversation_id = $2`,
    [userId, conversationId]
  )
  const role = result.rows[0]
  if (!role) return false
  // Owner-Rolle hat implizit IMMER alle Rechte, unabhängig vom permissions-Inhalt
  // (schützt davor, dass sich der Owner versehentlich selbst aussperrt).
  if (role.is_owner_role) return true
  return role.permissions?.[permission] === true
}

/**
 * Zählt die aktuellen Mitglieder einer Konversation (für das Größenlimit).
 */
export async function countGroupMembers(conversationId: string): Promise<number> {
  const result = await pool.query(
    'SELECT COUNT(*) AS count FROM conversation_members WHERE conversation_id = $1',
    [conversationId]
  )
  return parseInt(result.rows[0]?.count || '0', 10)
}