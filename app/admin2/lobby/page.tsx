'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '../../lib/auth-context'
import { hasWriteAccess } from '../layout'
import { usePathname } from 'next/navigation'

type NPC = {
  id: number
  name: string
  display_name: string
  skin_username: string | null
  skin_uuid: string | null
  world: string
  pos_x: number
  pos_y: number
  pos_z: number
  yaw: number
  pitch: number
  action_type: string
  action_value: string | null
  dialog: string | null
  bubble_text: string | null
}

type CompassItem = {
  id: number
  label: string
  server_id: string
  material: string
  lore: string | null
  sort_order: number
  enabled: boolean
}

const MATERIALS = [
  'COMPASS', 'NETHER_STAR', 'ENDER_PEARL', 'DIAMOND', 'EMERALD',
  'GOLD_INGOT', 'IRON_INGOT', 'PAPER', 'BOOK', 'MAP',
  'BLAZE_ROD', 'BEACON',
]

const defaultNpcForm = {
  name: '', display_name: '', skin_username: '',
  action_type: 'server_switch', action_value: '', dialog: '', bubble_text: '',
}

export default function Admin2LobbyPage() {
  const { user } = useAuth()
  const pathname = usePathname()
  const canWrite = hasWriteAccess(user?.clan_role, pathname)

  const [tab, setTab] = useState<'npcs' | 'compass'>('npcs')

  const [npcs, setNpcs] = useState<NPC[]>([])
  const [npcLoading, setNpcLoading] = useState(true)
  const [npcError, setNpcError] = useState('')
  const [editingNpc, setEditingNpc] = useState<NPC | null>(null)
  const [showNpcForm, setShowNpcForm] = useState(false)
  const [npcForm, setNpcForm] = useState(defaultNpcForm)
  const [npcSaving, setNpcSaving] = useState(false)

  const [compass, setCompass] = useState<CompassItem[]>([])
  const [compassLoading, setCompassLoading] = useState(true)
  const [compassError, setCompassError] = useState('')
  const [editingCompass, setEditingCompass] = useState<CompassItem | null>(null)
  const [showCompassForm, setShowCompassForm] = useState(false)
  const [compassForm, setCompassForm] = useState({
    label: '', server_id: '', material: 'COMPASS', lore: '', enabled: true,
  })
  const [compassSaving, setCompassSaving] = useState(false)

  const loadNpcs = () => {
    setNpcLoading(true)
    fetch('/api/admin2/lobby-npcs')
      .then(r => r.json())
      .then(d => setNpcs(d.npcs || []))
      .catch(() => setNpcError('Fehler beim Laden'))
      .finally(() => setNpcLoading(false))
  }

  const loadCompass = () => {
    setCompassLoading(true)
    fetch('/api/admin2/lobby-compass')
      .then(r => r.json())
      .then(d => setCompass(d.items || []))
      .catch(() => setCompassError('Fehler beim Laden'))
      .finally(() => setCompassLoading(false))
  }

  useEffect(() => { if (user) { loadNpcs(); loadCompass() } }, [user])

  const openNpcForm = (npc?: NPC) => {
    setNpcError('')
    if (npc) {
      setEditingNpc(npc)
      setNpcForm({
        name: npc.name,
        display_name: npc.display_name,
        skin_username: npc.skin_username || '',
        action_type: npc.action_type,
        action_value: npc.action_value || '',
        dialog: npc.dialog || '',
        bubble_text: npc.bubble_text || '',
      })
    } else {
      setEditingNpc(null)
      setNpcForm(defaultNpcForm)
    }
    setShowNpcForm(true)
  }

  const saveNpc = async () => {
    setNpcSaving(true)
    setNpcError('')

    const url = editingNpc ? `/api/admin2/lobby-npcs/${editingNpc.id}` : '/api/admin2/lobby-npcs'
    const method = editingNpc ? 'PATCH' : 'POST'

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(npcForm),
    })
    setNpcSaving(false)

    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      setNpcError(d.error || 'Fehler beim Speichern')
      return
    }
    setShowNpcForm(false)
    loadNpcs()
  }

  const deleteNpc = async (id: number) => {
    if (!confirm('NPC wirklich löschen?')) return
    await fetch(`/api/admin2/lobby-npcs/${id}`, { method: 'DELETE' })
    loadNpcs()
  }

  const openCompassForm = (item?: CompassItem) => {
    setCompassError('')
    if (item) {
      setEditingCompass(item)
      setCompassForm({ label: item.label, server_id: item.server_id, material: item.material, lore: item.lore || '', enabled: item.enabled })
    } else {
      setEditingCompass(null)
      setCompassForm({ label: '', server_id: '', material: 'COMPASS', lore: '', enabled: true })
    }
    setShowCompassForm(true)
  }

  const saveCompass = async () => {
    setCompassSaving(true)
    if (editingCompass) {
      await fetch('/api/admin2/lobby-compass', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editingCompass.id, ...compassForm }),
      })
    } else {
      await fetch('/api/admin2/lobby-compass', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(compassForm),
      })
    }
    setCompassSaving(false)
    setShowCompassForm(false)
    loadCompass()
  }

  const deleteCompass = async (id: number) => {
    if (!confirm('Löschen?')) return
    await fetch('/api/admin2/lobby-compass', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    loadCompass()
  }

  const moveCompass = async (item: CompassItem, dir: 'up' | 'down') => {
    const sorted = [...compass].sort((a, b) => a.sort_order - b.sort_order)
    const idx = sorted.findIndex(i => i.id === item.id)
    const neighbor = dir === 'up' ? sorted[idx - 1] : sorted[idx + 1]
    if (!neighbor) return
    await Promise.all([
      fetch('/api/admin2/lobby-compass', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: item.id, sort_order: neighbor.sort_order }) }),
      fetch('/api/admin2/lobby-compass', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: neighbor.id, sort_order: item.sort_order }) }),
    ])
    loadCompass()
  }

  const inp = {
    background: 'var(--muted-bg)', border: '1px solid var(--card-border)',
    color: 'var(--foreground)', borderRadius: 8, padding: '8px 12px', width: '100%', fontSize: 14,
  }
  const card = {
    background: 'var(--card-bg)', border: '1px solid var(--card-border)',
    borderRadius: 12, padding: '16px 20px',
  }
  const gradBtn = { background: 'linear-gradient(135deg, #4F46E5, #7C3AED, #C026D3)' }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-1" style={{ color: 'var(--foreground)' }}>🎮 Lobby-Verwaltung</h1>
        <p style={{ color: 'var(--muted)' }}>NPCs und Kompass-Menü für die Lobby verwalten.</p>
      </div>

      {!canWrite && (
        <div className="mb-6 px-4 py-3 rounded-xl text-sm" style={{ background: 'var(--muted-bg)', color: 'var(--muted)', border: '1px solid var(--card-border)' }}>
          🔒 Nur Lesezugriff.
        </div>
      )}

      <div className="flex gap-2 mb-6">
        {(['npcs', 'compass'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className="px-5 py-2 rounded-xl text-sm font-medium transition-all"
            style={tab === t ? { ...gradBtn, color: '#fff' } : { background: 'var(--muted-bg)', color: 'var(--muted)', border: '1px solid var(--card-border)' }}>
            {t === 'npcs' ? '🧑 NPCs' : '🧭 Kompass-Menü'}
          </button>
        ))}
      </div>

      {/* NPCs */}
      {tab === 'npcs' && (
        <div>
          {canWrite && (
            <button onClick={() => openNpcForm()} className="mb-6 px-5 py-2.5 rounded-xl text-sm font-medium text-white" style={gradBtn}>
              + NPC erstellen
            </button>
          )}
          {npcError && !showNpcForm && <p className="mb-4 text-sm" style={{ color: '#EF4444' }}>{npcError}</p>}
          {npcLoading ? <p style={{ color: 'var(--muted)' }}>Laden...</p> : npcs.length === 0 ? (
            <p style={{ color: 'var(--muted)' }}>Noch keine NPCs.</p>
          ) : (
            <div className="space-y-3">
              {npcs.map(npc => (
                <div key={npc.id} style={card} className="flex items-center gap-4">
                  {/* Spielerkopf */}
                  <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0" style={{ border: '1px solid var(--card-border)' }}>
                    {npc.skin_username
                      ? <img src={`/api/player-heads/${npc.skin_username}/48`} alt="head" className="w-full h-full object-cover" />
                      : <div className="w-full h-full flex items-center justify-center text-2xl" style={{ background: 'var(--muted-bg)' }}>🧍</div>
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm" style={{ color: 'var(--foreground)' }}>{npc.display_name}</p>
                    <p className="text-xs" style={{ color: 'var(--muted)' }}>
                      ID: {npc.id} · {npc.skin_username || 'kein Skin'} · {npc.action_type === 'server_switch' ? `→ ${npc.action_value || '?'}` : 'Dialog'}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
                      {npc.pos_x !== 0 || npc.pos_z !== 0
                        ? `📍 ${npc.world} ${Math.round(npc.pos_x)}, ${Math.round(npc.pos_y)}, ${Math.round(npc.pos_z)}`
                        : '📍 Position noch nicht gesetzt — /setnpchere ' + npc.id}
                    </p>
                    {npc.bubble_text && <p className="text-xs italic mt-0.5" style={{ color: 'var(--muted)' }}>💬 "{npc.bubble_text}"</p>}
                  </div>
                  {canWrite && (
                    <div className="flex gap-2 flex-shrink-0">
                      <button onClick={() => openNpcForm(npc)} className="px-3 py-1.5 rounded-lg text-xs" style={{ background: 'var(--muted-bg)', color: 'var(--foreground)', border: '1px solid var(--card-border)' }}>Bearbeiten</button>
                      <button onClick={() => deleteNpc(npc.id)} className="px-3 py-1.5 rounded-lg text-xs" style={{ background: '#FEE2E2', color: '#EF4444', border: '1px solid #FECACA' }}>Löschen</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {showNpcForm && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)' }}>
              <div className="w-full max-w-lg rounded-2xl p-6 space-y-4" style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', maxHeight: '90vh', overflowY: 'auto' }}>
                <h2 className="text-lg font-bold" style={{ color: 'var(--foreground)' }}>{editingNpc ? 'NPC bearbeiten' : 'NPC erstellen'}</h2>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--muted)' }}>Interner Name</label>
                    <input style={inp} value={npcForm.name} onChange={e => setNpcForm(f => ({ ...f, name: e.target.value }))} placeholder="z.B. smp_npc" />
                  </div>
                  <div>
                    <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--muted)' }}>Anzeigename (über dem NPC)</label>
                    <input style={inp} value={npcForm.display_name} onChange={e => setNpcForm(f => ({ ...f, display_name: e.target.value }))} placeholder="z.B. §6SMP beitreten" />
                  </div>
                  <div>
                    <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--muted)' }}>Minecraft-Username für Skin (optional)</label>
                    <input style={inp} value={npcForm.skin_username} onChange={e => setNpcForm(f => ({ ...f, skin_username: e.target.value }))} placeholder="z.B. EmilyThorne" />
                    <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>UUID wird automatisch von Mojang geholt — funktioniert auch nach Namensänderungen.</p>
                  </div>
                  <div>
                    <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--muted)' }}>Aktion bei Klick</label>
                    <select style={inp} value={npcForm.action_type} onChange={e => setNpcForm(f => ({ ...f, action_type: e.target.value }))}>
                      <option value="server_switch">Server wechseln</option>
                      <option value="dialog">Nur Dialog</option>
                    </select>
                  </div>
                  {npcForm.action_type === 'server_switch' && (
                    <div>
                      <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--muted)' }}>Velocity Server-ID</label>
                      <input style={inp} value={npcForm.action_value} onChange={e => setNpcForm(f => ({ ...f, action_value: e.target.value }))} placeholder="z.B. smp" />
                    </div>
                  )}
                  <div>
                    <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--muted)' }}>Dialog im Chat (leer = keiner)</label>
                    <textarea style={{ ...inp, resize: 'vertical', minHeight: 60 }} value={npcForm.dialog} onChange={e => setNpcForm(f => ({ ...f, dialog: e.target.value }))} placeholder="§7Willkommen!" />
                  </div>
                  <div>
                    <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--muted)' }}>Sprechblase über dem Kopf (leer = keine)</label>
                    <input style={inp} value={npcForm.bubble_text} onChange={e => setNpcForm(f => ({ ...f, bubble_text: e.target.value }))} placeholder="Klick mich!" />
                  </div>
                </div>
                {npcError && <p className="text-sm" style={{ color: '#EF4444' }}>{npcError}</p>}
                <div className="flex gap-3 pt-2">
                  <button onClick={saveNpc} disabled={npcSaving} className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white" style={{ ...gradBtn, opacity: npcSaving ? 0.7 : 1 }}>
                    {npcSaving ? 'Speichern...' : 'Speichern'}
                  </button>
                  <button onClick={() => setShowNpcForm(false)} className="px-5 py-2.5 rounded-xl text-sm" style={{ background: 'var(--muted-bg)', color: 'var(--muted)', border: '1px solid var(--card-border)' }}>
                    Abbrechen
                  </button>
                </div>
                {editingNpc && (
                  <div className="pt-2 border-t" style={{ borderColor: 'var(--card-border)' }}>
                    <p className="text-xs" style={{ color: 'var(--muted)' }}>
                      💡 Position setzen: Ingame <code className="px-1 py-0.5 rounded" style={{ background: 'var(--muted-bg)' }}>/setnpchere {editingNpc.id}</code>
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Kompass */}
      {tab === 'compass' && (
        <div>
          {canWrite && (
            <button onClick={() => openCompassForm()} className="mb-6 px-5 py-2.5 rounded-xl text-sm font-medium text-white" style={gradBtn}>
              + Eintrag hinzufügen
            </button>
          )}
          {compassError && <p className="mb-4 text-sm" style={{ color: '#EF4444' }}>{compassError}</p>}
          {compassLoading ? <p style={{ color: 'var(--muted)' }}>Laden...</p> : compass.length === 0 ? (
            <p style={{ color: 'var(--muted)' }}>Noch keine Einträge.</p>
          ) : (
            <div className="space-y-3">
              {[...compass].sort((a, b) => a.sort_order - b.sort_order).map((item, idx) => (
                <div key={item.id} style={card} className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center text-lg flex-shrink-0" style={{ background: 'var(--muted-bg)', border: '1px solid var(--card-border)' }}>🧭</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-sm" style={{ color: 'var(--foreground)' }}>{item.label}</p>
                      {!item.enabled && <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'var(--muted-bg)', color: 'var(--muted)' }}>deaktiviert</span>}
                    </div>
                    <p className="text-xs" style={{ color: 'var(--muted)' }}>Server: <code>{item.server_id}</code> · {item.material}</p>
                    {item.lore && <p className="text-xs italic mt-0.5" style={{ color: 'var(--muted)' }}>{item.lore}</p>}
                  </div>
                  {canWrite && (
                    <div className="flex gap-1 flex-shrink-0">
                      <button onClick={() => moveCompass(item, 'up')} disabled={idx === 0} className="px-2 py-1.5 rounded-lg text-xs" style={{ background: 'var(--muted-bg)', color: 'var(--foreground)', border: '1px solid var(--card-border)', opacity: idx === 0 ? 0.4 : 1 }}>↑</button>
                      <button onClick={() => moveCompass(item, 'down')} disabled={idx === compass.length - 1} className="px-2 py-1.5 rounded-lg text-xs" style={{ background: 'var(--muted-bg)', color: 'var(--foreground)', border: '1px solid var(--card-border)', opacity: idx === compass.length - 1 ? 0.4 : 1 }}>↓</button>
                      <button onClick={() => openCompassForm(item)} className="px-3 py-1.5 rounded-lg text-xs" style={{ background: 'var(--muted-bg)', color: 'var(--foreground)', border: '1px solid var(--card-border)' }}>Bearbeiten</button>
                      <button onClick={() => deleteCompass(item.id)} className="px-3 py-1.5 rounded-lg text-xs" style={{ background: '#FEE2E2', color: '#EF4444', border: '1px solid #FECACA' }}>Löschen</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {showCompassForm && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)' }}>
              <div className="w-full max-w-md rounded-2xl p-6 space-y-4" style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}>
                <h2 className="text-lg font-bold" style={{ color: 'var(--foreground)' }}>{editingCompass ? 'Bearbeiten' : 'Hinzufügen'}</h2>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--muted)' }}>Anzeigename</label>
                    <input style={inp} value={compassForm.label} onChange={e => setCompassForm(f => ({ ...f, label: e.target.value }))} placeholder="§6SMP" />
                  </div>
                  <div>
                    <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--muted)' }}>Velocity Server-ID</label>
                    <input style={inp} value={compassForm.server_id} onChange={e => setCompassForm(f => ({ ...f, server_id: e.target.value }))} placeholder="smp" />
                  </div>
                  <div>
                    <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--muted)' }}>Material</label>
                    <select style={inp} value={compassForm.material} onChange={e => setCompassForm(f => ({ ...f, material: e.target.value }))}>
                      {MATERIALS.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--muted)' }}>Lore (optional)</label>
                    <input style={inp} value={compassForm.lore} onChange={e => setCompassForm(f => ({ ...f, lore: e.target.value }))} placeholder="§7Klicke um zu wechseln" />
                  </div>
                  <div className="flex items-center gap-3">
                    <input type="checkbox" id="enabled" checked={compassForm.enabled} onChange={e => setCompassForm(f => ({ ...f, enabled: e.target.checked }))} />
                    <label htmlFor="enabled" className="text-sm" style={{ color: 'var(--foreground)' }}>Aktiviert</label>
                  </div>
                </div>
                <div className="flex gap-3 pt-2">
                  <button onClick={saveCompass} disabled={compassSaving} className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white" style={{ ...gradBtn, opacity: compassSaving ? 0.7 : 1 }}>
                    {compassSaving ? 'Speichern...' : 'Speichern'}
                  </button>
                  <button onClick={() => setShowCompassForm(false)} className="px-5 py-2.5 rounded-xl text-sm" style={{ background: 'var(--muted-bg)', color: 'var(--muted)', border: '1px solid var(--card-border)' }}>
                    Abbrechen
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}