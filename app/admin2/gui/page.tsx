'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '../../lib/auth-context'
import { hasWriteAccess } from '../layout'
import { usePathname } from 'next/navigation'

const MATERIALS_COMMON = [
  'NETHER_STAR', 'DIAMOND', 'EMERALD', 'GOLD_INGOT', 'IRON_INGOT',
  'PAPER', 'BOOK', 'CHEST', 'CLOCK', 'COMPASS',
  'GREEN_STAINED_GLASS_PANE', 'RED_STAINED_GLASS_PANE', 'YELLOW_STAINED_GLASS_PANE',
  'GRAY_STAINED_GLASS_PANE', 'BLACK_STAINED_GLASS_PANE', 'WHITE_STAINED_GLASS_PANE',
  'LIME_DYE', 'BLAZE_ROD', 'BEACON', 'BARRIER',
  'OAK_SIGN', 'WRITABLE_BOOK', 'FILLED_MAP', 'GLOBE_BANNER_PATTERN',
]

const VARIABLES_GUI = [
  { key: '{name}', desc: 'Spielername' },
  { key: '{sternies}', desc: 'Sternies' },
  { key: '{streak}', desc: 'Streak' },
  { key: '{daily_amount}', desc: 'Heutige Belohnung' },
  { key: '{already_claimed}', desc: 'Schon abgeholt? (true/false)' },
  { key: '{quest1_progress}', desc: 'Quest 1 Fortschritt (0-100)' },
  { key: '{quest2_progress}', desc: 'Quest 2 Fortschritt (0-100)' },
  { key: '{quest1_bar}', desc: 'Quest 1 Fortschrittsbalken' },
  { key: '{quest2_bar}', desc: 'Quest 2 Fortschrittsbalken' },
  { key: '{quest1_done}', desc: 'Quest 1 abgeschlossen?' },
  { key: '{quest2_done}', desc: 'Quest 2 abgeschlossen?' },
]

const ACTIONS = [
  { value: 'claim_daily', label: 'Tägliche Belohnung abholen' },
  { value: 'close', label: 'GUI schließen' },
  { value: 'none', label: 'Keine Aktion' },
]

type GUISlot = {
  slot: number
  material: string
  name: string
  lore: string[]
  action: string
  glow: boolean
}

type GUIConfig = {
  id: string
  title: string
  rows: number
  slots: GUISlot[]
}

const EMPTY_SLOT: GUISlot = { slot: -1, material: 'AIR', name: '', lore: [], action: 'none', glow: false }

const GUI_IDS = [
  { id: 'daily_reward', label: '🎁 Tägliche Belohnung' },
  { id: 'quests', label: '⚔ Quests' },
]

export default function GUIEditorPage() {
  const { user } = useAuth()
  const pathname = usePathname()
  const canWrite = hasWriteAccess(user?.clan_role, pathname)

  const [selectedGui, setSelectedGui] = useState('daily_reward')
  const [config, setConfig] = useState<GUIConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null)

  const load = (id: string) => {
    setLoading(true)
    setSelectedSlot(null)
    fetch(`/api/admin2/gui-config?id=${id}`).then(r => r.json()).then(d => {
      if (d.config) {
        const slots = typeof d.config.slots === 'string' ? JSON.parse(d.config.slots) : d.config.slots
        setConfig({ ...d.config, slots })
      } else {
        setConfig({ id, title: id === 'daily_reward' ? '§6✦ Tägliche Belohnung' : '§b⚔ Tägliche Quests', rows: 3, slots: [] })
      }
    }).finally(() => setLoading(false))
  }

  useEffect(() => { if (user) load(selectedGui) }, [user, selectedGui])

  const save = async () => {
    if (!config) return
    setSaving(true); setError(''); setSuccess('')
    const res = await fetch('/api/admin2/gui-config', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config)
    })
    setSaving(false)
    if (!res.ok) { setError('Fehler beim Speichern'); return }
    setSuccess('Gespeichert!')
  }

  const getSlotData = (slotIndex: number): GUISlot | null =>
    config?.slots.find(s => s.slot === slotIndex) || null

  const setSlotData = (slotIndex: number, data: Partial<GUISlot>) => {
    if (!config) return
    const existing = config.slots.find(s => s.slot === slotIndex)
    if (existing) {
      setConfig({ ...config, slots: config.slots.map(s => s.slot === slotIndex ? { ...s, ...data } : s) })
    } else {
      setConfig({ ...config, slots: [...config.slots, { ...EMPTY_SLOT, slot: slotIndex, ...data }] })
    }
  }

  const clearSlot = (slotIndex: number) => {
    if (!config) return
    setConfig({ ...config, slots: config.slots.filter(s => s.slot !== slotIndex) })
    if (selectedSlot === slotIndex) setSelectedSlot(null)
  }

  const totalSlots = (config?.rows || 3) * 9
  const inp = { background: 'var(--muted-bg)', border: '1px solid var(--card-border)', color: 'var(--foreground)', borderRadius: 8, padding: '8px 12px', width: '100%', fontSize: 13 }
  const card = { background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 12, padding: '20px' }
  const gradBtn = { background: 'linear-gradient(135deg, #4F46E5, #7C3AED, #C026D3)' }

  const selectedSlotData = selectedSlot !== null ? getSlotData(selectedSlot) : null

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-1" style={{ color: 'var(--foreground)' }}>🎮 GUI-Editor</h1>
        <p style={{ color: 'var(--muted)' }}>Inventar-GUIs der NPCs konfigurieren.</p>
      </div>

      {/* GUI Auswahl */}
      <div className="flex gap-2 mb-6">
        {GUI_IDS.map(g => (
          <button key={g.id} onClick={() => setSelectedGui(g.id)}
            className="px-5 py-2 rounded-xl text-sm font-medium transition-all"
            style={selectedGui === g.id ? { ...gradBtn, color: '#fff' } : { background: 'var(--muted-bg)', color: 'var(--muted)', border: '1px solid var(--card-border)' }}>
            {g.label}
          </button>
        ))}
      </div>

      {loading ? <p style={{ color: 'var(--muted)' }}>Laden...</p> : !config ? null : (
        <div className="grid gap-6" style={{ gridTemplateColumns: '1fr 320px' }}>

          {/* Editor links */}
          <div className="space-y-4">

            {/* Titel + Reihen */}
            <div style={card} className="space-y-3">
              <div>
                <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--muted)' }}>GUI-Titel</label>
                <input style={inp} value={config.title} onChange={e => setConfig({ ...config, title: e.target.value })} disabled={!canWrite} />
              </div>
              <div>
                <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--muted)' }}>Reihen (1-6)</label>
                <select style={{ ...inp, width: 'auto' }} value={config.rows} onChange={e => setConfig({ ...config, rows: parseInt(e.target.value) })} disabled={!canWrite}>
                  {[1,2,3,4,5,6].map(r => <option key={r} value={r}>{r} Reihe{r > 1 ? 'n' : ''} ({r * 9} Slots)</option>)}
                </select>
              </div>
            </div>

            {/* Chest-Grid */}
            <div style={card}>
              <h2 className="text-sm font-bold mb-4" style={{ color: 'var(--foreground)' }}>Slots — klicke einen Slot zum Bearbeiten</h2>
              <div className="rounded-xl p-3" style={{ background: '#8B8B8B', display: 'grid', gridTemplateColumns: 'repeat(9, 1fr)', gap: 3 }}>
                {Array.from({ length: totalSlots }, (_, i) => {
                  const slot = getSlotData(i)
                  const isSelected = selectedSlot === i
                  const isEmpty = !slot || slot.material === 'AIR'
                  return (
                    <button key={i} onClick={() => setSelectedSlot(i)}
                      className="aspect-square rounded flex flex-col items-center justify-center text-xs transition-all relative"
                      style={{
                        background: isSelected ? '#4F46E5' : isEmpty ? '#555' : '#333',
                        border: isSelected ? '2px solid #A78BFA' : '2px solid #222',
                        minHeight: 44,
                      }}>
                      {!isEmpty && (
                        <>
                          <span className="text-lg leading-none">
                            {slot!.material.includes('GLASS') ? '🟦' :
                             slot!.material === 'NETHER_STAR' ? '⭐' :
                             slot!.material === 'DIAMOND' ? '💎' :
                             slot!.material === 'EMERALD' ? '💚' :
                             slot!.material === 'GOLD_INGOT' ? '🟡' :
                             slot!.material === 'BARRIER' ? '🚫' :
                             slot!.material === 'CLOCK' ? '⏰' :
                             slot!.material === 'CHEST' ? '📦' : '📄'}
                          </span>
                          {slot!.name && <span className="text-white leading-none mt-0.5 truncate w-full text-center" style={{ fontSize: 8 }}>{slot!.name.replace(/§./g, '').slice(0, 6)}</span>}
                        </>
                      )}
                      <span className="absolute bottom-0.5 right-1" style={{ fontSize: 7, color: '#999' }}>{i}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            {error && <p className="text-sm" style={{ color: '#EF4444' }}>{error}</p>}
            {success && <p className="text-sm" style={{ color: '#22C55E' }}>{success}</p>}
            {canWrite && (
              <button onClick={save} disabled={saving} className="w-full py-3 rounded-xl text-sm font-medium text-white" style={{ ...gradBtn, opacity: saving ? 0.7 : 1 }}>
                {saving ? 'Speichern...' : '💾 Speichern'}
              </button>
            )}
          </div>

          {/* Slot Editor rechts */}
          <div className="sticky top-6 space-y-4">
            {selectedSlot !== null ? (
              <div style={card} className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-bold" style={{ color: 'var(--foreground)' }}>Slot {selectedSlot}</h2>
                  <button onClick={() => clearSlot(selectedSlot)} className="text-xs px-2 py-1 rounded" style={{ background: '#FEE2E2', color: '#EF4444' }}>Leeren</button>
                </div>

                <div>
                  <label className="text-xs mb-1 block" style={{ color: 'var(--muted)' }}>Material</label>
                  <select style={inp} value={selectedSlotData?.material || 'AIR'}
                    onChange={e => setSlotData(selectedSlot, { material: e.target.value })} disabled={!canWrite}>
                    <option value="AIR">AIR (leer)</option>
                    {MATERIALS_COMMON.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>

                <div>
                  <label className="text-xs mb-1 block" style={{ color: 'var(--muted)' }}>Name</label>
                  <input style={inp} value={selectedSlotData?.name || ''}
                    onChange={e => setSlotData(selectedSlot, { name: e.target.value })}
                    placeholder="§6✦ Belohnung abholen" disabled={!canWrite} />
                </div>

                <div>
                  <label className="text-xs mb-1 block" style={{ color: 'var(--muted)' }}>Lore (eine Zeile pro Eintrag)</label>
                  {(selectedSlotData?.lore || []).map((line, li) => (
                    <div key={li} className="flex gap-1 mb-1">
                      <input style={{ ...inp, flex: 1 }} value={line}
                        onChange={e => { const l = [...(selectedSlotData?.lore || [])]; l[li] = e.target.value; setSlotData(selectedSlot, { lore: l }) }}
                        disabled={!canWrite} />
                      <button onClick={() => setSlotData(selectedSlot, { lore: (selectedSlotData?.lore || []).filter((_, i) => i !== li) })}
                        className="px-2 rounded" style={{ background: '#FEE2E2', color: '#EF4444' }}>✕</button>
                    </div>
                  ))}
                  {canWrite && (
                    <button onClick={() => setSlotData(selectedSlot, { lore: [...(selectedSlotData?.lore || []), ''] })}
                      className="text-xs px-3 py-1 rounded" style={{ background: 'var(--muted-bg)', color: 'var(--muted)', border: '1px solid var(--card-border)' }}>
                      + Zeile
                    </button>
                  )}
                </div>

                <div>
                  <label className="text-xs mb-1 block" style={{ color: 'var(--muted)' }}>Aktion</label>
                  <select style={inp} value={selectedSlotData?.action || 'none'}
                    onChange={e => setSlotData(selectedSlot, { action: e.target.value })} disabled={!canWrite}>
                    {ACTIONS.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <input type="checkbox" id="glow" checked={selectedSlotData?.glow || false}
                    onChange={e => setSlotData(selectedSlot, { glow: e.target.checked })} disabled={!canWrite} />
                  <label htmlFor="glow" className="text-xs" style={{ color: 'var(--foreground)' }}>Enchantment Glow</label>
                </div>

                {/* Variablen */}
                <div>
                  <p className="text-xs mb-1" style={{ color: 'var(--muted)' }}>Variablen</p>
                  <div className="flex flex-wrap gap-1">
                    {VARIABLES_GUI.map(v => (
                      <button key={v.key} title={v.desc}
                        onClick={() => setSlotData(selectedSlot, { name: (selectedSlotData?.name || '') + v.key })}
                        className="text-xs px-1.5 py-0.5 rounded font-mono" style={{ background: '#4F46E520', color: '#818CF8', border: '1px solid #4F46E540' }}>
                        {v.key}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div style={card}>
                <p className="text-sm text-center" style={{ color: 'var(--muted)' }}>Slot anklicken um ihn zu bearbeiten</p>
              </div>
            )}

            {/* Variablen Referenz */}
            <div style={card}>
              <p className="text-xs font-medium mb-2" style={{ color: 'var(--muted)' }}>Variablen-Referenz</p>
              <div className="space-y-1">
                {VARIABLES_GUI.map(v => (
                  <div key={v.key} className="flex gap-2 items-start">
                    <code className="text-xs px-1 py-0.5 rounded flex-shrink-0" style={{ background: '#4F46E520', color: '#818CF8' }}>{v.key}</code>
                    <span className="text-xs" style={{ color: 'var(--muted)' }}>{v.desc}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}