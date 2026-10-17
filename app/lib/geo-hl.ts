import { randomBytes } from 'crypto'
import { pool } from '@/app/lib/db'
import { book, loadConfig, syncLevelSternis, withUser, type Db, type SterniPart, type XpPart } from '@/app/lib/geo-data'
import { HL_KAT, HL_KATEGORIEN, type HlKategorie, type HlRegion } from '@/app/geo/_data/hl'
import { berlinDay } from '@/app/geo/_lib/plan'
import {
  MIX, fmtWert, hlGesperrtBis, mergeHlConfig, multiplikator, quoteFuer, stufenIndex,
  type HlArt, type HlConfig, type HlStufe,
} from '@/app/geo/_lib/hl'
import WERTE from './hl-werte.json'

// Higher Lower – Spiel-Logik auf dem Server (seekclan.de/geo/higher-lower)
//
// Der Server erzeugt die Paare und prüft jede Antwort. Der Browser bekommt den Wert der rechten (verdeckten) Karte
// erst nach dem Tipp – so kann niemand im Browser nachschauen. Runden liegen in geo_hl_runden.
// Sternis laufen über geo_sterni_log (Gründe: hl-einsatz, hl-wette, hl-runde, hl-rekord, hl-tag), XP über geo_xp_log (Grund: hl).

/* ───────────── Daten ───────────── */

type Wert = [number, number | null, string?]
interface Daten {
  stand: string
  laender: Record<string, { name: string; flag: string | null; capital: string; regionen: string[] }>
  bekannt: Record<HlRegion, string[]>
  werte: Record<string, Record<string, Wert>>
}
const D = WERTE as unknown as Daten
export const HL_REGIONEN: HlRegion[] = ['welt', 'europa', 'suedamerika']
export const HL_ARTEN_KEYS: HlArt[] = ['klassisch', 'leben', 'sprint', 'tag']
export const HL_STUFEN_KEYS: HlStufe[] = ['leicht', 'mittel', 'schwer']
const MIN_POOL = 8

/** Korrektur aus dem Adminpanel: ersetzt den Wert eines Landes in einer Kategorie (wert = null → Land fliegt raus) */
export interface HlKorrektur { wert: number | null; jahr: number | null; quelle: string | null; von: string | null; am: string }
export type HlKorrekturen = Record<string, Record<string, HlKorrektur>>

const memo = new Map<string, { t: number; v: unknown }>()
async function cached<T>(key: string, ms: number, fn: () => Promise<T>): Promise<T> {
  const hit = memo.get(key)
  if (hit && Date.now() - hit.t < ms) return hit.v as T
  const v = await fn()
  memo.set(key, { t: Date.now(), v })
  return v
}
export const clearHlCache = () => memo.clear()

export function loadHlConfig(): Promise<HlConfig> {
  return cached('cfg', 15000, async () => {
    try {
      const r = await pool.query(`SELECT value FROM geo_settings WHERE key = 'hl'`)
      return mergeHlConfig(r.rows[0]?.value)
    } catch { return mergeHlConfig(null) }
  })
}

export function loadKorrekturen(): Promise<HlKorrekturen> {
  return cached('korr', 15000, async () => {
    try {
      const r = await pool.query(`SELECT value FROM geo_settings WHERE key = 'hl-korrekturen'`)
      return (r.rows[0]?.value ?? {}) as HlKorrekturen
    } catch { return {} }
  })
}

/** Werte einer Kategorie mit Korrekturen */
async function werteVon(kat: string): Promise<Record<string, Wert>> {
  const korr = (await loadKorrekturen())[kat]
  const base = D.werte[kat] ?? {}
  if (!korr) return base
  const out: Record<string, Wert> = { ...base }
  for (const [id, k] of Object.entries(korr)) {
    if (k.wert == null) delete out[id]
    else out[id] = [k.wert, k.jahr, base[id]?.[2]]
  }
  return out
}

const inRegion = (id: string, r: HlRegion) => D.laender[id]?.regionen.includes(r)

/** Länder einer Region mit Wert in der Kategorie (bei Leicht nur bekannte, wenn genug da sind) */
async function poolVon(kat: string, region: HlRegion, stufe: HlStufe): Promise<string[]> {
  const w = await werteVon(kat)
  const alle = Object.keys(w).filter(id => inRegion(id, region))
  if (stufe !== 'leicht') return alle
  const b = new Set(D.bekannt[region])
  const leicht = alle.filter(id => b.has(id))
  return leicht.length >= MIN_POOL ? leicht : alle
}

/** Kategorien, die es in der Region gibt und die im Adminpanel nicht ausgeschaltet sind */
export function kategorienIn(region: HlRegion, cfg: HlConfig): HlKategorie[] {
  return HL_KATEGORIEN.filter(k => k.regionen[region] && !cfg.kategorien[k.key]?.aus)
}

/* ───────────── Zufall (mit Startwert, für die Tagesrunde gleich für alle) ───────────── */

function rng(seed: number) {
  let s = seed >>> 0 || 1
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const pickOne = <T,>(a: T[], r: () => number) => a[Math.floor(r() * a.length)]

/* ───────────── Rundenstand ───────────── */

export interface Stand {
  seed: number
  schritt: number
  links: string
  rechts: string
  /** Kategorie des aktuellen Paars (bei Mix wechselt sie) */
  kat: string
  benutzt: string[]
  /** Zeitpunkt, ab dem das aktuelle Paar zu sehen war (für das Zeitlimit bei Wetten) */
  gezeigt: number
  /** Sprint: Ende der Runde (ms) */
  ende?: number
  /** Team-Runde (Mehrspieler „miteinander“) – zählt nicht für persönliche Rekorde und Ranglisten */
  team?: boolean
}

/** Abstand zweier Werte (0 = gleich, 1 = sehr verschieden; funktioniert auch bei 0 und negativen Werten) */
const abstand = (a: number, b: number) => Math.abs(a - b) / (Math.abs(a) + Math.abs(b) || 1)

/**
 * Nächstes Land für die rechte Karte. Am Anfang liegen die Werte weit auseinander, mit wachsender Serie werden die Paare
 * enger (bei Schwer von Anfang an enger). Gleiche Werte werden vermieden.
 */
async function naechstes(st: Stand, region: HlRegion, stufe: HlStufe, serie: number, katWahl: string, cfg: HlConfig, r: () => number): Promise<{ kat: string; id: string } | null> {
  // Mix: Kategorie zufällig, in der das linke Land einen Wert hat
  let kat = katWahl
  if (katWahl === MIX) {
    const moeglich: string[] = []
    for (const k of kategorienIn(region, cfg)) {
      const w = await werteVon(k.key)
      if (w[st.links] && (await poolVon(k.key, region, stufe)).length >= MIN_POOL) moeglich.push(k.key)
    }
    const ohneGleich = moeglich.filter(k => k !== st.kat)
    kat = pickOne(ohneGleich.length ? ohneGleich : moeglich, r)
    if (!kat) return null
  }
  const w = await werteVon(kat)
  const vL = w[st.links]?.[0]
  if (vL == null) return null
  const p = await poolVon(kat, region, stufe)
  let frei = p.filter(id => id !== st.links && !st.benutzt.includes(id))
  if (frei.length < 3) { st.benutzt = [st.links]; frei = p.filter(id => id !== st.links) }
  const verschieden = frei.filter(id => w[id][0] !== vL)
  const kand = (verschieden.length ? verschieden : frei).map(id => ({ id, d: abstand(w[id][0], vL) })).sort((a, b) => b.d - a.d)
  if (!kand.length) return null
  const basis = stufe === 'leicht' ? 0 : stufe === 'mittel' ? 0.1 : 0.3
  const tempo = stufe === 'leicht' ? 0.015 : stufe === 'mittel' ? 0.025 : 0.03
  const q = Math.min(0.85, basis + serie * tempo)
  const fenster = Math.max(1, Math.round(kand.length * 0.35))
  const start = Math.min(kand.length - fenster, Math.floor(kand.length * q))
  return { kat, id: kand[start + Math.floor(r() * fenster)].id }
}

/* ───────────── Karten für den Browser ───────────── */

export interface Karte { id: string; name: string; flag: string | null; wert?: number; text?: string; jahr?: number | null; zusatz?: string }

function titel(s: string) { return s.toLowerCase().replace(/(^|[\s-])\p{L}/gu, m => m.toUpperCase()) }

async function zusatzText(kat: string, id: string, w: Wert): Promise<string | undefined> {
  const k = HL_KAT[kat]
  const v = w[0]
  const de = (x: number, d = 0) => x.toLocaleString('de-DE', { maximumFractionDigits: d })
  switch (k?.zusatz) {
    case 'berg': return w[2] ? `Höchster Punkt: ${w[2]}` : undefined
    case 'hauptstadt': return w[2] ? `Ballungsraum ${titel(String(w[2]))}` : undefined
    case 'name': return `„${D.laender[id]?.name}“`
    case 'kueste': return v > 0 ? `Zu Fuß bei 30 km am Tag: ≈ ${de(Math.max(1, v / 30))} Tage` : 'Kein Meer – Binnenland'
    case 'bier': return `≈ ${de(v / 10, 1)} Kästen (20 × 0,5 l) pro Person und Jahr`
    case 'tee': return `≈ ${de((v * 1000) / 2 / 365, 1)} Tassen am Tag (2 g pro Tasse)`
    case 'milch': return `≈ ${de(v / 0.2 / 365, 1)} Gläser (0,2 l) am Tag`
    case 'fleisch': return `≈ ${de(v / 0.15 / 52, 1)} Schnitzel (150 g) pro Woche`
    case 'schiene': return v >= 40075 ? `${de(v / 40075, 1)}-mal um den Äquator` : `${de((v / 40075) * 100, 1)} % einer Runde um den Äquator`
    case 'mcdonalds': {
      const pop = D.werte.einwohner?.[id]?.[0]
      return pop && v > 0 ? `1 Filiale auf ${de(Math.round(pop / v))} Menschen` : undefined
    }
    default: return undefined
  }
}

async function karte(kat: string, id: string, offen: boolean): Promise<Karte> {
  const l = D.laender[id]
  const c: Karte = { id, name: l?.name ?? id, flag: l?.flag ?? null }
  if (offen) {
    const w = (await werteVon(kat))[id]
    if (w) {
      c.wert = w[0]
      c.text = fmtWert(w[0], HL_KAT[kat])
      c.jahr = w[1]
      c.zusatz = await zusatzText(kat, id, w)
    }
  }
  return c
}

/* ───────────── Runden in der Datenbank ───────────── */

export interface RundeRow {
  id: string; user_id: string | null; region: HlRegion; kategorie: string; art: HlArt; stufe: HlStufe; tag: number | null
  status: 'laeuft' | 'beendet'; richtige: number; fehler: number; serie: number; beste_serie: number; punkte: number
  leben: number | null; einsatz: number; ziel: number | null; quote: string | number | null; wette: 'offen' | 'gewonnen' | 'verloren' | null
  stand: Stand; xp: number | null; sternis: number | null; started_at: Date; ended_at: Date | null
  /** Mehrspieler-Raum (Duell oder Team), sonst null */
  raum_id: string | null
}

/** Was der Browser über eine Runde erfährt */
export async function rundeFuerBrowser(r: RundeRow, cfg: HlConfig) {
  const st = r.stand
  const laeuft = r.status === 'laeuft'
  return {
    id: r.id, region: r.region, kategorie: r.kategorie, art: r.art, stufe: r.stufe, status: r.status,
    kat: st.kat,
    links: await karte(st.kat, st.links, true),
    rechts: laeuft ? await karte(st.kat, st.rechts, false) : await karte(st.kat, st.rechts, true),
    richtige: r.richtige, fehler: r.fehler, serie: r.serie, besteSerie: r.beste_serie, punkte: r.punkte,
    multi: multiplikator(r.serie, cfg), stufe_i: stufenIndex(r.serie, cfg),
    leben: r.leben, einsatz: r.einsatz, ziel: r.ziel, quote: r.quote == null ? null : Number(r.quote), wette: r.wette,
    zeit: r.wette === 'offen' && cfg.wetten.zeit ? { bis: st.gezeigt + cfg.wetten.zeit * 1000 } : null,
    sprintEnde: st.ende ?? null,
    jetzt: Date.now(),
    /** Anzahl beantworteter Paare (für Mehrspieler: wer ist dran, welche Auflösung ist neu) */
    schritt: r.richtige + r.fehler,
    raum: r.raum_id ?? null,
    xp: r.xp, sternis: r.sternis,
  }
}

const neueId = () => randomBytes(9).toString('base64url')
const istTag = (art: HlArt) => art === 'tag'

/* ───────────── Trefferquote und Quote ───────────── */

/** Trefferquote (Anteil richtiger Antworten) für Region × Kategorie × Stufe – gemischt aus Startwert und echten Spielen */
export async function trefferquote(region: HlRegion, kat: string, stufe: HlStufe, cfg: HlConfig): Promise<{ p: number; antworten: number }> {
  const key = `p:${region}:${kat}:${stufe}`
  return cached(key, 60000, async () => {
    const schwer = kat === MIX ? 2 : (HL_KAT[kat]?.schwer ?? 2)
    const start = Math.max(0.3, cfg.wetten.startP[stufe] - (schwer - 2) * 0.03)
    let richtig = 0, falsch = 0
    try {
      const r = await pool.query(
        `SELECT COALESCE(sum(richtige), 0)::int AS r, COALESCE(sum(fehler), 0)::int AS f FROM geo_hl_runden
         WHERE region = $1 AND kategorie = $2 AND stufe = $3 AND art <> 'tag' AND status = 'beendet' AND started_at > now() - interval '120 days'`,
        [region, kat, stufe],
      )
      richtig = Number(r.rows[0].r); falsch = Number(r.rows[0].f)
    } catch { /* Tabelle fehlt → Startwert */ }
    const n = richtig + falsch
    const echt = n ? richtig / n : start
    const g = cfg.wetten.minAntworten ? Math.min(1, n / cfg.wetten.minAntworten) : 1
    return { p: Math.min(0.99, Math.max(0.3, start * (1 - g) + echt * g)), antworten: n }
  })
}

export async function quoteBerechnen(region: HlRegion, kat: string, stufe: HlStufe, ziel: number, cfg: HlConfig) {
  const { p, antworten } = await trefferquote(region, kat, stufe, cfg)
  const max = Math.min(cfg.wetten.maxQuote, cfg.kategorien[kat]?.maxQuote ?? Infinity)
  return { quote: quoteFuer(p, ziel, cfg.wetten.rueckgabe, max), p, antworten, max }
}

/* ───────────── Start ───────────── */

export type StartErgebnis = { ok: true; runde: Awaited<ReturnType<typeof rundeFuerBrowser>> } | { ok: false; error: string; status: number }

/** Mehrspieler: fester Startwert (gleiche Paare für alle), Raum, Team-Runde */
export interface StartExtra { seed?: number; raumId?: string; team?: boolean; db?: Db }

export async function rundeStarten(user: { id: string } | null, o: { region: HlRegion; kategorie: string; art: HlArt; stufe: HlStufe; einsatz: number; ziel: number }, admin: boolean, extra: StartExtra = {}): Promise<StartErgebnis> {
  const cfg = await loadHlConfig()
  if (!cfg.aktiv && !admin) return { ok: false, error: 'Higher Lower ist gerade ausgeschaltet', status: 403 }
  const gesperrt = hlGesperrtBis(cfg)
  if (gesperrt && !admin) return { ok: false, error: `Higher Lower startet am ${new Date(gesperrt).toLocaleString('de-DE', { timeZone: 'Europe/Berlin', dateStyle: 'medium', timeStyle: 'short' })} Uhr`, status: 403 }
  let { region, kategorie, stufe } = o
  const art = o.art
  if (!cfg.arten[art]) return { ok: false, error: 'Diese Spielart ist ausgeschaltet', status: 403 }
  let seed = extra.seed ?? randomBytes(4).readUInt32BE(0)
  let tag: number | null = null
  if (istTag(art)) {
    if (!user) return { ok: false, error: 'Die Tagesrunde gibt es nur eingeloggt', status: 401 }
    tag = berlinDay(new Date())
    region = 'welt'; kategorie = MIX; stufe = 'mittel'
    seed = (tag * 2654435761) >>> 0
    const schon = await pool.query(`SELECT 1 FROM geo_hl_runden WHERE user_id = $1 AND art = 'tag' AND tag = $2`, [user.id, tag])
    if (schon.rowCount) return { ok: false, error: 'Die heutige Tagesrunde hast du schon gespielt – morgen gibt es eine neue', status: 409 }
  }
  if (kategorie !== MIX && (!HL_KAT[kategorie] || !HL_KAT[kategorie].regionen[region] || cfg.kategorien[kategorie]?.aus)) {
    return { ok: false, error: 'Diese Kategorie gibt es hier nicht', status: 400 }
  }

  // Wette prüfen
  const einsatz = Math.max(0, Math.floor(o.einsatz || 0))
  let ziel: number | null = null, quote: number | null = null
  if (einsatz > 0) {
    if (!user) return { ok: false, error: 'Wetten geht nur eingeloggt', status: 401 }
    if (!cfg.wetten.an) return { ok: false, error: 'Wetten sind gerade ausgeschaltet', status: 403 }
    if (art === 'sprint' || art === 'tag') return { ok: false, error: 'Wetten gibt es nur bei Klassisch und 3 Leben', status: 400 }
    if (cfg.kategorien[kategorie]?.wettenAus) return { ok: false, error: 'Auf diese Kategorie kann man nicht wetten', status: 400 }
    if (einsatz > cfg.wetten.maxEinsatz) return { ok: false, error: `Höchstens ${cfg.wetten.maxEinsatz} Sternis Einsatz`, status: 400 }
    ziel = Math.floor(o.ziel || 0)
    if (ziel < cfg.wetten.minZiel || ziel > cfg.wetten.maxZiel) return { ok: false, error: `Ziel zwischen ${cfg.wetten.minZiel} und ${cfg.wetten.maxZiel}`, status: 400 }
    quote = (await quoteBerechnen(region, kategorie, stufe, ziel, cfg)).quote
    if (quote < 1.1) return { ok: false, error: 'Das Ziel ist zu leicht für eine Wette – nimm ein höheres Ziel', status: 400 }
  }

  // Erstes Paar
  const r = rng(seed)
  const startKat = kategorie === MIX ? pickOne(kategorienIn(region, cfg).map(k => k.key), r) : kategorie
  const p0 = await poolVon(startKat, region, stufe)
  if (p0.length < 2) return { ok: false, error: 'Zu wenige Länder mit Werten', status: 400 }
  const st: Stand = { seed, schritt: 0, links: pickOne(p0, r), rechts: '', kat: startKat, benutzt: [], gezeigt: Date.now() }
  const n = await naechstes(st, region, stufe, 0, kategorie === MIX ? startKat : kategorie, cfg, r)
  if (!n) return { ok: false, error: 'Kein Paar gefunden', status: 500 }
  st.kat = n.kat; st.rechts = n.id; st.benutzt = [st.links, n.id]
  if (art === 'sprint') st.ende = Date.now() + cfg.sprintSek * 1000
  if (extra.team) st.team = true

  const id = neueId()
  const leben = art === 'leben' ? cfg.leben : null
  const insert = async (db: Db) => {
    // Laufende alte Runden dieses Spielers erst abschließen
    if (user) {
      const alt = await db.query(`SELECT id FROM geo_hl_runden WHERE user_id = $1 AND status = 'laeuft'`, [user.id])
      for (const a of alt.rows) await abschliessen(db, String(a.id), user.id, cfg, 'neu')
    }
    if (einsatz > 0 && user) {
      const bal = Number((await db.query('SELECT sternis FROM geo_profile WHERE user_id = $1', [user.id])).rows[0]?.sternis ?? 0)
      if (bal < einsatz) return { ok: false, error: `Nicht genug Geo-Sternis (${bal} von ${einsatz})`, status: 402 } as StartErgebnis
      await book(db, user.id, -einsatz, 'hl-einsatz', null, id, `Ziel ${ziel} · Quote ×${quote}`)
    }
    await db.query(
      `INSERT INTO geo_hl_runden (id, user_id, region, kategorie, art, stufe, tag, leben, einsatz, ziel, quote, wette, stand, raum_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
      [id, user?.id ?? null, region, kategorie, art, stufe, tag, leben, einsatz, ziel, quote, einsatz > 0 ? 'offen' : null, JSON.stringify(st), extra.raumId ?? null],
    )
    return null
  }
  try {
    // Mehrspieler-Start läuft schon in einer Sperre des Raums (extra.db)
    const fehler = extra.db ? await insert(extra.db) : user ? await withUser(user.id, insert) : await insert(pool as unknown as Db)
    if (fehler) return fehler
  } catch (e) {
    // Zwei Tagesrunden gleichzeitig gestartet → eindeutiger Index greift
    if (String((e as Error).message).includes('geo_hl_runden_tag_idx')) return { ok: false, error: 'Die heutige Tagesrunde hast du schon gespielt', status: 409 }
    throw e
  }
  const row = (await (extra.db ?? pool).query('SELECT * FROM geo_hl_runden WHERE id = $1', [id])).rows[0] as unknown as RundeRow
  return { ok: true, runde: await rundeFuerBrowser(row, cfg) }
}

/* ───────────── Tipp ───────────── */

export interface Aufloesung {
  richtig: boolean
  grund?: 'zeit' | 'sprint-ende'
  rechts: Karte
  punkte: number
  multi: number
  stufeHoch: boolean
  wette?: { status: 'gewonnen' | 'verloren'; betrag: number }
  ende?: Belohnung
}
export interface Belohnung { xp: XpPart[]; sternis: SterniPart[]; rekord: boolean; vorher: number }

export async function tippen(user: { id: string } | null, id: string, wahl: 'hoeher' | 'niedriger' | 'zeit'): Promise<{ ok: true; aufloesung: Aufloesung; runde: Awaited<ReturnType<typeof rundeFuerBrowser>> } | { ok: false; error: string; status: number }> {
  const cfg = await loadHlConfig()
  const run = async (db: Db) => {
    const r = (await db.query('SELECT * FROM geo_hl_runden WHERE id = $1 FOR UPDATE', [id])).rows[0] as unknown as RundeRow | undefined
    if (!r) return { ok: false as const, error: 'Runde nicht gefunden', status: 404 }
    if (r.status !== 'laeuft') return { ok: false as const, error: 'Die Runde ist schon vorbei', status: 409 }
    if (r.stand.team && r.raum_id) {
      // Team: nur wer gerade dran ist
      const dran = await teamAmZug(db, r.raum_id, r.richtige + r.fehler)
      if (!user || dran !== user.id) return { ok: false as const, error: 'Du bist gerade nicht dran', status: 403 }
    } else if ((r.user_id ?? null) !== (user?.id ?? null)) return { ok: false as const, error: 'Das ist nicht deine Runde', status: 403 }
    const st = r.stand
    const w = await werteVon(st.kat)
    const vL = w[st.links]?.[0], vR = w[st.rechts]?.[0]
    const jetzt = Date.now()
    let richtig = vR === vL || (wahl === 'hoeher' ? vR > vL : vR < vL)
    let grund: Aufloesung['grund']
    if (r.art === 'sprint' && st.ende && jetzt > st.ende + 1500) { richtig = false; grund = 'sprint-ende' }
    // Zeitlimit bei laufender Wette: zu spät (oder der Browser meldet „Zeit abgelaufen“) = falsch
    if (r.wette === 'offen' && cfg.wetten.zeit && (wahl === 'zeit' || jetzt > st.gezeigt + cfg.wetten.zeit * 1000 + 1500)) { richtig = false; grund = 'zeit' }
    else if (wahl === 'zeit') richtig = false

    const rechtsOffen = await karte(st.kat, st.rechts, true)
    let punkte = 0
    const multiVorher = stufenIndex(r.serie, cfg)
    let wette: Aufloesung['wette']
    let ende = false
    if (grund === 'sprint-ende') {
      ende = true
    } else if (richtig) {
      r.richtige++
      r.serie++
      r.beste_serie = Math.max(r.beste_serie, r.serie)
      punkte = Math.round(cfg.grund * multiplikator(r.serie, cfg))
      r.punkte += punkte
      if (r.wette === 'offen' && r.ziel && r.serie >= r.ziel && r.user_id) {
        const betrag = Math.floor(r.einsatz * Number(r.quote))
        await book(db, r.user_id, betrag, 'hl-wette', null, r.id, `Ziel ${r.ziel} geschafft · ×${Number(r.quote)}`)
        r.wette = 'gewonnen'
        wette = { status: 'gewonnen', betrag }
      }
    } else {
      r.fehler++
      if (r.wette === 'offen') { r.wette = 'verloren'; wette = { status: 'verloren', betrag: r.einsatz } }
      if (r.art === 'klassisch' || r.art === 'tag') ende = true
      else if (r.art === 'leben') {
        r.leben = (r.leben ?? 1) - 1
        // Bonus-Stufe fällt eine Stufe zurück
        const i = stufenIndex(r.serie, cfg)
        r.serie = i > 0 ? cfg.stufen[i - 1].ab : 0
        if (r.leben <= 0) ende = true
      } else if (r.art === 'sprint') {
        r.serie = 0
        if (st.ende) st.ende -= cfg.sprintStrafe * 1000
        if (st.ende && Date.now() > st.ende) ende = true
      }
    }
    const stufeHoch = stufenIndex(r.serie, cfg) > multiVorher

    // Nächstes Paar: die rechte Karte rutscht nach links
    if (!ende) {
      st.schritt++
      const neu = { ...st, links: st.rechts }
      const rr = rng((st.seed + st.schritt * 7919) >>> 0)
      const n = await naechstes(neu, r.region, r.stufe, r.serie, r.kategorie, cfg, rr)
      if (!n) ende = true
      else {
        st.links = neu.links; st.kat = n.kat; st.rechts = n.id
        st.benutzt = [...neu.benutzt.filter(x => x !== n.id), n.id].slice(-200)
        st.gezeigt = Date.now()
      }
    }
    await db.query(
      `UPDATE geo_hl_runden SET richtige = $2, fehler = $3, serie = $4, beste_serie = $5, punkte = $6, leben = $7, wette = $8, stand = $9, updated_at = now() WHERE id = $1`,
      [r.id, r.richtige, r.fehler, r.serie, r.beste_serie, r.punkte, r.leben, r.wette, JSON.stringify(st)],
    )
    let belohnung: Belohnung | undefined
    if (ende) belohnung = await abschliessen(db, r.id, r.user_id, cfg, 'ende')
    return { ok: true as const, aufloesung: { richtig, grund, rechts: rechtsOffen, punkte, multi: multiplikator(r.serie, cfg), stufeHoch, wette, ende: belohnung } }
  }
  const out = user ? await withUser(user.id, run) : await txOhneUser(run)
  if (!out.ok) return out
  const row = (await pool.query('SELECT * FROM geo_hl_runden WHERE id = $1', [id])).rows[0] as RundeRow
  if (out.aufloesung.ende && user && row.user_id === user.id) {
    // Level-Sternis nach den neuen XP
    const lv = await syncLevelSternis(user.id, await loadConfig()).catch(() => [])
    out.aufloesung.ende.sternis.push(...lv)
  }
  return { ok: true, aufloesung: out.aufloesung, runde: await rundeFuerBrowser(row, cfg) }
}

export async function txOhneUser<T>(fn: (db: Db) => Promise<T>): Promise<T> {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const out = await fn(client as unknown as Db)
    await client.query('COMMIT')
    return out
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {})
    throw e
  } finally {
    client.release()
  }
}

/** Runde aufgeben (oder Sprint-Zeit abgelaufen) */
export async function rundeBeenden(user: { id: string } | null, id: string) {
  const cfg = await loadHlConfig()
  const run = async (db: Db) => {
    const r = (await db.query('SELECT user_id, status FROM geo_hl_runden WHERE id = $1 FOR UPDATE', [id])).rows[0]
    if (!r) return { ok: false as const, error: 'Runde nicht gefunden', status: 404 }
    if ((r.user_id ?? null) !== (user?.id ?? null)) return { ok: false as const, error: 'Das ist nicht deine Runde', status: 403 }
    if (r.status !== 'laeuft') return { ok: false as const, error: 'Die Runde ist schon vorbei', status: 409 }
    return { ok: true as const, ende: await abschliessen(db, id, user?.id ?? null, cfg, 'aufgegeben') }
  }
  const out = user ? await withUser(user.id, run) : await txOhneUser(run)
  if (!out.ok) return out
  if (user) out.ende.sternis.push(...(await syncLevelSternis(user.id, await loadConfig()).catch(() => [])))
  const row = (await pool.query('SELECT * FROM geo_hl_runden WHERE id = $1', [id])).rows[0] as RundeRow
  return { ok: true as const, ende: out.ende, runde: await rundeFuerBrowser(row, cfg) }
}

/**
 * Runde abschließen: Status, offene Wette verloren, XP + Sternis aus den Punkten, Rekord-Bonus.
 * Läuft innerhalb von withUser (Profil gesperrt) – darum direkt mit db buchen.
 */
export async function abschliessen(db: Db, id: string, userId: string | null, cfg: HlConfig, wie: 'ende' | 'aufgegeben' | 'neu'): Promise<Belohnung> {
  const r = (await db.query('SELECT * FROM geo_hl_runden WHERE id = $1', [id])).rows[0] as unknown as RundeRow
  const leer: Belohnung = { xp: [], sternis: [], rekord: false, vorher: 0 }
  if (!r || r.status !== 'laeuft') return leer
  const wette = r.wette === 'offen' ? 'verloren' : r.wette
  let xp = 0, sternis = 0, rekord = false, vorher = 0
  const out: Belohnung = { ...leer, xp: [], sternis: [] }
  if (userId) {
    const best = await db.query(
      `SELECT COALESCE(max(richtige), 0)::int AS b FROM geo_hl_runden
       WHERE user_id = $1 AND region = $2 AND kategorie = $3 AND art = $4 AND stufe = $5 AND status = 'beendet' AND NOT COALESCE((stand->>'team')::boolean, false)`,
      [userId, r.region, r.kategorie, r.art, r.stufe],
    )
    vorher = Number(best.rows[0].b)
    xp = Math.floor(r.punkte / cfg.xpTeiler)
    sternis = Math.floor(r.punkte / cfg.sterniTeiler)
    if (cfg.tagesLimit > 0 && sternis > 0) {
      const heute = await db.query(
        `SELECT COALESCE(sum(amount), 0)::int AS n FROM geo_sterni_log WHERE user_id = $1 AND reason IN ('hl-runde', 'hl-rekord') AND created_at > now() - interval '1 day'`,
        [userId],
      )
      sternis = Math.max(0, Math.min(sternis, cfg.tagesLimit - Number(heute.rows[0].n)))
    }
    if (xp > 0) {
      await db.query(`INSERT INTO geo_xp_log (user_id, amount, reason, slug, ref) VALUES ($1, $2, 'hl', $3, $4)`, [userId, xp, `hl:${r.kategorie}`, r.id])
      await db.query(
        `INSERT INTO geo_profile (user_id, xp) VALUES ($1, GREATEST(0, $2)) ON CONFLICT (user_id) DO UPDATE SET xp = GREATEST(0, geo_profile.xp + $2), updated_at = now()`,
        [userId, xp],
      )
      out.xp.push({ reason: 'hl', amount: xp, label: `${r.punkte.toLocaleString('de-DE')} Punkte` })
    }
    if (sternis > 0) {
      await book(db, userId, sternis, 'hl-runde', null, r.id)
      out.sternis.push({ reason: 'hl-runde', amount: sternis, label: 'Higher-Lower-Runde', kind: 'sterni' })
    }
    if (r.richtige > vorher && r.richtige >= cfg.rekordMin && cfg.rekordBonus > 0 && r.art !== 'tag' && !r.stand.team) {
      rekord = true
      await book(db, userId, cfg.rekordBonus, 'hl-rekord', null, r.id, `${r.richtige} richtige`)
      out.sternis.push({ reason: 'hl-rekord', amount: cfg.rekordBonus, label: 'Neuer Rekord', kind: 'sterni' })
    } else if (r.richtige > vorher) rekord = true
  }
  await db.query(
    `UPDATE geo_hl_runden SET status = 'beendet', wette = $2, xp = $3, sternis = $4, ended_at = now(), updated_at = now(),
       stand = stand || jsonb_build_object('wie', $5::text) WHERE id = $1`,
    [id, wette, xp, sternis, wie],
  )
  return { ...out, rekord, vorher }
}

/**
 * Team: wer ist beim Paar Nummer `nr` dran? Reihum unter den Spielern, die gerade da sind
 * (in den letzten 30 Sekunden gesehen) – wer weg ist, wird übersprungen.
 */
export async function teamAmZug(db: Db, raumId: string, nr: number): Promise<string | null> {
  const p = await db.query(
    `SELECT user_id, last_seen > now() - interval '30 seconds' AS da FROM geo_hl_raum_spieler
     WHERE raum_id = $1 AND NOT verlassen ORDER BY joined_at`,
    [raumId],
  )
  const da = p.rows.filter(x => x.da)
  const liste = da.length ? da : p.rows
  return liste.length ? String(liste[nr % liste.length].user_id) : null
}

/* ───────────── Laufende Runde, Rekorde, Rangliste ───────────── */

export async function laufendeRunde(userId: string) {
  const cfg = await loadHlConfig()
  // Runden aus Mehrspieler-Räumen laufen auf der Raum-Seite weiter
  const r = (await pool.query(`SELECT * FROM geo_hl_runden WHERE user_id = $1 AND status = 'laeuft' AND raum_id IS NULL ORDER BY started_at DESC LIMIT 1`, [userId])).rows[0] as unknown as RundeRow | undefined
  if (!r) return null
  // Sprint, dessen Zeit längst abgelaufen ist → abschließen
  if (r.art === 'sprint' && r.stand.ende && Date.now() > r.stand.ende + 5000) {
    await rundeBeenden({ id: userId }, r.id)
    return null
  }
  return rundeFuerBrowser(r, cfg)
}

export async function meineRekorde(userId: string): Promise<Record<string, number>> {
  const r = await pool.query(
    `SELECT region, kategorie, art, stufe, max(richtige)::int AS b FROM geo_hl_runden
     WHERE user_id = $1 AND status = 'beendet' AND NOT COALESCE((stand->>'team')::boolean, false) GROUP BY region, kategorie, art, stufe`,
    [userId],
  )
  return Object.fromEntries(r.rows.map(x => [`${x.region}|${x.kategorie}|${x.art}|${x.stufe}`, Number(x.b)]))
}

export type Zeitraum = 'heute' | 'woche' | 'alle'

export async function rangliste(o: { region: HlRegion; kategorie: string; art: HlArt; stufe: HlStufe; zeitraum: Zeitraum; userId: string | null }) {
  const seit = o.zeitraum === 'heute' ? `AND r.ended_at > now() - interval '1 day'` : o.zeitraum === 'woche' ? `AND r.ended_at > now() - interval '7 days'` : ''
  const istTagesrunde = o.art === 'tag'
  const params: unknown[] = istTagesrunde ? [berlinDay(new Date())] : [o.region, o.kategorie, o.art, o.stufe]
  const where = istTagesrunde ? `r.art = 'tag' AND r.tag = $1` : `r.region = $1 AND r.kategorie = $2 AND r.art = $3 AND r.stufe = $4 ${seit}`
  const r = await pool.query(
    `SELECT b.user_id, u.username, COALESCE(u.anzeigename, u.username) AS name, b.richtige, b.punkte, b.ended_at FROM (
       SELECT DISTINCT ON (r.user_id) r.user_id, r.richtige, r.punkte, r.ended_at FROM geo_hl_runden r
       WHERE r.status = 'beendet' AND r.user_id IS NOT NULL AND r.richtige > 0 AND NOT COALESCE((r.stand->>'team')::boolean, false) AND ${where}
       ORDER BY r.user_id, r.richtige DESC, r.punkte DESC, r.ended_at ASC
     ) b JOIN users u ON u.id = b.user_id LEFT JOIN geo_profile p ON p.user_id = b.user_id
     WHERE COALESCE(p.hidden, false) = false
     ORDER BY b.richtige DESC, b.punkte DESC, b.ended_at ASC LIMIT 25`,
    params,
  )
  return r.rows.map((x, i) => ({ platz: i + 1, name: x.name, username: x.username, richtige: Number(x.richtige), punkte: Number(x.punkte), ich: x.user_id === o.userId }))
}

/** Tagesrunde von gestern (und älter, falls noch offen): Platz 1–3 bekommen ihren Bonus (einmal) */
export async function tagesBonusAuszahlen() {
  const cfg = await loadHlConfig()
  if (!cfg.tagBonus.some(b => b > 0)) return
  await cached('tagbonus', 10 * 60000, async () => {
    const heute = berlinDay(new Date())
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      await client.query(`SELECT pg_advisory_xact_lock(74210311)`)
      const tage = await client.query(
        `SELECT DISTINCT tag FROM geo_hl_runden WHERE art = 'tag' AND tag < $1 AND tag >= $1 - 7 AND status = 'beendet'`, [heute],
      )
      for (const t of tage.rows) {
        const tag = Number(t.tag)
        const schon = await client.query(`SELECT 1 FROM geo_sterni_log WHERE reason = 'hl-tag' AND ref LIKE $1 LIMIT 1`, [`${tag}:%`])
        if (schon.rowCount) continue
        const top = await client.query(
          `SELECT r.user_id FROM geo_hl_runden r LEFT JOIN geo_profile p ON p.user_id = r.user_id
           WHERE r.art = 'tag' AND r.tag = $1 AND r.status = 'beendet' AND r.richtige > 0 AND COALESCE(p.hidden, false) = false
           ORDER BY r.richtige DESC, r.punkte DESC, r.ended_at ASC LIMIT 3`, [tag],
        )
        for (let i = 0; i < top.rows.length; i++) {
          const amount = cfg.tagBonus[i] ?? 0
          if (amount <= 0) continue
          const uid = String(top.rows[i].user_id)
          await client.query('UPDATE geo_profile SET sternis = sternis + $2, updated_at = now() WHERE user_id = $1', [uid, amount])
          await client.query(`INSERT INTO geo_sterni_log (user_id, amount, reason, ref, note) VALUES ($1, $2, 'hl-tag', $3, $4)`, [uid, amount, `${tag}:${i + 1}`, `Tagesrunde Platz ${i + 1}`])
        }
      }
      await client.query('COMMIT')
    } catch (e) {
      await client.query('ROLLBACK').catch(() => {})
      console.error('geo/hl tagesbonus', e)
    } finally {
      client.release()
    }
    return true
  })
}

/** Heutige Tagesrunde des Spielers (falls gespielt) */
export async function meineTagesrunde(userId: string) {
  const r = await pool.query(`SELECT richtige, punkte, status FROM geo_hl_runden WHERE user_id = $1 AND art = 'tag' AND tag = $2`, [userId, berlinDay(new Date())])
  const x = r.rows[0]
  return x ? { richtige: Number(x.richtige), punkte: Number(x.punkte), laeuft: x.status === 'laeuft' } : null
}

/* ───────────── Adminpanel ───────────── */

export async function hlAdminDaten() {
  const [cfg, korr] = await Promise.all([loadHlConfig(), loadKorrekturen()])
  let stats = { runden: 0, runden_tag: 0, spieler: 0, einsatz: 0, ausgezahlt: 0, sternis: 0, beste: 0 }
  let kats: { kategorie: string; n: number; r: number; f: number }[] = []
  let top: { name: string; richtige: number; kategorie: string; region: string; art: string; stufe: string }[] = []
  try {
    const s = await pool.query(`SELECT
      (SELECT count(*)::int FROM geo_hl_runden) AS runden,
      (SELECT count(*)::int FROM geo_hl_runden WHERE started_at > now() - interval '24 hours') AS runden_tag,
      (SELECT count(DISTINCT user_id)::int FROM geo_hl_runden) AS spieler,
      (SELECT COALESCE(-sum(amount), 0)::int FROM geo_sterni_log WHERE reason = 'hl-einsatz') AS einsatz,
      (SELECT COALESCE(sum(amount), 0)::int FROM geo_sterni_log WHERE reason = 'hl-wette') AS ausgezahlt,
      (SELECT COALESCE(sum(amount), 0)::int FROM geo_sterni_log WHERE reason IN ('hl-runde', 'hl-rekord', 'hl-tag', 'hl-team')) AS sternis,
      (SELECT COALESCE(max(richtige), 0)::int FROM geo_hl_runden) AS beste`)
    stats = s.rows[0] as typeof stats
    const k = await pool.query(`SELECT kategorie, count(*)::int AS n, sum(richtige)::int AS r, sum(fehler)::int AS f FROM geo_hl_runden
      WHERE started_at > now() - interval '30 days' GROUP BY kategorie ORDER BY n DESC`)
    kats = k.rows.map(x => ({ kategorie: x.kategorie, n: Number(x.n), r: Number(x.r), f: Number(x.f) }))
    const t = await pool.query(`SELECT u.username, COALESCE(u.anzeigename, u.username) AS name, r.richtige, r.kategorie, r.region, r.art, r.stufe FROM geo_hl_runden r JOIN users u ON u.id = r.user_id
      WHERE r.status = 'beendet' ORDER BY r.richtige DESC, r.ended_at ASC LIMIT 10`)
    top = t.rows.map(x => ({ name: x.name, username: x.username, richtige: Number(x.richtige), kategorie: x.kategorie, region: x.region, art: x.art, stufe: x.stufe }))
  } catch { /* Tabelle fehlt noch */ }
  return { config: cfg, korrekturen: korr, stats, kategorien: kats, top, stand: D.stand }
}

/** Werte einer Kategorie für das Adminpanel (mit Korrekturen markiert) */
export async function hlAdminWerte(kat: string) {
  const korr = (await loadKorrekturen())[kat] ?? {}
  const base = D.werte[kat] ?? {}
  const ids = [...new Set([...Object.keys(base), ...Object.keys(korr)])]
  return ids.map(id => ({
    id, name: D.laender[id]?.name ?? id, original: base[id]?.[0] ?? null, jahr: base[id]?.[1] ?? null,
    korrektur: korr[id] ?? null,
  })).sort((a, b) => a.name.localeCompare(b.name, 'de'))
}

export const HL_LAENDER_LISTE = () => Object.entries(D.laender).map(([id, l]) => ({ id, name: l.name })).sort((a, b) => a.name.localeCompare(b.name, 'de'))

/* ───────────── Länderseiten (/geo/land/<slug>) ───────────── */

export interface HlLandZeile {
  key: string; name: string; icon: string; gruppe: HlKategorie['gruppe']; einheit: string
  wert: number; text: string; jahr: number | null; zusatz?: string
  /** Platz weltweit (1 = höchster Wert) und Anzahl Länder mit Wert */
  rang: number; von: number
  /** Mittelwert (Median) aller Länder – für die Diagramme */
  median: number; medianText: string
  /** Werte der Vergleichsländer (Nachbarn) */
  vergleich: { id: string; name: string; wert: number; text: string }[]
  quelle: string; url: string
}

/**
 * Alle Higher-Lower-Werte eines Landes (mit Korrekturen aus dem Adminpanel, ohne ausgeschaltete Kategorien),
 * dazu Platz weltweit und die Werte der Vergleichsländer.
 */
export async function hlLandWerte(id: string, vergleich: string[]): Promise<HlLandZeile[]> {
  const cfg = await loadHlConfig()
  const out: HlLandZeile[] = []
  for (const k of HL_KATEGORIEN) {
    if (cfg.kategorien[k.key]?.aus) continue
    const w = await werteVon(k.key)
    const eig = w[id]
    if (!eig) continue
    const alle = Object.entries(w).filter(([x]) => D.laender[x]).map(([x, v]) => [x, v[0]] as const).sort((a, b) => b[1] - a[1])
    const zahlen = alle.map(a => a[1]).sort((a, b) => a - b)
    const median = zahlen.length % 2 ? zahlen[(zahlen.length - 1) / 2] : (zahlen[zahlen.length / 2 - 1] + zahlen[zahlen.length / 2]) / 2
    out.push({
      key: k.key, name: k.name, icon: k.icon, gruppe: k.gruppe, einheit: k.einheit,
      wert: eig[0], text: fmtWert(eig[0], k), jahr: eig[1], zusatz: await zusatzText(k.key, id, eig),
      rang: alle.findIndex(a => a[0] === id) + 1, von: alle.length, median, medianText: fmtWert(median, k),
      vergleich: vergleich.filter(x => w[x] && D.laender[x]).map(x => ({ id: x, name: D.laender[x].name, wert: w[x][0], text: fmtWert(w[x][0], k) })),
      quelle: k.quelle, url: k.url,
    })
  }
  return out
}
