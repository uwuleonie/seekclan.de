'use client'

import { useState } from 'react'

export type ItemData = {
  slot: number
  type: string
  amount: number
  name?: string
  enchants?: Record<string, number>
  shulker_contents?: ItemData[]
}

// Deutschen Namen für Verzauberungen
export const ENCHANT_NAMES: Record<string, string> = {
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

export function ItemIcon({ type, size = 32 }: { type: string; size?: number }) {
  const name = type.toLowerCase()
  const [triedItem, setTriedItem] = useState(false)
  const [triedBlock, setTriedBlock] = useState(false)

  if (triedBlock) {
    return (
      <div style={{ width: size, height: size, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, opacity: 0.3 }}>?</div>
    )
  }

  const src = triedItem ? `/block-textures/${name}.png` : `/item-textures/${name}.png`

  return (
    <img
      src={src}
      alt={type}
      width={size}
      height={size}
      style={{ imageRendering: 'pixelated', width: size, height: size }}
      onError={() => { if (!triedItem) setTriedItem(true); else setTriedBlock(true) }}
    />
  )
}

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

export function ItemSlot({ item, size = 40 }: { item?: ItemData; size?: number }) {
  const [hovered, setHovered] = useState(false)
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
          {hovered && <ItemTooltip item={item} />}
        </>
      )}
    </div>
  )
}

// Globale Keyframe-Animation für den Verzauberungs-Glitzer-Effekt.
// Einmal pro Seite einbinden, wo ItemSlot mit verzauberten Items genutzt wird.
export function EnchantGlintStyle() {
  return (
    <style>{`
      @keyframes enchant-glint {
        0% { background-position: 0% 0%; }
        100% { background-position: 200% 200%; }
      }
    `}</style>
  )
}