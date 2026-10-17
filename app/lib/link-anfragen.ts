import { pool } from '@/app/lib/db'
import { uuidSql } from '@/app/lib/rechte'
import { akteVerknuepfen, kontoVerknuepfen, minecraftProfil, VerknuepfungsFehler } from '@/app/lib/minecraft-konto'

// Clan-Freischaltung: Wer in der Clan-Liste steht (Clan-Akte in clan_members), kann sich statt /link im Spiel
// auch vom Team freischalten lassen. Anfragen liegen in minecraft_link_anfragen, bearbeitet werden sie unter /admin2/clan.
//   status: offen | angenommen | abgelehnt | zurueckgezogen | erledigt (hat sich inzwischen selbst per /link verbunden)

const N = uuidSql

/** Clan-Akte mit diesem Namen, die noch mit keinem Website-Konto verbunden ist – sonst null */
export async function freieAkte(name: string): Promise<{ id: string; name: string } | null> {
  const n = name.trim()
  if (n.length < 2 || n.length > 40) return null
  const r = await pool.query(
    `SELECT cm.id, cm.display_name FROM clan_members cm
      WHERE lower(cm.display_name) = lower($1)
        AND NOT EXISTS (
          SELECT 1 FROM users u
           WHERE (cm.minecraft_uuid IS NOT NULL AND u.minecraft_uuid IS NOT NULL AND ${N('u.minecraft_uuid')} = ${N('cm.minecraft_uuid')})
              OR lower(u.minecraft_username) = lower(cm.display_name))
      LIMIT 1`,
    [n]
  )
  const a = r.rows[0]
  return a ? { id: String(a.id), name: a.display_name } : null
}

export interface Anfrage {
  id: number; status: string; nachricht: string | null; grund: string | null
  erstelltAm: string; bearbeitetAm: string | null; bearbeitetVon: string | null
  akteId: string; akteName: string; userId: string; username: string
}

const AUSWAHL = `SELECT a.id, a.status, a.nachricht, a.grund, a.erstellt_am, a.bearbeitet_am, a.bearbeitet_von,
                        a.akte_id, cm.display_name AS akte_name, a.user_id, u.username
                   FROM minecraft_link_anfragen a
                   JOIN clan_members cm ON cm.id = a.akte_id
                   JOIN users u ON u.id = a.user_id`

const iso = (d: unknown) => new Date(d as string).toISOString()

function zeile(r: Record<string, unknown>): Anfrage {
  return {
    id: Number(r.id), status: String(r.status), nachricht: (r.nachricht as string) ?? null, grund: (r.grund as string) ?? null,
    erstelltAm: iso(r.erstellt_am), bearbeitetAm: r.bearbeitet_am ? iso(r.bearbeitet_am) : null, bearbeitetVon: (r.bearbeitet_von as string) ?? null,
    akteId: String(r.akte_id), akteName: String(r.akte_name), userId: String(r.user_id), username: String(r.username),
  }
}

/** Neueste Anfrage eines Kontos */
export async function anfrageVon(userId: string): Promise<Anfrage | null> {
  const r = await pool.query(`${AUSWAHL} WHERE a.user_id = $1 ORDER BY a.erstellt_am DESC LIMIT 1`, [userId])
  return r.rows[0] ? zeile(r.rows[0]) : null
}

/** Für das Admin-Panel: alle offenen und die letzten 20 bearbeiteten */
export async function anfragenListe(): Promise<{ offen: Anfrage[]; zuletzt: Anfrage[] }> {
  const [o, z] = await Promise.all([
    pool.query(`${AUSWAHL} WHERE a.status = 'offen' ORDER BY a.erstellt_am ASC`),
    pool.query(`${AUSWAHL} WHERE a.status <> 'offen' ORDER BY a.bearbeitet_am DESC NULLS LAST LIMIT 20`),
  ])
  return { offen: o.rows.map(zeile), zuletzt: z.rows.map(zeile) }
}

/** Anfrage stellen (eine offene pro Konto) */
export async function anfrageStellen(userId: string, akteName: string, nachricht: string): Promise<Anfrage> {
  const akte = await freieAkte(akteName)
  if (!akte) throw new VerknuepfungsFehler('Diesen Namen gibt es nicht in der Clan-Liste (oder er ist schon mit einem Konto verbunden). Verbinde dich mit /link im Spiel.')
  const offen = await anfrageVon(userId)
  if (offen?.status === 'offen') throw new VerknuepfungsFehler('Du hast schon eine offene Anfrage.')
  await pool.query(
    'INSERT INTO minecraft_link_anfragen (user_id, akte_id, nachricht) VALUES ($1, $2, $3)',
    [userId, akte.id, nachricht.trim().slice(0, 500) || null]
  )
  return (await anfrageVon(userId))!
}

export async function anfrageZurueckziehen(userId: string): Promise<void> {
  await pool.query(
    `UPDATE minecraft_link_anfragen SET status = 'zurueckgezogen', bearbeitet_am = now(), bearbeitet_von = 'selbst' WHERE user_id = $1 AND status = 'offen'`,
    [userId]
  )
}

/**
 * Anfrage annehmen: Konto mit dem Minecraft-Account der Clan-Akte verbinden (Rang, Clan-Akte, Name – wie bei /link).
 * Hat die Akte noch keine UUID, wird sie über Mojang anhand des Namens gesucht.
 * Andere offene Anfragen für dieselbe Akte werden abgelehnt.
 */
export async function anfrageAnnehmen(id: number, von: string): Promise<Anfrage> {
  const a = (await pool.query(
    `SELECT a.*, cm.display_name, cm.minecraft_uuid FROM minecraft_link_anfragen a JOIN clan_members cm ON cm.id = a.akte_id WHERE a.id = $1`, [id]
  )).rows[0]
  if (!a) throw new VerknuepfungsFehler('Anfrage gibt es nicht')
  if (a.status !== 'offen') throw new VerknuepfungsFehler('Anfrage ist schon bearbeitet')

  let uuid: string | null = a.minecraft_uuid
  let name: string = a.display_name
  if (!uuid) {
    const prof = await minecraftProfil(a.display_name)
    if (!prof) throw new VerknuepfungsFehler(`Mojang kennt „${a.display_name}“ nicht (oder ist gerade nicht erreichbar) – weise der Clan-Akte zuerst über „Minecraft zuweisen“ den richtigen Account zu.`)
    uuid = prof.uuid; name = prof.name
    await akteVerknuepfen(String(a.akte_id), uuid, name)
  }

  await kontoVerknuepfen(String(a.user_id), uuid, name, von)
  await pool.query(`UPDATE minecraft_link_anfragen SET status = 'angenommen', bearbeitet_am = now(), bearbeitet_von = $2 WHERE id = $1`, [id, von])
  await pool.query(
    `UPDATE minecraft_link_anfragen SET status = 'abgelehnt', bearbeitet_am = now(), bearbeitet_von = $2, grund = 'Clan-Akte gehört zu einem anderen Konto'
      WHERE akte_id = $1 AND status = 'offen'`,
    [a.akte_id, von]
  )
  return (await pool.query(`${AUSWAHL} WHERE a.id = $1`, [id]).then(r => zeile(r.rows[0])))
}

export async function anfrageAblehnen(id: number, von: string, grund: string): Promise<void> {
  const r = await pool.query(
    `UPDATE minecraft_link_anfragen SET status = 'abgelehnt', bearbeitet_am = now(), bearbeitet_von = $2, grund = $3 WHERE id = $1 AND status = 'offen'`,
    [id, von, grund.trim().slice(0, 300) || null]
  )
  if (!r.rowCount) throw new VerknuepfungsFehler('Anfrage gibt es nicht oder ist schon bearbeitet')
}
