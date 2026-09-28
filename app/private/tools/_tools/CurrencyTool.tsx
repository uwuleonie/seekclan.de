'use client'

// Währungsrechner mit den Referenzkursen der Europäischen Zentralbank (über /api/private/currency)

import { useEffect, useState } from 'react'
import Icon from '../../_components/Icon'

const NAMES: Record<string, string> = {
  EUR: 'Euro', USD: 'US-Dollar', GBP: 'Britisches Pfund', CHF: 'Schweizer Franken', JPY: 'Japanischer Yen', TRY: 'Türkische Lira',
  PLN: 'Polnischer Złoty', CZK: 'Tschechische Krone', DKK: 'Dänische Krone', SEK: 'Schwedische Krone', NOK: 'Norwegische Krone',
  HUF: 'Ungarischer Forint', RON: 'Rumänischer Leu', BGN: 'Bulgarischer Lew', ISK: 'Isländische Krone', CAD: 'Kanadischer Dollar',
  AUD: 'Australischer Dollar', NZD: 'Neuseeland-Dollar', CNY: 'Chinesischer Yuan', HKD: 'Hongkong-Dollar', SGD: 'Singapur-Dollar',
  KRW: 'Südkoreanischer Won', INR: 'Indische Rupie', IDR: 'Indonesische Rupiah', MYR: 'Malaysischer Ringgit', PHP: 'Philippinischer Peso',
  THB: 'Thailändischer Baht', BRL: 'Brasilianischer Real', MXN: 'Mexikanischer Peso', ZAR: 'Südafrikanischer Rand', ILS: 'Israelischer Schekel',
}
const COMMON = ['USD', 'GBP', 'CHF', 'TRY', 'JPY', 'PLN', 'BRL', 'INR']

const fmt = (n: number, cur: string) => {
  try { return new Intl.NumberFormat('de-DE', { style: 'currency', currency: cur, maximumFractionDigits: n < 1 ? 4 : 2 }).format(n) } catch { return `${n.toFixed(2)} ${cur}` }
}

export default function CurrencyTool() {
  const [rates, setRates] = useState<Record<string, number> | null>(null)
  const [date, setDate] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [amount, setAmount] = useState('100')
  const [from, setFrom] = useState('EUR')
  const [to, setTo] = useState('USD')

  useEffect(() => {
    fetch('/api/private/currency', { cache: 'no-store' })
      .then(async r => { const d = await r.json().catch(() => ({})); if (!r.ok) throw new Error(d.error || `Fehler ${r.status}`); return d })
      .then(d => { setRates(d.rates); setDate(d.date) })
      .catch(e => setError((e as Error).message))
  }, [])

  const num = Number(amount.includes(',') ? amount.replace(/\./g, '').replace(',', '.') : amount)
  const conv = (v: number, a: string, b: string) => (rates && rates[a] && rates[b] ? (v / rates[a]) * rates[b] : NaN)
  const result = conv(num, from, to)
  const codes = rates ? Object.keys(rates).sort((a, b) => (NAMES[a] ?? a).localeCompare(NAMES[b] ?? b, 'de')) : []

  if (error) return <div className="pv-glass pv-card" style={{ color: 'var(--pv-danger)' }}>{error}. Bitte später nochmal versuchen.</div>
  if (!rates) return <div className="pv-center" style={{ padding: 40 }}><div className="pv-spinner" /></div>

  const option = (c: string) => <option key={c} value={c}>{c} · {NAMES[c] ?? c}</option>

  return (
    <div className="pv-tool-grid">
      <div className="pv-glass pv-card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div>
          <label className="pv-label">Betrag</label>
          <input className="pv-input pv-big-input" inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)} />
        </div>
        <div className="pv-row" style={{ gap: 8, alignItems: 'flex-end' }}>
          <div className="pv-grow"><label className="pv-label">Von</label><select className="pv-input" value={from} onChange={e => setFrom(e.target.value)}>{codes.map(option)}</select></div>
          <button className="pv-icon-btn" aria-label="Tauschen" onClick={() => { setFrom(to); setTo(from) }}><Icon name="swap" size={18} /></button>
          <div className="pv-grow"><label className="pv-label">Nach</label><select className="pv-input" value={to} onChange={e => setTo(e.target.value)}>{codes.map(option)}</select></div>
        </div>
        <div className="pv-result">
          <span className="pv-muted">{Number.isFinite(num) ? fmt(num, from) : '–'} =</span>
          <b>{Number.isFinite(result) ? fmt(result, to) : '–'}</b>
          <span className="pv-muted" style={{ fontSize: 12.5 }}>1 {from} = {fmt(conv(1, from, to), to)} · 1 {to} = {fmt(conv(1, to, from), from)}</span>
        </div>
        <p className="pv-muted" style={{ fontSize: 12, margin: 0 }}>
          Referenzkurse der Europäischen Zentralbank{date && ` vom ${new Date(date).toLocaleDateString('de-DE')}`} (über frankfurter.dev).
          Banken und Wechselstuben rechnen mit Aufschlag.
        </p>
      </div>
      <div className="pv-glass pv-card">
        <p className="pv-label">{Number.isFinite(num) ? fmt(num, from) : ''} in anderen Währungen</p>
        {COMMON.filter(c => c !== from && rates[c]).concat(from !== 'EUR' ? ['EUR'] : []).map(c => (
          <button key={c} className="pv-copy-row" onClick={() => setTo(c)}>
            <span className="pv-muted">{NAMES[c] ?? c}</span><b>{fmt(conv(num, from, c), c)}</b>
          </button>
        ))}
      </div>
    </div>
  )
}