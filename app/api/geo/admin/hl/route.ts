import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'
import { checkOrigin, csrfError } from '@/app/lib/csrf'
import { canReadGeoAdmin, getGeoUser, isGeoAdmin } from '@/app/lib/geo-server'
import { clearHlCache, hlAdminDaten, hlAdminWerte, loadKorrekturen, type HlKorrekturen } from '@/app/lib/geo-hl'
import { mergeHlConfig } from '@/app/geo/_lib/hl'
import { HL_KAT } from '@/app/geo/_data/hl'

// Geo-Adminpanel, Reiter „Higher Lower“: lesen = Team, ändern = Administrator/Owner
//
// GET  /api/geo/admin/hl                 → { config, korrekturen, stats, kategorien (30 Tage), top, stand }
// GET  /api/geo/admin/hl?werte=<kat>      → { werte: [{ id, name, original, jahr, korrektur }] }
// POST /api/geo/admin/hl  { action: 'config', config }                                  Einstellungen speichern
//                         { action: 'korrektur', kat, id, wert, jahr?, quelle? }         Wert ersetzen (wert = null → Land raus)
//                         { action: 'korrekturWeg', kat, id }                            Korrektur löschen (Originalwert gilt wieder)

const KAT = /^[a-z0-9-]{2,40}$/
const LAND = /^[A-Z]{3}$/

export async function GET(req: NextRequest) {
  const user = await getGeoUser(req).catch(() => null)
  if (!canReadGeoAdmin(user)) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })
  try {
    const kat = req.nextUrl.searchParams.get('werte')
    if (kat) {
      if (!KAT.test(kat) || !HL_KAT[kat]) return NextResponse.json({ error: 'Unbekannte Kategorie' }, { status: 400 })
      return NextResponse.json({ werte: await hlAdminWerte(kat) }, { headers: { 'Cache-Control': 'no-store' } })
    }
    const d = await hlAdminDaten()
    const raw = await pool.query(`SELECT updated_at FROM geo_settings WHERE key = 'hl'`).catch(() => ({ rows: [] as { updated_at: Date }[] }))
    return NextResponse.json({ ...d, canWrite: isGeoAdmin(user), savedAt: raw.rows[0]?.updated_at ?? null }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (err: unknown) {
    console.error('geo/admin/hl GET', err)
    return NextResponse.json({ error: 'Fehler' }, { status: 500 })
  }
}

async function saveSetting(key: string, value: unknown, userId: string) {
  await pool.query(
    `INSERT INTO geo_settings (key, value, updated_at, updated_by) VALUES ($1, $2, now(), $3)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now(), updated_by = EXCLUDED.updated_by`,
    [key, JSON.stringify(value), userId],
  )
}

export async function POST(req: NextRequest) {
  if (!checkOrigin(req)) return csrfError()
  const user = await getGeoUser(req).catch(() => null)
  if (!isGeoAdmin(user)) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })
  const b = await req.json().catch(() => ({}))
  try {
    switch (b.action) {
      case 'config': {
        const cfg = mergeHlConfig(b.config)
        if (cfg.wetten.minZiel > cfg.wetten.maxZiel) return NextResponse.json({ error: 'Kleinstes Ziel ist größer als das größte' }, { status: 400 })
        await saveSetting('hl', cfg, user!.id)
        break
      }
      case 'korrektur':
      case 'korrekturWeg': {
        const kat = String(b.kat ?? ''), id = String(b.id ?? '')
        if (!KAT.test(kat) || !HL_KAT[kat] || !LAND.test(id)) return NextResponse.json({ error: 'Ungültige Daten' }, { status: 400 })
        clearHlCache()
        const korr: HlKorrekturen = JSON.parse(JSON.stringify(await loadKorrekturen()))
        if (b.action === 'korrekturWeg') {
          if (korr[kat]) { delete korr[kat][id]; if (!Object.keys(korr[kat]).length) delete korr[kat] }
        } else {
          const wert = b.wert === null ? null : Number(b.wert)
          if (wert !== null && !Number.isFinite(wert)) return NextResponse.json({ error: 'Ungültiger Wert' }, { status: 400 })
          const jahr = b.jahr == null || b.jahr === '' ? null : Math.round(Number(b.jahr))
          if (jahr !== null && !(jahr >= 1900 && jahr <= 2100)) return NextResponse.json({ error: 'Ungültiges Jahr' }, { status: 400 })
          const quelle = typeof b.quelle === 'string' ? b.quelle.trim().slice(0, 300) || null : null
          korr[kat] = { ...(korr[kat] ?? {}), [id]: { wert, jahr, quelle, von: user!.name ?? user!.username, am: new Date().toISOString() } }
        }
        await saveSetting('hl-korrekturen', korr, user!.id)
        break
      }
      default:
        return NextResponse.json({ error: 'Unbekannte Aktion' }, { status: 400 })
    }
    clearHlCache()
    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    console.error('geo/admin/hl POST', err)
    return NextResponse.json({ error: 'Fehler beim Speichern' }, { status: 500 })
  }
}