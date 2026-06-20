'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import type { Claim, ClaimGroup } from '../smp/claims/page'
import PermissionPanel from './PermissionPanel'

type PermissionRule = {
  id: number
  scope: 'group_all' | 'group_player'
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

export default function GroupPanel({ group, claims, onRenamed, draggedClaim, setDraggedClaim, onRequestMove }: {
  group: ClaimGroup
  claims: Claim[]
  onRenamed?: (groupId: number, newName: string) => void
  draggedClaim?: Claim | null
  setDraggedClaim?: (c: Claim | null) => void
  onRequestMove?: (claim: Claim, targetGroupId: number | null) => void
}) {
  const [rules, setRules] = useState<PermissionRule[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [suggestions, setSuggestions] = useState<PlayerOption[]>([])
  const [searchFocused, setSearchFocused] = useState(false)
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerOption | null>(null)
  const [expanded, setExpanded] = useState(false)
  const [exceptionClaim, setExceptionClaim] = useState<Claim | null>(null)
  const searchBoxRef = useRef<HTMLDivElement>(null)
  const [templates, setTemplates] = useState<Template[]>([])
  const [showSaveBox, setShowSaveBox] = useState(false)
  const [showLoadPicker, setShowLoadPicker] = useState(false)
  const [templateName, setTemplateName] = useState('')
  const [savingTemplate, setSavingTemplate] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const [newGroupName, setNewGroupName] = useState('')
  const [savingName, setSavingName] = useState(false)
  const [confirmUnclaim, setConfirmUnclaim] = useState(false)
  const [unclaiming, setUnclaiming] = useState(false)
  const [unclaimDone, setUnclaimDone] = useState(false)
  const [showTransferBox, setShowTransferBox] = useState(false)
  const [transferSearch, setTransferSearch] = useState('')
  const [transferSuggestions, setTransferSuggestions] = useState<PlayerOption[]>([])
  const [transferTarget, setTransferTarget] = useState<PlayerOption | null>(null)
  const [sendingTransfer, setSendingTransfer] = useState(false)
  const [transferSent, setTransferSent] = useState(false)
  const [lockedByTransfer, setLockedByTransfer] = useState(false)

  const loadRules = (showLoadingState: boolean = true) => {
    if (showLoadingState) setLoading(true)
    fetch(`/api/smp/claim-groups/${group.id}`)
      .then(r => r.json())
      .then(data => {
        setRules(data.rules || [])
        if (showLoadingState) setLoading(false)
      })
  }

  useEffect(() => {
    loadRules()
    loadTemplates()
    setSelectedPlayer(null)
    setSearch('')
    setExceptionClaim(null)
    setShowLoadPicker(false)
    setShowSaveBox(false)
    setTransferSent(false)
    setShowTransferBox(false)
    setTransferTarget(null)
    setTransferSearch('')

    fetch(`/api/smp/claim-groups/${group.id}/transfer-status`)
      .then(r => r.json())
      .then(data => setLockedByTransfer(!!data.locked))
      .catch(() => setLockedByTransfer(false))
  }, [group.id])

  // Spielervorschläge für die Übertragungs-Suche
  useEffect(() => {
    if (transferSearch.trim().length < 2) {
      setTransferSuggestions([])
      return
    }
    const timeout = setTimeout(() => {
      fetch(`/api/smp/players-search?q=${encodeURIComponent(transferSearch.trim())}`)
        .then(r => r.json())
        .then(data => setTransferSuggestions(data.players || []))
    }, 200)
    return () => clearTimeout(timeout)
  }, [transferSearch])

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

  const scope: 'group_all' | 'group_player' = selectedPlayer ? 'group_player' : 'group_all'

  const stateFor = (permissionKey: string): PermState => {
    const rule = rules.find(r =>
      r.scope === scope &&
      r.permission === permissionKey &&
      (scope === 'group_all' || r.target_uuid === selectedPlayer?.uuid)
    )
    return rule ? rule.allowed : null
  }
const sendTransfer = async () => {
    if (!transferTarget) return
    setSendingTransfer(true)
    const res = await fetch(`/api/smp/claim-groups/${group.id}/transfer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ receiverUuid: transferTarget.uuid, receiverName: transferTarget.player_name }),
    })
    setSendingTransfer(false)
    if (res.ok) {
      setTransferSent(true)
      setShowTransferBox(false)
      setLockedByTransfer(true)
    }
  }

  const cancelTransfer = async () => {
    await fetch(`/api/smp/claim-groups/${group.id}/transfer`, { method: 'DELETE' })
    setLockedByTransfer(false)
    setTransferSent(false)
  }  
const unclaimGroup = async () => {
    setUnclaiming(true)
    const res = await fetch(`/api/smp/claim-groups/${group.id}/unclaim`, { method: 'POST' })
    setUnclaiming(false)
    setConfirmUnclaim(false)
    if (res.ok) setUnclaimDone(true)
  }
  const saveGroupName = async () => {
    if (!newGroupName.trim()) return
    setSavingName(true)
    await fetch(`/api/smp/claim-groups/${group.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newGroupName.trim() }),
    })
    setSavingName(false)
    setRenaming(false)
    onRenamed?.(group.id, newGroupName.trim())
  }
  const loadTemplates = () => {
    fetch('/api/smp/permission-templates')
      .then(r => r.json())
      .then(data => setTemplates(data.templates || []))
  }

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
  const setPermission = async (permissionKey: string, value: PermState) => {
    // Optimistisches Update im UI, bevor die Antwort vom Server da ist
    setRules(prev => {
      const filtered = prev.filter(r => !(
        r.scope === scope &&
        r.permission === permissionKey &&
        (scope === 'group_all' || r.target_uuid === selectedPlayer?.uuid)
      ))
      if (value === null) return filtered
      return [...filtered, {
        id: -1,
        scope,
        target_uuid: scope === 'group_player' ? selectedPlayer!.uuid : null,
        target_name: scope === 'group_player' ? selectedPlayer!.player_name : null,
        permission: permissionKey,
        allowed: value,
      }]
    })

    await fetch(`/api/smp/claim-groups/${group.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        scope,
        targetUuid: scope === 'group_player' ? selectedPlayer?.uuid : undefined,
        targetName: scope === 'group_player' ? selectedPlayer?.player_name : undefined,
        permission: permissionKey,
        allowed: value,
      }),
    })
    loadRules(false) // mit Server-Stand synchronisieren (z.B. echte ID statt -1), ohne Lade-Flackern
  }

  const handlePermissionChange = useCallback((permKey: string, value: PermState) => {
    setPermission(permKey, value)
  }, [scope, selectedPlayer])

  return (
    <div className="space-y-4">
      <div className="card rounded-2xl p-6">
        <div className="mb-4">
          {renaming ? (
            <div className="flex items-center gap-2 mb-1">
              <input
                type="text"
                value={newGroupName}
                onChange={e => setNewGroupName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && saveGroupName()}
                placeholder={group.name || `Gruppe #${group.id}`}
                autoFocus
                className="px-3 py-1.5 rounded-lg text-sm font-bold flex-1"
                style={{ background: 'var(--muted-bg)', border: '1px solid var(--card-border)', color: 'var(--foreground)' }}
              />
              <button onClick={saveGroupName} disabled={!newGroupName.trim() || savingName}
                className="text-xs font-medium px-3 py-1.5 rounded-lg disabled:opacity-40" style={{ background: '#16A34A', color: 'white' }}>
                {savingName ? '...' : 'Speichern'}
              </button>
              <button onClick={() => setRenaming(false)} className="text-xs px-2 py-1.5" style={{ color: 'var(--muted)' }}>
                Abbrechen
              </button>
            </div>
          ) : (
            <h2 className="font-bold text-lg flex items-center gap-2" style={{ color: 'var(--foreground)' }}>
              🗂️ {group.name || `Gruppe #${group.id}`}
              <button
                onClick={() => { setNewGroupName(group.name || ''); setRenaming(true) }}
                className="text-xs font-normal hover:opacity-70"
                style={{ color: 'var(--muted)' }}
              >
                ✏️ umbenennen
              </button>
            </h2>
          )}
          <p className="text-sm" style={{ color: 'var(--muted)' }}>
            {claims.length} Chunk{claims.length === 1 ? '' : 's'} · erstellt am {new Date(group.created_at).toLocaleDateString('de-DE')}
          </p>
        </div>

        {/* Suchleiste für Spieler-spezifische Permissions */}
        <div ref={searchBoxRef} className="relative mb-4">
          {selectedPlayer ? (
            <div className="flex items-center justify-between px-3 py-2 rounded-lg" style={{ background: 'rgba(22,163,74,0.1)', border: '2px solid #16A34A' }}>
              <span className="text-sm font-medium flex items-center gap-2" style={{ color: '#16A34A' }}>
                <img src={`https://mc-heads.net/avatar/${selectedPlayer.player_name}/24`} alt="" className="w-6 h-6 rounded flex-shrink-0" />
                ⚠️ Du änderst gerade NUR die Rechte für {selectedPlayer.player_name}
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
                  <img src={`https://mc-heads.net/avatar/${p.player_name}/24`} alt="" className="w-6 h-6 rounded flex-shrink-0" />
                  {p.player_name}
                </button>
              ))}
            </div>
          )}
        </div>

        <p className="text-xs mb-3" style={{ color: 'var(--muted)' }}>
          {selectedPlayer
            ? 'Nicht gesetzte Rechte fallen zurück auf die "Alle"-Einstellung für diese Gruppe.'
            : 'Diese Rechte gelten für alle Chunks dieser Gruppe (sofern nicht auf Chunk-Ebene überschrieben).'}
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

      <div className="card rounded-2xl p-6">
        <button onClick={() => setExpanded(!expanded)} className="w-full flex items-center justify-between">
          <h3 className="font-bold text-sm" style={{ color: 'var(--foreground)' }}>
            Chunks in dieser Gruppe ({claims.length})
          </h3>
          <span style={{ color: 'var(--muted)' }}>{expanded ? '▲' : '▼'}</span>
        </button>

        {expanded && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-4">
            {claims.map(c => (
              <button key={c.id} onClick={() => setExceptionClaim(c)}
                draggable={!!setDraggedClaim}
                onDragStart={() => setDraggedClaim?.(c)}
                onDragEnd={() => setDraggedClaim?.(null)}
                className="rounded-xl p-3 text-left transition-all cursor-grab active:cursor-grabbing"
                style={exceptionClaim?.id === c.id
                  ? { background: '#16A34A', color: 'white' }
                  : { background: 'var(--muted-bg)', border: '1px solid var(--card-border)', color: 'var(--foreground)' }}>
                <p className="font-bold text-sm">📍 {c.name || `Chunk ${c.chunk_x},${c.chunk_z}`}</p>
                <p className="text-xs opacity-80">{c.world}</p>
              </button>
            ))}
          </div>
        )}

        {!expanded && (
          <p className="text-xs mt-2" style={{ color: 'var(--muted)' }}>
            Aufklappen, um für einen bestimmten Chunk eine Ausnahme zu setzen.
          </p>
        )}
      </div>

      {exceptionClaim && (
        <PermissionPanel claim={exceptionClaim} groupName={group.name || `Gruppe #${group.id}`} />
      )}

      {lockedByTransfer && (
        <div className="card rounded-2xl p-4" style={{ border: '1px solid #EAB308', background: 'rgba(234,179,8,0.08)' }}>
          <p className="text-sm font-medium flex items-center justify-between gap-2" style={{ color: '#EAB308' }}>
            🔒 Diese Gruppe wird gerade übertragen und ist bis zur Antwort gesperrt.
            <button onClick={cancelTransfer} className="text-xs underline hover:opacity-70 flex-shrink-0">
              Übertragung zurückziehen
            </button>
          </p>
        </div>
      )}

      <div className="card rounded-2xl p-6">
        <p className="font-bold text-sm mb-1" style={{ color: 'var(--foreground)' }}>📤 Gruppe übertragen</p>
        {transferSent ? (
          <p className="text-sm" style={{ color: '#16A34A' }}>✓ Anfrage gesendet. Die Gruppe ist gesperrt, bis sie angenommen oder abgelehnt wird.</p>
        ) : lockedByTransfer ? (
          <p className="text-xs" style={{ color: 'var(--muted)' }}>Es läuft bereits eine Übertragung für diese Gruppe.</p>
        ) : (
          <>
            <p className="text-xs mb-3" style={{ color: 'var(--muted)' }}>
              Übertrage alle {claims.length} Chunks dieser Gruppe an einen anderen Spieler. Die Übertragung muss erst angenommen werden.
            </p>
            {!showTransferBox ? (
              <button
                onClick={() => setShowTransferBox(true)}
                className="text-xs font-medium px-3 py-1.5 rounded-lg transition"
                style={{ background: 'var(--muted-bg)', border: '1px solid var(--card-border)', color: 'var(--foreground)' }}
              >
                📤 Gruppe übertragen
              </button>
            ) : (
              <div className="relative">
                {transferTarget ? (
                  <div className="flex items-center justify-between px-3 py-2 rounded-lg mb-2" style={{ background: 'rgba(22,163,74,0.1)', border: '1px solid #16A34A' }}>
                    <span className="text-sm font-medium flex items-center gap-2" style={{ color: '#16A34A' }}>
                      <img src={`https://mc-heads.net/avatar/${transferTarget.player_name}/24`} alt="" className="w-6 h-6 rounded flex-shrink-0" />
                      {transferTarget.player_name}
                    </span>
                    <button onClick={() => setTransferTarget(null)} className="text-xs hover:opacity-70" style={{ color: '#16A34A' }}>Ändern</button>
                  </div>
                ) : (
                  <input
                    type="text"
                    value={transferSearch}
                    onChange={e => setTransferSearch(e.target.value)}
                    placeholder="Spielername eingeben..."
                    className="w-full px-3 py-2 rounded-lg text-sm mb-2"
                    style={{ background: 'var(--muted-bg)', border: '1px solid var(--card-border)', color: 'var(--foreground)' }}
                  />
                )}

                {!transferTarget && transferSuggestions.length > 0 && (
                  <div className="rounded-lg overflow-hidden mb-2" style={{ background: 'var(--card)', border: '1px solid var(--card-border)' }}>
                    {transferSuggestions.map(p => (
                      <button
                        key={p.uuid}
                        onClick={() => { setTransferTarget(p); setTransferSearch('') }}
                        className="w-full text-left px-3 py-1.5 text-sm transition flex items-center gap-2"
                        style={{ color: 'var(--foreground)' }}
                      >
                        <img src={`https://mc-heads.net/avatar/${p.player_name}/24`} alt="" className="w-6 h-6 rounded flex-shrink-0" />
                        {p.player_name}
                      </button>
                    ))}
                  </div>
                )}

                <div className="flex gap-2">
                  <button onClick={() => setShowTransferBox(false)} className="flex-1 text-xs py-2 rounded-lg" style={{ background: 'var(--muted-bg)', color: 'var(--foreground)' }}>
                    Abbrechen
                  </button>
                  <button onClick={sendTransfer} disabled={!transferTarget || sendingTransfer}
                    className="flex-1 text-xs font-medium py-2 rounded-lg disabled:opacity-40" style={{ background: '#16A34A', color: 'white' }}>
                    {sendingTransfer ? '...' : 'Anfrage senden'}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <div className="card rounded-2xl p-6">
        {unclaimDone ? (
          <p className="text-sm" style={{ color: '#16A34A' }}>
            ✓ Gruppe wurde unclaimt. Du kannst sie bis zu 48h im Papierkorb wiederherstellen.
          </p>
        ) : (
          <>
            <p className="font-bold text-sm mb-1" style={{ color: '#EF4444' }}>⚠️ Gefahrenzone</p>
            <p className="text-xs mb-3" style={{ color: 'var(--muted)' }}>
              Unclaimt alle {claims.length} Chunks dieser Gruppe auf einmal. Die Gruppe wird bis zu 48h im Papierkorb wiederherstellbar bleiben.
            </p>
            <button
              onClick={() => setConfirmUnclaim(true)}
              disabled={lockedByTransfer}
              className="text-xs font-medium px-3 py-1.5 rounded-lg transition disabled:opacity-40"
              style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid #EF4444', color: '#EF4444' }}
            >
              🗑️ Gruppe komplett unclaimen
            </button>
          </>
        )}
      </div>

      {confirmUnclaim && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="rounded-2xl p-6 max-w-sm w-full" style={{ background: 'var(--card)', border: '1px solid var(--card-border)' }}>
            <p className="font-bold mb-2" style={{ color: 'var(--foreground)' }}>Wirklich alle {claims.length} Chunks unclaimen?</p>
            <p className="text-sm mb-5" style={{ color: 'var(--muted)' }}>
              Die Gruppe "{group.name || `Gruppe #${group.id}`}" wird komplett gelöscht. Du kannst sie bis zu 48h im Papierkorb wiederherstellen, danach ist es endgültig.
            </p>
            <div className="flex gap-2">
              <button onClick={() => setConfirmUnclaim(false)} className="flex-1 text-sm py-2 rounded-lg" style={{ background: 'var(--muted-bg)', color: 'var(--foreground)' }}>
                Abbrechen
              </button>
              <button onClick={unclaimGroup} disabled={unclaiming} className="flex-1 text-sm font-medium py-2 rounded-lg disabled:opacity-50" style={{ background: '#EF4444', color: 'white' }}>
                {unclaiming ? '...' : 'Ja, unclaimen'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}