import { NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'
import { uploadPath } from '@/app/lib/home-tiles'
import { rowToEvent, type SiteEvent } from '@/app/lib/site-events'

// GET /api/home
// Öffentliche Daten für die Startseite (ohne Login):
//  • showcase  – Bilder aus /admin2/showcase
//  • tiles     – Bereichs-Kacheln aus /admin2/startseite
//  • update    – neuester Changelog-Eintrag (nur Titel, Version, Datum)
//  • event     – nächstes SMP-Event
//  • members   – Anzahl Clan-Mitglieder
//  • servers   – weitere Server-Adressen (klappen unter seekclan.de auf)
//  • featured  – hervorgehobenes Event mit Countdown (aus /admin2/events)
// Jede Abfrage ist einzeln abgesichert: fehlt eine Tabelle, fehlt nur dieser Teil.

async function safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try { return await fn() } catch (err) {
    console.error('Startseite:', (err as Error)?.message)
    return fallback
  }
}

export async function GET() {
  const [showcase, tiles, update, event, members, servers, featured] = await Promise.all([
    safe(async () => {
      const r = await pool.query('SELECT filename, caption FROM showcase_images ORDER BY position ASC')
      return r.rows.map(x => ({ url: uploadPath('site-content', `showcase/${x.filename}`), caption: x.caption || '' }))
    }, [] as { url: string; caption: string }[]),

    safe(async () => {
      const r = await pool.query(
        `SELECT id, title, description, href, image_filename, icon FROM home_tiles
         WHERE active = TRUE ORDER BY position ASC, id ASC`
      )
      return r.rows.map(x => ({
        id: Number(x.id),
        title: x.title,
        description: x.description || '',
        href: x.href,
        image: x.image_filename ? uploadPath('site-content', `home-tiles/${x.image_filename}`) : null,
        icon: x.icon || null,
      }))
    }, null as null | { id: number; title: string; description: string; href: string; image: string | null; icon: string | null }[]),

    safe(async () => {
      const r = await pool.query('SELECT title, version, created_at FROM changelog_entries ORDER BY created_at DESC LIMIT 1')
      return r.rows[0] ? { title: r.rows[0].title, version: r.rows[0].version || null, date: r.rows[0].created_at } : null
    }, null),

    safe(async () => {
      const r = await pool.query('SELECT title, event_date FROM smp_events WHERE event_date >= NOW() ORDER BY event_date ASC LIMIT 1')
      return r.rows[0] ? { title: r.rows[0].title, date: r.rows[0].event_date } : null
    }, null),

    safe(async () => {
      const r = await pool.query('SELECT COUNT(*)::int AS n FROM clan_members')
      return r.rows[0]?.n ?? null
    }, null as number | null),

    safe(async () => {
      const r = await pool.query(
        'SELECT id, address, name, description, version, icon, image_filename FROM home_servers WHERE active = TRUE ORDER BY position ASC, id ASC'
      )
      return r.rows.map(x => ({
        id: Number(x.id),
        address: x.address,
        name: x.name,
        description: x.description || '',
        version: x.version || '',
        icon: x.icon || null,
        image: x.image_filename ? uploadPath('site-content', `home-servers/${x.image_filename}`) : null,
      }))
    }, [] as { id: number; address: string; name: string; description: string; version: string; icon: string | null; image: string | null }[]),

    safe(async () => {
      // Aktiv, noch nicht vorbei und (falls eingestellt) Countdown-Zeit erreicht – das nächste zuerst
      const r = await pool.query(
        `SELECT * FROM site_events
         WHERE active = TRUE AND ends_at > NOW() AND (countdown_from IS NULL OR countdown_from <= NOW())
         ORDER BY starts_at ASC LIMIT 1`
      )
      return r.rows[0] ? rowToEvent(r.rows[0]) : null
    }, null as SiteEvent | null),
  ])

  return NextResponse.json(
    { showcase, tiles, update, event, members, servers, featured },
    { headers: { 'Cache-Control': 'no-store' } }
  )
}