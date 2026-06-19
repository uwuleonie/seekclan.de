'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '../../lib/auth-context'

type Claim = {
  id: number
  owner_uuid: string
  owner_name: string
  world: string
  chunk_x: number
  chunk_z: number
  claimed_at: string
}

type Trust = {
  id: number
  owner_uuid: string
  trusted_uuid: string
  trusted_name: string
  claim_id: number | null
  perm_build: boolean
  perm_break: boolean
  perm_containers: boolean
  perm_doors: boolean
  perm_mobs: boolean
  perm_redstone: boolean
}

type ClaimSettings = {
  uuid: string
  sound_enabled: boolean
  public_build: boolean
  public_break: boolean
  public_containers: boolean
  public_doors: boolean
  public_mobs: boolean
  public_redstone: boolean
}

const PERM_LABELS: { key: keyof Pick<Trust, 'perm_build' | 'perm_break' | 'perm_containers' | 'perm_doors' | 'perm_mobs' | 'perm_redstone'>, label: string, icon: string }[] = [
  { key: 'perm_build', label: 'Bauen', icon: '🧱' },
  { key: 'perm_break', label: 'Abbauen', icon: '⛏️' },
  { key: 'perm_containers', label: 'Container', icon: '📦' },
  { key: 'perm_doors', label: 'Türen', icon: '🚪' },
  { key: 'perm_mobs', label: 'Tiere', icon: '🐄' },
  { key: 'perm_redstone', label: 'Redstone', icon: '🔴' },
]

export default function ClaimsPage() {
  const { user } = useAuth()
  const [claims, setClaims] = useState<Claim[]>([])
  const [trusts, setTrusts] = useState<Trust[]>([])
  const [trustedBy, setTrustedBy] = useState<Trust[]>([])
  const [settings, setSettings] = useState<ClaimSettings | null>(null)
  const [linked, setLinked] = useState(true)
  const [loading, setLoading] = useState(true)
  const [selectedClaim, setSelectedClaim] = useState<Claim | 'global' | null>(null)
  const [newTrustName, setNewTrustName] = useState('')
  const [savingTrust, setSavingTrust] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const loadClaimsData = () => {
    if (!user) return
    setLoading(true)
    fetch('/api/smp/claims').then(r => r.json()).then(data => {
      setClaims(data.claims || [])
      setTrusts(data.trusts || [])
      setTrustedBy(data.trustedBy || [])
      setSettings(data.settings)
      setLinked(data.linked)
      setLoading(false)
    })
  }

  useEffect(() => {
    if (user) loadClaimsData()
  }, [user])

  const getTrustsFor = (claimId: number | null) => trusts.filter(t => t.claim_id === claimId)

  const updateSetting = async (key: keyof ClaimSettings, value: boolean) => {
    setError(''); setSuccess('')
    const res = await fetch('/api/smp/claims/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [key]: value }),
    })
    if (res.ok) {
      setSettings(prev => prev ? { ...prev, [key]: value } : prev)
      setSuccess('Gespeichert!')
    } else {
      setError('Fehler beim Speichern')
    }
  }

  const addTrust = async () => {
    if (!newTrustName.trim()) return
    setSavingTrust(true); setError(''); setSuccess('')
    try {
      const res = await fetch(`https://api.mojang.com/users/profiles/minecraft/${newTrustName.trim()}`)
      if (!res.ok) {
        setError('Spieler nicht gefunden (Minecraft-Username prüfen)')
        setSavingTrust(false)
        return
      }
      const data = await res.json()
      const uuid = data.id.replace(/(.{8})(.{4})(.{4})(.{4})(.{12})/, '$1-$2-$3-$4-$5')
      const claimId = selectedClaim === 'global' ? null : selectedClaim?.id

      const trustRes = await fetch('/api/smp/claims/trust', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trusted_uuid: uuid,
          trusted_name: data.name,
          claim_id: claimId,
          permissions: { build: true, break: true, containers: true, doors: true, mobs: true, redstone: true },
        }),
      })
      if (trustRes.ok) {
        setSuccess(`${data.name} wurde vertraut!`)
        setNewTrustName('')
        loadClaimsData()
      } else {
        const j = await trustRes.json()
        setError(j.error || 'Fehler beim Hinzufügen')
      }
    } catch {
      setError('Fehler beim Auflösen des Spielernamens')
    }
    setSavingTrust(false)
  }

  const togglePerm = async (trust: Trust, permKey: typeof PERM_LABELS[number]['key']) => {
    const newPerms = {
      build: trust.perm_build, break: trust.perm_break, containers: trust.perm_containers,
      doors: trust.perm_doors, mobs: trust.perm_mobs, redstone: trust.perm_redstone,
    }
    const apiKey = permKey.replace('perm_', '') as keyof typeof newPerms
    newPerms[apiKey] = !newPerms[apiKey]
    await fetch('/api/smp/claims/trust', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ trusted_uuid: trust.trusted_uuid, trusted_name: trust.trusted_name, claim_id: trust.claim_id, permissions: newPerms }),
    })
    loadClaimsData()
  }

  const removeTrust = async (trust: Trust) => {
    await fetch('/api/smp/claims/trust', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ trusted_uuid: trust.trusted_uuid, claim_id: trust.claim_id }),
    })
    loadClaimsData()
  }

  if (!user) {
    return (
      <div className="card rounded-2xl p-12 text-center">
        <p className="text-5xl mb-4">🔒</p>
        <p className="font-bold" style={{ color: 'var(--foreground)' }}>Du musst eingeloggt sein.</p>
      </div>
    )
  }

  if (loading) return <p style={{ color: 'var(--muted)' }}>Laden...</p>

  if (!linked) {
    return (
      <div className="card rounded-2xl p-12 text-center">
        <p className="text-5xl mb-4">🔗</p>
        <p className="font-bold mb-2" style={{ color: 'var(--foreground)' }}>Kein Minecraft-Account verknüpft</p>
        <p className="text-sm" style={{ color: 'var(--muted)' }}>Verknüpfe deinen Minecraft-Account in den Einstellungen, um deine Claims zu sehen.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {error && <p className="text-red-500 text-sm px-4 py-2 rounded-xl" style={{ background: 'rgba(239,68,68,0.1)' }}>{error}</p>}
      {success && <p className="text-green-500 text-sm px-4 py-2 rounded-xl" style={{ background: 'rgba(34,197,94,0.1)' }}>{success}</p>}

      <div className="card rounded-2xl p-6">
        <h2 className="font-bold text-lg mb-1" style={{ color: 'var(--foreground)' }}>Deine Claims ({claims.length})</h2>
        <p className="text-sm mb-4" style={{ color: 'var(--muted)' }}>Claime Chunks ingame mit <code>/claim</code>. Hier verwaltest du die Berechtigungen.</p>

        {claims.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--muted)' }}>Du hast noch keine Chunks geclaimt.</p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            <button onClick={() => setSelectedClaim('global')}
              className="rounded-xl p-3 text-left transition-all"
              style={selectedClaim === 'global'
                ? { background: '#16A34A', color: 'white' }
                : { background: 'var(--muted-bg)', border: '1px solid var(--card-border)', color: 'var(--foreground)' }}>
              <p className="font-bold text-sm">🌍 Alle Chunks</p>
              <p className="text-xs opacity-80">Globale Permissions</p>
            </button>
            {claims.map(c => (
              <button key={c.id} onClick={() => setSelectedClaim(c)}
                className="rounded-xl p-3 text-left transition-all"
                style={selectedClaim !== 'global' && selectedClaim?.id === c.id
                  ? { background: '#16A34A', color: 'white' }
                  : { background: 'var(--muted-bg)', border: '1px solid var(--card-border)', color: 'var(--foreground)' }}>
                <p className="font-bold text-sm">📍 {c.chunk_x}, {c.chunk_z}</p>
                <p className="text-xs opacity-80">{c.world}</p>
              </button>
            ))}
          </div>
        )}
      </div>

      {selectedClaim && (
        <div className="card rounded-2xl p-6">
          <h2 className="font-bold text-lg mb-1" style={{ color: 'var(--foreground)' }}>
            {selectedClaim === 'global' ? '🌍 Permissions für alle Chunks' : `📍 Permissions für Chunk ${selectedClaim.chunk_x}, ${selectedClaim.chunk_z}`}
          </h2>
          <p className="text-sm mb-4" style={{ color: 'var(--muted)' }}>Vertraue Spielern und stelle ein, was sie dürfen.</p>

          <div className="flex gap-2 mb-4">
            <input type="text" value={newTrustName} onChange={e => setNewTrustName(e.target.value)}
              placeholder="Minecraft-Username..."
              className="flex-1 rounded-xl px-4 py-2.5 text-sm outline-none"
              style={{ background: 'var(--muted-bg)', border: '1px solid var(--card-border)', color: 'var(--foreground)' }} />
            <button onClick={addTrust} disabled={savingTrust}
              className="px-4 py-2.5 rounded-xl text-sm font-medium text-white disabled:opacity-50"
              style={{ background: '#16A34A' }}>
              {savingTrust ? 'Lädt...' : 'Vertrauen'}
            </button>
          </div>

          {getTrustsFor(selectedClaim === 'global' ? null : selectedClaim.id).length === 0 ? (
            <p className="text-sm" style={{ color: 'var(--muted)' }}>Noch niemand vertraut.</p>
          ) : (
            <div className="space-y-3">
              {getTrustsFor(selectedClaim === 'global' ? null : selectedClaim.id).map(t => (
                <div key={t.id} className="rounded-xl p-4" style={{ background: 'var(--muted-bg)', border: '1px solid var(--card-border)' }}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <img src={`https://mc-heads.net/avatar/${t.trusted_name}/24`} alt="" className="w-6 h-6 rounded" />
                      <span className="font-medium text-sm" style={{ color: 'var(--foreground)' }}>{t.trusted_name}</span>
                    </div>
                    <button onClick={() => removeTrust(t)} className="text-xs text-red-500 hover:opacity-70">Entfernen</button>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {PERM_LABELS.map(perm => (
                      <button key={perm.key} onClick={() => togglePerm(t, perm.key)}
                        className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs transition-all"
                        style={t[perm.key]
                          ? { background: 'rgba(22,163,74,0.15)', border: '1px solid #16A34A', color: '#16A34A' }
                          : { background: 'var(--card)', border: '1px solid var(--card-border)', color: 'var(--muted)' }}>
                        <span>{perm.icon}</span>{perm.label}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {settings && (
        <div className="card rounded-2xl p-6">
          <h2 className="font-bold text-lg mb-1" style={{ color: 'var(--foreground)' }}>Öffentliche Permissions</h2>
          <p className="text-sm mb-4" style={{ color: 'var(--muted)' }}>Was dürfen Spieler, die du NICHT vertraut hast, in deinen Chunks?</p>
          <div className="grid grid-cols-3 gap-2">
            {PERM_LABELS.map(perm => {
              const settingKey = ('public_' + perm.key.replace('perm_', '')) as keyof ClaimSettings
              return (
                <button key={perm.key} onClick={() => updateSetting(settingKey, !settings[settingKey])}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs transition-all"
                  style={settings[settingKey]
                    ? { background: 'rgba(22,163,74,0.15)', border: '1px solid #16A34A', color: '#16A34A' }
                    : { background: 'var(--muted-bg)', border: '1px solid var(--card-border)', color: 'var(--muted)' }}>
                  <span>{perm.icon}</span>{perm.label}
                </button>
              )
            })}
          </div>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        {settings && (
          <div className="card rounded-2xl p-6">
            <h2 className="font-bold text-lg mb-3" style={{ color: 'var(--foreground)' }}>Einstellungen</h2>
            <button onClick={() => updateSetting('sound_enabled', !settings.sound_enabled)}
              className="flex items-center justify-between w-full px-4 py-3 rounded-xl text-sm transition-all"
              style={{ background: 'var(--muted-bg)', border: '1px solid var(--card-border)', color: 'var(--foreground)' }}>
              <span>🔊 Claim-Sound</span>
              <span style={{ color: settings.sound_enabled ? '#16A34A' : 'var(--muted)' }}>{settings.sound_enabled ? 'An' : 'Aus'}</span>
            </button>
          </div>
        )}

        {trustedBy.length > 0 && (
          <div className="card rounded-2xl p-6">
            <h2 className="font-bold text-lg mb-3" style={{ color: 'var(--foreground)' }}>Dir wird vertraut von</h2>
            <div className="space-y-2">
              {trustedBy.map(t => (
                <div key={t.id} className="flex items-center gap-2 text-sm" style={{ color: 'var(--foreground)' }}>
                  <span>👤</span> Spieler ({t.claim_id ? 'ein Chunk' : 'alle Chunks'})
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
