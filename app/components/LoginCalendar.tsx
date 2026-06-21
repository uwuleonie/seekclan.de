'use client'

import { useState, useEffect } from 'react'

const WEEKDAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']
const MONTH_NAMES = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'
]

function formatMinutes(min: number): string {
  const h = Math.floor(min / 60)
  const m = min % 60
  if (h === 0) return `${m}m`
  return `${h}h ${m}m`
}

// Liefert das heutige Datum in der deutschen Zeitzone (unabhängig von der Server-Zeitzone)
function getGermanToday(): Date {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(new Date())
  const get = (type: string) => parts.find(p => p.type === type)?.value
  return new Date(`${get('year')}-${get('month')}-${get('day')}T00:00:00`)
}

export default function LoginCalendar({ username }: { username: string }) {
  const now = getGermanToday()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1) // 1-12
  const [days, setDays] = useState<Record<string, number>>({})
  const [streak, setStreak] = useState(0)
  const [loading, setLoading] = useState(true)
  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  const [reliableFrom, setReliableFrom] = useState<string>('9999-12-31')

  useEffect(() => {
    setLoading(true)
    fetch(`/api/smp/calendar?username=${username}&year=${year}&month=${month}`)
      .then(r => r.json())
      .then(data => {
        setDays(data.days || {})
        setStreak(data.streak || 0)
        setReliableFrom(data.reliableFrom || '9999-12-31')
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [username, year, month])

  const goPrevMonth = () => {
    if (month === 1) { setMonth(12); setYear(y => y - 1) } else { setMonth(m => m - 1) }
  }
  const goNextMonth = () => {
    if (month === 12) { setMonth(1); setYear(y => y + 1) } else { setMonth(m => m + 1) }
  }

  // Kalenderraster berechnen
  const firstOfMonth = new Date(year, month - 1, 1)
  const lastOfMonth = new Date(year, month, 0)
  const daysInMonth = lastOfMonth.getDate()
  // getDay(): 0=So, wir wollen 0=Mo -> Montag-basiertes Offset
  const startOffset = (firstOfMonth.getDay() + 6) % 7

  const cells: (number | null)[] = []
  for (let i = 0; i < startOffset; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

  return (
    <div className="card rounded-2xl p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-xl">📅</span>
          <h2 className="font-bold text-lg" style={{ color: 'var(--foreground)' }}>Login-Kalender</h2>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-bold"
          style={{ background: 'rgba(249,115,22,0.15)', color: '#f97316' }}>
          🔥 {streak} Tag{streak !== 1 ? 'e' : ''} Streak
        </div>
      </div>

      <div className="flex items-center justify-between mb-3">
        <button onClick={goPrevMonth} className="px-2 py-1 rounded-lg hover:opacity-70 transition text-sm">←</button>
        <span className="font-medium" style={{ color: 'var(--foreground)' }}>{MONTH_NAMES[month - 1]} {year}</span>
        <button onClick={goNextMonth} className="px-2 py-1 rounded-lg hover:opacity-70 transition text-sm">→</button>
      </div>

      {/* Wochentage */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 44px)", gap: 4, marginBottom: 4, justifyContent: 'center' }}>
        {WEEKDAYS.map(d => (
          <div key={d} className="text-center text-xs opacity-50 py-1">{d}</div>
        ))}
      </div>

      {/* Tage */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 44px)", gap: 4, justifyContent: 'center' }}>
        {cells.map((day, i) => {
          if (day === null) return <div key={i} />
          const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
          const minutes = days[dateStr] || 0
          const isToday = dateStr === todayStr
          const isFuture = dateStr > todayStr
          const isUnreliable = dateStr < reliableFrom
          const hasLogin = minutes > 0
          const isEvaluable = !isFuture && !isUnreliable

          let bg = 'var(--muted-bg)' // Zukunft oder unverlässliche Vergangenheit: neutral grau
          if (isEvaluable) {
            bg = hasLogin ? 'rgba(22,163,74,0.85)' : 'rgba(220,38,38,0.55)'
          }

          return (
            <button
              key={i}
              onClick={() => isEvaluable && setSelectedDay(dateStr)}
              disabled={!isEvaluable}
              title={isUnreliable ? 'Vor Einführung des Login-Trackings, keine Daten verfügbar' : undefined}
              className="rounded-lg flex flex-col items-center justify-center text-xs relative transition"
              style={{
                width: 44, height: 44,
                background: bg,
                border: isToday ? '2px solid #16A34A' : '1px solid var(--card-border)',
                cursor: isEvaluable ? 'pointer' : 'default',
              }}
            >
              <span style={{ color: isEvaluable ? '#fff' : 'var(--foreground)', fontWeight: isToday ? 700 : 400, opacity: isUnreliable ? 0.4 : 1 }}>
                {day}
              </span>
            </button>
          )
        })}
      </div>

      {selectedDay && (
        <div className="mt-3 text-sm rounded-lg px-3 py-2" style={{ background: 'var(--muted-bg)' }}>
          <strong>{new Date(selectedDay).toLocaleDateString('de-DE', { day: 'numeric', month: 'long' })}:</strong>{' '}
          {days[selectedDay] ? `${formatMinutes(days[selectedDay])} online` : 'Nicht eingeloggt'}
          <button onClick={() => setSelectedDay(null)} className="ml-2 opacity-50 hover:opacity-100">×</button>
        </div>
      )}

      <p className="text-xs opacity-40 mt-2">
        Login-Tracking ist vor dem {new Date(reliableFrom).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })} leider nicht verfügbar.
      </p>

      <div className="flex items-center gap-3 mt-4 text-xs opacity-60">
        <span className="flex items-center gap-1.5">
          <span style={{ display: 'inline-block', width: 12, height: 12, borderRadius: 4, background: 'rgba(22,163,74,0.85)' }} /> Eingeloggt
        </span>
        <span className="flex items-center gap-1.5">
          <span style={{ display: 'inline-block', width: 12, height: 12, borderRadius: 4, background: 'rgba(220,38,38,0.55)' }} /> Nicht eingeloggt
        </span>
      </div>
    </div>
  )
}