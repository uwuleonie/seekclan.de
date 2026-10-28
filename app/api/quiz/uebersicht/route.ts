import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'
import { getGeoUser, isGeoAdmin, type GeoUser } from '@/app/lib/geo-server'
import { loadConfig, loadGroupMeta, loadPopular, loadProfile, loadQuizMeta, loadReleases, loadUnlocks } from '@/app/lib/geo-data'
import { CATALOG, CATALOG_BY_SLUG, EMPTY_STATE, bereichName, decorate, isBuilt, statusOf, type CatalogState } from '@/app/geo/_lib/catalog'
import { itemCount } from '@/app/geo/_lib/items'
import { levelOf } from '@/app/geo/_lib/xp'
import { BEREICH_BY_KEY } from '@/app/geo/_content/welt'
import type { CatalogEntry } from '@/app/geo/_lib/types'
import { kartenBild } from '@/app/lib/quiz-karten'

// GET /api/quiz/uebersicht – alles für die Hauptseite seekclan.de/quiz in einer Anfrage.
//
//  kategorien – Zahlen je Kategorie (zurzeit nur geo: offene Quizzes, Einträge, bald verfügbar)
//  neu        – zuletzt freigeschaltete Quizzes (alle Kategorien, neueste zuerst), jeweils mit kleinem Kartenbild (app/lib/quiz-karten.ts)
//  bald       – die nächsten geplanten Freischaltungen
//  beliebt    – im Adminpanel festgelegte + meistgespielte Quizzes (nur offene)
//  ich        – eigenes Level, XP, Sternis, Platz (nur eingeloggt)
//  top        – die ersten 5 der Rangliste (falls Ranglisten im Adminpanel an sind)
//
// Gezählt wird, was der Besucher selbst spielen kann (offiziell freigeschaltet oder freigekauft).
// Admins sehen hier dieselben Zahlen wie alle anderen – die Vorschau gibt es in /geo.
// Quizzes, die im Adminpanel ausgeblendet sind, erscheinen nirgends.

interface QuizKurz {
  kategorie: 'geo'
  slug: string
  titel: string
  meta: string
  bereich: string
  farbe: string
  href: string
  /** Freischaltung (ISO) */
  at: string | null
}

const kurz = (e: CatalogEntry, at: string | null): QuizKurz => ({
  kategorie: 'geo',
  slug: e.slug,
  titel: e.title,
  meta: e.meta,
  bereich: bereichName(e.bereich),
  farbe: BEREICH_BY_KEY[e.bereich]?.color ?? '#e9b35f',
  href: `/geo/quiz/${e.slug}`,
  at,
})

export async function GET(req: NextRequest) {
  const headers = { 'Cache-Control': 'no-store' }
  let user: GeoUser | null = null
  try { user = await getGeoUser(req) } catch { /* nicht eingeloggt */ }

  try {
    const [config, meta, groups, releases, popular, unlocks] = await Promise.all([
      loadConfig(), loadQuizMeta(), loadGroupMeta(), loadReleases(), loadPopular(),
      user ? loadUnlocks(user.id).catch(() => [] as string[]) : Promise.resolve([] as string[]),
    ])

    // Status wie auf /geo – aber immer aus Sicht eines normalen Besuchers (admin: false)
    const state: CatalogState = {
      ...EMPTY_STATE,
      releases, now: Date.now(), role: user?.role ?? null, loggedIn: !!user, config,
      meta: meta as unknown as CatalogState['meta'], groups, unlocks, admin: false, preview: false,
    }
    const liste = CATALOG.map(e => ({ e: decorate(e, state), st: statusOf(e, state) })).filter(x => !x.st.adminOnly)

    const offen = liste.filter(x => !x.e.planned && (x.st.released || x.st.bought))
    const eintraege = offen.reduce((n, x) => n + (isBuilt(x.e) ? itemCount(x.e) : 0), 0)
    const baldAnzahl = liste.filter(x => !x.st.released).length

    const neuListe = liste
      .filter(x => x.st.released && x.st.releaseAt)
      .sort((a, b) => b.st.releaseAt!.localeCompare(a.st.releaseAt!))
      .slice(0, 6)
    const karten = await Promise.all(neuListe.map(x => kartenBild(x.e)))
    const neu = neuListe.map((x, i) => ({ ...kurz(x.e, x.st.releaseAt), frisch: x.st.isNew, karte: karten[i] }))

    const bald = liste
      .filter(x => !x.st.released && x.st.releaseAt && Date.parse(x.st.releaseAt) > state.now)
      .sort((a, b) => a.st.releaseAt!.localeCompare(b.st.releaseAt!))
      .slice(0, 5)
      .map(x => kurz(x.e, x.st.releaseAt))

    const beliebt: QuizKurz[] = []
    for (const slug of [...popular.pinned, ...popular.auto]) {
      const roh = CATALOG_BY_SLUG[slug]
      if (!roh || beliebt.some(b => b.slug === slug)) continue
      const x = liste.find(l => l.e.slug === slug)
      if (!x || !(x.st.released || x.st.bought)) continue
      beliebt.push(kurz(x.e, x.st.releaseAt))
      if (beliebt.length >= 6) break
    }

    // Eigenes Profil (Geo – bis es den gemeinsamen Quiz-Kern gibt)
    let ich: null | {
      name: string; username: string; xp: number; level: number; into: number; need: number; pct: number; sternis: number
      platz: number | null; versteckt: boolean; geloest: number; quizzes: number; left: number
    } = null
    if (user) {
      const [p, rang, prog] = await Promise.all([
        loadProfile(user.id, config),
        pool.query(`SELECT count(*)::int + 1 AS r FROM geo_profile WHERE hidden = false AND xp > COALESCE((SELECT xp FROM geo_profile WHERE user_id = $1), 0)`, [user.id]),
        pool.query('SELECT count(*)::int AS n, count(DISTINCT slug)::int AS q FROM geo_item_progress WHERE user_id = $1', [user.id]),
      ])
      ich = {
        name: user.name, username: user.username, xp: p.xp, level: p.level.level, into: p.level.into, need: p.level.need, pct: p.level.pct,
        sternis: p.sternis, platz: p.hidden || p.xp <= 0 ? null : rang.rows[0].r, versteckt: p.hidden,
        geloest: prog.rows[0]?.n ?? 0, quizzes: prog.rows[0]?.q ?? 0, left: p.level.left,
      }
    }

    // Rangliste: die ersten 5
    let top: { platz: number; name: string; username: string; level: number; xp: number; ich: boolean }[] = []
    if (config.leaderboards) {
      const r = await pool.query(
        `SELECT p.user_id, u.username, COALESCE(u.anzeigename, u.username) AS name, p.xp FROM geo_profile p JOIN users u ON u.id = p.user_id
         WHERE p.hidden = false AND p.xp > 0 ORDER BY p.xp DESC, p.updated_at ASC LIMIT 5`,
      )
      top = r.rows.map((x, i) => ({ platz: i + 1, name: x.name, username: x.username, xp: Number(x.xp), level: levelOf(Number(x.xp), config).level, ich: x.user_id === user?.id }))
    }

    return NextResponse.json({
      now: new Date(state.now).toISOString(),
      loggedIn: !!user,
      isAdmin: isGeoAdmin(user),
      kategorien: { geo: { offen: offen.length, eintraege, bald: baldAnzahl } },
      neu, bald, beliebt, ich, top, ranglisten: config.leaderboards,
    }, { headers })
  } catch (err: unknown) {
    console.error('quiz/uebersicht', err)
    return NextResponse.json({ error: 'Übersicht konnte nicht geladen werden' }, { status: 500, headers })
  }
}