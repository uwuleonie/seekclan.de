import { NextRequest } from 'next/server'
import { pool } from '@/app/lib/db'
import { uploadPath } from '@/app/lib/home-tiles'

// ─────────────────────────────────────────────────────────────────────────────
// Halloween-System (modular, pro Jahr ein eigenes Event)
//
// Grundlage ist ein Event aus /admin2/events (Tabelle site_events) mit dem Kürzel halloween-JAHR,
// z. B. halloween-2026. Dazu gehören:
//   hw_config     – Einstellungen (Süßigkeiten pro Kürbis/Frage, Musik, Shop offen bis)
//   hw_questions  – Quizfragen mit Schwierigkeit
//   hw_pumpkins   – versteckte Kürbisse (Seite + Element + Position)
//   hw_finds      – wer welchen Kürbis gefunden und wie beantwortet hat
//   hw_items      – Shop-Artikel
//   hw_purchases  – Käufe
// Für 2027 legt man einfach ein neues Event halloween-2027 an – alles andere bleibt getrennt.
// „Sofort beenden“ in /admin2/events (active = false) blendet alles sofort aus.
// ─────────────────────────────────────────────────────────────────────────────

export type Difficulty = 'easy' | 'medium' | 'hard'
export const DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard']
export const DIFF_LABEL: Record<Difficulty, string> = { easy: 'Einfach', medium: 'Mittel', hard: 'Schwer' }

export type HwUser = { id: string; username: string; clan_role: string | null; minecraft_uuid: string | null; minecraft_username: string | null }

/** Eingeloggter Nutzer (egal welche Rolle) oder null */
export async function getUser(req: NextRequest): Promise<HwUser | null> {
  const token = req.cookies.get('session_token')?.value
  if (!token) return null
  const r = await pool.query(
    `SELECT u.id, u.username, u.clan_role, u.minecraft_uuid, u.minecraft_username
     FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token = $1 AND (s.expires_at IS NULL OR s.expires_at > NOW())`,
    [token]
  )
  const u = r.rows[0]
  return u ? { id: String(u.id), username: u.username, clan_role: u.clan_role, minecraft_uuid: u.minecraft_uuid, minecraft_username: u.minecraft_username } : null
}

export const isAdmin = (u: HwUser | null) => !!u && ['administrator', 'owner'].includes(u.clan_role || '')

export type HwEvent = {
  id: number; slug: string; title: string; subtitle: string; accent: string
  startsAt: string; endsAt: string; active: boolean
  enabled: boolean
  candyFind: number; candy: Record<Difficulty, number>
  shopUntil: string | null; music: string | null
}

function rowToHwEvent(x: Record<string, unknown>): HwEvent {
  const iso = (d: unknown) => (d ? new Date(d as string).toISOString() : null)
  return {
    id: Number(x.id), slug: x.slug as string, title: x.title as string, subtitle: (x.subtitle as string) || '',
    accent: (x.accent as string) || '#f97316',
    startsAt: iso(x.starts_at)!, endsAt: iso(x.ends_at)!, active: x.active as boolean,
    enabled: x.enabled !== false,
    candyFind: Number(x.candy_find ?? 2),
    candy: { easy: Number(x.candy_easy ?? 2), medium: Number(x.candy_medium ?? 4), hard: Number(x.candy_hard ?? 6) },
    shopUntil: iso(x.shop_until),
    music: x.music_filename ? uploadPath('site-content', `halloween/${x.music_filename}`) : null,
  }
}

const EVENT_SELECT = `
  SELECT e.id, e.slug, e.title, e.subtitle, e.accent, e.starts_at, e.ends_at, e.active,
         c.enabled, c.candy_find, c.candy_easy, c.candy_medium, c.candy_hard, c.shop_until, c.music_filename
  FROM site_events e JOIN hw_config c ON c.event_id = e.id`

/** Das gerade aktive Halloween-Event (aktiv, eingeschaltet, nicht vorbei). Läuft es noch nicht, kommt es trotzdem – „running“ prüft man selbst. */
export async function getCurrentHalloween(): Promise<HwEvent | null> {
  try {
    const r = await pool.query(
      `${EVENT_SELECT}
       WHERE e.slug LIKE 'halloween-%' AND e.active = TRUE AND c.enabled = TRUE AND e.ends_at > NOW()
       ORDER BY e.starts_at ASC LIMIT 1`
    )
    return r.rows[0] ? rowToHwEvent(r.rows[0]) : null
  } catch {
    return null // Tabellen fehlen noch → kein Event
  }
}

export async function getHalloweenBySlug(slug: string): Promise<HwEvent | null> {
  try {
    const r = await pool.query(`${EVENT_SELECT} WHERE e.slug = $1`, [slug])
    return r.rows[0] ? rowToHwEvent(r.rows[0]) : null
  } catch {
    return null
  }
}

export async function getHalloweenById(id: number): Promise<HwEvent | null> {
  try {
    const r = await pool.query(`${EVENT_SELECT} WHERE e.id = $1`, [id])
    return r.rows[0] ? rowToHwEvent(r.rows[0]) : null
  } catch {
    return null
  }
}

export const isRunning = (e: HwEvent, now = Date.now()) =>
  e.active && e.enabled && now >= new Date(e.startsAt).getTime() && now < new Date(e.endsAt).getTime()

export const shopOpen = (e: HwEvent, now = Date.now()) =>
  e.active && e.enabled && now >= new Date(e.startsAt).getTime() && now < new Date(e.shopUntil || e.endsAt).getTime()

/** Süßigkeiten-Stand eines Spielers: verdient, ausgegeben, übrig, gefundene Kürbisse */
export async function getBalance(eventId: number, userId: string) {
  const r = await pool.query(
    `SELECT
       (SELECT COALESCE(SUM(candies), 0) FROM hw_finds WHERE event_id = $1 AND user_id = $2)::int AS earned,
       (SELECT COUNT(*) FROM hw_finds WHERE event_id = $1 AND user_id = $2)::int AS found,
       (SELECT COALESCE(SUM(price), 0) FROM hw_purchases WHERE event_id = $1 AND user_id = $2)::int AS spent`,
    [eventId, userId]
  )
  const x = r.rows[0]
  return { earned: x.earned, spent: x.spent, candies: x.earned - x.spent, found: x.found }
}

export async function countPumpkins(eventId: number): Promise<number> {
  const r = await pool.query('SELECT COUNT(*)::int AS n FROM hw_pumpkins WHERE event_id = $1 AND active = TRUE', [eventId])
  return r.rows[0].n
}

/** Seitenpfad für Kürbisse vereinheitlichen: ohne Query, ohne Slash am Ende, max. 200 Zeichen */
export function cleanPath(v: unknown): string | null {
  const s = typeof v === 'string' ? v.trim() : ''
  if (!s.startsWith('/') || s.startsWith('//')) return null
  const p = s.split(/[?#]/)[0].replace(/\/+$/, '') || '/'
  return p.length <= 200 ? p : null
}

/** CSS-Selektor des Elements, an dem ein Kürbis hängt – nur harmlose Zeichen erlaubt */
export function cleanAnchor(v: unknown): string | null {
  const s = typeof v === 'string' ? v.trim() : ''
  if (!s || s.length > 600) return null
  return /^[a-zA-Z0-9\s>#._:()\-\[\]="']+$/.test(s) ? s : null
}

export function rowToQuestion(x: Record<string, unknown>) {
  return {
    id: Number(x.id), difficulty: x.difficulty as Difficulty, question: x.question as string,
    answers: (x.answers as string[]) || [], correctIndex: Number(x.correct_index), timeLimit: Number(x.time_limit),
    active: x.active as boolean,
  }
}

export function rowToPumpkin(x: Record<string, unknown>) {
  return {
    id: Number(x.id), pagePath: x.page_path as string, anchor: x.anchor as string,
    x: Number(x.x), y: Number(x.y), size: Number(x.size), difficulty: x.difficulty as Difficulty | 'random',
    active: x.active as boolean,
  }
}

export function rowToItem(x: Record<string, unknown>) {
  return {
    id: Number(x.id), name: x.name as string, description: (x.description as string) || '',
    image: x.image_filename ? uploadPath('site-content', `halloween/${x.image_filename}`) : null,
    price: Number(x.price), stock: x.stock == null ? null : Number(x.stock), perUserLimit: x.per_user_limit == null ? null : Number(x.per_user_limit),
    rewardType: x.reward_type as 'manual' | 'mailbox', templateId: x.template_id == null ? null : Number(x.template_id),
    position: Number(x.position), active: x.active as boolean,
  }
}