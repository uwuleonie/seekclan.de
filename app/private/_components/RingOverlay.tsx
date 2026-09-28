'use client'

// Klingel-Anzeige für Wecker und Timer, solange die Seite offen ist.
// Ton wird im Browser erzeugt (kein Audio-Download nötig), dazu Vibration am Handy.

import { useEffect, useRef } from 'react'
import Icon from './Icon'

export interface RingInfo {
  key: string
  title: string
  body?: string
  alarmId?: number
  canSnooze?: boolean
}

export default function RingOverlay({
  ring, onStop, onSnooze,
}: {
  ring: RingInfo
  onStop: () => void
  onSnooze?: (minutes: number) => void
}) {
  const ctxRef = useRef<AudioContext | null>(null)

  useEffect(() => {
    let stopped = false
    let timer: ReturnType<typeof setTimeout> | null = null
    try {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      const ctx = new AC()
      ctxRef.current = ctx
      ctx.resume().catch(() => {})
      // Zwei-Ton-Klingeln, alle 1,4 s wiederholt
      const beep = () => {
        if (stopped) return
        const t = ctx.currentTime
        for (const [i, freq] of [880, 1175, 880, 1175].entries()) {
          const osc = ctx.createOscillator()
          const gain = ctx.createGain()
          osc.type = 'sine'
          osc.frequency.value = freq
          gain.gain.setValueAtTime(0.0001, t + i * 0.16)
          gain.gain.exponentialRampToValueAtTime(0.35, t + i * 0.16 + 0.02)
          gain.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.16 + 0.14)
          osc.connect(gain).connect(ctx.destination)
          osc.start(t + i * 0.16)
          osc.stop(t + i * 0.16 + 0.15)
        }
        if ('vibrate' in navigator) navigator.vibrate?.([300, 150, 300])
        timer = setTimeout(beep, 1400)
      }
      beep()
    } catch {
      /* ohne Ton */
    }
    // Nach 3 Minuten automatisch leise werden
    const auto = setTimeout(() => { stopped = true }, 180_000)
    return () => {
      stopped = true
      if (timer) clearTimeout(timer)
      clearTimeout(auto)
      ctxRef.current?.close().catch(() => {})
      if ('vibrate' in navigator) navigator.vibrate?.(0)
    }
  }, [ring.key])

  return (
    <div className="pv-ring" role="alertdialog" aria-label={ring.title}>
      <div className="pv-ring-card pv-glass strong">
        <span className="pv-ring-icon"><Icon name="clock" size={34} /></span>
        <div className="pv-title" style={{ fontSize: 30, textAlign: 'center' }}>{ring.title}</div>
        {ring.body && <p className="pv-muted" style={{ margin: 0, textAlign: 'center' }}>{ring.body}</p>}
        <div className="pv-row" style={{ width: '100%', marginTop: 8 }}>
          {ring.canSnooze && onSnooze && (
            <button className="pv-btn lg pv-grow" onClick={() => onSnooze(5)}>5 Min. später</button>
          )}
          <button className="pv-btn primary lg pv-grow" onClick={onStop}>Stopp</button>
        </div>
      </div>
    </div>
  )
}