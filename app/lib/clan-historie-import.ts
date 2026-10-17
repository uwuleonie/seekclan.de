import { pool } from '@/app/lib/db'
import { alleRaenge, istUmgestellt, spielerRangSchreiben, standardRang } from '@/app/lib/rechte'
import { historieCacheLeeren } from '@/app/lib/clan-historie'
import { verlauf, type Art } from '@/app/lib/clan-historie-def'
import ALT from '@/app/lib/daten/clan-historie-alt.json'
import CLANLISTE from '@/app/api/admin2/raenge/umstellung/clanliste.json'

// Einmaliger Import (darf mehrmals laufen, ersetzt dann den alten Import):
//   1. Alter Clan-Verlauf → clan_historie (quelle gomme / discord). Datei: app/lib/daten/clan-historie-alt.json
//      (aus Leonies Nachricht vom 17.10.2026: Verlauf aus dem Spiel ab 19.10.2025 + Discord-Liste ab 16.03.2025)
//   2. Clan-Liste aus dem Spiel (clanliste.json) mit den Clan-Akten abgleichen:
//      fehlende Akten anlegen, Beitrittsdatum aus dem Verlauf (unbekannt = leer), fehlenden Clan-Rang geben.

type Roh = { z: string; g: boolean; a: Art; s: string; v: string | null; r: string | null; n: string | null; q: string; t: string }
const EINTRAEGE = (ALT as { eintraege: Roh[] }).eintraege
const norm = (u: string | null | undefined) => (u ?? '').replace(/-/g, '').toLowerCase()

/** Beitritt laut altem Verlauf (aktuelle Mitgliedschaft) – null, wenn nicht bekannt */
export function beitrittAusAltHistorie(name: string): string | null {
  const n = name.toLowerCase()
  const es = EINTRAEGE.filter(e => e.s.toLowerCase() === n).map(e => ({ zeit: e.z, genau: e.g, art: e.a, rang: e.r, von: e.v }))
  const v = verlauf(es)
  return v.status === 'drin' ? v.beitritt : null
}

export interface ImportPlan {
  eintraege: number
  schonImportiert: number
  umgestellt: boolean
  neueAkten: { name: string; uuid: string | null; rang: string; beitritt: string | null }[]
  datum: { akteId: string; name: string; alt: string | null; neu: string | null; grund: 'leer' | 'automatisch' | 'abweichend' }[]
  raenge: { name: string; uuid: string; von: string; zu: string; zuId: number }[]
  /** Vorhandene Akten (nach Name gefunden) ohne UUID → UUID aus der Liste */
  verknuepfen: { akteId: string; name: string; uuid: string }[]
  andererRang: { name: string; rang: string }[]
}

export async function importPlan(): Promise<ImportPlan> {
  const [raenge, std, umgestellt] = await Promise.all([alleRaenge(), standardRang(), istUmgestellt()])
  const schon = await pool.query(`SELECT count(*)::int AS n FROM clan_historie WHERE quelle IN ('gomme', 'discord')`).then(r => r.rows[0].n as number).catch(() => -1)
  const akten = (await pool.query('SELECT id, display_name, minecraft_uuid, join_date FROM clan_members')).rows
  const umstellZeit = await pool.query(`SELECT updated_at FROM system_einstellungen WHERE key = 'raenge_umgestellt'`).then(r => r.rows[0]?.updated_at ?? null).catch(() => null)
  const spielerRaenge = (await pool.query('SELECT uuid, rank_id FROM mc_player_ranks')).rows
  const abschnitte = CLANLISTE.abschnitte as Record<string, string>

  const plan: ImportPlan = { eintraege: EINTRAEGE.length, schonImportiert: schon, umgestellt, neueAkten: [], datum: [], raenge: [], andererRang: [], verknuepfen: [] }
  for (const [name, uuid, abschnitt] of CLANLISTE.spieler as [string, string | null, string][]) {
    const ziel = raenge.find(r => r.schluessel === abschnitte[abschnitt])
    const beitritt = beitrittAusAltHistorie(name)
    const akte = akten.find(a => (uuid && a.minecraft_uuid && norm(a.minecraft_uuid) === norm(uuid)) || a.display_name?.toLowerCase() === name.toLowerCase())
    if (!akte) {
      plan.neueAkten.push({ name, uuid, rang: ziel?.anzeige ?? abschnitt, beitritt })
    } else {
      if (!akte.minecraft_uuid && uuid) plan.verknuepfen.push({ akteId: String(akte.id), name, uuid })
      const alt = akte.join_date ? new Date(akte.join_date).toISOString() : null
      const automatisch = !!(alt && umstellZeit && Math.abs(+new Date(alt) - +new Date(umstellZeit)) < 5 * 60_000)
      if (!alt && beitritt) plan.datum.push({ akteId: String(akte.id), name, alt, neu: beitritt, grund: 'leer' })
      else if (automatisch) plan.datum.push({ akteId: String(akte.id), name, alt, neu: beitritt, grund: 'automatisch' })
      else if (alt && beitritt && Math.abs(+new Date(alt) - +new Date(beitritt)) > 36 * 3600_000) plan.datum.push({ akteId: String(akte.id), name, alt, neu: beitritt, grund: 'abweichend' })
    }
    // Rang: nur wer gar keinen besonderen Rang hat, bekommt den Clan-Rang aus der Liste (auch schon vor der Umstellung –
    // /clan liest die Ränge direkt aus mc_player_ranks)
    if (uuid && ziel) {
      const jetzt = raenge.find(r => r.id === spielerRaenge.find(p => norm(p.uuid) === norm(uuid))?.rank_id) ?? std
      if (jetzt.standard) plan.raenge.push({ name, uuid, von: jetzt.anzeige, zu: ziel.anzeige, zuId: ziel.id })
      else if (!jetzt.clan) plan.andererRang.push({ name, rang: jetzt.anzeige })
    }
  }
  return plan
}

export async function importAusfuehren(von: string, ueberschreiben: boolean) {
  const plan = await importPlan()
  const c = await pool.connect()
  try {
    await c.query('BEGIN')
    // 1. Verlauf (alter Import wird ersetzt, von Hand oder automatisch eingetragene Einträge bleiben).
    //    Fehlt die Tabelle clan_historie noch, wird nur dieser Teil übersprungen.
    let historieFehlt = false
    await c.query('SAVEPOINT verlauf')
    try {
    await c.query(`DELETE FROM clan_historie WHERE quelle IN ('gomme', 'discord')`)
    const spalten = { z: [] as string[], g: [] as boolean[], a: [] as string[], s: [] as string[], v: [] as (string | null)[], r: [] as (string | null)[], n: [] as (string | null)[], q: [] as string[], t: [] as string[], i: [] as number[] }
    EINTRAEGE.forEach((e, i) => {
      spalten.z.push(e.z); spalten.g.push(e.g); spalten.a.push(e.a); spalten.s.push(e.s); spalten.v.push(e.v); spalten.r.push(e.r)
      spalten.n.push(e.n); spalten.q.push(e.q); spalten.t.push(e.t); spalten.i.push(i)
    })
    await c.query(
      `INSERT INTO clan_historie (zeit, zeit_genau, art, spieler, von, rang, notiz, quelle, original, reihe, erstellt_von)
       SELECT * , $11::text FROM unnest($1::timestamptz[], $2::boolean[], $3::text[], $4::text[], $5::text[], $6::text[], $7::text[], $8::text[], $9::text[], $10::int[])`,
      [spalten.z, spalten.g, spalten.a, spalten.s, spalten.v, spalten.r, spalten.n, spalten.q, spalten.t, spalten.i, `import:${von}`]
    )
    } catch {
      historieFehlt = true
      await c.query('ROLLBACK TO SAVEPOINT verlauf')
    }
    // 2. Fehlende Clan-Akten
    for (const a of plan.neueAkten) {
      await c.query('INSERT INTO clan_members (display_name, role, join_date, minecraft_uuid) VALUES ($1, $2, $3, $4)', [a.name, a.rang, a.beitritt, a.uuid])
    }
    for (const v of plan.verknuepfen) await c.query('UPDATE clan_members SET minecraft_uuid = $1 WHERE id = $2 AND minecraft_uuid IS NULL', [v.uuid, v.akteId])
    // 3. Beitrittsdaten
    let daten = 0
    for (const d of plan.datum) {
      if (d.grund === 'abweichend' && !ueberschreiben) continue
      await c.query('UPDATE clan_members SET join_date = $1 WHERE id = $2', [d.neu, d.akteId])
      daten++
    }
    // 4. Fehlende Clan-Ränge
    for (const r of plan.raenge) await spielerRangSchreiben(c, r.uuid, r.name, r.zuId, `import:${von}`)
    await c.query('COMMIT')
    historieCacheLeeren()
    return { historieFehlt, eintraege: historieFehlt ? 0 : EINTRAEGE.length, neueAkten: plan.neueAkten.length, verknuepft: plan.verknuepfen.length, daten, raenge: plan.raenge.length, andererRang: plan.andererRang }
  } catch (e) {
    await c.query('ROLLBACK').catch(() => {})
    throw e
  } finally {
    c.release()
  }
}
