import { pool } from '@/app/lib/db'
import { rangNachId, rangSetzen, rangVon, uuidSql } from '@/app/lib/rechte'
import { formatUuid, isUuid, isValidMcName, nameToProfile, uuidToName } from '@/app/lib/mojang'

// Minecraft-Account mit einem Website-Konto oder einer Clan-Akte verbinden – per /link im Spiel
// (app/api/minecraft/link) oder vom Team im Admin-Panel (PATCH /api/admin2/personen), ohne dass die Person online sein muss.

const N = uuidSql

/** Minecraft-Name oder UUID → { uuid, name } über Mojang. null, wenn es den Account nicht gibt. */
export async function minecraftProfil(eingabe: string): Promise<{ uuid: string; name: string } | null> {
  const t = eingabe.trim()
  if (isUuid(t)) {
    const name = await uuidToName(t)
    return name ? { uuid: formatUuid(t), name } : null
  }
  if (!isValidMcName(t)) return null
  return nameToProfile(t)
}

export class VerknuepfungsFehler extends Error {}

/**
 * Website-Konto mit Minecraft verbinden. Prüft, dass der Account nicht schon an einem anderen Konto hängt.
 * Ein Rang aus der Zeit ohne Minecraft (users.rang_id) wird mitgenommen, wenn er höher ist als der Rang im Spiel.
 * Eine Clan-Akte unter dem Minecraft-Namen ohne UUID bekommt die UUID.
 */
export async function kontoVerknuepfen(userId: string, uuid: string, name: string, von: string): Promise<void> {
  const anderes = (await pool.query(
    `SELECT username FROM users WHERE minecraft_uuid IS NOT NULL AND ${N('minecraft_uuid')} = ${N('$1')} AND id <> $2`, [uuid, userId]
  )).rows[0]
  if (anderes) throw new VerknuepfungsFehler(`Dieser Minecraft-Account ist schon mit dem Konto „${anderes.username}“ verbunden`)
  const vorher = (await pool.query('SELECT rang_id FROM users WHERE id = $1', [userId])).rows[0]
  if (!vorher) throw new VerknuepfungsFehler('Konto gibt es nicht')
  await pool.query('UPDATE users SET minecraft_username = $1, minecraft_uuid = $2, minecraft_linked_at = NOW() WHERE id = $3', [name, uuid, userId])
  if (vorher.rang_id) {
    const webRang = await rangNachId(vorher.rang_id)
    const mcRang = await rangVon({ uuid })
    if (webRang && webRang.prioritaet > mcRang.prioritaet) await rangSetzen({ userId }, webRang.id, von, { historie: false })
    else await pool.query('UPDATE users SET rang_id = NULL WHERE id = $1', [userId])
  }
  await pool.query(`UPDATE clan_members SET minecraft_uuid = $1 WHERE minecraft_uuid IS NULL AND lower(display_name) = lower($2)`, [uuid, name])
}

/** Minecraft-Verbindung eines Kontos lösen (Rang bleibt beim Minecraft-Spieler) */
export async function kontoLoesen(userId: string): Promise<void> {
  await pool.query('UPDATE users SET minecraft_username = NULL, minecraft_uuid = NULL, minecraft_linked_at = NULL WHERE id = $1', [userId])
}

/** Clan-Akte mit einem Minecraft-Account verbinden (Name in der Akte wird der aktuelle Minecraft-Name) */
export async function akteVerknuepfen(akteId: string, uuid: string, name: string): Promise<void> {
  const doppelt = (await pool.query(
    `SELECT display_name FROM clan_members WHERE minecraft_uuid IS NOT NULL AND ${N('minecraft_uuid')} = ${N('$1')} AND id <> $2`, [uuid, akteId]
  )).rows[0]
  if (doppelt) throw new VerknuepfungsFehler(`Für diesen Minecraft-Account gibt es schon eine Clan-Akte („${doppelt.display_name}“)`)
  const r = await pool.query('UPDATE clan_members SET minecraft_uuid = $1, display_name = $2 WHERE id = $3', [uuid, name, akteId])
  if (!r.rowCount) throw new VerknuepfungsFehler('Clan-Akte gibt es nicht')
}
