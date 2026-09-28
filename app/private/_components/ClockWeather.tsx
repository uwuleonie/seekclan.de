'use client'

// Uhr (live) + Wetter Frankfurt am Main (Open-Meteo, über /api/private/weather)

import { useEffect, useState } from 'react'
import Icon from './Icon'

interface Weather {
  place: string
  current: { temp: number; feels: number; humidity: number; wind: number; code: number; isDay: boolean; precipitation: number }
  hourly: { time: string; temp: number; code: number; rain: number | null }[]
  daily: { date: string; code: number; max: number; min: number; rain: number | null; sunrise: string | null; sunset: string | null }[]
}

/** WMO-Wettercodes → Symbol + deutscher Text */
export function weatherInfo(code: number, isDay = true): { icon: string; text: string } {
  if (code === 0) return { icon: isDay ? 'sun' : 'moon', text: isDay ? 'Sonnig' : 'Klar' }
  if (code === 1) return { icon: isDay ? 'sun' : 'moon', text: 'Überwiegend klar' }
  if (code === 2) return { icon: 'cloud', text: 'Teilweise bewölkt' }
  if (code === 3) return { icon: 'cloud', text: 'Bedeckt' }
  if (code === 45 || code === 48) return { icon: 'fog', text: 'Nebel' }
  if (code >= 51 && code <= 57) return { icon: 'rain', text: 'Nieselregen' }
  if (code >= 61 && code <= 67) return { icon: 'rain', text: code >= 65 ? 'Starker Regen' : 'Regen' }
  if (code >= 71 && code <= 77) return { icon: 'snow', text: 'Schnee' }
  if (code >= 80 && code <= 82) return { icon: 'rain', text: 'Regenschauer' }
  if (code === 85 || code === 86) return { icon: 'snow', text: 'Schneeschauer' }
  if (code >= 95) return { icon: 'storm', text: 'Gewitter' }
  return { icon: 'cloud', text: 'Wolkig' }
}

const round = (n: number | undefined) => (typeof n === 'number' ? Math.round(n) : '–')

export default function ClockWeather({ greeting }: { greeting: string }) {
  const [now, setNow] = useState<Date | null>(null)
  const [w, setW] = useState<Weather | null>(null)
  const [err, setErr] = useState(false)

  useEffect(() => {
    setNow(new Date())
    const iv = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(iv)
  }, [])

  useEffect(() => {
    const load = () => fetch('/api/private/weather').then(r => (r.ok ? r.json() : Promise.reject())).then(d => { setW(d); setErr(false) }).catch(() => setErr(true))
    load()
    const iv = setInterval(load, 10 * 60_000)
    return () => clearInterval(iv)
  }, [])

  const info = w ? weatherInfo(w.current.code, w.current.isDay) : null
  const today = w?.daily[0]

  return (
    <section className="pv-glass pv-clock-card">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 200 }}>
        <p className="pv-eyebrow">{now ? now.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : ' '}</p>
        <div className="pv-clock-time" suppressHydrationWarning>
          {now ? now.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) : '--:--'}
          <small>{now ? String(now.getSeconds()).padStart(2, '0') : ''}</small>
        </div>
        <div className="pv-h2" style={{ fontSize: 19 }}>{greeting}</div>
      </div>

      <div className="pv-grow" style={{ display: 'flex', flexDirection: 'column', gap: 12, minWidth: 260 }}>
        {err && !w && <div className="pv-muted" style={{ fontSize: 13 }}>Wetter gerade nicht erreichbar.</div>}
        {!w && !err && <div className="pv-spinner" />}
        {w && info && (
          <>
            <div className="pv-weather-now">
              <span className="pv-weather-icon"><Icon name={info.icon} size={32} /></span>
              <div>
                <div className="pv-weather-temp">{round(w.current.temp)}°</div>
                <div className="pv-muted" style={{ fontSize: 13 }}>{info.text} · Frankfurt</div>
              </div>
              <div className="pv-grow" />
              <div className="pv-muted pv-desktop-only" style={{ fontSize: 12.5, textAlign: 'right', lineHeight: 1.6 }}>
                {today && <>Max {round(today.max)}° · Min {round(today.min)}°<br /></>}
                gefühlt {round(w.current.feels)}° · Wind {round(w.current.wind)} km/h<br />
                {today?.rain != null && `Regen ${today.rain} %`}
              </div>
            </div>
            <div className="pv-hours">
              {w.hourly.slice(0, 12).map((h, i) => {
                const hi = weatherInfo(h.code, true)
                return (
                  <div key={h.time} className="pv-hour">
                    <span className="pv-muted">{i === 0 ? 'Jetzt' : `${h.time.slice(11, 13)} Uhr`}</span>
                    <Icon name={hi.icon} size={18} />
                    <b>{round(h.temp)}°</b>
                    {h.rain != null && h.rain >= 20 && <span style={{ fontSize: 10.5, color: '#3f7fb5' }}>{h.rain} %</span>}
                  </div>
                )
              })}
            </div>
            <div className="pv-days">
              {w.daily.map((d, i) => {
                const di = weatherInfo(d.code, true)
                const date = new Date(`${d.date}T12:00:00`)
                return (
                  <div key={d.date} className="pv-daycell" title={di.text}>
                    <span className="pv-muted">{i === 0 ? 'Heute' : date.toLocaleDateString('de-DE', { weekday: 'short' })}</span>
                    <Icon name={di.icon} size={17} />
                    <span><b>{round(d.max)}°</b> <span className="pv-muted">{round(d.min)}°</span></span>
                  </div>
                )
              })}
            </div>
            <span className="pv-muted" style={{ fontSize: 10.5 }}>Wetterdaten: Open-Meteo</span>
          </>
        )}
      </div>
    </section>
  )
}