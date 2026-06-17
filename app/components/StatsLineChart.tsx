'use client'

type HistoryPoint = {
  date: string
  playtime_minutes: number
  blocks_broken: number
  blocks_placed: number
  mob_kills: number
  deaths: number
}

export default function StatsLineChart({ data }: { data: HistoryPoint[] }) {
  if (data.length < 2) return null

  const width = 700
  const height = 200
  const padding = 30

  const values = data.map(d => d.playtime_minutes)
  const maxValue = Math.max(...values, 1)
  const minValue = 0

  const points = data.map((d, i) => {
    const x = padding + (i / (data.length - 1)) * (width - padding * 2)
    const y = height - padding - ((d.playtime_minutes - minValue) / (maxValue - minValue)) * (height - padding * 2)
    return { x, y, date: d.date, value: d.playtime_minutes }
  })

  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
  const areaD = `${pathD} L ${points[points.length - 1].x} ${height - padding} L ${points[0].x} ${height - padding} Z`

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr)
    return `${d.getDate()}.${d.getMonth() + 1}.`
  }

  return (
    <div style={{ width: '100%', overflowX: 'auto' }}>
      <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: 'auto', minWidth: '500px' }}>
        {/* Horizontale Hilfslinien */}
        {[0, 0.5, 1].map(frac => (
          <line key={frac}
            x1={padding} y1={padding + frac * (height - padding * 2)}
            x2={width - padding} y2={padding + frac * (height - padding * 2)}
            stroke="var(--card-border)" strokeWidth={1} />
        ))}

        {/* Fläche unter der Linie */}
        <path d={areaD} fill="#16A34A" opacity={0.1} />

        {/* Linie */}
        <path d={pathD} fill="none" stroke="#16A34A" strokeWidth={2} />

        {/* Punkte */}
        {points.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={3} fill="#16A34A" />
        ))}

        {/* X-Achsen Labels (erstes, mittleres, letztes Datum) */}
        {[0, Math.floor(points.length / 2), points.length - 1].map(i => (
          <text key={i} x={points[i].x} y={height - 8} textAnchor="middle" fontSize="11" fill="var(--muted)">
            {formatDate(points[i].date)}
          </text>
        ))}

        {/* Y-Achsen Label (Maximum) */}
        <text x={padding - 5} y={padding + 4} textAnchor="end" fontSize="11" fill="var(--muted)">
          {Math.floor(maxValue / 60)}h
        </text>
      </svg>
    </div>
  )
}