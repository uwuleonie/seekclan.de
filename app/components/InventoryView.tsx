'use client'

import { useState } from 'react'

type ItemData = {
  slot: number
  type: string
  amount: number
  name?: string
  enchants?: Record<string, number>
  shulker_contents?: ItemData[]
}

type InventoryData = {
  inventory: ItemData[]
  enderchest: ItemData[]
  armor: ItemData[]
  offhand: ItemData[]
  updated_at: string
}

// Deutschen Namen für Verzauberungen
const ENCHANT_NAMES: Record<string, string> = {
  sharpness: 'Schärfe', smite: 'Bann', bane_of_arthropods: 'Fluch der Gliederfüßer',
  knockback: 'Rückstoß', fire_aspect: 'Feueraspekt', looting: 'Plünderung',
  sweeping_edge: 'Feger', efficiency: 'Effizienz', silk_touch: 'Seidene Hand',
  fortune: 'Glück', power: 'Stärke', punch: 'Rückschlag', flame: 'Flamme',
  infinity: 'Unendlichkeit', luck_of_the_sea: 'Glück des Meeres', lure: 'Köder',
  mending: 'Ausbesserung', unbreaking: 'Unzerstörbarkeit', protection: 'Schutz',
  fire_protection: 'Feuerschutz', blast_protection: 'Explosionsschutz',
  projectile_protection: 'Geschossschutz', feather_falling: 'Federfall',
  respiration: 'Atemschutz', aqua_affinity: 'Wasseraffinität', thorns: 'Dornen',
  depth_strider: 'Tiefentaucher', frost_walker: 'Eiswandler', swift_sneak: 'Schnelles Schleichen',
  soul_speed: 'Seelengeschwindigkeit', binding_curse: 'Fluch der Bindung',
  vanishing_curse: 'Fluch des Verschwindens', multishot: 'Mehrfachschuss',
  quick_charge: 'Schnellladen', piercing: 'Durchdringung', loyalty: 'Loyalität',
  impaling: 'Aufspießen', riptide: 'Sog', channeling: 'Kanalisation',
  density: 'Dichte', breach: 'Durchbruch', wind_burst: 'Windstoß',
}

const ENCHANT_ROMAN: Record<number, string> = { 1: 'I', 2: 'II', 3: 'III', 4: 'IV', 5: 'V' }

// Item-Textur ermitteln: erst item/, dann block/ als Fallback
function getItemTexture(type: string): string {
  return type.toLowerCase()
}

// Item-Icon Komponente
function ItemIcon({ type, size = 32 }: { type: string; size?: number }) {
  const name = getItemTexture(type)
  const [triedItem, setTriedItem] = useState(false)
  const [triedBlock, setTriedBlock] = useState(false)

  if (triedBlock) {
    return (
      <div style={{ width: size, height: size, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, opacity: 0.3 }}>?</div>
    )
  }

  const src = triedItem
    ? `/block-textures/${name}.png`
    : `/item-textures/${name}.png`

  return (
    <img
      src={src}
      alt={type}
      width={size}
      height={size}
      style={{ imageRendering: 'pixelated', width: size, height: size }}
      onError={() => {
        if (!triedItem) {
          setTriedItem(true)
        } else {
          setTriedBlock(true)
        }
      }}
    />
  )
}

// Tooltip für Item-Details
function ItemTooltip({ item }: { item: ItemData }) {
  const enchants = item.enchants ? Object.entries(item.enchants) : []
  return (
    <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 pointer-events-none"
      style={{ minWidth: 160 }}>
      <div className="rounded-lg px-3 py-2 text-xs shadow-2xl"
        style={{ background: '#1a0a2e', border: '2px solid #6b21a8' }}>
        <div className="font-bold mb-1" style={{ color: item.name ? '#55ff55' : '#ffffff' }}>
          {item.name || item.type.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase())}
        </div>
        {enchants.map(([key, level]) => (
          <div key={key} style={{ color: '#aaaaff' }}>
            {ENCHANT_NAMES[key] || key} {level > 1 ? (ENCHANT_ROMAN[level] || level) : ''}
          </div>
        ))}
        {item.amount > 1 && (
          <div className="mt-1" style={{ color: '#aaaaaa' }}>Anzahl: {item.amount}</div>
        )}
      </div>
    </div>
  )
}

// Shulker-Popup
function ShulkerPopup({ item }: { item: ItemData }) {
  const contents = item.shulker_contents || []
  const color = item.type.replace('_SHULKER_BOX', '').toLowerCase()

  return (
    <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 pointer-events-none"
      style={{ minWidth: 200 }}>
      <div className="rounded-lg px-3 py-2 shadow-2xl"
        style={{ background: '#1a0a2e', border: '2px solid #6b21a8' }}>
        <div className="font-bold text-xs mb-2" style={{ color: '#ffffff' }}>
          {item.name || `${color} Shulker Box`}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(9, 20px)", gap: 2 }}>
          {Array.from({ length: 27 }).map((_, i) => {
            const slotItem = contents.find(c => c.slot === i)
            return (
              <div key={i} style={{ width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', background: '#374151', border: '1px solid #4b5563' }}>
                {slotItem && <ItemIcon type={slotItem.type} size={16} />}
                {slotItem && slotItem.amount > 1 && (
                  <span className="absolute bottom-0 right-0 text-white leading-none"
                    style={{ fontSize: 8, textShadow: '1px 1px 0 #000' }}>
                    {slotItem.amount}
                  </span>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// Einzelner Inventar-Slot
function InventorySlot({ item, size = 40 }: { item?: ItemData; size?: number }) {
  const [hovered, setHovered] = useState(false)

  const isShulker = item?.type?.includes('SHULKER_BOX')
  const isEnchanted = item?.enchants && Object.keys(item.enchants).length > 0
  const iconSize = Math.round(size * 0.7)

  return (
    <div
      className="relative flex items-center justify-center cursor-default"
      style={{
        width: size, height: size,
        background: '#374151',
        border: '2px solid',
        borderColor: '#1f2937',
        boxShadow: 'inset 1px 1px 0 rgba(255,255,255,0.1)',
      }}
      onMouseEnter={() => item && setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {item && (
        <>
          <div className="relative flex items-center justify-center overflow-hidden" style={{ width: iconSize, height: iconSize }}>
            <ItemIcon type={item.type} size={iconSize} />
            {isEnchanted && (
              <div
                className="absolute inset-0 pointer-events-none mix-blend-overlay"
                style={{
                  background: 'linear-gradient(115deg, transparent 0%, transparent 35%, rgba(160,90,255,0.9) 45%, rgba(220,180,255,0.9) 50%, rgba(160,90,255,0.9) 55%, transparent 65%, transparent 100%)',
                  backgroundSize: '200% 200%',
                  animation: 'enchant-glint 2.5s linear infinite',
                  mixBlendMode: 'color-dodge',
                  opacity: 0.55,
                }}
              />
            )}
          </div>
          {item.amount > 1 && (
            <span className="absolute bottom-0 right-0.5 text-white font-bold leading-none"
              style={{ fontSize: Math.max(9, size * 0.26), textShadow: '1px 1px 0 #000, -1px -1px 0 #000' }}>
              {item.amount}
            </span>
          )}
          {hovered && (
            isShulker ? <ShulkerPopup item={item} /> : <ItemTooltip item={item} />
          )}
        </>
      )}
    </div>
  )
}

// Haupt-Inventar-Grid (9x4, Slots 0-35, Hotbar = Slots 0-8 unten) + Offhand direkt rechts von der Hotbar
function MainInventoryWithOffhand({ items, offhand }: { items: ItemData[]; offhand?: ItemData }) {
  const bySlot = Object.fromEntries(items.map(i => [i.slot, i]))

  return (
    <div>
      {/* Hauptinventar Zeilen 1-3 (Slots 9-35) */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(9, 40px)", gap: 2 }}>
        {Array.from({ length: 27 }).map((_, i) => (
          <InventorySlot key={i + 9} item={bySlot[i + 9]} />
        ))}
      </div>
      {/* Hotbar (Slots 0-8) + Offhand direkt daneben */}
      <div className="flex items-start" style={{ marginTop: 4, borderTop: "2px solid #4b5563", paddingTop: 4, gap: 8 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(9, 40px)", gap: 2 }}>
          {Array.from({ length: 9 }).map((_, i) => (
            <InventorySlot key={i} item={bySlot[i]} />
          ))}
        </div>
        <InventorySlot item={offhand} />
      </div>
    </div>
  )
}

// Rüstungs-Slots (4 Slots: Helm, Brust, Hose, Stiefel – Index 3,2,1,0)
function ArmorSlots({ armor }: { armor: ItemData[] }) {
  const bySlot = Object.fromEntries(armor.map(i => [i.slot, i]))
  const labels = ['Helm', 'Brust', 'Hose', 'Stiefel']

  return (
    <div className="flex flex-col gap-0.5">
      {[3, 2, 1, 0].map((slot, i) => (
        <div key={slot}>
          <InventorySlot item={bySlot[slot]} />
        </div>
      ))}
    </div>
  )
}

// Haupt-Export
export default function InventoryView({ data }: { data: InventoryData }) {
  const updatedAt = new Date(data.updated_at)
  const timeAgo = Math.round((Date.now() - updatedAt.getTime()) / 60000)

  return (
    <div className="card rounded-2xl p-6 space-y-6">
      <style>{`
        @keyframes enchant-glint {
          0% { background-position: 0% 0%; }
          100% { background-position: 200% 200%; }
        }
      `}</style>
      <div className="flex items-center justify-between">
        <h2 className="font-bold text-lg" style={{ color: 'var(--foreground)' }}>Inventar</h2>
        <span className="text-xs opacity-50">
          zuletzt aktualisiert vor {timeAgo < 1 ? 'weniger als 1 Minute' : `${timeAgo} Minuten`}
        </span>
      </div>

      {/* Inventar + Rüstung nebeneinander */}
      <div>
        <p className="text-xs font-bold uppercase tracking-wide mb-2 opacity-50">🎒 Inventar</p>
        <div className="flex gap-2 items-start" style={{ width: 'fit-content' }}>
          <ArmorSlots armor={data.armor} />
          <MainInventoryWithOffhand items={data.inventory} offhand={data.offhand[0]} />
        </div>
      </div>

      {/* Enderchest */}
      <div>
        <p className="text-xs font-bold uppercase tracking-wide mb-2 opacity-50">📦 Enderchest</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(9, 40px)", gap: 2 }}>
          {Array.from({ length: 27 }).map((_, i) => {
            const item = data.enderchest.find(e => e.slot === i)
            return <InventorySlot key={i} item={item} />
          })}
        </div>
      </div>
    </div>
  )
}