'use client'

import { useEffect, useState } from 'react'

type EventData = {
  title: string
  description?: string | null
  event_date: string
}

function getCountdown(targetDate: string) {
  const diff = new Date(targetDate).getTime() - Date.now()
  if (diff <= 0) return null
  const days = Math.floor(diff / 86400000)
  const hours = Math.floor((diff % 86400000) / 3600000)
  const minutes = Math.floor((diff % 3600000) / 60000)
  return { days, hours, minutes }
}

export default function EventBanner({ event }: { event: EventData | null }) {
  const [countdown, setCountdown] = useState(event ? getCountdown(event.event_date) : null)

  useEffect(() => {
    if (!event) return
    const interval = setInterval(() => setCountdown(getCountdown(event.event_date)), 60000)
    return () => clearInterval(interval)
  }, [event])

  if (!event || !countdown) return null

  const timeText = countdown.days > 0
    ? `in ${countdown.days} Tag${countdown.days !== 1 ? 'en' : ''}`
    : countdown.hours > 0
    ? `in ${countdown.hours} Stunde${countdown.hours !== 1 ? 'n' : ''}`
    : `in ${countdown.minutes} Minute${countdown.minutes !== 1 ? 'n' : ''}`

  return (
    <div className="rounded-xl px-4 py-2.5 mb-4 flex items-center gap-2 text-sm"
      style={{ background: 'rgba(22,163,74,0.1)', border: '1px solid rgba(22,163,74,0.3)' }}>
      <span>📅</span>
      <span style={{ color: 'var(--foreground)' }}>
        <strong>{event.title}</strong> {timeText}
      </span>
    </div>
  )
}