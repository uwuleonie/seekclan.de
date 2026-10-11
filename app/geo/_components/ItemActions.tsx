'use client'

// Kleine Knöpfe an einem Eintrag: Anhören (echte Aufnahme oder Stimme des Geräts) und Merken (Merkliste „Meine Wörter“)

import Icon from './Icon'
import { useGeo } from './GeoShell'
import { canSay, playSay, playSounds, useVoices, type Say } from '../_lib/audio'
import { wordFromItem, type SavedWord } from '../_lib/words'
import type { GeoItem } from '../_lib/types'

/** Aussprache eines Eintrags: eigene Angabe, sonst der Name auf Deutsch */
export const sayOfItem = (item: GeoItem): Say => item.say ?? { t: item.prompt ?? item.label, l: 'de-DE' }

export function SoundButton({ say, sounds, label = 'Anhören', small }: { say?: Say | null; sounds?: string[]; label?: string; small?: boolean }) {
  useVoices()
  const can = !!sounds?.length || canSay(say)
  if (!can) return null
  const btn = (
    <button type="button" className={`ga-btn ghost ${small ? 'xs' : 'sm'} ga-sound`} title={say?.a?.length ? 'Echte Aufnahme anhören' : label}
      onClick={e => { e.stopPropagation(); if (sounds?.length) playSounds(sounds); else if (say) playSay(say) }}>
      <Icon name="volume" size={small ? 13 : 14} />{!small && ` ${label}`}
    </button>
  )
  // Echte Aufnahme: Link zur Dateiseite auf Wikimedia Commons (Urheber und Lizenz stehen dort)
  if (!say?.src || sounds?.length || small) return btn
  return (
    <span className="ga-sound-wrap">
      {btn}
      <a className="ga-sound-src" href={`https://commons.wikimedia.org/wiki/File:${encodeURIComponent(say.src.replace(/ /g, '_'))}`} target="_blank" rel="noopener noreferrer"
        title="Aufnahme von Wikimedia Commons – Urheber und Lizenz auf der Dateiseite" onClick={e => e.stopPropagation()}>Aufnahme: Commons</a>
    </span>
  )
}

export function SaveButton({ word, small }: { word: SavedWord; small?: boolean }) {
  const { isSaved, toggleWord } = useGeo()
  const on = isSaved(word.key)
  return (
    <button type="button" className={`ga-btn ghost ${small ? 'xs' : 'sm'} ga-save ${on ? 'on' : ''}`} aria-pressed={on}
      title={on ? 'Aus „Meine Wörter“ entfernen' : 'In „Meine Wörter“ merken – zum Üben im Sprachen-Lerntool'}
      onClick={e => { e.stopPropagation(); toggleWord(word) }}>
      <Icon name="star" size={small ? 13 : 14} />{!small && (on ? ' Gemerkt' : ' Merken')}
    </button>
  )
}

/** Anhören + Merken für einen Quiz-Eintrag */
export default function ItemActions({ item, slug, quiz }: { item: GeoItem; slug: string; quiz: string }) {
  return (
    <div className="ga-item-actions">
      <SoundButton say={sayOfItem(item)} />
      <SaveButton word={wordFromItem(item, slug, quiz)} />
    </div>
  )
}