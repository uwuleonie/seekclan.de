'use client'

import { useState } from 'react'

type HistoryDay = {
  date: string
  playtime_minutes: number
}

function hexToRgb(hex: string): string {
  const clean = hex.replace('#', '')
  const r = parseInt(clean.substring(0, 2), 16)
  const g = parseInt(clean.substring(2, 4), 16)
  const b = parseInt(clean.substring(4, 6), 16)
  return `rgb(${r}, ${g}, ${b})`
}

function getIntensity(minutes: number): number {
  if (minutes <= 0) return 0
  if (minutes < 30) return 1
  if (minutes < 60) return 2
  if (minutes < 180) return 3
  return 4
}

function buildYearGrid(history: HistoryDay[]): { date: string; minutes: number }[][] {
  const map = new Map<string, number>()
  history.forEach(h => map.set(h.date, h.playtime_minutes))

  const today = new Date()
  const start = new Date(today)
  start.setDate(start.getDate() - 364)
  // Auf Montag der Startwoche zurückrechnen, damit das Grid bei einem vollen Wochenanfang beginnt
  const startDay = (start.getDay() + 6) % 7 // 0 = Montag
  start.setDate(start.getDate() - startDay)

  const weeks: { date: string; minutes: number }[][] = []
  let current = new Date(start)

  while (current <= today) {
    const week: { date: string; minutes: number }[] = []
    for (let i = 0; i < 7; i++) {
      const iso = current.toISOString().slice(0, 10)
      week.push({ date: iso, minutes: map.get(iso) || 0 })
      current.setDate(current.getDate() + 1)
    }
    weeks.push(week)
  }

  return weeks
}

export default function PlaytimeCalendar({ history, accentColor }: { history: HistoryDay[]; accentColor: string }) {
  const [hovered, setHovered] = useState<{ date: string; minutes: number } | null>(null)
  const weeks = buildYearGrid(history)

  const monthLabels: { label: string; weekIndex: number }[] = []
  let lastMonth = -1
  weeks.forEach((week, idx) => {
    const d = new Date(week[0].date)
    if (d.getMonth() !== lastMonth) {
      lastMonth = d.getMonth()
      monthLabels.push({ label: d.toLocaleDateString('de-DE', { month: 'short' }), weekIndex: idx })
    }
  })

  const rgbAccent = accentColor.startsWith('#') ? hexToRgb(accentColor) : accentColor

  function cellColor(intensity: number): string {
    if (intensity === 0) return 'var(--muted-bg)'
    const opacities = [0, 0.3, 0.5, 0.75, 1]
    return rgbAccent
      .replace('rgb(', 'rgba(')
      .replace(')', `, ${opacities[intensity]})`)
  }

  return (
    <div className="overflow-x-auto pb-2">
      <div className="inline-block min-w-full">
        <div className="flex gap-1 mb-1 ml-8 text-xs" style={{ color: 'var(--muted)' }}>
          {monthLabels.map((m, i) => (
            <div key={i} style={{ position: 'relative', left: `${m.weekIndex * 14}px` }} className="absolute">
              {m.label}
            </div>
          ))}
        </div>
        <div className="flex gap-1 mt-5">
          <div className="flex flex-col gap-1 mr-1 text-xs" style={{ color: 'var(--muted)' }}>
            <div style={{ height: '11px' }} />
            <div style={{ height: '11px' }}>Mo</div>
            <div style={{ height: '11px' }} />
            <div style={{ height: '11px' }}>Mi</div>
            <div style={{ height: '11px' }} />
            <div style={{ height: '11px' }}>Fr</div>
            <div style={{ height: '11px' }} />
          </div>
          {weeks.map((week, wi) => (
            <div key={wi} className="flex flex-col gap-1">
              {week.map((day, di) => (
                <div
                  key={di}
                  onMouseEnter={() => setHovered(day)}
                  onMouseLeave={() => setHovered(null)}
                  style={{
                    width: '11px',
                    height: '11px',
                    borderRadius: '2px',
                    background: cellColor(getIntensity(day.minutes)),
                    cursor: 'pointer',
                  }}
                />
              ))}
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2 mt-3 text-xs" style={{ color: 'var(--muted)' }}>
          <span>Weniger</span>
          {[0, 1, 2, 3, 4].map(i => (
            <div key={i} style={{ width: '11px', height: '11px', borderRadius: '2px', background: cellColor(i) }} />
          ))}
          <span>Mehr</span>
          {hovered && (
            <span className="ml-4">
              {new Date(hovered.date).toLocaleDateString('de-DE', { day: '2-digit', month: 'short', year: 'numeric' })}: {hovered.minutes} Min. online
            </span>
          )}
        </div>
      </div>
    </div>
  )
}