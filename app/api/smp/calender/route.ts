import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/app/lib/supabase'

// Ab diesem Datum gilt das History-Tracking als verlässlich (erster vollständiger Datenpunkt).
// Alles davor kann technisch nicht ausgewertet werden, da kein Vortages-Vergleichswert existiert.
const RELIABLE_FROM = '2026-06-19'

export async function GET(req: NextRequest) {
  const username = req.nextUrl.searchParams.get('username')
  const year = parseInt(req.nextUrl.searchParams.get('year') || '')
  const month = parseInt(req.nextUrl.searchParams.get('month') || '') // 1-12

  if (!username || !year || !month) {
    return NextResponse.json({ error: 'username, year, month erforderlich' }, { status: 400 })
  }

  const { data: stats } = await supabaseAdmin
    .from('smp_player_stats')
    .select('uuid')
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

  const days: Record<string, number> = {}
  for (let i = 1; i < rows.length; i++) {
    // Nur Tage ab RELIABLE_FROM auswerten
    if (rows[i].date < RELIABLE_FROM) continue
    const diff = rows[i].playtime_minutes - rows[i - 1].playtime_minutes
    if (diff > 0) days[rows[i].date] = diff
  }

  // Streak berechnen
  const { data: allHistory } = await supabaseAdmin
    .from('smp_stats_history')
    .select('date, playtime_minutes')
    .eq('uuid', stats.uuid)
    .order('date', { ascending: true })

  let streak = 0
  if (allHistory && allHistory.length > 1) {
    const activeDays = new Set<string>()
    for (let i = 1; i < allHistory.length; i++) {
      if (allHistory[i].date < RELIABLE_FROM) continue
      const diff = allHistory[i].playtime_minutes - allHistory[i - 1].playtime_minutes
      if (diff > 0) activeDays.add(allHistory[i].date)
    }
    const today = new Date()
    for (let i = 0; i < 365; i++) {
      const d = new Date(today)
      d.setDate(d.getDate() - i)
      const dateStr = d.toISOString().slice(0, 10)
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