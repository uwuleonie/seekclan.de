import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'
import { checkOrigin, csrfError } from '@/app/lib/csrf'
import { checkRateLimit, getIP, rateLimitResponse } from '@/app/lib/rate-limit'
import { getGeoUser, isGeoAdmin } from '@/app/lib/geo-server'
import {
  HL_ARTEN_KEYS, HL_REGIONEN, HL_STUFEN_KEYS, kategorienIn, laufendeRunde, loadHlConfig, meineRekorde, meineTagesrunde,
  quoteBerechnen, rangliste, rundeBeenden, rundeStarten, tagesBonusAuszahlen, tippen, type Zeitraum,
} from '@/app/lib/geo-hl'
import { MIX, hlGesperrtBis, type HlArt, type HlStufe } from '@/app/geo/_lib/hl'
import {
  raumAendern, raumBeitreten, raumErstellen, raumNachTipp, raumNochmal, raumPruefen, raumStarten, raumVerlassen, raumVorschlag, raumZustand,
} from '@/app/lib/geo-hl-raum'
import type { HlRegion } from '@/app/geo/_data/hl'

// Higher Lower (seekclan.de/geo/higher-lower)
//
// GET  /api/geo/hl                                    → { config, kategorien je Region, eingeloggt, sternis, rekorde, laufend, tagesrunde }
// GET  /api/geo/hl?was=quote&region&kat&stufe&ziel     → { quote, p, antworten, max }   (Wett-Quote vorab anzeigen)
// GET  /api/geo/hl?was=rangliste&region&kat&art&stufe&zeitraum=heute|woche|alle → { liste }
// POST /api/geo/hl  { action: 'start', region, kategorie, art, stufe, einsatz?, ziel? } → { runde }
//                   { action: 'tipp', id, wahl: 'hoeher' | 'niedriger' | 'zeit' }         → { aufloesung, runde }
//                   { action: 'ende', id }                                             → { ende, runde }
//
// Mehrspieler (Räume, seekclan.de/geo/higher-lower/raum/<id>):
// GET  /api/geo/hl?raum=<id>                           → { raum, spieler, meineRunde, ichDrin, isHost }
// POST { action: 'raum-neu', modus: 'duell'|'team', region, kategorie, art, stufe, einsatz? } → { id }
//      { action: 'raum-beitreten' | 'raum-verlassen' | 'raum-start' | 'raum-nochmal', raum }
//      { action: 'raum-aendern', raum, region?, kategorie?, art?, stufe?, einsatz? }   (Gastgeber, im Warteraum)
//      { action: 'raum-vorschlag', raum, wahl: 'hoeher'|'niedriger'|null }            (Team: Vorschlag an den, der dran ist)

const ID = /^[A-Za-z0-9_-]{8,20}$/
const RAUM = /^[A-Za-z0-9_-]{6,12}$/
const KAT = /^[a-z0-9-]{2,40}$/
const region = (v: unknown): HlRegion | null => (HL_REGIONEN.includes(v as HlRegion) ? (v as HlRegion) : null)
const art = (v: unknown): HlArt | null => (HL_ARTEN_KEYS.includes(v as HlArt) ? (v as HlArt) : null)
const stufe = (v: unknown): HlStufe | null => (HL_STUFEN_KEYS.includes(v as HlStufe) ? (v as HlStufe) : null)
const noStore = { headers: { 'Cache-Control': 'no-store' } }

// Kleine Bremse gegen Dauerfeuer auf einzelne Runden (max. 6 Tipps pro Sekunde)
const tippZeit = new Map<string, number[]>()
function zuSchnell(id: string) {
  const now = Date.now()
  const a = (tippZeit.get(id) ?? []).filter(t => now - t < 1000)
  a.push(now)
  tippZeit.set(id, a)
  if (tippZeit.size > 5000) tippZeit.clear()
  return a.length > 6
}

export async function GET(req: NextRequest) {
  const user = await getGeoUser(req).catch(() => null)
  const q = req.nextUrl.searchParams
  try {
    const cfg = await loadHlConfig()
    const admin = isGeoAdmin(user)
    if (!cfg.aktiv && !admin) return NextResponse.json({ aus: true }, noStore)
    // Noch nicht freigeschaltet: normale Nutzer sehen nur den Countdown (Admins können schon spielen)
    const gesperrt = hlGesperrtBis(cfg)
    if (gesperrt && !admin) return NextResponse.json({ gesperrt: new Date(gesperrt).toISOString(), eingeloggt: !!user }, noStore)
    const was = q.get('was') ?? 'info'

    const raumId = q.get('raum')
    if (raumId) {
      if (!RAUM.test(raumId)) return NextResponse.json({ error: 'Ungültiger Link' }, { status: 400 })
      const st = await raumZustand(user, raumId)
      if (!st) return NextResponse.json({ error: 'Raum nicht gefunden' }, { status: 404 })
      return NextResponse.json(st, noStore)
    }

    if (was === 'quote') {
      const r = region(q.get('region')), s = stufe(q.get('stufe')), kat = q.get('kat') ?? ''
      const ziel = Math.floor(Number(q.get('ziel')))
      if (!r || !s || !(kat === MIX || KAT.test(kat)) || !(ziel >= 1 && ziel <= 500)) return NextResponse.json({ error: 'Ungültige Daten' }, { status: 400 })
      const o = await quoteBerechnen(r, kat, s, ziel, cfg)
      return NextResponse.json({ ...o, p: Math.round(o.p * 1000) / 1000, gesperrt: !!cfg.kategorien[kat]?.wettenAus }, noStore)
    }

    if (was === 'rangliste') {
      const r = region(q.get('region')) ?? 'welt', a = art(q.get('art')) ?? 'klassisch', s = stufe(q.get('stufe')) ?? 'mittel'
      const kat = q.get('kat') ?? MIX
      const z = (['heute', 'woche', 'alle'].includes(q.get('zeitraum') ?? '') ? q.get('zeitraum') : 'alle') as Zeitraum
      if (!(kat === MIX || KAT.test(kat))) return NextResponse.json({ error: 'Ungültige Daten' }, { status: 400 })
      return NextResponse.json({ liste: await rangliste({ region: r, kategorie: kat, art: a, stufe: s, zeitraum: z, userId: user?.id ?? null }) }, noStore)
    }

    tagesBonusAuszahlen().catch(() => {})
    const kategorien = Object.fromEntries(HL_REGIONEN.map(r => [r, kategorienIn(r, cfg).map(k => k.key)]))
    let me: Record<string, unknown> = { eingeloggt: false }
    if (user) {
      const [p, rek, lauf, tag] = await Promise.all([
        pool.query('SELECT sternis FROM geo_profile WHERE user_id = $1', [user.id]),
        meineRekorde(user.id).catch(() => ({})),
        laufendeRunde(user.id).catch(() => null),
        meineTagesrunde(user.id).catch(() => null),
      ])
      me = { eingeloggt: true, name: user.name ?? user.username, sternis: Number(p.rows[0]?.sternis ?? 0), rekorde: rek, laufend: lauf, tagesrunde: tag }
    }
    return NextResponse.json({
      config: {
        aktiv: cfg.aktiv, freigabe: cfg.freigabe, gesperrtBis: gesperrt ? new Date(gesperrt).toISOString() : null, grund: cfg.grund, stufen: cfg.stufen, xpTeiler: cfg.xpTeiler, sterniTeiler: cfg.sterniTeiler,
        rekordBonus: cfg.rekordBonus, rekordMin: cfg.rekordMin, leben: cfg.leben, sprintSek: cfg.sprintSek, sprintStrafe: cfg.sprintStrafe,
        arten: cfg.arten, tagBonus: cfg.tagBonus,
        wetten: { an: cfg.wetten.an, minZiel: cfg.wetten.minZiel, maxZiel: cfg.wetten.maxZiel, maxEinsatz: cfg.wetten.maxEinsatz, zeit: cfg.wetten.zeit, maxQuote: cfg.wetten.maxQuote },
        mehrspieler: cfg.mehrspieler,
        wettenAus: Object.entries(cfg.kategorien).filter(([, v]) => v.wettenAus).map(([k]) => k),
      },
      kategorien, admin, ...me,
    }, noStore)
  } catch (err: unknown) {
    console.error('geo/hl GET', err)
    return NextResponse.json({ error: 'Konnte nicht geladen werden' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  if (!checkOrigin(req)) return csrfError()
  const user = await getGeoUser(req).catch(() => null)
  const b = await req.json().catch(() => ({}))
  try {
    if (b.action === 'start') {
      const rl = await checkRateLimit(`hl:${getIP(req)}:${user?.id ?? '-'}`, 'api')
      if (!rl.allowed) return rateLimitResponse(rl)
      const r = region(b.region), a = art(b.art), s = stufe(b.stufe), kat = String(b.kategorie ?? '')
      if (!r || !a || !s || !(kat === MIX || KAT.test(kat))) return NextResponse.json({ error: 'Ungültige Daten' }, { status: 400 })
      const out = await rundeStarten(user, { region: r, kategorie: kat, art: a, stufe: s, einsatz: Number(b.einsatz) || 0, ziel: Number(b.ziel) || 0 }, isGeoAdmin(user))
      if (!out.ok) return NextResponse.json({ error: out.error }, { status: out.status })
      return NextResponse.json({ runde: out.runde })
    }
    if (typeof b.action === 'string' && b.action.startsWith('raum-')) {
      if (!user) return NextResponse.json({ error: 'Zum Mitspielen bitte einloggen' }, { status: 401 })
      if (b.action === 'raum-neu') {
        const rl = await checkRateLimit(`hl:${getIP(req)}:${user.id}`, 'api')
        if (!rl.allowed) return rateLimitResponse(rl)
        const r = region(b.region), a = art(b.art), s = stufe(b.stufe), kat = String(b.kategorie ?? '')
        const modus = b.modus === 'team' ? 'team' : b.modus === 'duell' ? 'duell' : null
        if (!r || !a || !s || !modus || !(kat === MIX || KAT.test(kat))) return NextResponse.json({ error: 'Ungültige Daten' }, { status: 400 })
        const out = await raumErstellen(user, { modus, region: r, kategorie: kat, art: a, stufe: s, einsatz: Number(b.einsatz) || 0 }, isGeoAdmin(user))
        if (!out.ok) return NextResponse.json({ error: out.error }, { status: out.status })
        return NextResponse.json({ id: out.id })
      }
      const raumId = String(b.raum ?? '')
      if (!RAUM.test(raumId)) return NextResponse.json({ error: 'Ungültiger Raum' }, { status: 400 })
      let out: { ok: true } | { ok: false; error: string; status: number }
      switch (b.action) {
        case 'raum-beitreten': out = await raumBeitreten(user, raumId, isGeoAdmin(user)); break
        case 'raum-verlassen': out = await raumVerlassen(user, raumId); break
        case 'raum-start': out = await raumStarten(user, raumId); break
        case 'raum-nochmal': out = await raumNochmal(user, raumId); break
        case 'raum-vorschlag': out = await raumVorschlag(user, raumId, b.wahl === 'hoeher' || b.wahl === 'niedriger' ? b.wahl : null); break
        case 'raum-aendern': {
          const o: Parameters<typeof raumAendern>[2] = {}
          if (b.region !== undefined) { const r = region(b.region); if (!r) return NextResponse.json({ error: 'Ungültige Region' }, { status: 400 }); o.region = r }
          if (b.art !== undefined) { const a = art(b.art); if (!a) return NextResponse.json({ error: 'Ungültige Spielart' }, { status: 400 }); o.art = a }
          if (b.stufe !== undefined) { const s = stufe(b.stufe); if (!s) return NextResponse.json({ error: 'Ungültige Stufe' }, { status: 400 }); o.stufe = s }
          if (b.kategorie !== undefined) { const k = String(b.kategorie); if (!(k === MIX || KAT.test(k))) return NextResponse.json({ error: 'Ungültige Kategorie' }, { status: 400 }); o.kategorie = k }
          if (b.einsatz !== undefined) o.einsatz = Number(b.einsatz) || 0
          out = await raumAendern(user, raumId, o)
          break
        }
        default: return NextResponse.json({ error: 'Unbekannte Aktion' }, { status: 400 })
      }
      if (!out.ok) return NextResponse.json({ error: out.error }, { status: out.status })
      return NextResponse.json(await raumZustand(user, raumId) ?? { weg: true })
    }

    const id = String(b.id ?? '')
    if (!ID.test(id)) return NextResponse.json({ error: 'Ungültige Runde' }, { status: 400 })
    if (b.action === 'tipp') {
      if (b.wahl !== 'hoeher' && b.wahl !== 'niedriger' && b.wahl !== 'zeit') return NextResponse.json({ error: 'Ungültiger Tipp' }, { status: 400 })
      if (zuSchnell(id)) return NextResponse.json({ error: 'Langsam!' }, { status: 429 })
      const out = await tippen(user, id, b.wahl)
      if (!out.ok) return NextResponse.json({ error: out.error }, { status: out.status })
      if (out.runde.raum && user) await raumNachTipp(out.runde.raum, user, out.aufloesung, out.runde.schritt).catch(e => console.error('geo/hl raumNachTipp', e))
      return NextResponse.json({ aufloesung: out.aufloesung, runde: out.runde })
    }
    if (b.action === 'ende') {
      const out = await rundeBeenden(user, id)
      if (!out.ok) return NextResponse.json({ error: out.error }, { status: out.status })
      if (out.runde.raum) await raumPruefen(out.runde.raum).catch(e => console.error('geo/hl raumPruefen', e))
      return NextResponse.json({ ende: out.ende, runde: out.runde })
    }
    return NextResponse.json({ error: 'Unbekannte Aktion' }, { status: 400 })
  } catch (err: unknown) {
    console.error('geo/hl POST', err)
    return NextResponse.json({ error: 'Fehler' }, { status: 500 })
  }
}