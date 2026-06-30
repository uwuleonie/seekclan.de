'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import { useAuth } from '../../../lib/auth-context'
import ClaimProtectionSettingsAll from '../../../components/ClaimProtectionSettingsAll'

type PermissionRule = {
  id: number
  scope: 'global_all' | 'global_player'
  target_uuid: string | null
  target_name: string | null
  permission: string
  allowed: boolean
}

type PlayerOption = { uuid: string; player_name: string }

type Template = {
  id: number
  name: string
  permissions: Record<string, boolean | null>
}

// Drei Zustände pro Permission: true = erlaubt, false = verboten, null = nicht gesetzt
type PermState = boolean | null

const PERMISSIONS: { key: string; label: string; icon: string }[] = [
  { key: 'BLOCK_BREAK', label: 'Blöcke abbauen', icon: '⛏️' },
  { key: 'BLOCK_PLACE', label: 'Blöcke platzieren', icon: '🧱' },
  { key: 'BUCKET_USE', label: 'Eimer benutzen', icon: '🪣' },
  { key: 'CONTAINER_OPEN', label: 'Container öffnen', icon: '📦' },
  { key: 'ITEM_PICKUP', label: 'Items aufheben', icon: '🤲' },
  { key: 'ITEM_FRAME', label: 'Item Frames', icon: '🖼️' },
  { key: 'DOOR_USE', label: 'Türen benutzen', icon: '🚪' },
  { key: 'BUTTON_LEVER_USE', label: 'Buttons/Hebel', icon: '🔘' },
  { key: 'REDSTONE_USE', label: 'Redstone', icon: '🔴' },
  { key: 'CROP_HARVEST', label: 'Pflanzen ernten', icon: '🌾' },
  { key: 'ANIMAL_INTERACT', label: 'Tiere (füttern etc.)', icon: '🐄' },
  { key: 'MOB_KILL', label: 'Mobs töten', icon: '⚔️' },
  { key: 'VEHICLE_USE', label: 'Boote/Minecarts', icon: '🚤' },
  { key: 'MOUNT_USE', label: 'Reiten', icon: '🐴' },
]

const TOGGLE_OPTIONS: { value: PermState; label: string; color: string }[] = [
  { value: true, label: 'Erlaubt', color: '#16A34A' },
  { value: null, label: 'Erben', color: 'var(--muted)' },
  { value: false, label: 'Verboten', color: '#EF4444' },
]

const PermissionToggle = React.memo(function PermissionToggle({ state, onChange }: { state: PermState; onChange: (next: PermState) => void }) {
  return (
    <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid var(--card-border)' }}>
      {TOGGLE_OPTIONS.map(opt => (
        <button
          key={String(opt.value)}
          onClick={() => onChange(opt.value)}
          className="px-2 py-1 text-xs font-medium transition flex-1"
          style={state === opt.value
            ? { background: opt.color, color: opt.value === null ? 'var(--background)' : 'white' }
            : { background: 'var(--muted-bg)', color: 'var(--muted)' }}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
})

const PermissionRow = React.memo(function PermissionRow({
  permKey, icon, label, state, onPermissionChange,
}: { permKey: string; icon: string; label: string; state: PermState; onPermissionChange: (permKey: string, next: PermState) => void }) {
  const handleChange = useCallback((next: PermState) => onPermissionChange(permKey, next), [permKey, onPermissionChange])
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <span className="text-sm flex items-center gap-2" style={{ color: 'var(--foreground)' }}>
        <span>{icon}</span> {label}
      </span>
      <div className="w-56">
        <PermissionToggle state={state} onChange={handleChange} />
      </div>
    </div>
  )
})

export default function GlobalPermissionsPage() {
  const { user } = useAuth()
  const [mainTab, setMainTab] = useState<'permissions' | 'protection'>('permissions')
  const [rules, setRules] = useState<PermissionRule[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [suggestions, setSuggestions] = useState<PlayerOption[]>([])
  const [searchFocused, setSearchFocused] = useState(false)
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerOption | null>(null)
  const searchBoxRef = useRef<HTMLDivElement>(null)
  const [templates, setTemplates] = useState<Template[]>([])
  const [showSaveBox, setShowSaveBox] = useState(false)
  const [showLoadPicker, setShowLoadPicker] = useState(false)
  const [templateName, setTemplateName] = useState('')
  const [savingTemplate, setSavingTemplate] = useState(false)

  const loadRules = (showLoadingState: boolean = true) => {
    if (showLoadingState) setLoading(true)
    fetch('/api/smp/global-permissions')
      .then(r => r.json())
      .then(data => {
        setRules(data.rules || [])
        if (showLoadingState) setLoading(false)
      })
  }

  const loadTemplates = () => {
    fetch('/api/smp/permission-templates')
      .then(r => r.json())
      .then(data => setTemplates(data.templates || []))
  }

  useEffect(() => {
    if (!user) return
    loadRules()
    loadTemplates()
  }, [user])

  // Spielervorschläge laden, während getippt wird
  useEffect(() => {
    if (search.trim().length < 2) {
      setSuggestions([])
      return
    }
    const timeout = setTimeout(() => {
      fetch(`/api/smp/players-search?q=${encodeURIComponent(search.trim())}`)
        .then(r => r.json())
        .then(data => setSuggestions(data.players || []))
    }, 200)
    return () => clearTimeout(timeout)
  }, [search])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (searchBoxRef.current && !searchBoxRef.current.contains(e.target as Node)) {
        setSearchFocused(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const scope: 'global_all' | 'global_player' = selectedPlayer ? 'global_player' : 'global_all'

  const stateFor = (permissionKey: string): PermState => {
    const rule = rules.find(r =>
      r.scope === scope &&
      r.permission === permissionKey &&
      (scope === 'global_all' || r.target_uuid === selectedPlayer?.uuid)
    )
    return rule ? rule.allowed : null
  }

  const setPermission = async (permissionKey: string, value: PermState) => {
    setRules(prev => {
      const filtered = prev.filter(r => !(
        r.scope === scope &&
        r.permission === permissionKey &&
        (scope === 'global_all' || r.target_uuid === selectedPlayer?.uuid)
      ))
      if (value === null) return filtered
      return [...filtered, {
        id: -1,
        scope,
        target_uuid: scope === 'global_player' ? selectedPlayer!.uuid : null,
        target_name: scope === 'global_player' ? selectedPlayer!.player_name : null,
        permission: permissionKey,
        allowed: value,
      }]
    })

    await fetch('/api/smp/global-permissions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        scope,
        targetUuid: scope === 'global_player' ? selectedPlayer?.uuid : undefined,
        targetName: scope === 'global_player' ? selectedPlayer?.player_name : undefined,
        permission: permissionKey,
        allowed: value,
      }),
    })
    loadRules(false)
  }

  const handlePermissionChange = useCallback((permKey: string, value: PermState) => {
    setPermission(permKey, value)
  }, [scope, selectedPlayer])

  const saveTemplate = async () => {
    if (!templateName.trim()) return
    setSavingTemplate(true)
    const permissionsSnapshot: Record<string, boolean | null> = {}
    PERMISSIONS.forEach(p => { permissionsSnapshot[p.key] = stateFor(p.key) })

    await fetch('/api/smp/permission-templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: templateName.trim(), permissions: permissionsSnapshot }),
    })
    setTemplateName('')
    setShowSaveBox(false)
    setSavingTemplate(false)
    loadTemplates()
  }

  const applyTemplate = async (template: Template) => {
    setShowLoadPicker(false)
    for (const perm of PERMISSIONS) {
      const value = template.permissions[perm.key] ?? null
      await setPermission(perm.key, value)
    }
  }

  const handleLoadClick = () => {
    if (templates.length === 0) return
    if (templates.length === 1) {
      applyTemplate(templates[0])
    } else {
      setShowLoadPicker(prev => !prev)
    }
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
      <Link href="/smp/claims" className="text-sm flex items-center gap-1 hover:opacity-70" style={{ color: 'var(--muted)' }}>
        ← Zurück zu deinen Claims
      </Link>

      <h1 className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>🌍 Globale Einstellungen</h1>

      <div className="flex gap-2">
        <button
          onClick={() => setMainTab('permissions')}
          className="flex-1 px-4 py-2.5 rounded-xl text-sm font-bold transition-all"
          style={mainTab === 'permissions'
            ? { background: 'var(--foreground)', color: 'var(--background)' }
            : { background: 'var(--muted-bg)', border: '1px solid var(--card-border)', color: 'var(--muted)' }}
        >
          Berechtigungen
        </button>
        <button
          onClick={() => setMainTab('protection')}
          className="flex-1 px-4 py-2.5 rounded-xl text-sm font-bold transition-all"
          style={mainTab === 'protection'
            ? { background: 'var(--foreground)', color: 'var(--background)' }
            : { background: 'var(--muted-bg)', border: '1px solid var(--card-border)', color: 'var(--muted)' }}
        >
          Schutz
        </button>
      </div>

      {mainTab === 'protection' && <ClaimProtectionSettingsAll />}

      {mainTab === 'permissions' && (
      <div className="card rounded-2xl p-6">
        <div className="mb-4">
          <h2 className="font-bold text-lg" style={{ color: 'var(--foreground)' }}>
            🌍 Globale Einstellungen
          </h2>
          <p className="text-sm" style={{ color: 'var(--muted)' }}>
            Diese Regeln gelten für alle deine Claims und Gruppen, als unterste Standard-Ebene — sofern keine spezifischere Regel (Chunk oder Gruppe) existiert. Gilt nur für Spieler, die du irgendwo vertraut hast.
          </p>
        </div>

        {/* Suchleiste für Spieler-spezifische Permissions */}
        <div ref={searchBoxRef} className="relative mb-4">
          {selectedPlayer ? (
            <div className="flex items-center justify-between px-3 py-2 rounded-lg" style={{ background: 'rgba(22,163,74,0.1)', border: '2px solid #16A34A' }}>
              <span className="text-sm font-medium flex items-center gap-2" style={{ color: '#16A34A' }}>
                <img src={`https://api.creepernation.net/avatar/${selectedPlayer.player_name}/24`} alt="" className="w-6 h-6 rounded flex-shrink-0" />
                ⚠️ Du änderst gerade NUR die globalen Rechte für {selectedPlayer.player_name}
              </span>
              <button onClick={() => setSelectedPlayer(null)} className="text-xs font-medium hover:opacity-70 flex-shrink-0 ml-2" style={{ color: '#16A34A' }}>
                ← Zurück zu "Alle"
              </button>
            </div>
          ) : (
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              placeholder="Spielername eingeben, um individuelle Rechte zu setzen..."
              className="w-full px-3 py-2 rounded-lg text-sm"
              style={{ background: 'var(--muted-bg)', border: '1px solid var(--card-border)', color: 'var(--foreground)' }}
            />
          )}

          {searchFocused && !selectedPlayer && suggestions.length > 0 && (
            <div className="absolute left-0 right-0 mt-1 rounded-lg overflow-hidden z-10" style={{ background: 'var(--card)', border: '1px solid var(--card-border)' }}>
              {suggestions.map(p => (
                <button
                  key={p.uuid}
                  onClick={() => { setSelectedPlayer(p); setSearchFocused(false) }}
                  onMouseDown={e => e.preventDefault()}
                  className="w-full text-left px-3 py-1.5 text-sm transition flex items-center gap-2"
                  style={{ color: 'var(--foreground)' }}
                >
                  <img src={`https://api.creepernation.net/avatar/${p.player_name}/24`} alt="" className="w-6 h-6 rounded flex-shrink-0" />
                  {p.player_name}
                </button>
              ))}
            </div>
          )}
        </div>

        <p className="text-xs mb-3" style={{ color: 'var(--muted)' }}>
          {selectedPlayer
            ? 'Nicht gesetzte Rechte fallen zurück auf die globale "Alle"-Einstellung.'
            : 'Diese Rechte gelten als unterste Fallback-Ebene für alle getrusteten Spieler auf all deinen Claims.'}
        </p>

        {/* Vorlagen: Speichern / Laden */}
        <div className="relative mb-4 flex gap-2">
          <button
            onClick={() => { setShowSaveBox(prev => !prev); setShowLoadPicker(false) }}
            className="text-xs font-medium px-3 py-1.5 rounded-lg transition"
            style={{ background: 'var(--muted-bg)', border: '1px solid var(--card-border)', color: 'var(--foreground)' }}
          >
            💾 Config speichern
          </button>
          <button
            onClick={handleLoadClick}
            disabled={templates.length === 0}
            className="text-xs font-medium px-3 py-1.5 rounded-lg transition disabled:opacity-40"
            style={{ background: 'var(--muted-bg)', border: '1px solid var(--card-border)', color: 'var(--foreground)' }}
          >
            📂 Config laden{templates.length > 0 ? ` (${templates.length})` : ''}
          </button>

          {showSaveBox && (
            <div className="absolute left-0 top-full mt-1 p-3 rounded-lg z-10 w-72" style={{ background: 'var(--card)', border: '1px solid var(--card-border)' }}>
              <input
                type="text"
                value={templateName}
                onChange={e => setTemplateName(e.target.value)}
                placeholder="Name für diese Konfiguration..."
                className="w-full px-3 py-2 rounded-lg text-sm mb-2"
                style={{ background: 'var(--muted-bg)', border: '1px solid var(--card-border)', color: 'var(--foreground)' }}
              />
              <button
                onClick={saveTemplate}
                disabled={!templateName.trim() || savingTemplate}
                className="w-full text-xs font-medium px-3 py-1.5 rounded-lg transition disabled:opacity-40"
                style={{ background: '#16A34A', color: 'white' }}
              >
                {savingTemplate ? 'Speichert...' : 'Speichern'}
              </button>
            </div>
          )}

          {showLoadPicker && (
            <div className="absolute left-0 top-full mt-1 p-2 rounded-lg z-10 w-72" style={{ background: 'var(--card)', border: '1px solid var(--card-border)' }}>
              {templates.map(t => (
                <button
                  key={t.id}
                  onClick={() => applyTemplate(t)}
                  className="w-full text-left px-3 py-1.5 text-sm rounded-lg transition"
                  style={{ color: 'var(--foreground)' }}
                >
                  {t.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {loading ? (
          <p className="text-sm" style={{ color: 'var(--muted)' }}>Lädt...</p>
        ) : (
          <div className="space-y-2">
            {PERMISSIONS.map(perm => (
              <PermissionRow
                key={perm.key}
                permKey={perm.key}
                icon={perm.icon}
                label={perm.label}
                state={stateFor(perm.key)}
                onPermissionChange={handlePermissionChange}
              />
            ))}
          </div>
        )}
      </div>
      )}
    </div>
  )
}