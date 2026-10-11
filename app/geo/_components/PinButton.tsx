'use client'

// Kleiner Knopf zum An-/Abpinnen (Quiz, Land, Abschnitt, Bereich). Angepinntes steht oben auf der Startseite.

import Icon from './Icon'
import { useGeo, type PinKind } from './GeoShell'

export default function PinButton({ kind, pinKey, label, className = '' }: { kind: PinKind; pinKey: string; label: string; className?: string }) {
  const { isPinned, togglePin } = useGeo()
  const on = isPinned(kind, pinKey)
  return (
    <button
      type="button"
      className={`ga-pin ${on ? 'on' : ''} ${className}`}
      aria-pressed={on}
      aria-label={on ? `${label} abpinnen` : `${label} anpinnen`}
      title={on ? 'Abpinnen' : 'Anpinnen – erscheint oben auf der Startseite'}
      onClick={e => { e.preventDefault(); e.stopPropagation(); togglePin(kind, pinKey) }}
    >
      <Icon name="pin" size={14} />
    </button>
  )
}