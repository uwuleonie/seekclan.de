'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '../../lib/auth-context'
import { hasWriteAccess } from '../layout'
import { usePathname } from 'next/navigation'

const MOB_TYPES = [
  'CAT', 'DOG', 'HORSE', 'DONKEY', 'MULE', 'LLAMA', 'PIG', 'COW', 'SHEEP', 'CHICKEN',
  'RABBIT', 'FOX', 'PANDA', 'POLAR_BEAR', 'WOLF', 'OCELOT', 'PARROT', 'TURTLE',
  'AXOLOTL', 'FROG', 'ALLAY', 'BEE', 'GOAT', 'STRIDER', 'HOGLIN',
  'PHANTOM', 'BAT', 'BLAZE', 'CREEPER', 'ENDERMAN', 'GHAST', 'SKELETON',
  'SLIME', 'SPIDER', 'ZOMBIE', 'MAGMA_CUBE', 'WITHER_SKELETON', 'IRON_GOLEM',
  'SNOW_GOLEM', 'ELDER_GUARDIAN', 'GUARDIAN', 'ENDER_DRAGON', 'WITHER',
]

const RARITY_ORDER = ['common', 'rare', 'very_rare', 'epic', 'legendary', 'special']

type Pet = {
  id: number
  name: string
  mob_type: string
  price: number
  rarity: string
  description: string | null
  enabled: boolean
}

type Rarity = {
  rarity: string
  label: string
  chance: number
  color: string
}

type ShopSlot = {
  slot: number
  id: number
  name: string
  mob_type: string
  price: number
  rarity: string
  rarity_label: string
  rarity_color: string
}

export default function PetsAdminPage() {
  const { user } = useAuth()
  const pathname = usePathname()
  const canWrite = hasWriteAccess(user?.clan_role, pathname)

  const [tab, setTab] = useState<'pets' | 'shop' | 'rarities'>('pets')
  const [pets, setPets] = useState<Pet[]>([])
  const [rarities, setRarities] = useState<Rarity[]>([])
  const [shop, setShop] = useState<ShopSlot[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')

  const [showPetForm, setShowPetForm] = useState(false)
  const [editingPet, setEditingPet] = useState<Pet | null>(null)
  const [petForm, setPetForm] = useState({ name: '', mob_type: 'CAT', price: 50, rarity: 'common', description: '' })

  const [manualShop, setManualShop] = useState<number[]>([])
  const [showManualShop, setShowManualShop] = useState(false)

  const load = async () => {
    setLoading(true)
    const [petsRes, shopRes] = await Promise.all([
      fetch('/api/admin2/pets').then(r => r.json()),
      fetch('/api/admin2/pet-shop').then(r => r.json()),
    ])
    setPets(petsRes.pets || [])
    setRarities(petsRes.rarities || [])
    setShop(shopRes.shop || [])
    setLoading(false)
  }
  useEffect(() => { if (user) load() }, [user])

  const savePet = async () => {
    setSaving(true); setError(''); setSuccess('')
    const url = editingPet ? '/api/admin2/pets' : '/api/admin2/pets'
    const method = editingPet ? 'PATCH' : 'POST'
    const body = editingPet ? { id: editingPet.id, ...petForm } : petForm
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    setSaving(false)
    if (!res.ok) { setError('Fehler beim Speichern'); return }
    setShowPetForm(false); setEditingPet(null); load()
  }

  const deletePet = async (id: number) => {
    if (!confirm('Pet löschen?')) return
    await fetch('/api/admin2/pets', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    load()
  }

  const togglePet = async (pet: Pet) => {
    await fetch('/api/admin2/pets', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: pet.id, enabled: !pet.enabled }) })
    load()
  }

  const refreshShop = async (manual = false) => {
    setSaving(true); setSuccess(''); setError('')
    const body = manual ? { manual: true, pet_ids: manualShop } : {}
    const res = await fetch('/api/admin2/pet-shop', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    setSaving(false)
    if (!res.ok) { setError('Fehler'); return }
    setSuccess('Shop aktualisiert!')
    setShowManualShop(false)
    load()
  }

  const saveRarity = async (rarity: Rarity) => {
    await fetch('/api/admin2/rarity-config', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(rarity) })
    load()
  }

  const getRarityInfo = (rarity: string) => rarities.find(r => r.rarity === rarity)

  const inp = { background: 'var(--muted-bg)', border: '1px solid var(--card-border)', color: 'var(--foreground)', borderRadius: 8, padding: '8px 12px', width: '100%', fontSize: 13 }
  const card = { background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 12, padding: '20px' }
  const gradBtn = { background: 'linear-gradient(135deg, #4F46E5, #7C3AED, #C026D3)' }

  const rarityColorMap: Record<string, string> = {
    common: '#FFFFFF', rare: '#5555FF', very_rare: '#AA00AA',
    epic: '#FF55FF', legendary: '#FFAA00', special: '#FF5555',
  }

  if (loading) return <p style={{ color: 'var(--muted)' }}>Laden...</p>

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-1" style={{ color: 'var(--foreground)' }}>🐾 Haustiere & Shop</h1>
        <p style={{ color: 'var(--muted)' }}>Haustiere verwalten, Shop konfigurieren und Seltenheiten anpassen.</p>
      </div>

      <div className="flex gap-2 mb-6">
        {(['pets', 'shop', 'rarities'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} className="px-5 py-2 rounded-xl text-sm font-medium"
            style={tab === t ? { ...gradBtn, color: '#fff' } : { background: 'var(--muted-bg)', color: 'var(--muted)', border: '1px solid var(--card-border)' }}>
            {t === 'pets' ? '🐾 Pets' : t === 'shop' ? '🛒 Täglicher Shop' : '⭐ Seltenheiten'}
          </button>
        ))}
      </div>

      {/* ─── Pets Tab ─── */}
      {tab === 'pets' && (
        <div>
          {canWrite && (
            <button onClick={() => { setEditingPet(null); setPetForm({ name: '', mob_type: 'CAT', price: 50, rarity: 'common', description: '' }); setShowPetForm(true) }}
              className="mb-6 px-5 py-2.5 rounded-xl text-sm font-medium text-white" style={gradBtn}>
              + Pet hinzufügen
            </button>
          )}

          {RARITY_ORDER.map(rarity => {
            const rPets = pets.filter(p => p.rarity === rarity)
            if (rPets.length === 0) return null
            const rInfo = getRarityInfo(rarity)
            return (
              <div key={rarity} className="mb-6">
                <h2 className="text-sm font-bold mb-3" style={{ color: rarityColorMap[rarity] }}>
                  {rInfo?.label || rarity} ({rInfo?.chance}% Chance)
                </h2>
                <div className="space-y-2">
                  {rPets.map(pet => (
                    <div key={pet.id} style={{ ...card, opacity: pet.enabled ? 1 : 0.5 }} className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-lg flex items-center justify-center text-xl flex-shrink-0"
                        style={{ background: 'var(--muted-bg)', border: '1px solid var(--card-border)' }}>
                        🐾
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-sm" style={{ color: 'var(--foreground)' }}>{pet.name}</p>
                          <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'var(--muted-bg)', color: rarityColorMap[rarity] }}>{rInfo?.label}</span>
                          {!pet.enabled && <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'var(--muted-bg)', color: 'var(--muted)' }}>deaktiviert</span>}
                        </div>
                        <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>{pet.mob_type} · §e{pet.price} Sternies</p>
                        {pet.description && <p className="text-xs italic mt-0.5" style={{ color: 'var(--muted)' }}>{pet.description}</p>}
                      </div>
                      {canWrite && (
                        <div className="flex gap-2 flex-shrink-0">
                          <button onClick={() => togglePet(pet)} className="px-3 py-1.5 rounded-lg text-xs"
                            style={{ background: 'var(--muted-bg)', color: 'var(--foreground)', border: '1px solid var(--card-border)' }}>
                            {pet.enabled ? 'Deaktivieren' : 'Aktivieren'}
                          </button>
                          <button onClick={() => { setEditingPet(pet); setPetForm({ name: pet.name, mob_type: pet.mob_type, price: pet.price, rarity: pet.rarity, description: pet.description || '' }); setShowPetForm(true) }}
                            className="px-3 py-1.5 rounded-lg text-xs" style={{ background: 'var(--muted-bg)', color: 'var(--foreground)', border: '1px solid var(--card-border)' }}>
                            Bearbeiten
                          </button>
                          <button onClick={() => deletePet(pet.id)} className="px-3 py-1.5 rounded-lg text-xs"
                            style={{ background: '#FEE2E2', color: '#EF4444', border: '1px solid #FECACA' }}>
                            Löschen
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )
          })}

          {/* Pet Form Modal */}
          {showPetForm && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)' }}>
              <div className="w-full max-w-md rounded-2xl p-6 space-y-4" style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}>
                <h2 className="text-lg font-bold" style={{ color: 'var(--foreground)' }}>{editingPet ? 'Pet bearbeiten' : 'Pet hinzufügen'}</h2>
                <div className="space-y-3">
                  <div><label className="text-xs mb-1 block" style={{ color: 'var(--muted)' }}>Name</label>
                    <input style={inp} value={petForm.name} onChange={e => setPetForm(f => ({ ...f, name: e.target.value }))} placeholder="z.B. Phantom" /></div>
                  <div><label className="text-xs mb-1 block" style={{ color: 'var(--muted)' }}>Mob-Typ</label>
                    <select style={inp} value={petForm.mob_type} onChange={e => setPetForm(f => ({ ...f, mob_type: e.target.value }))}>
                      {MOB_TYPES.map(m => <option key={m} value={m}>{m}</option>)}
                    </select></div>
                  <div><label className="text-xs mb-1 block" style={{ color: 'var(--muted)' }}>Seltenheit</label>
                    <select style={inp} value={petForm.rarity} onChange={e => setPetForm(f => ({ ...f, rarity: e.target.value }))}>
                      {rarities.sort((a, b) => b.chance - a.chance).map(r => <option key={r.rarity} value={r.rarity}>{r.label} ({r.chance}%)</option>)}
                    </select></div>
                  <div><label className="text-xs mb-1 block" style={{ color: 'var(--muted)' }}>Preis (Sternies)</label>
                    <input type="number" style={inp} value={petForm.price} onChange={e => setPetForm(f => ({ ...f, price: parseInt(e.target.value) || 0 })) } /></div>
                  <div><label className="text-xs mb-1 block" style={{ color: 'var(--muted)' }}>Beschreibung (optional)</label>
                    <input style={inp} value={petForm.description} onChange={e => setPetForm(f => ({ ...f, description: e.target.value }))} placeholder="Fliegt durch die Nacht..." /></div>
                </div>
                {error && <p className="text-sm" style={{ color: '#EF4444' }}>{error}</p>}
                <div className="flex gap-3">
                  <button onClick={savePet} disabled={saving} className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white" style={{ ...gradBtn, opacity: saving ? 0.7 : 1 }}>
                    {saving ? 'Speichern...' : 'Speichern'}
                  </button>
                  <button onClick={() => setShowPetForm(false)} className="px-5 py-2.5 rounded-xl text-sm" style={{ background: 'var(--muted-bg)', color: 'var(--muted)', border: '1px solid var(--card-border)' }}>Abbrechen</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── Shop Tab ─── */}
      {tab === 'shop' && (
        <div className="space-y-6">
          {success && <p className="text-sm" style={{ color: '#22C55E' }}>{success}</p>}
          {error && <p className="text-sm" style={{ color: '#EF4444' }}>{error}</p>}

          {/* Heutiger Shop */}
          <div style={card}>
            <h2 className="text-lg font-bold mb-4" style={{ color: 'var(--foreground)' }}>🛒 Heutiger Shop</h2>
            {shop.length === 0 ? (
              <p style={{ color: 'var(--muted)' }}>Noch kein Shop für heute generiert.</p>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                {shop.map(slot => (
                  <div key={slot.slot} className="p-4 rounded-xl" style={{ background: 'var(--muted-bg)', border: '1px solid var(--card-border)' }}>
                    <p className="text-xs mb-1" style={{ color: 'var(--muted)' }}>Slot {slot.slot + 1}</p>
                    <p className="font-bold" style={{ color: rarityColorMap[slot.rarity] || '#fff' }}>{slot.name}</p>
                    <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>{slot.mob_type}</p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>{slot.rarity_label} · {slot.price} Sternies</p>
                  </div>
                ))}
              </div>
            )}

            {canWrite && (
              <div className="flex gap-3 mt-4">
                <button onClick={() => refreshShop(false)} disabled={saving} className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white" style={{ ...gradBtn, opacity: saving ? 0.7 : 1 }}>
                  🎲 Zufällig neu generieren
                </button>
                <button onClick={() => setShowManualShop(s => !s)} className="px-5 py-2.5 rounded-xl text-sm" style={{ background: 'var(--muted-bg)', color: 'var(--foreground)', border: '1px solid var(--card-border)' }}>
                  ✏️ Manuell setzen
                </button>
              </div>
            )}

            {showManualShop && (
              <div className="mt-4 p-4 rounded-xl space-y-3" style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}>
                <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>Manuelle Auswahl (2 Pets)</p>
                {[0, 1].map(i => (
                  <div key={i}>
                    <label className="text-xs mb-1 block" style={{ color: 'var(--muted)' }}>Slot {i + 1}</label>
                    <select style={inp} value={manualShop[i] || ''} onChange={e => { const n = [...manualShop]; n[i] = parseInt(e.target.value); setManualShop(n) }}>
                      <option value="">-- Bitte wählen --</option>
                      {pets.filter(p => p.enabled).map(p => {
                        const r = getRarityInfo(p.rarity)
                        return <option key={p.id} value={p.id}>{p.name} ({r?.label} · {p.price} ✦)</option>
                      })}
                    </select>
                  </div>
                ))}
                <button onClick={() => refreshShop(true)} disabled={manualShop.filter(Boolean).length < 2}
                  className="w-full py-2.5 rounded-xl text-sm font-medium text-white" style={{ ...gradBtn, opacity: manualShop.filter(Boolean).length < 2 ? 0.5 : 1 }}>
                  Setzen
                </button>
              </div>
            )}
          </div>

          {/* Nächsten Tag vorplanen */}
          <div style={card}>
            <h2 className="text-sm font-bold mb-2" style={{ color: 'var(--foreground)' }}>ℹ️ Shop-Reset</h2>
            <p className="text-sm" style={{ color: 'var(--muted)' }}>Der Shop wird täglich um 00:00 Uhr automatisch neu generiert basierend auf den Seltenheits-Chancen.</p>
          </div>
        </div>
      )}

      {/* ─── Seltenheiten Tab ─── */}
      {tab === 'rarities' && (
        <div style={card} className="space-y-4">
          <h2 className="text-lg font-bold mb-4" style={{ color: 'var(--foreground)' }}>⭐ Seltenheits-Konfiguration</h2>
          {rarities.sort((a, b) => b.chance - a.chance).map(r => (
            <div key={r.rarity} className="flex items-center gap-4 p-3 rounded-xl" style={{ background: 'var(--muted-bg)', border: '1px solid var(--card-border)' }}>
              <div className="w-4 h-4 rounded flex-shrink-0" style={{ background: rarityColorMap[r.rarity] || '#fff' }} />
              <p className="font-medium text-sm w-32 flex-shrink-0" style={{ color: rarityColorMap[r.rarity] || 'var(--foreground)' }}>{r.label}</p>
              <div className="flex items-center gap-2 flex-1">
                <span className="text-xs" style={{ color: 'var(--muted)' }}>Chance:</span>
                <input type="number" step="0.01" min="0" max="100"
                  style={{ ...inp, width: 80 }}
                  defaultValue={r.chance}
                  onBlur={e => saveRarity({ ...r, chance: parseFloat(e.target.value) })}
                  disabled={!canWrite} />
                <span className="text-xs" style={{ color: 'var(--muted)' }}>%</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs" style={{ color: 'var(--muted)' }}>Farbe:</span>
                <input style={{ ...inp, width: 80 }} defaultValue={r.color}
                  onBlur={e => saveRarity({ ...r, color: e.target.value })}
                  disabled={!canWrite} placeholder="§6" />
              </div>
              <p className="text-xs" style={{ color: 'var(--muted)' }}>{pets.filter(p => p.rarity === r.rarity).length} Pets</p>
            </div>
          ))}
          <p className="text-xs" style={{ color: 'var(--muted)' }}>Änderungen werden beim nächsten Shop-Reset wirksam.</p>
        </div>
      )}
    </div>
  )
}