import { uploadPath } from '@/app/lib/home-tiles'

// Events für die Startseite (Countdown vor dem Start, „läuft noch“ währenddessen).
// Verwaltet unter /admin2/events. Jedes Event hat ein eindeutiges Kürzel (z. B. halloween-2026),
// an das sich spätere Event-Systeme (Halloween-Kürbisse, Shop …) hängen können.

export const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/
export const COLOR_PATTERN = /^#[0-9a-f]{6}$/i

export function cleanSlug(v: unknown): string | null {
  const s = typeof v === 'string' ? v.trim().toLowerCase() : ''
  return s.length >= 3 && s.length <= 60 && SLUG_PATTERN.test(s) ? s : null
}

// Link: interne Seite (/…) oder https-Adresse, darf leer sein
export function cleanOptionalHref(v: unknown): string | null | false {
  const s = typeof v === 'string' ? v.trim() : ''
  if (!s) return null
  if (/^\/(?!\/)[^\s]*$/.test(s)) return s.slice(0, 300)
  if (/^https:\/\/[^\s]+$/i.test(s)) return s.slice(0, 500)
  return false
}

export function parseDate(v: unknown): Date | null {
  const s = typeof v === 'string' ? v.trim() : ''
  if (!s) return null
  const d = new Date(s)
  return Number.isNaN(d.getTime()) ? null : d
}

export function rowToEvent(x: Record<string, unknown>) {
  const iso = (d: unknown) => (d ? new Date(d as string).toISOString() : null)
  return {
    id: Number(x.id),
    slug: x.slug as string,
    title: x.title as string,
    subtitle: (x.subtitle as string) || '',
    href: (x.href as string) || null,
    accent: (x.accent as string) || '#14b8a6',
    image: x.image_filename ? uploadPath('site-content', `site-events/${x.image_filename}`) : null,
    startsAt: iso(x.starts_at)!,
    endsAt: iso(x.ends_at)!,
    countdownFrom: iso(x.countdown_from),
    active: x.active as boolean,
  }
}
export type SiteEvent = ReturnType<typeof rowToEvent>

// Gemeinsame Prüfung der Formulardaten für Anlegen und Bearbeiten
export function parseEventForm(form: FormData) {
  const slug = cleanSlug(form.get('slug'))
  const title = String(form.get('title') ?? '').trim().slice(0, 80)
  const subtitle = String(form.get('subtitle') ?? '').trim().slice(0, 160) || null
  const href = cleanOptionalHref(form.get('href'))
  const accentRaw = String(form.get('accent') ?? '').trim()
  const startsAt = parseDate(form.get('startsAt'))
  const endsAt = parseDate(form.get('endsAt'))
  const countdownFrom = parseDate(form.get('countdownFrom'))
  const active = form.get('active') !== 'false'

  if (!slug) return { error: 'Kürzel ungültig – nur a–z, 0–9 und Bindestriche, z. B. halloween-2026' }
  if (!title) return { error: 'Titel fehlt' }
  if (href === false) return { error: 'Link muss mit / (Seite auf seekclan.de) oder https:// beginnen' }
  if (!startsAt || !endsAt) return { error: 'Start und Ende angeben' }
  if (endsAt <= startsAt) return { error: 'Das Ende muss nach dem Start liegen' }
  if (countdownFrom && countdownFrom > startsAt) return { error: '„Countdown ab“ muss vor dem Start liegen' }
  const accent = COLOR_PATTERN.test(accentRaw) ? accentRaw.toLowerCase() : '#14b8a6'
  return { slug, title, subtitle, href, accent, startsAt, endsAt, countdownFrom, active }
}