import { randomBytes } from 'crypto'
import { pool } from '@/app/lib/db'
import { book, withUser, type Db } from '@/app/lib/geo-data'
import { HL_KAT, type HlRegion } from '@/app/geo/_data/hl'
import { MIX, hlGesperrtBis, type HlArt, type HlStufe } from '@/app/geo/_lib/hl'
import {
  kategorienIn, loadHlConfig, rundeBeenden, rundeFuerBrowser, rundeStarten, teamAmZug, txOhneUser,
  type Aufloesung, type RundeRow,
} from '@/app/lib/geo-hl'

// Higher Lower – Mehrspieler (seekclan.de/geo/higher-lower/raum/<id>)
//
// Duell (gegeneinander): alle bekommen dieselben Paare (gleicher Startwert). Wer am weitesten kommt, gewinnt.
//   Optional setzt jeder beim Start Sternis in einen Topf – der Sieger bekommt alles (Gleichstand: wird geteilt).
//   Jeder spielt seine eigene Runde (geo_hl_runden mit raum_id) – XP/Sternis aus den Punkten wie solo.
// Team (miteinander): eine gemeinsame Runde, reihum ist jemand dran, die anderen können vorschlagen.
//   Am Ende bekommen alle dieselben XP und Sternis.
// Räume: geo_hl_raeume · Spieler: geo_hl_raum_spieler

export type Modus = 'duell' | 'team'
type Fehler = { ok: false; error: string; status: number }
const fehler = (error: string, status = 400): Fehler => ({ ok: false, error, status })
const neueId = () => randomBytes(5).toString('base64url')
const neuerSeed = () => randomBytes(4).readUInt32BE(0) & 0x7fffffff

interface RaumRow {
  id: string; host_id: string; modus: Modus; region: HlRegion; kategorie: string; art: HlArt; stufe: HlStufe
  einsatz: number; seed: number; status: 'lobby' | 'laeuft' | 'fertig'; runde_id: string | null
  letzte: { nr: number; von: string; aufl: Aufloesung } | null; vorschlaege: Record<string, 'hoeher' | 'niedriger'>
  ergebnis: Record<string, unknown> | null
}

/* ───────────── Anlegen, Beitreten, Verlassen ───────────── */

export async function raumErstellen(user: { id: string }, o: { modus: Modus; region: HlRegion; kategorie: string; art: HlArt; stufe: HlStufe; einsatz: number }, admin = false) {
  const cfg = await loadHlConfig()
  if ((!cfg.aktiv || !cfg.mehrspieler.an) && !admin) return fehler('Mehrspieler ist gerade ausgeschaltet', 403)
  if (hlGesperrtBis(cfg) && !admin) return fehler('Higher Lower ist noch nicht freigeschaltet', 403)
  if (o.modus === 'team' && o.art !== 'klassisch' && o.art !== 'leben') return fehler('Im Team gibt es Klassisch und Leben')
  if (o.art === 'tag') return fehler('Die Tagesrunde gibt es nur allein')
  if (!cfg.arten[o.art]) return fehler('Diese Spielart ist ausgeschaltet', 403)
  if (o.kategorie !== MIX && !kategorienIn(o.region, cfg).some(k => k.key === o.kategorie)) return fehler('Diese Kategorie gibt es hier nicht')
  const einsatz = o.modus === 'duell' && cfg.mehrspieler.topf ? Math.max(0, Math.floor(o.einsatz || 0)) : 0
  if (einsatz > cfg.mehrspieler.maxEinsatz) return fehler(`Höchstens ${cfg.mehrspieler.maxEinsatz} Sternis Einsatz`)
  const id = neueId()
  await pool.query(
    `INSERT INTO geo_hl_raeume (id, host_id, modus, region, kategorie, art, stufe, einsatz, seed) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [id, user.id, o.modus, o.region, o.kategorie, o.art, o.stufe, einsatz, neuerSeed()],
  )
  await pool.query('INSERT INTO geo_hl_raum_spieler (raum_id, user_id) VALUES ($1, $2)', [id, user.id])
  return { ok: true as const, id }
}

async function raumLaden(db: Db, id: string, sperren = false): Promise<RaumRow | null> {
  const r = await db.query(`SELECT * FROM geo_hl_raeume WHERE id = $1 ${sperren ? 'FOR UPDATE' : ''}`, [id])
  return (r.rows[0] as unknown as RaumRow) ?? null
}

export async function raumBeitreten(user: { id: string }, id: string, admin = false) {
  const cfg = await loadHlConfig()
  if (hlGesperrtBis(cfg) && !admin) return fehler('Higher Lower ist noch nicht freigeschaltet', 403)
  return txOhneUser(async db => {
    const raum = await raumLaden(db, id, true)
    if (!raum) return fehler('Raum nicht gefunden', 404)
    const da = await db.query('SELECT verlassen FROM geo_hl_raum_spieler WHERE raum_id = $1 AND user_id = $2', [id, user.id])
    if (da.rows[0] && !da.rows[0].verlassen) return { ok: true as const }
    if (raum.status !== 'lobby') return fehler('Die Runde läuft schon – warte auf die nächste', 409)
    const n = Number((await db.query('SELECT count(*)::int AS n FROM geo_hl_raum_spieler WHERE raum_id = $1 AND NOT verlassen', [id])).rows[0].n)
    const max = raum.modus === 'team' ? cfg.mehrspieler.maxTeam : cfg.mehrspieler.maxDuell
    if (n >= max) return fehler(`Der Raum ist voll (${max})`, 409)
    await db.query(
      `INSERT INTO geo_hl_raum_spieler (raum_id, user_id) VALUES ($1, $2)
       ON CONFLICT (raum_id, user_id) DO UPDATE SET verlassen = false, joined_at = now(), last_seen = now()`,
      [id, user.id],
    )
    return { ok: true as const }
  })
}

export async function raumVerlassen(user: { id: string }, id: string) {
  const raum = await raumLaden(pool as unknown as Db, id)
  if (!raum) return fehler('Raum nicht gefunden', 404)
  const ich = (await pool.query('SELECT runde_id FROM geo_hl_raum_spieler WHERE raum_id = $1 AND user_id = $2', [id, user.id])).rows[0]
  if (!ich) return { ok: true as const }
  // Laufende eigene Runde (Duell) bzw. Team-Runde des Gastgebers beenden
  if (raum.status === 'laeuft') {
    if (raum.modus === 'duell' && ich.runde_id) await rundeBeenden(user, String(ich.runde_id)).catch(() => null)
    if (raum.modus === 'team' && raum.host_id === user.id && raum.runde_id) await rundeBeenden(user, raum.runde_id).catch(() => null)
  }
  if (raum.status === 'lobby') await pool.query('DELETE FROM geo_hl_raum_spieler WHERE raum_id = $1 AND user_id = $2', [id, user.id])
  else await pool.query('UPDATE geo_hl_raum_spieler SET verlassen = true WHERE raum_id = $1 AND user_id = $2', [id, user.id])
  // Gastgeber weg → ältester Mitspieler übernimmt; niemand mehr da → Raum löschen (nur im Warteraum)
  if (raum.host_id === user.id) {
    const next = await pool.query('SELECT user_id FROM geo_hl_raum_spieler WHERE raum_id = $1 AND NOT verlassen ORDER BY joined_at LIMIT 1', [id])
    if (next.rows[0]) await pool.query('UPDATE geo_hl_raeume SET host_id = $2 WHERE id = $1', [id, next.rows[0].user_id])
    else if (raum.status === 'lobby') await pool.query('DELETE FROM geo_hl_raeume WHERE id = $1', [id])
  }
  await raumPruefen(id).catch(e => console.error('geo/hl raumPruefen', e))
  return { ok: true as const }
}

/** Gastgeber ändert im Warteraum die Einstellungen */
export async function raumAendern(user: { id: string }, id: string, o: Partial<{ region: HlRegion; kategorie: string; art: HlArt; stufe: HlStufe; einsatz: number }>) {
  const cfg = await loadHlConfig()
  const raum = await raumLaden(pool as unknown as Db, id)
  if (!raum) return fehler('Raum nicht gefunden', 404)
  if (raum.host_id !== user.id) return fehler('Nur der Gastgeber kann das ändern', 403)
  if (raum.status !== 'lobby') return fehler('Die Runde läuft schon', 409)
  const n = { region: o.region ?? raum.region, kategorie: o.kategorie ?? raum.kategorie, art: o.art ?? raum.art, stufe: o.stufe ?? raum.stufe, einsatz: o.einsatz ?? raum.einsatz }
  if (raum.modus === 'team' && n.art !== 'klassisch' && n.art !== 'leben') return fehler('Im Team gibt es Klassisch und Leben')
  if (n.art === 'tag' || !cfg.arten[n.art]) return fehler('Diese Spielart geht hier nicht')
  if (n.kategorie !== MIX && !kategorienIn(n.region, cfg).some(k => k.key === n.kategorie)) n.kategorie = MIX
  n.einsatz = raum.modus === 'duell' && cfg.mehrspieler.topf ? Math.max(0, Math.min(cfg.mehrspieler.maxEinsatz, Math.floor(n.einsatz || 0))) : 0
  await pool.query('UPDATE geo_hl_raeume SET region = $2, kategorie = $3, art = $4, stufe = $5, einsatz = $6 WHERE id = $1', [id, n.region, n.kategorie, n.art, n.stufe, n.einsatz])
  return { ok: true as const }
}

/* ───────────── Start ───────────── */

export async function raumStarten(user: { id: string; username: string }, id: string) {
  const cfg = await loadHlConfig()
  return txOhneUser(async db => {
    const raum = await raumLaden(db, id, true)
    if (!raum) return fehler('Raum nicht gefunden', 404)
    if (raum.host_id !== user.id) return fehler('Nur der Gastgeber kann starten', 403)
    if (raum.status !== 'lobby') return fehler('Die Runde läuft schon', 409)
    const sp = (await db.query(
      `SELECT s.user_id, u.username FROM geo_hl_raum_spieler s JOIN users u ON u.id = s.user_id
       WHERE s.raum_id = $1 AND NOT s.verlassen ORDER BY s.joined_at`, [id],
    )).rows as { user_id: string; username: string }[]
    if (sp.length < 2) return fehler('Es braucht mindestens zwei Spieler')

    // Topf: jeder zahlt den Einsatz (wer zu wenig hat, verhindert den Start)
    if (raum.einsatz > 0) {
      const arm: string[] = []
      for (const p of sp) {
        await db.query('INSERT INTO geo_profile (user_id) VALUES ($1) ON CONFLICT DO NOTHING', [p.user_id])
        const bal = Number((await db.query('SELECT sternis FROM geo_profile WHERE user_id = $1 FOR UPDATE', [p.user_id])).rows[0]?.sternis ?? 0)
        if (bal < raum.einsatz) arm.push(p.username)
      }
      if (arm.length) return fehler(`Zu wenig Sternis für den Einsatz: ${arm.join(', ')}`, 402)
      for (const p of sp) {
        await book(db, p.user_id, -raum.einsatz, 'hl-topf', null, id, `Duell-Einsatz (${sp.length} Spieler)`)
        await db.query('UPDATE geo_hl_raum_spieler SET bezahlt = $3 WHERE raum_id = $1 AND user_id = $2', [id, p.user_id, raum.einsatz])
      }
    }

    const basis = { region: raum.region, kategorie: raum.kategorie, art: raum.art, stufe: raum.stufe, einsatz: 0, ziel: 0 }
    if (raum.modus === 'duell') {
      for (const p of sp) {
        const r = await rundeStarten({ id: p.user_id }, basis, true, { seed: raum.seed, raumId: id, db })
        if (!r.ok) throw new Error(r.error)
        await db.query('UPDATE geo_hl_raum_spieler SET runde_id = $3, gewinn = 0 WHERE raum_id = $1 AND user_id = $2', [id, p.user_id, r.runde.id])
      }
      await db.query(`UPDATE geo_hl_raeume SET status = 'laeuft', started_at = now(), ended_at = NULL, runde_id = NULL, letzte = NULL, vorschlaege = '{}', ergebnis = NULL WHERE id = $1`, [id])
    } else {
      const r = await rundeStarten({ id: raum.host_id }, basis, true, { seed: raum.seed, raumId: id, team: true, db })
      if (!r.ok) throw new Error(r.error)
      await db.query(`UPDATE geo_hl_raeume SET status = 'laeuft', started_at = now(), ended_at = NULL, runde_id = $2, letzte = NULL, vorschlaege = '{}', ergebnis = NULL WHERE id = $1`, [id, r.runde.id])
      await db.query('UPDATE geo_hl_raum_spieler SET gewinn = 0, runde_id = NULL WHERE raum_id = $1', [id])
    }
    // Alle, die gerade da sind, zählen als „gesehen“ (für die Team-Reihenfolge)
    await db.query('UPDATE geo_hl_raum_spieler SET last_seen = now() WHERE raum_id = $1 AND NOT verlassen AND last_seen > now() - interval \'30 seconds\'', [id])
    void cfg
    return { ok: true as const }
  })
}

/** Gastgeber: zurück in den Warteraum (gleiche Leute, neue Paare) */
export async function raumNochmal(user: { id: string }, id: string) {
  const raum = await raumLaden(pool as unknown as Db, id)
  if (!raum) return fehler('Raum nicht gefunden', 404)
  if (raum.host_id !== user.id) return fehler('Nur der Gastgeber kann das', 403)
  if (raum.status !== 'fertig') return fehler('Die Runde ist noch nicht vorbei', 409)
  await pool.query(`UPDATE geo_hl_raeume SET status = 'lobby', seed = $2, runde_id = NULL, letzte = NULL, vorschlaege = '{}' WHERE id = $1`, [id, neuerSeed()])
  await pool.query('DELETE FROM geo_hl_raum_spieler WHERE raum_id = $1 AND verlassen', [id])
  await pool.query('UPDATE geo_hl_raum_spieler SET runde_id = NULL, bezahlt = 0, gewinn = 0 WHERE raum_id = $1', [id])
  return { ok: true as const }
}

/* ───────────── Team: Vorschlag, nach jedem Tipp ───────────── */

export async function raumVorschlag(user: { id: string }, id: string, wahl: 'hoeher' | 'niedriger' | null) {
  const raum = await raumLaden(pool as unknown as Db, id)
  if (!raum || raum.modus !== 'team' || raum.status !== 'laeuft') return fehler('Gerade nicht möglich', 409)
  const da = await pool.query('SELECT 1 FROM geo_hl_raum_spieler WHERE raum_id = $1 AND user_id = $2 AND NOT verlassen', [id, user.id])
  if (!da.rowCount) return fehler('Du bist nicht in diesem Raum', 403)
  await pool.query(
    wahl ? `UPDATE geo_hl_raeume SET vorschlaege = vorschlaege || jsonb_build_object($2::text, $3::text) WHERE id = $1`
      : `UPDATE geo_hl_raeume SET vorschlaege = vorschlaege - $2::text WHERE id = $1`,
    wahl ? [id, user.id, wahl] : [id, user.id],
  )
  return { ok: true as const }
}

/** Nach einem Tipp in einer Raum-Runde: Team → Auflösung für alle merken, Vorschläge leeren; danach prüfen, ob der Raum fertig ist */
export async function raumNachTipp(raumId: string, user: { id: string; username: string }, aufl: Aufloesung, schritt: number) {
  const raum = await raumLaden(pool as unknown as Db, raumId)
  if (!raum) return
  if (raum.modus === 'team') {
    const { ende, ...rest } = aufl
    void ende
    await pool.query(`UPDATE geo_hl_raeume SET letzte = $2, vorschlaege = '{}' WHERE id = $1`, [raumId, JSON.stringify({ nr: schritt, von: user.username, aufl: rest })])
  }
  if (aufl.ende) await raumPruefen(raumId)
}

/* ───────────── Fertig? Abrechnen ───────────── */

/**
 * Prüft einen laufenden Raum: Runden von Spielern, die länger als 60 s weg sind, werden beendet.
 * Sind alle Runden vorbei → Duell: Topf an den/die Sieger · Team: alle bekommen dieselben XP/Sternis wie die Runde.
 */
export async function raumPruefen(id: string) {
  const raum = await raumLaden(pool as unknown as Db, id)
  if (!raum || raum.status !== 'laeuft') return

  // Wer weg ist, dessen Runde endet (Duell)
  if (raum.modus === 'duell') {
    const weg = await pool.query(
      `SELECT s.user_id, s.runde_id FROM geo_hl_raum_spieler s JOIN geo_hl_runden r ON r.id = s.runde_id
       WHERE s.raum_id = $1 AND r.status = 'laeuft' AND (s.verlassen OR s.last_seen < now() - interval '60 seconds')`, [id],
    )
    for (const w of weg.rows) await rundeBeenden({ id: String(w.user_id) }, String(w.runde_id)).catch(() => null)
  } else if (raum.runde_id) {
    // Team ohne Spieler, die noch da sind (2 Minuten) → Runde beenden
    const da = await pool.query(`SELECT 1 FROM geo_hl_raum_spieler WHERE raum_id = $1 AND NOT verlassen AND last_seen > now() - interval '2 minutes'`, [id])
    if (!da.rowCount) await rundeBeenden({ id: raum.host_id }, raum.runde_id).catch(() => null)
  }

  let zahlungen: { userId: string; xp: number; sternis: number }[] = []
  await txOhneUser(async db => {
    const r = await raumLaden(db, id, true)
    if (!r || r.status !== 'laeuft') return
    if (r.modus === 'duell') {
      const sp = (await db.query(
        `SELECT s.user_id, s.bezahlt, g.status, g.richtige, g.punkte, g.ended_at FROM geo_hl_raum_spieler s
         LEFT JOIN geo_hl_runden g ON g.id = s.runde_id WHERE s.raum_id = $1 AND s.runde_id IS NOT NULL`, [id],
      )).rows as { user_id: string; bezahlt: number; status: string; richtige: number; punkte: number }[]
      if (sp.some(x => x.status === 'laeuft')) return
      const topf = sp.reduce((s, x) => s + Number(x.bezahlt), 0)
      const best = Math.max(...sp.map(x => Number(x.richtige)))
      const kand = sp.filter(x => Number(x.richtige) === best)
      const bestP = Math.max(...kand.map(x => Number(x.punkte)))
      const sieger = kand.filter(x => Number(x.punkte) === bestP)
      const jeder = topf > 0 ? Math.floor(topf / sieger.length) : 0
      for (const s of sieger) {
        if (jeder > 0) await book(db, s.user_id, jeder, 'hl-duell', null, id, sieger.length > 1 ? `Topf geteilt (${sieger.length})` : 'Duell gewonnen')
        await db.query('UPDATE geo_hl_raum_spieler SET gewinn = $3 WHERE raum_id = $1 AND user_id = $2', [id, s.user_id, jeder])
      }
      await db.query(`UPDATE geo_hl_raeume SET status = 'fertig', ended_at = now(), ergebnis = $2 WHERE id = $1`,
        [id, JSON.stringify({ sieger: sieger.map(x => x.user_id), topf, jeder, richtige: best })])
    } else {
      const g = r.runde_id ? (await db.query('SELECT * FROM geo_hl_runden WHERE id = $1', [r.runde_id])).rows[0] as unknown as RundeRow | undefined : undefined
      if (!g || g.status === 'laeuft') return
      const sp = (await db.query('SELECT user_id FROM geo_hl_raum_spieler WHERE raum_id = $1 AND NOT verlassen AND user_id <> $2', [id, g.user_id])).rows
      // Der Gastgeber hat seine Belohnung schon mit der Runde bekommen – die anderen bekommen dasselbe
      zahlungen = sp.map(x => ({ userId: String(x.user_id), xp: Number(g.xp ?? 0), sternis: Number(g.sternis ?? 0) }))
      await db.query(`UPDATE geo_hl_raeume SET status = 'fertig', ended_at = now(), ergebnis = $2 WHERE id = $1`,
        [id, JSON.stringify({ richtige: g.richtige, punkte: g.punkte, xp: g.xp ?? 0, sternis: g.sternis ?? 0 })])
    }
  })
  for (const z of zahlungen) {
    await withUser(z.userId, async db => {
      if (z.xp > 0) {
        await db.query(`INSERT INTO geo_xp_log (user_id, amount, reason, slug, ref) VALUES ($1, $2, 'hl', 'hl:team', $3)`, [z.userId, z.xp, id])
        await db.query('UPDATE geo_profile SET xp = GREATEST(0, xp + $2), updated_at = now() WHERE user_id = $1', [z.userId, z.xp])
      }
      if (z.sternis > 0) await book(db, z.userId, z.sternis, 'hl-team', null, id)
      await db.query('UPDATE geo_hl_raum_spieler SET gewinn = $3 WHERE raum_id = $1 AND user_id = $2', [id, z.userId, z.sternis])
    }).catch(e => console.error('geo/hl team-zahlung', e))
  }
}

/* ───────────── Zustand für den Browser ───────────── */

export async function raumZustand(user: { id: string } | null, id: string) {
  const cfg = await loadHlConfig()
  if (user) await pool.query('UPDATE geo_hl_raum_spieler SET last_seen = now() WHERE raum_id = $1 AND user_id = $2', [id, user.id])
  let raum = await raumLaden(pool as unknown as Db, id)
  if (!raum) return null
  if (raum.status === 'laeuft') {
    await raumPruefen(id).catch(e => console.error('geo/hl raumPruefen', e))
    raum = (await raumLaden(pool as unknown as Db, id))!
  }
  const sp = (await pool.query(
    `SELECT s.user_id, u.username, s.last_seen, s.verlassen, s.bezahlt, s.gewinn, s.runde_id,
            g.status AS g_status, g.richtige, g.serie, g.punkte, g.leben, g.fehler
     FROM geo_hl_raum_spieler s JOIN users u ON u.id = s.user_id LEFT JOIN geo_hl_runden g ON g.id = s.runde_id
     WHERE s.raum_id = $1 ORDER BY s.joined_at`, [id],
  )).rows
  const host = (await pool.query('SELECT username FROM users WHERE id = $1', [raum.host_id])).rows[0]?.username ?? '?'
  const now = Date.now()

  let meineRunde = null
  let amZug: string | null = null
  if (raum.modus === 'team' && raum.runde_id) {
    const g = (await pool.query('SELECT * FROM geo_hl_runden WHERE id = $1', [raum.runde_id])).rows[0] as unknown as RundeRow | undefined
    if (g) {
      meineRunde = await rundeFuerBrowser(g, cfg)
      if (raum.status === 'laeuft' && g.status === 'laeuft') amZug = await teamAmZug(pool as unknown as Db, id, g.richtige + g.fehler)
    }
  } else if (user) {
    const mine = sp.find(x => x.user_id === user.id)
    if (mine?.runde_id) {
      const g = (await pool.query('SELECT * FROM geo_hl_runden WHERE id = $1', [mine.runde_id])).rows[0] as unknown as RundeRow | undefined
      if (g) meineRunde = await rundeFuerBrowser(g, cfg)
    }
  }
  const namen = Object.fromEntries(sp.map(x => [x.user_id, x.username]))
  return {
    raum: {
      id: raum.id, modus: raum.modus, region: raum.region, kategorie: raum.kategorie, art: raum.art, stufe: raum.stufe,
      einsatz: raum.einsatz, status: raum.status, hostId: raum.host_id, hostName: host,
      topf: sp.reduce((s, x) => s + Number(x.bezahlt), 0),
      ergebnis: raum.ergebnis, letzte: raum.letzte,
      vorschlaege: Object.entries(raum.vorschlaege ?? {}).map(([uid, w]) => ({ name: namen[uid] ?? '?', wahl: w, me: uid === user?.id })),
      amZug, amZugName: amZug ? namen[amZug] ?? null : null,
      katName: raum.kategorie === MIX ? 'Mix' : HL_KAT[raum.kategorie]?.name ?? raum.kategorie,
    },
    spieler: sp.filter(x => !x.verlassen || x.runde_id).map(x => ({
      id: x.user_id, name: x.username, me: x.user_id === user?.id,
      online: now - new Date(x.last_seen).getTime() < 20000 && !x.verlassen,
      verlassen: !!x.verlassen,
      status: raum.status === 'lobby' ? 'wartet' : raum.modus === 'team' ? 'team' : !x.runde_id ? 'zuschauer' : x.g_status === 'laeuft' ? 'spielt' : 'fertig',
      richtige: Number(x.richtige ?? 0), serie: Number(x.serie ?? 0), punkte: Number(x.punkte ?? 0), leben: x.leben == null ? null : Number(x.leben),
      bezahlt: Number(x.bezahlt), gewinn: Number(x.gewinn),
    })),
    meineRunde,
    ichDrin: !!sp.find(x => x.user_id === user?.id && !x.verlassen),
    isHost: raum.host_id === user?.id,
    mehr: cfg.mehrspieler,
  }
}