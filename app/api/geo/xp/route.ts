import { NextRequest, NextResponse } from 'next/server'
import { checkOrigin, csrfError } from '@/app/lib/csrf'
import { getGeoUser } from '@/app/lib/geo-server'
import { awardItem, inRunningRoom, loadConfig, loadProfile, quizKeys, syncLevelSternis } from '@/app/lib/geo-data'

// POST /api/geo/xp  Body: { slugs: string[], key: string, total: number, multi?: boolean }
// Meldet einen richtigen Treffer. Ist der Eintrag für diesen Nutzer neu, gibt es XP (+ evtl. %-Stufen-Bonus).
// slugs: das Quiz – bei einem Mix alle beteiligten Quizzes (der Eintrag zählt für das Quiz, zu dem er gehört).
// Antwort enthält zusätzlich sternis: Geo-Sternis aus diesem Treffer (Quiz zum ersten Mal geschafft, neues Level).

const SLUG = /^[a-z0-9-]{2,60}$/
const KEY = /^[^\s]{1,120}$/

// Kleine Bremse gegen Massen-Anfragen (pro Server-Prozess): höchstens 120 Treffer pro Minute und Nutzer
const hits = new Map<string, number[]>()
function tooFast(userId: string): boolean {
  const now = Date.now()
  const list = (hits.get(userId) ?? []).filter(t => now - t < 60000)
  list.push(now)
  hits.set(userId, list)
  if (hits.size > 5000) hits.clear()
  return list.length > 120
}

export async function POST(req: NextRequest) {
  if (!checkOrigin(req)) return csrfError()
  const user = await getGeoUser(req).catch(() => null)
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })
  if (tooFast(user.id)) return NextResponse.json({ error: 'Zu viele Anfragen' }, { status: 429 })

  const b = await req.json().catch(() => ({}))
  const slugs = Array.isArray(b.slugs) ? [...new Set(b.slugs.map((s: unknown) => String(s)))].slice(0, 12) as string[] : []
  const key = String(b.key ?? '')
  if (!slugs.length || !slugs.every(s => SLUG.test(s)) || !KEY.test(key)) return NextResponse.json({ error: 'Ungültige Daten' }, { status: 400 })

  try {
    let slug: string | null = null
    for (const s of slugs) if ((await quizKeys(s)).has(key)) { slug = s; break }
    if (!slug) return NextResponse.json({ error: 'Unbekannter Eintrag' }, { status: 400 })

    // Mehrspieler-Bonus nur, wenn der Nutzer wirklich gerade in einer laufenden Runde mit diesem Quiz ist
    const multi = !!b.multi && await inRunningRoom(user.id, slug)
    const res = await awardItem(user.id, slug, key, Number(b.total) || 0, multi)
    const cfg = await loadConfig()
    const sternis = [...res.sternis, ...(res.parts.length ? await syncLevelSternis(user.id, cfg) : [])]
    const profile = await loadProfile(user.id, cfg)
    return NextResponse.json({ slug, gained: res.parts.reduce((s, p) => s + p.amount, 0), parts: res.parts, sternis, solved: res.solved, total: res.total, profile })
  } catch (err: unknown) {
    console.error('geo/xp', err)
    return NextResponse.json({ error: 'XP konnten nicht gespeichert werden' }, { status: 500 })
  }
}