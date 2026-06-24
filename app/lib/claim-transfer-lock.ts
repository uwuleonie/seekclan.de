import { pool } from './db'

// Prüft, ob für eine Gruppe aktuell eine offene Übertragungsanfrage existiert.
// Solange das der Fall ist, darf der aktuelle Owner nichts an der Gruppe ändern.
export async function isGroupLockedByTransfer(groupId: string | number): Promise<boolean> {
  const result = await pool.query(
    `SELECT id, expires_at FROM claim_transfers
     WHERE group_id = $1 AND status = 'pending' AND expires_at > $2
     LIMIT 1`,
    [groupId, new Date().toISOString()]
  )
  return result.rows.length > 0
}