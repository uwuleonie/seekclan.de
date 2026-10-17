import type { NextRequest } from 'next/server'
import { pool } from '@/app/lib/db'
import { ALLE_RECHTE, darf, darfEins, mcFarbe, type Rang, type RechtKey } from '@/app/lib/rechte-def'
import { rangWechselEintragen, type Austritt } from '@/app/lib/clan-historie'

// Rechte und Ränge auf dem Server – siehe Erklärung in app/lib/rechte-def.ts.
//
//   const nutzer = await mitRecht(req, 'admin.verwalten')   // null = nicht angemeldet oder kein Recht
//   if (!nutzer) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })
//
// Tabellen: mc_ranks (Ränge, Spalten rechte/clan/team/web_farbe/beschreibung/schluessel),
//           mc_player_ranks (Minecraft-UUID → Rang), users.rang_id (Rang für Konten ohne Minecraft),
//           system_einstellungen ('raenge_umgestellt' – bis dahin gelten zusätzlich die alten Website-Rollen).

export { darf, darfEins }
export type { Rang, RechtKey }

/** UUID ohne Bindestriche, klein – für Vergleiche in SQL (Spieler-UUIDs kommen mal mit, mal ohne Bindestriche) */
export const uuidSql = (spalte: string) => `lower(replace(${spalte}, '-', ''))`

/**
 * SQL-Baustein: Rang einer users-Zeile dazuholen, wie ihn die Website zeigt (Alias des Rangs: r, Spalten wie mc_ranks).
 * Ränge mit „nur im Spiel“ zählen hier als Standard-Rang.
 *   SELECT u.username, r.display_name FROM users u ${rangJoin('u', 'r')}
 * (nur_ingame wird über to_jsonb gelesen – so geht es auch, solange die Spalte noch nicht angelegt ist)
 */
export const rangJoin = (u = 'u', r = 'r') =>
  `LEFT JOIN mc_player_ranks ${r}_pr ON ${u}.minecraft_uuid IS NOT NULL AND ${uuidSql(`${r}_pr.uuid`)} = ${uuidSql(`${u}.minecraft_uuid`)}
   LEFT JOIN mc_ranks ${r}_x ON ${r}_x.id = COALESCE(${r}_pr.rank_id, ${u}.rang_id)
   LEFT JOIN mc_ranks ${r} ON ${r}.id = CASE WHEN ${r}_x.id IS NULL OR COALESCE((to_jsonb(${r}_x) ->> 'nur_ingame')::boolean, false)
                                             THEN (SELECT id FROM mc_ranks WHERE is_default ORDER BY id LIMIT 1) ELSE ${r}_x.id END`

/** SQL-Baustein: Anzeigename eines Rangs ohne Minecraft-Farbcodes */
export const rangNameSql = (r = 'r') => `regexp_replace(COALESCE(NULLIF(${r}.display_name, ''), ${r}.name), '[§&][0-9a-fk-or]', '', 'gi')`

/* ───────────── Ränge laden (kurz zwischengespeichert) ───────────── */

interface RangZeile {
  id: number; name: string; display_name: string; color: string | null; web_farbe: string | null; priority: number
  rechte: unknown; clan: boolean | null; team: boolean | null; beschreibung: string | null; schluessel: string | null
  can_assign_up_to_priority: number | null; is_default: boolean | null; nur_ingame?: boolean | null
}

/** Minecraft-Farbcodes (§6, &l …) entfernen – für die Anzeige auf der Website */
export const ohneFarbcodes = (t: string | null | undefined) => (t ?? '').replace(/[§&][0-9a-fk-or]/gi, '').trim()

export function rangAusZeile(r: RangZeile): Rang {
  const rechte = Array.isArray(r.rechte) ? r.rechte.map(String) : typeof r.rechte === 'string' ? (() => { try { return JSON.parse(r.rechte as string) } catch { return [] } })() : []
  return {
    id: Number(r.id), schluessel: r.schluessel ?? null, name: r.name, anzeige: ohneFarbcodes(r.display_name) || r.name,
    farbe: r.web_farbe || mcFarbe(r.color) || '#9ca3af', prioritaet: Number(r.priority ?? 0), rechte,
    clan: !!r.clan, team: !!r.team, beschreibung: r.beschreibung ?? null, nurIngame: !!r.nur_ingame,
    vergabeBis: r.can_assign_up_to_priority == null ? -1 : Number(r.can_assign_up_to_priority), standard: !!r.is_default,
  }
}

let cache: { t: number; raenge: Rang[]; umgestellt: boolean } | null = null
export function rangCacheLeeren() { cache = null }

async function stand() {
  if (cache && Date.now() - cache.t < 10_000) return cache
  const [r, e] = await Promise.all([
    pool.query('SELECT * FROM mc_ranks ORDER BY priority DESC, id ASC').catch(() => ({ rows: [] as RangZeile[] })),
    pool.query(`SELECT value FROM system_einstellungen WHERE key = 'raenge_umgestellt'`).catch(() => ({ rows: [] as { value: unknown }[] })),
  ])
  cache = { t: Date.now(), raenge: r.rows.map(rangAusZeile), umgestellt: e.rows[0]?.value === true }
  return cache
}
/** Alle Ränge, höchste Priorität zuerst */
export const alleRaenge = async () => (await stand()).raenge
export const rangNachId = async (id: number | null | undefined) => (id == null ? null : (await stand()).raenge.find(r => r.id === Number(id)) ?? null)
/** Standard-Rang (Spieler) – den bekommt jeder ohne eigenen Rang */
export async function standardRang(): Promise<Rang> {
  const rs = (await stand()).raenge
  return rs.find(r => r.standard) ?? rs[rs.length - 1] ?? { id: 0, schluessel: 'spieler', name: 'Spieler', anzeige: 'Spieler', farbe: '#9ca3af', prioritaet: 0, rechte: [], clan: false, team: false, beschreibung: null, nurIngame: false, vergabeBis: -1, standard: true }
}
/** Rang, wie er auf der Website zählt: „nur im Spiel“-Ränge → Standard-Rang */
export async function webRang(r: Rang | null | undefined): Promise<Rang> {
  return r && !r.nurIngame ? r : standardRang()
}
/** Ist die Umstellung vom alten System (Website-Rolle, Clan-Rolle) schon gelaufen? */
export const istUmgestellt = async () => (await stand()).umgestellt

/* ───────────── Übergang: alte Website-Rollen ───────────── */

// Bis die Umstellung unter /admin2/raenge gelaufen ist, behalten alle ihre bisherigen Rechte aus users.clan_role.
// Danach zählt nur noch der Rang. (Werte wie bisher im Code: owner = alles, administrator = Admin, teammitglied = Team)
const ALTE_ROLLEN_RECHTE: Record<string, string[]> = {
  owner: [ALLE_RECHTE],
  administrator: ['admin.zugang', 'admin.teambereiche', 'admin.verwalten', 'support.team', 'konten.verwalten', 'clan.verwalten', 'raenge.vergeben', 'raenge.bearbeiten', 'privat.zugang'],
  teammitglied: ['admin.zugang', 'admin.teambereiche', 'support.team'],
}

/* ───────────── Angemeldete Person ───────────── */

export interface Nutzer {
  id: string
  username: string
  /** Anzeigename: Spitzname (wenn nach der Minecraft-Verknüpfung gesetzt) > Minecraft-Name > Username */
  name: string
  minecraft_uuid: string | null
  minecraft_username: string | null
  rang: Rang
  rechte: string[]
}

/** Angemeldete Person aus dem Cookie session_token (abgelaufene Sitzungen zählen nicht) */
export async function nutzerAusAnfrage(req: NextRequest): Promise<Nutzer | null> {
  const token = req.cookies.get('session_token')?.value
  return token ? nutzerAusToken(token) : null
}

export async function nutzerAusToken(token: string): Promise<Nutzer | null> {
  let u
  try {
    u = (await pool.query(
      `SELECT u.id, u.username, u.anzeigename, u.minecraft_uuid, u.minecraft_username, u.clan_role, u.rang_id, pr.rank_id, s.expires_at
         FROM sessions s
         JOIN users u ON u.id = s.user_id
         LEFT JOIN mc_player_ranks pr ON u.minecraft_uuid IS NOT NULL AND ${uuidSql('pr.uuid')} = ${uuidSql('u.minecraft_uuid')}
        WHERE s.token = $1
        LIMIT 1`,
      [token]
    )).rows[0]
  } catch (e) {
    // Fehlen die neuen Spalten (Datenbank-Befehle fürs Rang-System noch nicht ausgeführt), bleibt man trotzdem
    // eingeloggt – mit den alten Website-Rollen.
    console.error('Rang-System: neue Spalten fehlen? Bitte die Datenbank-Befehle ausführen.', e instanceof Error ? e.message : e)
    u = (await pool.query(
      `SELECT u.id, u.username, u.minecraft_uuid, u.minecraft_username, u.clan_role, s.expires_at
         FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = $1 LIMIT 1`,
      [token]
    )).rows[0]
  }
  if (!u) return null
  // Ablauf in JavaScript prüfen (funktioniert egal, wie expires_at in der Datenbank gespeichert ist)
  if (u.expires_at && new Date(u.expires_at).getTime() < Date.now()) return null
  return nutzerAusZeile(u)
}

/** Person aus einer users-Zeile (mit rank_id aus mc_player_ranks, rang_id, clan_role) */
export async function nutzerAusZeile(u: { id: string; username: string; anzeigename?: string | null; minecraft_uuid: string | null; minecraft_username: string | null; clan_role?: string | null; rang_id?: number | null; rank_id?: number | null }): Promise<Nutzer> {
  const rang = await webRang(await rangNachId(u.rank_id ?? u.rang_id))
  let rechte = rang.rechte
  if (!(await istUmgestellt())) rechte = [...new Set([...rechte, ...(ALTE_ROLLEN_RECHTE[u.clan_role ?? ''] ?? [])])]
  return {
    id: String(u.id), username: u.username, name: u.anzeigename || u.minecraft_username || u.username,
    minecraft_uuid: u.minecraft_uuid, minecraft_username: u.minecraft_username, rang, rechte,
  }
}

/** Angemeldet und hat (eins der) Rechte? Sonst null. Ohne Rechte-Angabe: nur angemeldet. */
export async function mitRecht(req: NextRequest, ...rechte: RechtKey[]): Promise<Nutzer | null> {
  const n = await nutzerAusAnfrage(req)
  if (!n) return null
  return !rechte.length || darfEins(n, ...rechte) ? n : null
}

/** Alle Website-Konten mit einem Recht (z. B. für Benachrichtigungen ans Team) */
export async function kontenMitRecht(recht: RechtKey): Promise<{ id: string; username: string; name: string }[]> {
  const r = await pool.query(
    `SELECT u.id, u.username, u.anzeigename, u.minecraft_uuid, u.minecraft_username, u.clan_role, u.rang_id, pr.rank_id
       FROM users u
       LEFT JOIN mc_player_ranks pr ON u.minecraft_uuid IS NOT NULL AND ${uuidSql('pr.uuid')} = ${uuidSql('u.minecraft_uuid')}
      WHERE COALESCE(u.is_deactivated, false) = false`
  )
  const out = []
  for (const row of r.rows) {
    const n = await nutzerAusZeile(row)
    if (darf(n, recht)) out.push({ id: n.id, username: n.username, name: n.name })
  }
  return out
}

/* ───────────── Rang einer Person setzen ───────────── */

export interface Person { userId?: string | null; uuid?: string | null; name?: string | null }

/**
 * Gibt einer Person einen Rang – die EINZIGE Stelle, die Ränge schreibt (außer dem Plugin über /api/internal/player-rank).
 * Mit Minecraft-UUID → mc_player_ranks (das Plugin liest es), sonst users.rang_id.
 * Clan-Ränge legen eine Clan-Akte an, falls die Person noch keine hat (Beitritt heute).
 * Wechsel in den Clan, aus dem Clan oder innerhalb des Clans landen automatisch in der Clan-Historie
 * (opts.historie = false: nicht eintragen; opts.austritt: verlassen / geworfen / entfernt beim Rausgehen).
 */
export async function rangSetzen(p: Person, rangId: number, von: string, opts: { historie?: boolean; austritt?: Austritt; zeit?: Date | string | null } = {}): Promise<void> {
  const rang = await rangNachId(rangId)
  if (!rang) throw new Error('Rang gibt es nicht')
  let uuid = p.uuid ?? null
  let name = p.name ?? null
  if (p.userId) {
    const u = (await pool.query('SELECT minecraft_uuid, minecraft_username, username FROM users WHERE id = $1', [p.userId])).rows[0]
    if (!u) throw new Error('Konto gibt es nicht')
    uuid = uuid ?? u.minecraft_uuid
    name = name ?? u.minecraft_username ?? u.username
  }
  const alt = opts.historie === false ? null : await rangVon({ userId: p.userId, uuid })
  if (uuid) {
    await spielerRangSchreiben(pool, uuid, name ?? '', rang.id, von)
    await pool.query(`UPDATE users SET rang_id = NULL WHERE minecraft_uuid IS NOT NULL AND ${uuidSql('minecraft_uuid')} = ${uuidSql('$1')}`, [uuid])
  } else if (p.userId) {
    await pool.query('UPDATE users SET rang_id = $1 WHERE id = $2', [rang.id, p.userId])
  } else {
    throw new Error('Person ohne Konto und ohne Minecraft-UUID')
  }
  if (rang.clan && uuid) {
    await pool.query(
      `INSERT INTO clan_members (display_name, role, join_date, minecraft_uuid)
       SELECT $1, $2, NOW(), $3 WHERE NOT EXISTS (SELECT 1 FROM clan_members WHERE minecraft_uuid IS NOT NULL AND ${uuidSql('minecraft_uuid')} = ${uuidSql('$3')})`,
      [name ?? '', rang.anzeige, uuid]
    )
  }
  if (alt && name) await rangWechselEintragen({ name, uuid }, alt, rang, von, opts.austritt, opts.zeit).catch(() => {})
}

/**
 * Rang eines Minecraft-Spielers in mc_player_ranks schreiben. Gibt es schon eine Zeile mit derselben UUID (egal ob mit
 * oder ohne Bindestriche), wird sie geändert – sonst neu angelegt, mit Bindestrichen wie im Spiel (Plugin).
 */
export async function spielerRangSchreiben(db: { query: typeof pool.query }, uuid: string, name: string, rangId: number, von: string) {
  const u = await db.query(
    `UPDATE mc_player_ranks SET rank_id = $2, assigned_by = $3, assigned_at = now(), player_name = COALESCE(NULLIF($4, ''), player_name)
      WHERE ${uuidSql('uuid')} = ${uuidSql('$1')}`,
    [uuid, rangId, von, name]
  )
  if (!u.rowCount) {
    const h = uuid.replace(/-/g, '').toLowerCase()
    const mitStrichen = h.length === 32 ? `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}` : uuid
    await db.query('INSERT INTO mc_player_ranks (uuid, player_name, rank_id, assigned_by) VALUES ($1, $2, $3, $4)', [mitStrichen, name, rangId, von])
  }
}

/** Aktueller Rang einer Person (über Konto oder UUID) */
export async function rangVon(p: Person): Promise<Rang> {
  let rankId: number | null = null
  if (p.uuid) {
    rankId = (await pool.query(`SELECT rank_id FROM mc_player_ranks WHERE ${uuidSql('uuid')} = ${uuidSql('$1')}`, [p.uuid])).rows[0]?.rank_id ?? null
  }
  if (rankId == null && p.userId) {
    const u = (await pool.query(
      `SELECT u.rang_id, pr.rank_id FROM users u
         LEFT JOIN mc_player_ranks pr ON u.minecraft_uuid IS NOT NULL AND ${uuidSql('pr.uuid')} = ${uuidSql('u.minecraft_uuid')}
        WHERE u.id = $1`, [p.userId])).rows[0]
    rankId = u?.rank_id ?? u?.rang_id ?? null
  }
  return (await rangNachId(rankId)) ?? (await standardRang())
}
