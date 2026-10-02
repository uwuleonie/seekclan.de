'use client'

// Musik auf der Halloween-Shopseite – Schallplatte unten rechts wie beim UCL-Tippspiel.
// Klick auf die Platte = Pause / weiter. Mit der Maus drüber = Lautstärke.
// Browser erlauben Musik oft erst nach dem ersten Klick – dann startet sie beim ersten Klick auf der Seite.
// Pause und Lautstärke merkt sich der Browser.

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

const KEY_VOL = 'hw_music_volume'
const KEY_PAUSED = 'hw_music_paused'

function read(key: string): string | null {
  try { return localStorage.getItem(key) } catch { return null }
}
function write(key: string, v: string) {
  try { localStorage.setItem(key, v) } catch { /* egal */ }
}

export default function SpookyMusic({ src, title = 'Spooky Scary Skeletons' }: { src: string; title?: string }) {
  const [mounted, setMounted] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [open, setOpen] = useState(false)
  const [volume, setVolume] = useState(() => {
    const v = Number(read(KEY_VOL))
    return Number.isFinite(v) && v > 0 && v <= 1 ? v : 0.25
  })
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const leave = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 0)
    const audio = new Audio(src)
    audio.loop = true
    audio.volume = volume
    audio.preload = 'auto'
    audioRef.current = audio
    const onPlay = () => setPlaying(true)
    const onPause = () => setPlaying(false)
    audio.addEventListener('play', onPlay)
    audio.addEventListener('pause', onPause)

    let unlock: (() => void) | null = null
    if (read(KEY_PAUSED) !== '1') {
      audio.play().catch(() => {
        // Autoplay blockiert → beim ersten Klick/Tastendruck starten
        unlock = () => {
          if (read(KEY_PAUSED) !== '1') audio.play().catch(() => {})
          if (unlock) { window.removeEventListener('pointerdown', unlock); window.removeEventListener('keydown', unlock) }
        }
        window.addEventListener('pointerdown', unlock, { once: true })
        window.addEventListener('keydown', unlock, { once: true })
      })
    }
    return () => {
      clearTimeout(t)
      if (unlock) { window.removeEventListener('pointerdown', unlock); window.removeEventListener('keydown', unlock) }
      audio.removeEventListener('play', onPlay)
      audio.removeEventListener('pause', onPause)
      audio.pause()
      audio.src = ''
    }
    // Lautstärke wird unten separat gesetzt
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src])

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume
    write(KEY_VOL, String(volume))
  }, [volume])

  const toggle = (e: React.MouseEvent) => {
    e.stopPropagation()
    const a = audioRef.current
    if (!a) return
    if (a.paused) { write(KEY_PAUSED, '0'); a.play().catch(() => {}) }
    else { write(KEY_PAUSED, '1'); a.pause() }
  }
  const enter = () => { if (leave.current) clearTimeout(leave.current); setOpen(true) }
  const exit = () => { leave.current = setTimeout(() => setOpen(false), 200) }

  if (!mounted) return null

  return createPortal(
    <div className="hwm" onMouseEnter={enter} onMouseLeave={exit}>
      {open && (
        <div className="hwm-panel">
          <span className="hwm-title">{title}</span>
          <input type="range" min={0} max={1} step={0.01} value={volume} aria-label="Lautstärke"
            onChange={e => setVolume(Number(e.target.value))} />
          <span className="hwm-state">{playing ? 'Spielt' : 'Pausiert'}</span>
        </div>
      )}
      <button type="button" className={`hwm-vinyl${playing ? ' on' : ''}`} onClick={toggle} aria-label={playing ? 'Musik pausieren' : 'Musik abspielen'}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/vinyl.jpg" alt="" />
        {!playing && (
          <span className="hwm-play" aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" fill="#fff" /></svg>
          </span>
        )}
      </button>
    </div>,
    document.body
  )
}