'use client'

import { useState } from 'react'

type Props = {
  claimId?: number
  groupId?: number
  initialTntProtection: boolean | null
  initialFireProtection: boolean | null
  initialSnowProtection: boolean | null
  initialWeatherOverride: string | null
  isGroup?: boolean
}

type ToggleState = boolean | null

function ToggleRow({ label, icon, value, onChange, allowInherit }: {
  label: string
  icon: string
  value: ToggleState
  onChange: (next: ToggleState) => void
  allowInherit: boolean
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
        {allowInherit && (
          <button
            onClick={() => onChange(null)}
            className="px-2.5 py-1 rounded-lg text-xs font-medium"
            style={value === null ? { background: 'var(--foreground)', color: 'var(--background)' } : { background: 'var(--muted-bg)', color: 'var(--muted)' }}
          >
            Erben
          </button>
        )}
      </div>
    </div>
  )
}

export default function ClaimProtectionSettings({
  claimId, groupId, initialTntProtection, initialFireProtection, initialSnowProtection, initialWeatherOverride, isGroup = false,
}: Props) {
  const [tnt, setTnt] = useState<ToggleState>(initialTntProtection)
  const [fire, setFire] = useState<ToggleState>(initialFireProtection)
  const [snow, setSnow] = useState<ToggleState>(initialSnowProtection)
  const [weatherClear, setWeatherClear] = useState<ToggleState>(initialWeatherOverride === 'clear' ? true : (initialWeatherOverride === null ? null : false))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const save = async (changes: Partial<{ tnt_explosion_protection: ToggleState, fire_spread_protection: ToggleState, snow_accumulation_protection: ToggleState, weather_override: string | null }>) => {
    setSaving(true)
    setError('')
    try {
      const url = isGroup ? '/api/smp/claim-groups/protection-settings' : '/api/smp/claims/protection-settings'
      const body = isGroup ? { group_id: groupId, ...changes } : { claim_id: claimId, ...changes }
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error || 'Fehler beim Speichern')
      }
    } catch {
      setError('Fehler beim Speichern')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="card rounded-2xl p-5">
      <p className="text-sm font-bold mb-1" style={{ color: 'var(--foreground)' }}>Schutz-Einstellungen</p>
      {isGroup && (
        <p className="text-xs mb-3" style={{ color: 'var(--muted)' }}>
          "Erben" bedeutet: jeder Chunk der Gruppe behält seine eigene Einstellung. An/Aus überschreibt alle Chunks der Gruppe.
        </p>
      )}

      <ToggleRow
        label="TNT-Explosionsschutz"
        icon="🧨"
        value={tnt}
        allowInherit={isGroup}
        onChange={next => { setTnt(next); save({ tnt_explosion_protection: next }) }}
      />
      <ToggleRow
        label="Feuerausbreitungsschutz"
        icon="🔥"
        value={fire}
        allowInherit={isGroup}
        onChange={next => { setFire(next); save({ fire_spread_protection: next }) }}
      />
      <ToggleRow
        label="Schnee-Akkumulation verhindern"
        icon="❄️"
        value={snow}
        allowInherit={isGroup}
        onChange={next => { setSnow(next); save({ snow_accumulation_protection: next }) }}
      />
      <ToggleRow
        label="Besuchern klares Wetter zeigen"
        icon="☀️"
        value={weatherClear}
        allowInherit={isGroup}
        onChange={next => {
          setWeatherClear(next)
          save({ weather_override: next === true ? 'clear' : (next === null ? null : null) })
        }}
      />

      {error && <p className="text-xs text-red-500 mt-2">{error}</p>}
      {saving && <p className="text-xs mt-2" style={{ color: 'var(--muted)' }}>Speichert...</p>}
    </div>
  )
}