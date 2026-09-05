'use client'

import React, { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

export default function UCLMusicPlayer() {
  const [mounted, setMounted]   = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [playing, setPlaying]   = useState(false)
  const [volume, setVolume]     = useState(0.08)
  const [muted, setMuted]       = useState(false)
  const audioRef   = useRef<HTMLAudioElement | null>(null)
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    setMounted(true)
    const savedVol   = localStorage.getItem('ucl_music_volume')
    const savedMuted = localStorage.getItem('ucl_music_muted')
    const vol  = savedVol ? parseFloat(savedVol) : 0.08
    const mute = savedMuted === 'true'
    setVolume(vol); setMuted(mute)
    const audio = new Audio('/ucl-anthem.mp3')
    audio.loop = true; audio.volume = mute ? 0 : vol
    audioRef.current = audio
    audio.play().then(() => setPlaying(true)).catch(() => {})
    return () => { audio.pause(); audio.src = '' }
  }, [])

  useEffect(() => {
    if (!audioRef.current) return
    audioRef.current.volume = muted ? 0 : volume
    localStorage.setItem('ucl_music_volume', String(volume))
    localStorage.setItem('ucl_music_muted', String(muted))
  }, [volume, muted])

  const enter = () => { if (leaveTimer.current) clearTimeout(leaveTimer.current); setExpanded(true) }
  const leave = () => { leaveTimer.current = setTimeout(() => setExpanded(false), 180) }

  const handleVinylClick = () => {
    if (!audioRef.current) return
    if (playing) { audioRef.current.pause(); setPlaying(false) }
    else { audioRef.current.play(); setPlaying(true) }
  }

  if (!mounted) return null

  const widget = (
    <>
      <style>{`@keyframes vspin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }`}</style>

      {/* Lautstärke-Panel — eigenes fixed element, kein gemeinsamer Container */}
      {expanded && (
        <div
          onMouseEnter={enter}
          onMouseLeave={leave}
          style={{
            position: 'fixed', bottom: 142, right: 28, zIndex: 9989,
            background: 'rgba(4,8,28,0.97)', backdropFilter: 'blur(20px)',
            border: '1px solid rgba(201,168,76,0.2)', borderRadius: 12,
            padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10,
            boxShadow: '0 4px 24px rgba(0,0,0,0.7)', minWidth: 160,
          }}
        >
          <span style={{ fontSize: 11, color: 'rgba(201,168,76,0.8)', fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.1em' }}>UCL Anthem</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span onClick={() => setMuted(m => !m)} style={{ fontSize: 16, cursor: 'pointer', userSelect: 'none' as const, flexShrink: 0 }}>
              {muted || volume === 0 ? '🔇' : volume < 0.1 ? '🔈' : volume < 0.2 ? '🔉' : '🔊'}
            </span>
            <input type="range" min="0" max="0.3" step="0.005" value={muted ? 0 : volume}
              onChange={e => { const v = parseFloat(e.target.value); setVolume(v); setMuted(v === 0) }}
              style={{ flex: 1, accentColor: '#c9a84c', cursor: 'pointer' }} />
          </div>
          <span style={{ fontSize: 10, color: 'rgba(180,210,255,0.4)', textAlign: 'center' as const }}>
            {playing ? (muted ? 'Stummgeschaltet' : 'Spielt') : 'Pausiert'}
          </span>
        </div>
      )}

      {/* Unsichtbare Brücke zwischen Panel und Vinyl damit Hover nicht unterbrochen wird */}
      {expanded && (
        <div
          onMouseEnter={enter}
          onMouseLeave={leave}
          style={{ position: 'fixed', bottom: 130, right: 28, width: 52, height: 14, zIndex: 9988 }}
        />
      )}

      {/* Vinyl */}
      <div
        onMouseEnter={enter}
        onMouseLeave={leave}
        onClick={handleVinylClick}
        style={{
          position: 'fixed', bottom: 80, right: 28, zIndex: 9990,
          width: 52, height: 52, borderRadius: '50%',
          cursor: 'pointer', overflow: 'hidden',
          background: '#000',
          boxShadow: playing && !muted
            ? '0 0 0 2px rgba(201,168,76,0.6), 0 4px 24px rgba(0,0,0,0.7)'
            : '0 4px 20px rgba(0,0,0,0.5)',
          animation: playing && !muted ? 'vspin 4s linear infinite' : 'none',
        }}
      >
        <img src="/vinyl.jpg" alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        {!playing && (
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>▶</div>
        )}
        {muted && playing && (
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>🔇</div>
        )}
      </div>
    </>
  )

  return createPortal(widget, document.body)
}