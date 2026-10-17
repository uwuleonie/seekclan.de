import { pool } from '@/app/lib/db'
import type { Rang } from '@/app/lib/rechte-def'
import { ARTEN, verlauf, type Art, type Eintrag, type Verlauf } from '@/app/lib/clan-historie-def'

// Clan-Historie in der Datenbank (Tabelle clan_historie). Erklärung der Einträge: app/lib/clan-historie-def.ts
//   - von Hand: /admin2/clan → Historie (jede Zeit, auch jetzt)
//   - automatisch: rangSetzen() in app/lib/rechte.ts und /api/internal/player-rank (Plugin) melden Rangwechsel hierher
//   - Import des alten Verlaufs: /api/admin2/clan-historie/import
// Diese Datei importiert nichts aus rechte.ts (rechte.ts ruft hierher auf).

const SPALTEN = `id, zeit, zeit_genau, art, spieler, von, rang, notiz, quelle, original`

function zeile(r: Record<string, unknown>): Eintrag {
  return {
    id: Number(r.id), zeit: new Date(r.zeit as string).toISOString(), genau: r.zeit_genau !== false, art: r.art as Art,
    spieler: String(r.spieler), von: (r.von as string) ?? null, rang: (r.rang as string) ?? null, notiz: (r.notiz as string) ?? null,
    quelle: String(r.quelle ?? 'website'), original: (r.original as string) ?? null,
  }
}

let cache: { t: number; alle: Eintrag[] } | null = null
export function historieCacheLeeren() { cache = null }

/** Alle Einträge, ältester zuerst (kurz zwischengespeichert). Fehlt die Tabelle noch: leer. */
export async function alleEintraege(): Promise<Eintrag[]> {
  if (cache && Date.now() - cache.t < 15_000) return cache.alle
  try {
    const r = await pool.query(`SELECT ${SPALTEN} FROM clan_historie ORDER BY zeit ASC, reihe ASC, id ASC`)
    cache = { t: Date.now(), alle: r.rows.map(zeile) }
  } catch (e) {
    console.error('clan_historie fehlt? Bitte den Datenbank-Befehl ausführen.', e instanceof Error ? e.message : e)
    cache = { t: Date.now(), alle: [] }
  }
  return cache.alle
}

/** Einträge, in denen die Person vorkommt (als Betroffene oder als ausführende Person) */
export async function eintraegeVon(name: string): Promise<{ betrifft: Eintrag[]; ausgefuehrt: Eintrag[] }> {
  const n = name.toLowerCase()
  const alle = await alleEintraege()
  return { betrifft: alle.filter(e => e.spieler.toLowerCase() === n), ausgefuehrt: alle.filter(e => e.von?.toLowerCase() === n) }
}

/** Verlauf (Mitgliedschaften) je Person, Schlüssel = Name klein */
export async function verlaeufe(): Promise<Map<string, { name: string; verlauf: Verlauf; anzahl: number; letzte: Eintrag }>> {
  const proPerson = new Map<string, Eintrag[]>()
  for (const e of await alleEintraege()) {
    const k = e.spieler.toLowerCase()
    const l = proPerson.get(k) ?? []
    l.push(e); proPerson.set(k, l)
  }
  const out = new Map<string, { name: string; verlauf: Verlauf; anzahl: number; letzte: Eintrag }>()
  for (const [k, es] of proPerson) out.set(k, { name: es[es.length - 1].spieler, verlauf: verlauf(es), anzahl: es.length, letzte: es[es.length - 1] })
  return out
}

export interface NeuerEintrag {
  zeit?: string | Date | null
  genau?: boolean
  art: Art
  spieler: string
  spielerUuid?: string | null
  von?: string | null
  rang?: string | null
  notiz?: string | null
  quelle?: string
  erstelltVon?: string | null
}

export function eintragPruefen(b: Record<string, unknown>): NeuerEintrag | string {
  const art = String(b.art ?? '') as Art
  if (!ARTEN.includes(art)) return 'Unbekannte Art'
  const spieler = String(b.spieler ?? '').trim().slice(0, 40)
  if (!spieler) return 'Name fehlt'
  const zeit = b.zeit ? new Date(String(b.zeit)) : new Date()
  if (isNaN(zeit.getTime())) return 'Ungültige Zeit'
  const t = (v: unknown, max: number) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null)
  return { zeit, genau: b.genau !== false, art, spieler, von: t(b.von, 40), rang: t(b.rang, 60), notiz: t(b.notiz, 500) }
}

export async function eintragen(e: NeuerEintrag): Promise<Eintrag | null> {
  try {
    const r = await pool.query(
      `INSERT INTO clan_historie (zeit, zeit_genau, art, spieler, spieler_uuid, von, rang, notiz, quelle, erstellt_von)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING ${SPALTEN}`,
      [e.zeit ? new Date(e.zeit).toISOString() : new Date().toISOString(), e.genau !== false, e.art, e.spieler, e.spielerUuid ?? null,
        e.von ?? null, e.rang ?? null, e.notiz ?? null, e.quelle ?? 'website', e.erstelltVon ?? null]
    )
    historieCacheLeeren()
    return zeile(r.rows[0])
  } catch (err) {
    console.error('Clan-Historie: Eintrag nicht gespeichert', err instanceof Error ? err.message : err)
    return null
  }
}

/** Was beim Entfernen aus dem Clan eingetragen wird */
export type Austritt = 'verlassen' | 'geworfen' | 'entfernt'

/**
 * Rangwechsel → automatischer Eintrag:
 *   kein Clan-Rang → Clan-Rang   „X wurde von V in den Clan aufgenommen“ (oder „ist beigetreten“, wenn es aus dem Spiel kam)
 *   Clan-Rang → kein Clan-Rang   „verlassen“ / „geworfen“ / „entfernt“ (austritt; ohne Angabe: entfernt)
 *   Clan-Rang → anderer Clan-Rang  befördert/degradiert (nach Priorität)
 */
export async function rangWechselEintragen(
  person: { name: string; uuid?: string | null }, alt: Pick<Rang, 'clan' | 'prioritaet' | 'anzeige' | 'id'>, neu: Pick<Rang, 'clan' | 'prioritaet' | 'anzeige' | 'id'>,
  von: string | null, austritt?: Austritt, zeit?: Date | string | null
): Promise<void> {
  if (!person.name || alt.id === neu.id) return
  const v = von && !['ingame', 'umstellung', 'verknuepfung'].includes(von) ? von : null
  // Website-Rang „Clan“ heißt im Verlauf wie im Spiel „Clan-Mitglied“
  const rangName = (r: { anzeige: string }) => (r.anzeige.trim().toLowerCase() === 'clan' ? 'Clan-Mitglied' : r.anzeige)
  let e: NeuerEintrag | null = null
  if (!alt.clan && neu.clan) e = { art: 'beigetreten', spieler: person.name, von: v, rang: rangName(neu) }
  else if (alt.clan && !neu.clan) e = { art: austritt ?? 'entfernt', spieler: person.name, von: austritt === 'verlassen' ? null : v }
  else if (alt.clan && neu.clan && alt.prioritaet !== neu.prioritaet) e = { art: neu.prioritaet > alt.prioritaet ? 'befoerdert' : 'degradiert', spieler: person.name, von: v, rang: rangName(neu) }
  if (e) await eintragen({ ...e, zeit: zeit ?? null, spielerUuid: person.uuid ?? null, quelle: 'automatisch', erstelltVon: von })
}
