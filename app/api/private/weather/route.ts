import { NextRequest, NextResponse } from 'next/server'
import { getPrivateUser } from '@/app/lib/private-auth'

// GET /api/private/weather — Wetter für Frankfurt am Main
// Quelle: Open-Meteo (https://open-meteo.com), kostenlos, ohne API-Schlüssel.
// Wird 10 Minuten im Server-Speicher gehalten, damit nicht jeder Seitenaufruf nachfragt.

const LAT = 50.1109
const LON = 8.6821
const CACHE_MS = 10 * 60 * 1000

let cache: { at: number; data: unknown } | null = null

export async function GET(req: NextRequest) {
  const user = await getPrivateUser(req)
  if (!user) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })

  if (cache && Date.now() - cache.at < CACHE_MS) return NextResponse.json(cache.data)

  const url = new URL('https://api.open-meteo.com/v1/forecast')
  url.searchParams.set('latitude', String(LAT))
  url.searchParams.set('longitude', String(LON))
  url.searchParams.set('timezone', 'Europe/Berlin')
  url.searchParams.set('current', 'temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m,is_day,precipitation')
  url.searchParams.set('hourly', 'temperature_2m,weather_code,precipitation_probability')
  url.searchParams.set('daily', 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset')
  url.searchParams.set('forecast_days', '7')

  try {
    const res = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(8000) })
    if (!res.ok) throw new Error(`Open-Meteo ${res.status}`)
    const raw = await res.json()

    // Nur die nächsten 24 Stunden ab jetzt
    const nowKey = String(raw.current?.time ?? '').slice(0, 13)
    const startIdx = Math.max(0, (raw.hourly?.time ?? []).findIndex((t: string) => t.slice(0, 13) === nowKey))
    const hourly = (raw.hourly?.time ?? []).slice(startIdx, startIdx + 24).map((t: string, i: number) => ({
      time: t,
      temp: raw.hourly.temperature_2m[startIdx + i],
      code: raw.hourly.weather_code[startIdx + i],
      rain: raw.hourly.precipitation_probability?.[startIdx + i] ?? null,
    }))
    const daily = (raw.daily?.time ?? []).map((d: string, i: number) => ({
      date: d,
      code: raw.daily.weather_code[i],
      max: raw.daily.temperature_2m_max[i],
      min: raw.daily.temperature_2m_min[i],
      rain: raw.daily.precipitation_probability_max?.[i] ?? null,
      sunrise: raw.daily.sunrise?.[i] ?? null,
      sunset: raw.daily.sunset?.[i] ?? null,
    }))

    const data = {
      place: 'Frankfurt am Main',
      current: {
        temp: raw.current?.temperature_2m,
        feels: raw.current?.apparent_temperature,
        humidity: raw.current?.relative_humidity_2m,
        wind: raw.current?.wind_speed_10m,
        code: raw.current?.weather_code,
        isDay: raw.current?.is_day === 1,
        precipitation: raw.current?.precipitation,
      },
      hourly,
      daily,
      source: 'Open-Meteo',
      fetchedAt: new Date().toISOString(),
    }
    cache = { at: Date.now(), data }
    return NextResponse.json(data)
  } catch (err) {
    console.error('Wetter:', (err as Error).message)
    if (cache) return NextResponse.json(cache.data) // lieber alte Daten als gar keine
    return NextResponse.json({ error: 'Wetter gerade nicht erreichbar' }, { status: 502 })
  }
}