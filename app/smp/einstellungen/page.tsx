'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '../../lib/auth-context'

export default function SmpEinstellungenPage() {
  const { user, loading } = useAuth()
  const [weatherPreference, setWeatherPreference] = useState<'default' | 'clear'>('default')
  const [notificationsEnabled, setNotificationsEnabled] = useState(false)
  const [loadingSettings, setLoadingSettings] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    if (!user) return
    Promise.all([
      fetch('/api/smp/weather-preference').then(r => r.json()),
      fetch('/api/smp/notification-settings').then(r => r.json()),
    ]).then(([weatherData, notifData]) => {
      if (weatherData.weather_preference) setWeatherPreference(weatherData.weather_preference)
      setNotificationsEnabled(!!notifData.ingame_messages_enabled)
      setLoadingSettings(false)
    })
  }, [user])

  const updateWeather = async (next: 'default' | 'clear') => {
    setWeatherPreference(next)
    setSaving(true)
    setError('')
    setSuccess('')
    try {
      const res = await fetch('/api/smp/weather-preference', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ weather_preference: next }),
      })
      if (res.ok) {
        setSuccess('Wetter-Einstellung gespeichert.')
      } else {
        const data = await res.json()
        setError(data.error || 'Fehler beim Speichern')
      }
    } catch {
      setError('Fehler beim Speichern')
    } finally {
      setSaving(false)
    }
  }

  const updateNotifications = async (next: boolean) => {
    setNotificationsEnabled(next)
    setSaving(true)
    setError('')
    setSuccess('')
    try {
      const res = await fetch('/api/smp/notification-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ingame_messages_enabled: next }),
      })
      if (res.ok) {
        setSuccess('Benachrichtigungs-Einstellung gespeichert.')
      } else {
        const data = await res.json()
        setError(data.error || 'Fehler beim Speichern')
      }
    } catch {
      setError('Fehler beim Speichern')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <p style={{ color: 'var(--muted)' }}>Laden...</p>
  }

  if (!user) {
    return (
      <div className="card rounded-2xl p-12 text-center">
        <p className="text-5xl mb-4">🔒</p>
        <p className="font-bold" style={{ color: 'var(--foreground)' }}>Du musst eingeloggt sein.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>SMP-Einstellungen</h1>

      {error && <p className="text-red-500 text-sm px-4 py-2 rounded-xl" style={{ background: 'rgba(239,68,68,0.1)' }}>{error}</p>}
      {success && <p className="text-green-500 text-sm px-4 py-2 rounded-xl" style={{ background: 'rgba(34,197,94,0.1)' }}>{success}</p>}

      {loadingSettings ? (
        <p style={{ color: 'var(--muted)' }}>Laden...</p>
      ) : (
        <>
          <div className="card rounded-2xl p-5">
            <p className="text-sm font-bold mb-1" style={{ color: 'var(--foreground)' }}>☀️ Persönliches Wetter</p>
            <p className="text-xs mb-4" style={{ color: 'var(--muted)' }}>
              Rein optisch für dich - das echte Wetter auf dem Server ändert sich dadurch nicht (z.B. Schneefall in der Wildnis bleibt bestehen).
              Ein Claim-Besitzer kann für seinen Claim ein eigenes Wetter erzwingen, das diese Einstellung dann überschreibt.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => updateWeather('default')}
                className="flex-1 px-3 py-2.5 rounded-xl text-sm font-medium transition-all"
                style={weatherPreference === 'default'
                  ? { background: '#16A34A', color: 'white' }
                  : { background: 'var(--muted-bg)', border: '1px solid var(--card-border)', color: 'var(--muted)' }}
              >
                Echtes Wetter anzeigen
              </button>
              <button
                onClick={() => updateWeather('clear')}
                className="flex-1 px-3 py-2.5 rounded-xl text-sm font-medium transition-all"
                style={weatherPreference === 'clear'
                  ? { background: '#16A34A', color: 'white' }
                  : { background: 'var(--muted-bg)', border: '1px solid var(--card-border)', color: 'var(--muted)' }}
              >
                Immer klarer Himmel
              </button>
            </div>
          </div>

          <div className="card rounded-2xl p-5">
            <p className="text-sm font-bold mb-1" style={{ color: 'var(--foreground)' }}>🔔 Claim-Benachrichtigungen</p>
            <p className="text-xs mb-4" style={{ color: 'var(--muted)' }}>
              Erhalte eine Ingame-Nachricht, wenn jemand einen deiner Claims betritt.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => updateNotifications(true)}
                className="flex-1 px-3 py-2.5 rounded-xl text-sm font-medium transition-all"
                style={notificationsEnabled
                  ? { background: '#16A34A', color: 'white' }
                  : { background: 'var(--muted-bg)', border: '1px solid var(--card-border)', color: 'var(--muted)' }}
              >
                An
              </button>
              <button
                onClick={() => updateNotifications(false)}
                className="flex-1 px-3 py-2.5 rounded-xl text-sm font-medium transition-all"
                style={!notificationsEnabled
                  ? { background: '#EF4444', color: 'white' }
                  : { background: 'var(--muted-bg)', border: '1px solid var(--card-border)', color: 'var(--muted)' }}
              >
                Aus
              </button>
            </div>
          </div>

          <div className="card rounded-2xl p-8 text-center">
            <p className="text-4xl mb-3">🚧</p>
            <p className="text-sm" style={{ color: 'var(--muted)' }}>
              Dieser Bereich befindet sich noch im Aufbau - weitere SMP-Einstellungen folgen.
            </p>
          </div>
        </>
      )}
    </div>
  )
}