import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'
import { getGeoUser, isGeoAdmin, type GeoUser } from '@/app/lib/geo-server'
import { loadBoosts, loadConfig, loadGroupMeta, loadPopular, loadQuizMeta, loadUnlocks, topUpPlan } from '@/app/lib/geo-data'

// GET /api/geo/catalog
// Alles, was die /geo-Seiten über den Katalog wissen müssen:
//  releases – Freischalt-Zeitpunkte (auch zukünftige – die Seite zeigt "ab <Datum>")
//  meta     – Überschreibungen aus dem Adminpanel (Titel, Beschreibung, Schwierigkeit, Sortierung, Sichtbarkeit, Spielarten, Beliebt)
//  groups   – Überschreibungen für Bereiche, Abschnitte und Länder (Name, Sortierung, Freischaltung, Sichtbarkeit)
//  boosts   – XP-Boosts (laufend, geplant, kürzlich vorbei – für Banner und Kalender)
//  config   – XP-Werte, Schwierigkeiten, Level-Formel
//  popular  – Beliebt: im Adminpanel festgelegte (pinned) + meistgespielte der letzten 30 Tage (auto)
//  unlocks  – mit Geo-Sternis freigekaufte Quizzes des Besuchers
// Vorher: Freischalt-Plan nachfüllen (topUpPlan, siehe app/lib/geo-data.ts)
// admin = administrator/owner (sehen alles), preview = Admin hat den Vorschau-Modus an, role = Clan-Rolle des Besuchers.
export async function GET(req: NextRequest) {
  let user: GeoUser | null = null
  try { user = await getGeoUser(req) } catch { /* nicht eingeloggt */ }
  const admin = isGeoAdmin(user)
  const preview = admin && req.cookies.get('geo_preview')?.value === '1'

  // Freischalt-Plan: neue Quizzes ohne Termin automatisch einplanen (falls im Adminpanel eingeschaltet)
  await topUpPlan()
  const [config, meta, groups, boosts, popular, unlocks] = await Promise.all([
    loadConfig(), loadQuizMeta(), loadGroupMeta(), loadBoosts(), loadPopular(), user ? loadUnlocks(user.id).catch(() => []) : Promise.resolve([] as string[]),
  ])
  const base = { now: new Date().toISOString(), admin, preview, role: user?.clan_role ?? null, loggedIn: !!user, meta, groups, boosts, config, popular, unlocks }
  try {
    const r = await pool.query('SELECT slug, release_at FROM geo_quiz_releases')
    const releases: Record<string, string> = {}
    for (const row of r.rows) releases[row.slug] = new Date(row.release_at).toISOString()
    return NextResponse.json({ ...base, releases }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (err: unknown) {
    console.error('geo/catalog', err)
    return NextResponse.json({ ...base, releases: {}, error: 'Freischaltungen konnten nicht geladen werden' }, { headers: { 'Cache-Control': 'no-store' } })
  }
}