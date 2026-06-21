import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/app/lib/supabase'

// Ab diesem Datum gilt das neue, eigene Session-Tracking als verlässlich (erster Tag,
// an dem das Plugin-Update mit PlaytimeTracker auf dem Server lief).
const RELIABLE_FROM = '2026-06-21'

function todayInGermany(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(new Date())
  const get = (type: string) => parts.find(p => p.type === type)?.value
  return `${get('year')}-${get('month')}-${get('day')}`
}

export async function GET(req: NextRequest) {
  const username = req.nextUrl.searchParams.get('username')
  const year = parseInt(req.nextUrl.searchParams.get('year') || '')
  const month = parseInt(req.nextUrl.searchParams.get('month') || '')

  if (!username || !year || !month) {
    return NextResponse.json({ error: 'username, year, month erforderlich' }, { status: 400 })
  }

  // UUID direkt aus den eigenen Login-Sessions ermitteln (nicht mehr über die
  // Statz-Tabelle smp_player_stats) — so funktioniert der Kalender auch für Spieler,
  // die (noch) keinen Statz-Eintrag haben, und ist komplett unabhängig vom
  // Drittanbieter-Stats-Plugin.
  const { data: sessionForUuid } = await supabaseAdmin
    .from('smp_login_sessions')
    .select('uuid')
    .ilike('player_name', username)
    .limit(1)
    .single()

  if (!sessionForUuid) return NextResponse.json({ days: {}, streak: 0, reliableFrom: RELIABLE_FROM })

  const uuid = sessionForUuid.uuid

  const monthStart = new Date(Date.UTC(year, month - 1, 1))
  const monthEnd = new Date(Date.UTC(year, month, 0))

  const { data: monthSessions } = await supabaseAdmin
    .from('smp_login_sessions')
    .select('date, minutes')
    .eq('uuid', uuid)
    .gte('date', monthStart.toISOString().slice(0, 10))
    .lte('date', monthEnd.toISOString().slice(0, 10))

  const days: Record<string, number> = {}
  for (const row of monthSessions || []) {
    if (row.minutes > 0) days[row.date] = row.minutes
  }

  // Streak berechnen: einfach täglich rückwärts prüfen, ob für diesen Tag eine
  // Session mit Minuten > 0 existiert. Kein Differenzbilden, keine Lücken-Logik mehr
  // nötig — jede Zeile in smp_login_sessions ist bereits ein abgeschlossener,
  // eigenständiger Tageswert.
  const { data: allSessions } = await supabaseAdmin
    .from('smp_login_sessions')
    .select('date, minutes')
    .eq('uuid', uuid)
    .gt('minutes', 0)

  const activeDays = new Set((allSessions || []).map(r => r.date))

  let streak = 0
  const today = todayInGermany()
  for (let i = 0; i < 365; i++) {
    const d = new Date()
    d.setUTCDate(d.getUTCDate() - i)
    // Datum in deutscher Zeitzone berechnen statt mit Server-UTC, um Tagesverschiebungen zu vermeiden
    const dateStr = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit'
    }).format(d)
    if (dateStr < RELIABLE_FROM) break
    if (activeDays.has(dateStr)) {
      streak++
    } else if (i > 0) {
      break
    }
  }
  // Hinweis: Ist "heute" selbst noch nicht aktiv (Spieler noch nicht eingeloggt
  // gewesen), bricht die Schleife bei i === 0 nicht ab (siehe "i > 0" oben), damit ein
  // gestriger Streak nicht schon vor Tagesende auf 0 fällt — er wird nur nicht
  // mitgezählt, bis heute selbst aktiv wird.

  return NextResponse.json({ days, streak, reliableFrom: RELIABLE_FROM, today })
}