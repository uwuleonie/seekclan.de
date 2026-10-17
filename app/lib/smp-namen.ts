// SMP: Anzeigename zu einer Minecraft-UUID (für Spieler mit seekclan-Account).
// Spieler ohne Account behalten den übergebenen Fallback (meist der gespeicherte Minecraft-Name).
// Nur zur ANZEIGE verwenden – Köpfe (/api/player-heads), Links und Abgleiche bleiben beim Minecraft-Namen bzw. der UUID.

/** SQL-Ausdruck: Anzeigename des Accounts mit dieser UUID, sonst `fallbackSql` */
export function mcAnzeigenameSql(uuidSql: string, fallbackSql: string): string {
  return `COALESCE((SELECT u_an.anzeigename FROM users u_an WHERE u_an.minecraft_uuid::text = (${uuidSql})::text AND u_an.anzeigename IS NOT NULL LIMIT 1), ${fallbackSql})`
}
