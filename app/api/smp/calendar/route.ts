import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/app/lib/supabase'

// Ab diesem Datum gilt das History-Tracking als verlässlich (erster vollständiger Datenpunkt).
const RELIABLE_FROM = '2026-06-19'

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

  const { data: stats } = await supabaseAdmin
    .from('smp_player_stats')
    .select('uuid, playtime_minutes')
    .ilike('player_name', username)
    .single()

  if (!stats) return NextResponse.json({ days: {}, streak: 0, reliableFrom: RELIABLE_FROM })

  const monthStart = new Date(Date.UTC(year, month - 1, 1))
  const dayBefore = new Date(monthStart)
  dayBefore.setUTCDate(dayBefore.getUTCDate() - 1)
  const monthEnd = new Date(Date.UTC(year, month, 0))

  const { data: history } = await supabaseAdmin
    .from('smp_stats_history')
    .select('date, playtime_minutes')
    .eq('uuid', stats.uuid)
    .gte('date', dayBefore.toISOString().slice(0, 10))
    .lte('date', monthEnd.toISOString().slice(0, 10))
    .order('date', { ascending: true })

  const rows = history || []
  const today = todayInGermany()

  const days: Record<string, number> = {}
  for (let i = 1; i < rows.length; i++) {
    if (rows[i].date < RELIABLE_FROM) continue
    const diff = rows[i].playtime_minutes - rows[i - 1].playtime_minutes
    if (diff > 0) days[rows[i].date] = diff
  }

  // Heutigen Tag live berechnen: letzter History-Wert vs. aktueller Live-Wert aus smp_player_stats
  const isCurrentMonthRequested = today.startsWith(`${year}-${String(month).padStart(2, '0')}`)
  if (isCurrentMonthRequested && today >= RELIABLE_FROM) {
    const lastHistoryEntry = rows.filter(r => r.date < today).at(-1)
    if (lastHistoryEntry) {
      const liveDiff = stats.playtime_minutes - lastHistoryEntry.playtime_minutes
      if (liveDiff > 0) days[today] = liveDiff
    }
  }

  // Streak berechnen (inkl. heutigem Live-Wert)
  const { data: allHistory } = await supabaseAdmin
    .from('smp_stats_history')
    .select('date, playtime_minutes')
    .eq('uuid', stats.uuid)
    .order('date', { ascending: true })

  let streak = 0
  if (allHistory && allHistory.length > 0) {
    const activeDays = new Set<string>()
    for (let i = 1; i < allHistory.length; i++) {
      if (allHistory[i].date < RELIABLE_FROM) continue
      const diff = allHistory[i].playtime_minutes - allHistory[i - 1].playtime_minutes
      if (diff > 0) activeDays.add(allHistory[i].date)
    }
    // Heutigen Live-Tag in die Streak-Berechnung einbeziehen, falls zutreffend
    if (days[today] > 0) activeDays.add(today)

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
  }

  return NextResponse.json({ days, streak, reliableFrom: RELIABLE_FROM })
}