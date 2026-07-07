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

type Hologram = {
  id: number
  label: string
  world: string
  pos_x: number
  pos_y: number
  pos_z: number
  lines: string[]
}

const MATERIALS = [
  'COMPASS', 'NETHER_STAR', 'ENDER_PEARL', 'DIAMOND', 'EMERALD',
  'GOLD_INGOT', 'IRON_INGOT', 'PAPER', 'BOOK', 'MAP', 'BLAZE_ROD', 'BEACON',
]

const defaultNpcForm = {
  name: '', display_name: '', skin_username: '',
  action_type: 'server_switch', action_value: '', dialog: '', bubble_text: '',
}

export default function Admin2LobbyPage() {
  const { user } = useAuth()
  const pathname = usePathname()
  const canWrite = hasWriteAccess(user?.clan_role, pathname)

  const [tab, setTab] = useState<'npcs' | 'compass' | 'holograms'>('npcs')

  // NPCs
  const [npcs, setNpcs] = useState<NPC[]>([])
  const [npcLoading, setNpcLoading] = useState(true)
  const [npcError, setNpcError] = useState('')
  const [editingNpc, setEditingNpc] = useState<NPC | null>(null)
  const [showNpcForm, setShowNpcForm] = useState(false)
  const [npcForm, setNpcForm] = useState(defaultNpcForm)
  const [npcSaving, setNpcSaving] = useState(false)

  // Compass
  const [compass, setCompass] = useState<CompassItem[]>([])
  const [compassLoading, setCompassLoading] = useState(true)
  const [compassError, setCompassError] = useState('')
  const [editingCompass, setEditingCompass] = useState<CompassItem | null>(null)
  const [showCompassForm, setShowCompassForm] = useState(false)
  const [compassForm, setCompassForm] = useState({ label: '', server_id: '', material: 'COMPASS', lore: '', enabled: true })
  const [compassSaving, setCompassSaving] = useState(false)

  // Holograms
  const [holograms, setHolograms] = useState<Hologram[]>([])
  const [hologramLoading, setHologramLoading] = useState(true)
  const [hologramError, setHologramError] = useState('')
  const [editingHologram, setEditingHologram] = useState<Hologram | null>(null)
  const [showHologramForm, setShowHologramForm] = useState(false)
  const [hologramForm, setHologramForm] = useState({ label: '', linesText: '' })
  const [hologramSaving, setHologramSaving] = useState(false)

  const loadNpcs = () => {
    setNpcLoading(true)
    fetch('/api/admin2/lobby-npcs').then(r => r.json()).then(d => setNpcs(d.npcs || [])).finally(() => setNpcLoading(false))
  }
  const loadCompass = () => {
    setCompassLoading(true)
    fetch('/api/admin2/lobby-compass').then(r => r.json()).then(d => setCompass(d.items || [])).finally(() => setCompassLoading(false))
  }
  const loadHolograms = () => {
    setHologramLoading(true)
    fetch('/api/admin2/lobby-holograms').then(r => r.json()).then(d => setHolograms(d.holograms || [])).finally(() => setHologramLoading(false))
  }

  useEffect(() => { if (user) { loadNpcs(); loadCompass(); loadHolograms() } }, [user])

  // NPC handlers
  const openNpcForm = (npc?: NPC) => {
    setNpcError('')
    if (npc) {
      setEditingNpc(npc)
      setNpcForm({ name: npc.name, display_name: npc.display_name, skin_username: npc.skin_username || '', action_type: npc.action_type, action_value: npc.action_value || '', dialog: npc.dialog || '', bubble_text: npc.bubble_text || '' })
    } else {
      setEditingNpc(null)
      setNpcForm(defaultNpcForm)
    }
    setShowNpcForm(true)
  }

  const saveNpc = async () => {
    setNpcSaving(true); setNpcError('')
    const url = editingNpc ? `/api/admin2/lobby-npcs/${editingNpc.id}` : '/api/admin2/lobby-npcs'
    const res = await fetch(url, { method: editingNpc ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(npcForm) })
    setNpcSaving(false)
    if (!res.ok) { const d = await res.json().catch(() => ({})); setNpcError(d.error || 'Fehler'); return }
    setShowNpcForm(false); loadNpcs()
  }

  const deleteNpc = async (id: number) => {
    if (!confirm('NPC löschen?')) return
    await fetch(`/api/admin2/lobby-npcs/${id}`, { method: 'DELETE' }); loadNpcs()
  }

  // Compass handlers
  const openCompassForm = (item?: CompassItem) => {
    setCompassError('')
    if (item) { setEditingCompass(item); setCompassForm({ label: item.label, server_id: item.server_id, material: item.material, lore: item.lore || '', enabled: item.enabled }) }
    else { setEditingCompass(null); setCompassForm({ label: '', server_id: '', material: 'COMPASS', lore: '', enabled: true }) }
    setShowCompassForm(true)
  }

  const saveCompass = async () => {
    setCompassSaving(true)
    if (editingCompass) await fetch('/api/admin2/lobby-compass', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: editingCompass.id, ...compassForm }) })
    else await fetch('/api/admin2/lobby-compass', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(compassForm) })
    setCompassSaving(false); setShowCompassForm(false); loadCompass()
  }

  const deleteCompass = async (id: number) => {
    if (!confirm('Löschen?')) return
    await fetch('/api/admin2/lobby-compass', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) }); loadCompass()
  }

  const moveCompass = async (item: CompassItem, dir: 'up' | 'down') => {
    const sorted = [...compass].sort((a, b) => a.sort_order - b.sort_order)
    const idx = sorted.findIndex(i => i.id === item.id)
    const neighbor = dir === 'up' ? sorted[idx - 1] : sorted[idx + 1]
    if (!neighbor) return
    await Promise.all([
      fetch('/api/admin2/lobby-compass', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: item.id, sort_order: neighbor.sort_order }) }),
      fetch('/api/admin2/lobby-compass', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: neighbor.id, sort_order: item.sort_order }) }),
    ]); loadCompass()
  }

  // Hologram handlers
  const openHologramForm = (h?: Hologram) => {
    setHologramError('')
    if (h) { setEditingHologram(h); setHologramForm({ label: h.label, linesText: h.lines.join('\n') }) }
    else { setEditingHologram(null); setHologramForm({ label: '', linesText: '' }) }
    setShowHologramForm(true)
  }

  const saveHologram = async () => {
    setHologramSaving(true); setHologramError('')
    const lines = hologramForm.linesText.split('\n').map(l => l.trim()).filter(l => l.length > 0)
    if (!hologramForm.label.trim()) { setHologramError('Label erforderlich'); setHologramSaving(false); return }

    if (editingHologram) {
      await fetch(`/api/admin2/lobby-holograms/${editingHologram.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: hologramForm.label.trim(), lines }),
      })
    } else {
      await fetch('/api/admin2/lobby-holograms', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: hologramForm.label.trim(), lines }),
      })
    }
    setHologramSaving(false); setShowHologramForm(false); loadHolograms()
  }

  const deleteHologram = async (id: number) => {
    if (!confirm('Hologramm löschen?')) return
    await fetch(`/api/admin2/lobby-holograms/${id}`, { method: 'DELETE' }); loadHolograms()
  }

  const inp = { background: 'var(--muted-bg)', border: '1px solid var(--card-border)', color: 'var(--foreground)', borderRadius: 8, padding: '8px 12px', width: '100%', fontSize: 14 }
  const card = { background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 12, padding: '16px 20px' }
  const gradBtn = { background: 'linear-gradient(135deg, #4F46E5, #7C3AED, #C026D3)' }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-1" style={{ color: 'var(--foreground)' }}>🎮 Lobby-Verwaltung</h1>
        <p style={{ color: 'var(--muted)' }}>NPCs, Kompass-Menü und Hologramme verwalten.</p>
      </div>

      {!canWrite && (
        <div className="mb-6 px-4 py-3 rounded-xl text-sm" style={{ background: 'var(--muted-bg)', color: 'var(--muted)', border: '1px solid var(--card-border)' }}>
          🔒 Nur Lesezugriff.
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        {(['npcs', 'compass', 'holograms'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} className="px-5 py-2 rounded-xl text-sm font-medium transition-all"
            style={tab === t ? { ...gradBtn, color: '#fff' } : { background: 'var(--muted-bg)', color: 'var(--muted)', border: '1px solid var(--card-border)' }}>
            {t === 'npcs' ? '🧑 NPCs' : t === 'compass' ? '🧭 Kompass' : '✨ Hologramme'}
          </button>
        ))}
      </div>

      {/* ─── NPCs ─── */}
      {tab === 'npcs' && (
        <div>
          {canWrite && <button onClick={() => openNpcForm()} className="mb-6 px-5 py-2.5 rounded-xl text-sm font-medium text-white" style={gradBtn}>+ NPC erstellen</button>}
          {npcError && !showNpcForm && <p className="mb-4 text-sm" style={{ color: '#EF4444' }}>{npcError}</p>}
          {npcLoading ? <p style={{ color: 'var(--muted)' }}>Laden...</p> : npcs.length === 0 ? <p style={{ color: 'var(--muted)' }}>Noch keine NPCs.</p> : (
            <div className="space-y-3">
              {npcs.map(npc => (
                <div key={npc.id} style={card} className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0" style={{ border: '1px solid var(--card-border)' }}>
                    {npc.skin_username ? <img src={`/api/player-heads/${npc.skin_username}/48`} alt="head" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-2xl" style={{ background: 'var(--muted-bg)' }}>🧍</div>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm" style={{ color: 'var(--foreground)' }}>{npc.display_name}</p>
                    <p className="text-xs" style={{ color: 'var(--muted)' }}>ID: {npc.id} · {npc.skin_username || 'kein Skin'} · {
                      npc.action_type === 'server_switch' ? `→ ${npc.action_value || '?'}` :
                      npc.action_type === 'daily_reward' ? '🎁 Belohnungs-GUI' :
                      npc.action_type === 'quests' ? '⚔ Quest-GUI' : 'Dialog'
                    }</p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
                      {npc.pos_x !== 0 || npc.pos_z !== 0 ? `📍 ${npc.world} ${Math.round(npc.pos_x)}, ${Math.round(npc.pos_y)}, ${Math.round(npc.pos_z)}` : `📍 Noch nicht gesetzt — /setnpchere ${npc.id}`}
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
                  {[['name', 'Interner Name', 'z.B. smp_npc'], ['display_name', 'Anzeigename', '§6SMP beitreten'], ['skin_username', 'Minecraft-Username für Skin', 'z.B. EmilyThorne']].map(([key, label, ph]) => (
                    <div key={key}>
                      <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--muted)' }}>{label}</label>
                      <input style={inp} value={(npcForm as any)[key]} onChange={e => setNpcForm(f => ({ ...f, [key]: e.target.value }))} placeholder={ph} />
                    </div>
                  ))}
                  <div>
                    <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--muted)' }}>Aktion</label>
                    <select style={inp} value={npcForm.action_type} onChange={e => setNpcForm(f => ({ ...f, action_type: e.target.value }))}>
                      <option value="server_switch">Server wechseln</option>
                      <option value="dialog">Nur Dialog</option>
                      <option value="daily_reward">🎁 Tägliche Belohnung GUI</option>
                      <option value="quests">⚔ Quest GUI</option>
                      <option value="pet_shop">🛒 Pet-Shop GUI</option>
                    </select>
                  </div>
                  {npcForm.action_type === 'server_switch' && (
                    <div>
                      <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--muted)' }}>Velocity Server-ID</label>
                      <input style={inp} value={npcForm.action_value} onChange={e => setNpcForm(f => ({ ...f, action_value: e.target.value }))} placeholder="smp" />
                    </div>
                  )}
                  <div>
                    <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--muted)' }}>Dialog (leer = keiner)</label>
                    <textarea style={{ ...inp, resize: 'vertical', minHeight: 60 }} value={npcForm.dialog} onChange={e => setNpcForm(f => ({ ...f, dialog: e.target.value }))} placeholder="§7Willkommen!" />
                  </div>
                  <div>
                    <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--muted)' }}>Sprechblase (leer = keine)</label>
                    <input style={inp} value={npcForm.bubble_text} onChange={e => setNpcForm(f => ({ ...f, bubble_text: e.target.value }))} placeholder="Klick mich!" />
                  </div>
                </div>
                {npcError && <p className="text-sm" style={{ color: '#EF4444' }}>{npcError}</p>}
                <div className="flex gap-3 pt-2">
                  <button onClick={saveNpc} disabled={npcSaving} className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white" style={{ ...gradBtn, opacity: npcSaving ? 0.7 : 1 }}>{npcSaving ? 'Speichern...' : 'Speichern'}</button>
                  <button onClick={() => setShowNpcForm(false)} className="px-5 py-2.5 rounded-xl text-sm" style={{ background: 'var(--muted-bg)', color: 'var(--muted)', border: '1px solid var(--card-border)' }}>Abbrechen</button>
                </div>
                {editingNpc && <p className="text-xs pt-2 border-t" style={{ color: 'var(--muted)', borderColor: 'var(--card-border)' }}>💡 Position: <code style={{ background: 'var(--muted-bg)', padding: '2px 6px', borderRadius: 4 }}>/setnpchere {editingNpc.id}</code></p>}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── Kompass ─── */}
      {tab === 'compass' && (
        <div>
          {canWrite && <button onClick={() => openCompassForm()} className="mb-6 px-5 py-2.5 rounded-xl text-sm font-medium text-white" style={gradBtn}>+ Eintrag hinzufügen</button>}
          {compassLoading ? <p style={{ color: 'var(--muted)' }}>Laden...</p> : compass.length === 0 ? <p style={{ color: 'var(--muted)' }}>Noch keine Einträge.</p> : (
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
                  <div><label className="text-xs font-medium mb-1 block" style={{ color: 'var(--muted)' }}>Anzeigename</label><input style={inp} value={compassForm.label} onChange={e => setCompassForm(f => ({ ...f, label: e.target.value }))} placeholder="§6SMP" /></div>
                  <div><label className="text-xs font-medium mb-1 block" style={{ color: 'var(--muted)' }}>Velocity Server-ID</label><input style={inp} value={compassForm.server_id} onChange={e => setCompassForm(f => ({ ...f, server_id: e.target.value }))} placeholder="smp" /></div>
                  <div>
                    <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--muted)' }}>Material</label>
                    <select style={inp} value={compassForm.material} onChange={e => setCompassForm(f => ({ ...f, material: e.target.value }))}>
                      {MATERIALS.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                  <div><label className="text-xs font-medium mb-1 block" style={{ color: 'var(--muted)' }}>Lore (optional)</label><input style={inp} value={compassForm.lore} onChange={e => setCompassForm(f => ({ ...f, lore: e.target.value }))} placeholder="§7Klicke um zu wechseln" /></div>
                  <div className="flex items-center gap-3">
                    <input type="checkbox" id="enabled" checked={compassForm.enabled} onChange={e => setCompassForm(f => ({ ...f, enabled: e.target.checked }))} />
                    <label htmlFor="enabled" className="text-sm" style={{ color: 'var(--foreground)' }}>Aktiviert</label>
                  </div>
                </div>
                <div className="flex gap-3 pt-2">
                  <button onClick={saveCompass} disabled={compassSaving} className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white" style={{ ...gradBtn, opacity: compassSaving ? 0.7 : 1 }}>{compassSaving ? 'Speichern...' : 'Speichern'}</button>
                  <button onClick={() => setShowCompassForm(false)} className="px-5 py-2.5 rounded-xl text-sm" style={{ background: 'var(--muted-bg)', color: 'var(--muted)', border: '1px solid var(--card-border)' }}>Abbrechen</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── Hologramme ─── */}
      {tab === 'holograms' && (
        <div>
          {canWrite && <button onClick={() => openHologramForm()} className="mb-6 px-5 py-2.5 rounded-xl text-sm font-medium text-white" style={gradBtn}>+ Hologramm erstellen</button>}
          {hologramError && !showHologramForm && <p className="mb-4 text-sm" style={{ color: '#EF4444' }}>{hologramError}</p>}
          {hologramLoading ? <p style={{ color: 'var(--muted)' }}>Laden...</p> : holograms.length === 0 ? <p style={{ color: 'var(--muted)' }}>Noch keine Hologramme.</p> : (
            <div className="space-y-3">
              {holograms.map(h => (
                <div key={h.id} style={card} className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center text-lg flex-shrink-0" style={{ background: 'var(--muted-bg)', border: '1px solid var(--card-border)' }}>✨</div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm" style={{ color: 'var(--foreground)' }}>{h.label}</p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
                      {h.pos_x !== 0 || h.pos_z !== 0 ? `📍 ${h.world} ${Math.round(h.pos_x)}, ${Math.round(h.pos_y)}, ${Math.round(h.pos_z)}` : `📍 Noch nicht gesetzt — /sethologramhere ${h.id}`}
                    </p>
                    <div className="mt-1 space-y-0.5">
                      {h.lines.map((line, i) => (
                        <p key={i} className="text-xs font-mono" style={{ color: 'var(--muted)' }}>{line}</p>
                      ))}
                    </div>
                  </div>
                  {canWrite && (
                    <div className="flex gap-2 flex-shrink-0">
                      <button onClick={() => openHologramForm(h)} className="px-3 py-1.5 rounded-lg text-xs" style={{ background: 'var(--muted-bg)', color: 'var(--foreground)', border: '1px solid var(--card-border)' }}>Bearbeiten</button>
                      <button onClick={() => deleteHologram(h.id)} className="px-3 py-1.5 rounded-lg text-xs" style={{ background: '#FEE2E2', color: '#EF4444', border: '1px solid #FECACA' }}>Löschen</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {showHologramForm && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)' }}>
              <div className="w-full max-w-lg rounded-2xl p-6 space-y-4" style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}>
                <h2 className="text-lg font-bold" style={{ color: 'var(--foreground)' }}>{editingHologram ? 'Hologramm bearbeiten' : 'Hologramm erstellen'}</h2>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--muted)' }}>Label (intern, nur für die Übersicht)</label>
                    <input style={inp} value={hologramForm.label} onChange={e => setHologramForm(f => ({ ...f, label: e.target.value }))} placeholder="z.B. Willkommen-Text" />
                  </div>
                  <div>
                    <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--muted)' }}>Zeilen (eine pro Zeile, §-Codes möglich)</label>
                    <textarea
                      style={{ ...inp, resize: 'vertical', minHeight: 120, fontFamily: 'monospace' }}
                      value={hologramForm.linesText}
                      onChange={e => setHologramForm(f => ({ ...f, linesText: e.target.value }))}
                      placeholder={"§6§lWillkommen!\n§7Viel Spaß auf dem Server\n§e➔ Klicke einen NPC"}
                    />
                    <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>Erste Zeile erscheint ganz oben. §6 = Gold, §l = Fett, §7 = Grau usw.</p>
                  </div>
                </div>
                {hologramError && <p className="text-sm" style={{ color: '#EF4444' }}>{hologramError}</p>}
                <div className="flex gap-3 pt-2">
                  <button onClick={saveHologram} disabled={hologramSaving} className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white" style={{ ...gradBtn, opacity: hologramSaving ? 0.7 : 1 }}>{hologramSaving ? 'Speichern...' : 'Speichern'}</button>
                  <button onClick={() => setShowHologramForm(false)} className="px-5 py-2.5 rounded-xl text-sm" style={{ background: 'var(--muted-bg)', color: 'var(--muted)', border: '1px solid var(--card-border)' }}>Abbrechen</button>
                </div>
                {editingHologram && <p className="text-xs pt-2 border-t" style={{ color: 'var(--muted)', borderColor: 'var(--card-border)' }}>💡 Position: <code style={{ background: 'var(--muted-bg)', padding: '2px 6px', borderRadius: 4 }}>/sethologramhere {editingHologram.id}</code></p>}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}