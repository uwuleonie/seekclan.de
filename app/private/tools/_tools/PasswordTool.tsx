'use client'

// Passwortgenerator mit echtem Zufall aus dem Browser (crypto.getRandomValues).
// Nichts wird gespeichert oder verschickt.

import { useCallback, useEffect, useState } from 'react'
import Icon from '../../_components/Icon'
import { usePrivate } from '../../_components/PrivateShell'

const SETS = {
  lower: 'abcdefghijklmnopqrstuvwxyz',
  upper: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  digits: '0123456789',
  symbols: '!@#$%^&*()-_=+[]{};:,.?/~',
}
const AMBIGUOUS = /[Il1O0o]/g

/** Gleichverteilte Zufallszahl 0 … max-1 (ohne Modulo-Verzerrung) */
function randomInt(max: number): number {
  const buf = new Uint32Array(1)
  const limit = Math.floor(0x100000000 / max) * max
  do { crypto.getRandomValues(buf) } while (buf[0] >= limit)
  return buf[0] % max
}

type Opts = { length: number; lower: boolean; upper: boolean; digits: boolean; symbols: boolean; noAmbiguous: boolean }

function generate(o: Opts): string {
  const groups = (['lower', 'upper', 'digits', 'symbols'] as const).filter(k => o[k]).map(k => (o.noAmbiguous ? SETS[k].replace(AMBIGUOUS, '') : SETS[k]))
  if (!groups.length) return ''
  const all = groups.join('')
  // Aus jeder gewählten Gruppe mindestens ein Zeichen
  const chars = groups.map(g => g[randomInt(g.length)])
  while (chars.length < o.length) chars.push(all[randomInt(all.length)])
  for (let i = chars.length - 1; i > 0; i--) { const j = randomInt(i + 1); [chars[i], chars[j]] = [chars[j], chars[i]] }
  return chars.slice(0, o.length).join('')
}

function entropy(o: Opts) {
  const pool = (['lower', 'upper', 'digits', 'symbols'] as const).filter(k => o[k])
    .reduce((n, k) => n + (o.noAmbiguous ? SETS[k].replace(AMBIGUOUS, '') : SETS[k]).length, 0)
  return pool ? Math.round(o.length * Math.log2(pool)) : 0
}

function strength(bits: number): { label: string; color: string; pct: number } {
  if (bits < 40) return { label: 'Schwach', color: '#c0344f', pct: 20 }
  if (bits < 60) return { label: 'Mittel', color: '#e0913a', pct: 45 }
  if (bits < 80) return { label: 'Stark', color: '#25845c', pct: 72 }
  return { label: 'Sehr stark', color: '#1f8a6e', pct: 100 }
}

export default function PasswordTool() {
  const { toast } = usePrivate()
  const [o, setO] = useState<Opts>({ length: 20, lower: true, upper: true, digits: true, symbols: true, noAmbiguous: true })
  const [pw, setPw] = useState('')
  const [pins, setPins] = useState<string[]>([])
  const [recent, setRecent] = useState<string[]>([])

  const regen = useCallback(() => setPw(generate(o)), [o])
  useEffect(() => { regen() }, [regen])

  const bits = entropy(o)
  const st = strength(bits)

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text)
      toast('Kopiert')
      setRecent(r => [text, ...r.filter(x => x !== text)].slice(0, 5))
    } catch { toast('Kopieren nicht möglich') }
  }

  return (
    <div className="pv-tool-grid">
      <div className="pv-glass pv-card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div className="pv-pw-box">
          <code>{pw || 'Mindestens eine Zeichenart wählen'}</code>
        </div>
        <div className="pv-pw-meter"><span style={{ width: `${st.pct}%`, background: st.color }} /></div>
        <div className="pv-row" style={{ fontSize: 13 }}>
          <b style={{ color: st.color }}>{st.label}</b>
          <span className="pv-muted">· ca. {bits} Bit Zufall</span>
        </div>
        <div className="pv-row pv-wrap" style={{ gap: 8 }}>
          <button className="pv-btn primary pv-grow" onClick={() => copy(pw)} disabled={!pw}><Icon name="copy" size={17} /> Kopieren</button>
          <button className="pv-btn pv-grow" onClick={regen}><Icon name="refresh" size={17} /> Neu erzeugen</button>
        </div>
        <div>
          <label className="pv-label">Länge: {o.length}</label>
          <input className="pv-range" type="range" min={6} max={64} value={o.length} onChange={e => setO({ ...o, length: Number(e.target.value) })} />
        </div>
        {([['lower', 'Kleinbuchstaben (a–z)'], ['upper', 'Großbuchstaben (A–Z)'], ['digits', 'Zahlen (0–9)'], ['symbols', 'Sonderzeichen (!@#…)'], ['noAmbiguous', 'Verwechselbare weglassen (I l 1 O 0 o)']] as const).map(([k, l]) => (
          <label key={k} className="pv-check-row">
            <input type="checkbox" checked={o[k]} onChange={e => setO({ ...o, [k]: e.target.checked })} /> {l}
          </label>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div className="pv-glass pv-card">
          <p className="pv-label">PIN erzeugen</p>
          <div className="pv-row pv-wrap" style={{ gap: 6 }}>
            {[4, 6, 8].map(n => (
              <button key={n} className="pv-btn sm" onClick={() => setPins(Array.from({ length: 3 }, () => Array.from({ length: n }, () => randomInt(10)).join('')))}>{n} Ziffern</button>
            ))}
          </div>
          {pins.map(p => (
            <button key={p} className="pv-copy-row" onClick={() => copy(p)}><code style={{ fontSize: 16 }}>{p}</code><Icon name="copy" size={15} /></button>
          ))}
        </div>
        <div className="pv-glass pv-card" style={{ fontSize: 13 }}>
          <p className="pv-label">Gut zu wissen</p>
          <div className="pv-muted">
            Die Passwörter entstehen nur in deinem Browser und werden nirgends gespeichert. Für wichtige Konten:
            mindestens 16 Zeichen, für jedes Konto ein eigenes Passwort, am besten in einem Passwort-Manager.
          </div>
          {recent.length > 0 && (
            <>
              <p className="pv-label" style={{ marginTop: 10 }}>Zuletzt kopiert (nur bis zum Neuladen)</p>
              {recent.map(r => <button key={r} className="pv-copy-row" onClick={() => copy(r)}><code className="pv-ellipsis">{r}</code><Icon name="copy" size={15} /></button>)}
            </>
          )}
        </div>
      </div>
    </div>
  )
}