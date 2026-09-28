'use client'

// Taschenrechner mit Klammern, Potenzen, Wurzel, Prozent, Winkelfunktionen und Verlauf.
// Rechnet mit einem eigenen Formel-Leser (kein eval) – nichts Fremdes wird ausgeführt.

import { useEffect, useRef, useState } from 'react'
import Icon from '../../_components/Icon'
import { usePrivate } from '../../_components/PrivateShell'

type Tok = { t: 'num'; v: number } | { t: 'op'; v: string } | { t: 'fn'; v: string } | { t: 'lp' } | { t: 'rp' }

const FNS: Record<string, (x: number, deg: boolean) => number> = {
  sqrt: x => Math.sqrt(x),
  sin: (x, d) => Math.sin(d ? (x * Math.PI) / 180 : x),
  cos: (x, d) => Math.cos(d ? (x * Math.PI) / 180 : x),
  tan: (x, d) => Math.tan(d ? (x * Math.PI) / 180 : x),
  ln: x => Math.log(x),
  log: x => Math.log10(x),
  abs: x => Math.abs(x),
}

function tokenize(src: string): Tok[] {
  const s = src.replace(/\s+/g, '').replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-').replace(/,/g, '.').replace(/√/g, 'sqrt').replace(/π/g, 'pi')
  const out: Tok[] = []
  let i = 0
  while (i < s.length) {
    const c = s[i]
    if (/[\d.]/.test(c)) {
      let j = i
      while (j < s.length && /[\d.]/.test(s[j])) j++
      if (s[j] === 'e' && /[\d+-]/.test(s[j + 1] ?? '')) { j++; if (/[+-]/.test(s[j])) j++; while (/\d/.test(s[j] ?? '')) j++ }
      const v = Number(s.slice(i, j))
      if (Number.isNaN(v)) throw new Error('Ungültige Zahl')
      out.push({ t: 'num', v }); i = j; continue
    }
    if (/[a-z]/i.test(c)) {
      let j = i
      while (j < s.length && /[a-z]/i.test(s[j])) j++
      const w = s.slice(i, j).toLowerCase()
      if (w === 'pi') out.push({ t: 'num', v: Math.PI })
      else if (w === 'e') out.push({ t: 'num', v: Math.E })
      else if (FNS[w]) out.push({ t: 'fn', v: w })
      else throw new Error(`Unbekannt: ${w}`)
      i = j; continue
    }
    if ('+-*/^%!'.includes(c)) { out.push({ t: 'op', v: c }); i++; continue }
    if (c === '(') { out.push({ t: 'lp' }); i++; continue }
    if (c === ')') { out.push({ t: 'rp' }); i++; continue }
    throw new Error(`Zeichen nicht erlaubt: ${c}`)
  }
  return out
}

/** Rekursiver Parser: Ausdruck → Zahl */
export function evaluate(src: string, deg = true): number {
  const toks = tokenize(src)
  let p = 0
  const peek = () => toks[p]
  const isOp = (v: string) => { const t = peek(); return t && t.t === 'op' && t.v === v }

  function expr(): number {
    let v = term()
    while (isOp('+') || isOp('-')) {
      const op = (toks[p++] as { v: string }).v
      const r = term()
      v = op === '+' ? v + r : v - r
    }
    return v
  }
  function term(): number {
    let v = unary()
    for (;;) {
      if (isOp('*') || isOp('/')) {
        const op = (toks[p++] as { v: string }).v
        const r = unary()
        v = op === '*' ? v * r : v / r
      } else if (peek() && (peek().t === 'num' || peek().t === 'lp' || peek().t === 'fn')) {
        v *= unary() // 2(3+4) oder 2pi
      } else return v
    }
  }
  function unary(): number {
    if (isOp('-')) { p++; return -unary() }
    if (isOp('+')) { p++; return unary() }
    return power()
  }
  function power(): number {
    const b = postfix()
    if (isOp('^')) { p++; return b ** unary() }
    return b
  }
  function postfix(): number {
    let v = primary()
    for (;;) {
      if (isOp('%')) { p++; v /= 100 }
      else if (isOp('!')) {
        p++
        if (v < 0 || !Number.isInteger(v) || v > 170) throw new Error('Fakultät nur für ganze Zahlen 0–170')
        let f = 1; for (let i = 2; i <= v; i++) f *= i; v = f
      } else return v
    }
  }
  function primary(): number {
    const t = toks[p++]
    if (!t) throw new Error('Ausdruck unvollständig')
    if (t.t === 'num') return t.v
    if (t.t === 'lp') {
      const v = expr()
      if (peek()?.t === 'rp') p++ // fehlende schließende Klammer am Ende verzeihen
      return v
    }
    if (t.t === 'fn') {
      const arg = peek()?.t === 'lp' ? primary() : postfix()
      return FNS[t.v](arg, deg)
    }
    throw new Error('Ausdruck unvollständig')
  }
  const v = expr()
  if (p < toks.length) throw new Error('Ausdruck nicht verstanden')
  return v
}

export function fmt(n: number): string {
  if (!Number.isFinite(n)) return n > 0 ? '∞' : Number.isNaN(n) ? 'Fehler' : '-∞'
  if (Math.abs(n) >= 1e15 || (n !== 0 && Math.abs(n) < 1e-9)) return n.toExponential(8).replace('.', ',')
  const r = Math.round(n * 1e10) / 1e10
  return r.toLocaleString('de-DE', { maximumFractionDigits: 10 })
}

const HIST_KEY = 'pv-tools-calc-history'
const KEYS = [
  ['(', ')', '%', '÷'],
  ['7', '8', '9', '×'],
  ['4', '5', '6', '−'],
  ['1', '2', '3', '+'],
  ['0', ',', '⌫', '='],
]
const SCI = ['√', '^', 'π', 'sin', 'cos', 'tan', 'ln', 'log', '!']

export default function CalcTool() {
  const { toast } = usePrivate()
  const [input, setInput] = useState('')
  const [deg, setDeg] = useState(true)
  const [history, setHistory] = useState<{ q: string; a: string }[]>([])
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { try { setHistory(JSON.parse(localStorage.getItem(HIST_KEY) || '[]')) } catch { /* egal */ } }, [])

  let preview = ''
  try { preview = input.trim() ? fmt(evaluate(input, deg)) : '' } catch { preview = '' }

  function press(k: string) {
    if (k === '=') return run()
    if (k === '⌫') return setInput(v => v.slice(0, -1))
    if (k === 'C') return setInput('')
    const ins = ['sin', 'cos', 'tan', 'ln', 'log', '√'].includes(k) ? `${k}(` : k
    setInput(v => v + ins)
    inputRef.current?.focus()
  }

  function run() {
    if (!input.trim()) return
    try {
      const a = fmt(evaluate(input, deg))
      const next = [{ q: input, a }, ...history].slice(0, 30)
      setHistory(next)
      try { localStorage.setItem(HIST_KEY, JSON.stringify(next)) } catch { /* egal */ }
      setInput(a.replace(/\./g, ''))
    } catch (e) {
      toast((e as Error).message)
    }
  }

  return (
    <div className="pv-tool-grid">
      <div className="pv-glass pv-card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div className="pv-calc-display">
          <input
            ref={inputRef}
            className="pv-calc-input"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); run() } if (e.key === 'Escape') setInput('') }}
            placeholder="0"
            inputMode="decimal"
            aria-label="Rechnung"
          />
          <div className="pv-calc-preview">{preview && preview !== input ? `= ${preview}` : ' '}</div>
        </div>
        <div className="pv-row" style={{ gap: 6 }}>
          <div className="pv-seg">
            <button className={deg ? 'active' : ''} onClick={() => setDeg(true)}>Grad</button>
            <button className={!deg ? 'active' : ''} onClick={() => setDeg(false)}>Bogenmaß</button>
          </div>
          <span className="pv-grow" />
          <button className="pv-btn sm" onClick={() => setInput('')}>C</button>
        </div>
        <div className="pv-calc-sci">
          {SCI.map(k => <button key={k} onClick={() => press(k)}>{k}</button>)}
        </div>
        <div className="pv-calc-keys">
          {KEYS.flat().map(k => (
            <button key={k} className={k === '=' ? 'eq' : /[÷×−+%()]/.test(k) ? 'op' : ''} onClick={() => press(k)}>{k}</button>
          ))}
        </div>
      </div>
      <div className="pv-glass pv-card">
        <div className="pv-row">
          <p className="pv-label pv-grow" style={{ margin: 0 }}>Verlauf</p>
          {history.length > 0 && (
            <button className="pv-btn sm ghost" onClick={() => { setHistory([]); try { localStorage.removeItem(HIST_KEY) } catch { /* egal */ } }}>
              <Icon name="trash" size={14} /> Leeren
            </button>
          )}
        </div>
        {history.length === 0 && <div className="pv-empty" style={{ padding: 24 }}>Noch nichts gerechnet. Tipp: Tastatur geht auch (Enter = Ergebnis).</div>}
        {history.map((h, i) => (
          <button key={i} className="pv-copy-row" onClick={() => setInput(h.q)} title="Rechnung übernehmen">
            <span className="pv-muted pv-ellipsis">{h.q}</span><b>= {h.a}</b>
          </button>
        ))}
      </div>
    </div>
  )
}