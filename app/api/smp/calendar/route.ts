import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'

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

// pg gibt date-Spalten als JavaScript-Date-Objekt zurück, nicht als "YYYY-MM-DD"-String
// (anders als zuvor bei Supabase/PostgREST, wo Datumswerte direkt als einfache Strings
// ankamen). Ein Date-Objekt als Objekt-Schlüssel verwendet automatisch dessen lange
// .toString()-Darstellung statt eines simplen Datums — das Frontend kann solche
// Schlüssel nie mit einem echten Kalendertag abgleichen. Diese Funktion formatiert
// daher immer explizit auf "YYYY-MM-DD".
function toDateKey(value: string | Date): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  return value
}

export async function GET(req: NextRequest) {
  const username = req.nextUrl.searchParams.get('username')
  const year = parseInt(req.nextUrl.searchParams.get('year') || '')
  const month = parseInt(req.nextUrl.searchParams.get('month') || '')

  if (!username || !year || !month) {
    return NextResponse.json({ error: 'username, year, month erforderlich' }, { status: 400 })
  }

  const sessionForUuidResult = await pool.query(
    'SELECT uuid FROM smp_login_sessions WHERE player_name ILIKE $1 LIMIT 1',
    [username]
  )
  const sessionForUuid = sessionForUuidResult.rows[0]

  if (!sessionForUuid) return NextResponse.json({ days: {}, streak: 0, reliableFrom: RELIABLE_FROM })

  const uuid = sessionForUuid.uuid

  const monthStart = new Date(Date.UTC(year, month - 1, 1))
  const monthEnd = new Date(Date.UTC(year, month, 0))

  const monthSessionsResult = await pool.query(
    'SELECT date, minutes FROM smp_login_sessions WHERE uuid = $1 AND date >= $2 AND date <= $3',
    [uuid, monthStart.toISOString().slice(0, 10), monthEnd.toISOString().slice(0, 10)]
  )

  const days: Record<string, number> = {}
  for (const row of monthSessionsResult.rows) {
    if (row.minutes > 0) days[toDateKey(row.date)] = row.minutes
  }

  const allSessionsResult = await pool.query(
    'SELECT date, minutes FROM smp_login_sessions WHERE uuid = $1 AND minutes > 0',
    [uuid]
  )

  const activeDays = new Set(allSessionsResult.rows.map(r => toDateKey(r.date)))

  let streak = 0
  const today = todayInGermany()
  for (let i = 0; i < 365; i++) {
    const d = new Date()
    d.setUTCDate(d.getUTCDate() - i)
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

  return NextResponse.json({ days, streak, reliableFrom: RELIABLE_FROM, today })
}