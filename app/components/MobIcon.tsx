'use client'

import { MOB_SPRITE_POSITIONS, SPRITE_SHEET_COLUMNS, SPRITE_SHEET_ROWS, SPRITE_CELL_SIZE } from '../lib/mobSprites'

type MobIconProps = {
  mobId: string
  fallbackEmoji?: string
  size?: number
}

/**
 * Zeigt das Pixel-Art-Icon eines Mobs aus dem lokalen Sprite-Sheet (public/mob-icons/sheet.png).
 * Fällt auf das übergebene Emoji zurück, falls der Mob nicht im Sprite-Sheet-Mapping vorhanden ist.
 */
export default function MobIcon({ mobId, fallbackEmoji, size = 24 }: MobIconProps) {
  const position = MOB_SPRITE_POSITIONS[mobId]

  if (!position) {
    return <span style={{ fontSize: size * 0.8 }}>{fallbackEmoji || '❓'}</span>
  }

  const [row, col] = position
  const sheetWidth = SPRITE_SHEET_COLUMNS * SPRITE_CELL_SIZE
  const sheetHeight = SPRITE_SHEET_ROWS * SPRITE_CELL_SIZE
  const scale = size / SPRITE_CELL_SIZE

  return (
    <span
      style={{
        display: 'inline-block',
        width: size,
        height: size,
        backgroundImage: 'url(/mob-icons/sheet.png)',
        backgroundPosition: `-${col * SPRITE_CELL_SIZE * scale}px -${row * SPRITE_CELL_SIZE * scale}px`,
        backgroundSize: `${sheetWidth * scale}px ${sheetHeight * scale}px`,
        imageRendering: 'pixelated',
        flexShrink: 0,
      }}
    />
  )
}