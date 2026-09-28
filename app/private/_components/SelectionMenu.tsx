'use client'

// Text markieren → kleines Menü: Claude fragen (mit Vorlagen), Google, Kopieren.
// Funktioniert überall im Privatbereich, auch in Notizen und Nachrichten.

import { useEffect, useRef, useState } from 'react'
import Icon from './Icon'
import Portal from './Portal'
import { CLAUDE_PRESETS, openClaude, openGoogle, type ClaudePreset } from '../_lib/ask'

interface Pos { x: number; y: number; below: boolean }

export default function SelectionMenu({ toast }: { toast: (t: string) => void }) {
  const [text, setText] = useState('')
  const [pos, setPos] = useState<Pos | null>(null)
  const [more, setMore] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const touch = window.matchMedia('(pointer: coarse)').matches
    const update = () => {
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(() => {
        const sel = window.getSelection()
        const t = sel?.toString().trim() ?? ''
        const active = document.activeElement as HTMLElement | null
        // In Eingabefeldern (Suche, Titel …) nicht stören
        if (!sel || sel.rangeCount === 0 || t.length < 2 || t.length > 5000 || active?.tagName === 'INPUT' || active?.tagName === 'TEXTAREA') {
          if (!menuRef.current?.contains(document.activeElement)) { setPos(null); setMore(false) }
          return
        }
        const node = sel.anchorNode instanceof Element ? sel.anchorNode : sel.anchorNode?.parentElement
        if (!node?.closest('.pv-main, .pv-modal, .pv-bell-panel')) { setPos(null); return }
        const r = sel.getRangeAt(0).getBoundingClientRect()
        if (!r.width && !r.height) { setPos(null); return }
        // Am Handy unter die Markierung (oben liegt das Menü des Systems)
        const below = touch || r.top < 70
        setText(t)
        setPos({ x: Math.min(window.innerWidth - 16, Math.max(16, r.left + r.width / 2)), y: below ? r.bottom + 10 : r.top - 10, below })
      }, touch ? 450 : 180)
    }
    const hide = () => { setPos(null); setMore(false) }
    document.addEventListener('selectionchange', update)
    window.addEventListener('scroll', hide, true)
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') hide() }
    window.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('selectionchange', update)
      window.removeEventListener('scroll', hide, true)
      window.removeEventListener('keydown', onKey)
      if (timer.current) clearTimeout(timer.current)
    }
  }, [])

  if (!pos) return null

  const done = () => { setPos(null); setMore(false) }
  const claude = (p: ClaudePreset) => { openClaude(text, p); toast('Claude geöffnet – der Text ist auch kopiert, falls er nicht drinsteht'); done() }

  return (
    <Portal>
      <div
        ref={menuRef}
        className={`pv-selmenu ${pos.below ? 'below' : ''}`}
        style={{ left: pos.x, top: pos.y }}
        onMouseDown={e => e.preventDefault()} // Markierung behalten
        role="toolbar"
        aria-label="Markierten Text verwenden"
      >
        <div className="pv-selmenu-row">
          <button onClick={() => claude('ask')}><Icon name="sparkle" size={15} /> Claude</button>
          <button className={more ? 'active' : ''} onClick={() => setMore(m => !m)} aria-label="Weitere Claude-Aktionen"><Icon name="chevronDown" size={14} /></button>
          <span className="sep" />
          <button onClick={() => { openGoogle(text); done() }}><Icon name="search" size={15} /> Google</button>
          <span className="sep" />
          <button
            onClick={async () => {
              try { await navigator.clipboard.writeText(text); toast('Kopiert') } catch { toast('Kopieren nicht möglich') }
              done()
            }}
            aria-label="Kopieren"
          ><Icon name="copy" size={15} /></button>
        </div>
        {more && (
          <div className="pv-selmenu-more">
            {CLAUDE_PRESETS.filter(p => p.key !== 'ask').map(p => (
              <button key={p.key} onClick={() => claude(p.key)}>{p.label}</button>
            ))}
          </div>
        )}
      </div>
    </Portal>
  )
}