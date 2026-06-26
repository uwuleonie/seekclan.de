'use client'

import { useState } from 'react'

type Props = {
  onApplied?: () => void
}

type ToggleState = boolean | null

function ToggleRow({ label, icon, value, onChange }: {
  label: string
  icon: string
  value: ToggleState
  onChange: (next: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-sm flex items-center gap-2" style={{ color: 'var(--foreground)' }}>
        <span>{icon}</span>{label}
      </span>
      <div className="flex gap-1">
        <button
          onClick={() => onChange(true)}
          className="px-2.5 py-1 rounded-lg text-xs font-medium"
          style={value === true ? { background: '#16A34A', color: 'white' } : { background: 'var(--muted-bg)', color: 'var(--muted)' }}
        >
          An
        </button>
        <button
          onClick={() => onChange(false)}
          className="px-2.5 py-1 rounded-lg text-xs font-medium"
          style={value === false ? { background: '#EF4444', color: 'white' } : { background: 'var(--muted-bg)', color: 'var(--muted)' }}
        >
          Aus
        </button>
      </div>
    </div>
  )
}

// Setzt die Schutz-Einstellungen für ALLE eigenen Claims und Gruppen auf
// einmal - höchste Priorität, überschreibt jeden Einzel-Claim und jeden
// Gruppen-Override direkt (kein "Erben"-Mechanismus, da hier alles auf
// einmal gesetzt wird).
export default function ClaimProtectionSettingsAll({ onApplied }: Props) {
  const [pendingChange, setPendingChange] = useState<{ key: string, value: boolean, label: string } | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const requestChange = (key: string, value: boolean, label: string) => {
    setPendingChange({ key, value, label })
    setError('')
    setSuccess('')
  }

  const confirmChange = async () => {
    if (!pendingChange) return
    setSaving(true)
    setError('')
    try {
      const body: Record<string, any> = {}
      if (pendingChange.key === 'weather_override') {
        body.weather_override = pendingChange.value ? 'clear' : null
      } else {
        body[pendingChange.key] = pendingChange.value
      }

      const res = await fetch('/api/smp/claims/protection-settings/all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (res.ok) {
        setSuccess(`"${pendingChange.label}" wurde für alle deine Claims gesetzt.`)
        onApplied?.()
      } else {
        const data = await res.json()
        setError(data.error || 'Fehler beim Speichern')
      }
    } catch {
      setError('Fehler beim Speichern')
    } finally {
      setSaving(false)
      setPendingChange(null)
    }
  }

  return (
    <div className="card rounded-2xl p-5 mb-4" style={{ border: '1px solid var(--card-border)' }}>
      <p className="text-sm font-bold mb-1" style={{ color: 'var(--foreground)' }}>🌍 Für alle meine Claims</p>
      <p className="text-xs mb-3" style={{ color: 'var(--muted)' }}>
        Überschreibt sofort jeden einzelnen Claim und jede Gruppe - auch bereits abweichend eingestellte.
      </p>

      <ToggleRow label="TNT-Explosionsschutz" icon="🧨" value={null} onChange={v => requestChange('tnt_explosion_protection', v, 'TNT-Explosionsschutz')} />
      <ToggleRow label="Feuerausbreitungsschutz" icon="🔥" value={null} onChange={v => requestChange('fire_spread_protection', v, 'Feuerausbreitungsschutz')} />
      <ToggleRow label="Schnee-Akkumulation verhindern" icon="❄️" value={null} onChange={v => requestChange('snow_accumulation_protection', v, 'Schnee-Akkumulation verhindern')} />
      <ToggleRow label="Besuchern klares Wetter zeigen" icon="☀️" value={null} onChange={v => requestChange('weather_override', v, 'Besuchern klares Wetter zeigen')} />

      {error && <p className="text-xs text-red-500 mt-2">{error}</p>}
      {success && <p className="text-xs mt-2" style={{ color: '#16A34A' }}>{success}</p>}

      {pendingChange && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="rounded-2xl p-6 max-w-sm w-full" style={{ background: 'var(--card)', border: '1px solid var(--card-border)' }}>
            <p className="font-bold mb-2" style={{ color: 'var(--foreground)' }}>Wirklich für ALLE Claims ändern?</p>
            <p className="text-sm mb-5" style={{ color: 'var(--muted)' }}>
              "{pendingChange.label}" wird auf <strong>{pendingChange.value ? 'An' : 'Aus'}</strong> gesetzt - für jeden deiner Claims und jede deiner Gruppen, unabhängig von der bisherigen Einstellung.
            </p>
            <div className="flex gap-2">
              <button onClick={() => setPendingChange(null)} className="flex-1 text-sm py-2 rounded-lg" style={{ background: 'var(--muted-bg)', color: 'var(--foreground)' }}>
                Abbrechen
              </button>
              <button onClick={confirmChange} disabled={saving} className="flex-1 text-sm font-medium py-2 rounded-lg disabled:opacity-50" style={{ background: '#16A34A', color: 'white' }}>
                {saving ? 'Speichert...' : 'Bestätigen'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}