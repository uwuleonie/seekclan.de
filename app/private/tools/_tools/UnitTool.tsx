'use client'

// Einheitenrechner. Umrechnungsfaktoren nach SI/NIST (exakte Definitionen, z.B. 1 inch = 2,54 cm).

import { useMemo, useState } from 'react'
import Icon from '../../_components/Icon'

interface Unit { key: string; label: string; f?: number; to?: (v: number) => number; from?: (v: number) => number }
interface Cat { key: string; label: string; units: Unit[] }

const CATS: Cat[] = [
  { key: 'length', label: 'Länge', units: [
    { key: 'mm', label: 'Millimeter', f: 0.001 }, { key: 'cm', label: 'Zentimeter', f: 0.01 }, { key: 'm', label: 'Meter', f: 1 },
    { key: 'km', label: 'Kilometer', f: 1000 }, { key: 'in', label: 'Zoll (inch)', f: 0.0254 }, { key: 'ft', label: 'Fuß (feet)', f: 0.3048 },
    { key: 'yd', label: 'Yard', f: 0.9144 }, { key: 'mi', label: 'Meile', f: 1609.344 }, { key: 'nmi', label: 'Seemeile', f: 1852 },
  ] },
  { key: 'mass', label: 'Gewicht', units: [
    { key: 'mg', label: 'Milligramm', f: 1e-6 }, { key: 'g', label: 'Gramm', f: 0.001 }, { key: 'kg', label: 'Kilogramm', f: 1 },
    { key: 't', label: 'Tonne', f: 1000 }, { key: 'oz', label: 'Unze (oz)', f: 0.028349523125 }, { key: 'lb', label: 'Pfund (lb)', f: 0.45359237 },
    { key: 'st', label: 'Stone', f: 6.35029318 },
  ] },
  { key: 'temp', label: 'Temperatur', units: [
    { key: 'c', label: 'Grad Celsius', to: v => v, from: v => v },
    { key: 'f', label: 'Grad Fahrenheit', to: v => (v - 32) * 5 / 9, from: v => v * 9 / 5 + 32 },
    { key: 'k', label: 'Kelvin', to: v => v - 273.15, from: v => v + 273.15 },
  ] },
  { key: 'area', label: 'Fläche', units: [
    { key: 'cm2', label: 'Quadratzentimeter', f: 1e-4 }, { key: 'm2', label: 'Quadratmeter', f: 1 }, { key: 'a', label: 'Ar', f: 100 },
    { key: 'ha', label: 'Hektar', f: 10000 }, { key: 'km2', label: 'Quadratkilometer', f: 1e6 }, { key: 'ft2', label: 'Quadratfuß', f: 0.09290304 },
    { key: 'ac', label: 'Acre', f: 4046.8564224 }, { key: 'mi2', label: 'Quadratmeile', f: 2589988.110336 },
    { key: 'fb', label: 'Fußballfeld (105×68 m)', f: 7140 },
  ] },
  { key: 'volume', label: 'Volumen', units: [
    { key: 'ml', label: 'Milliliter', f: 0.001 }, { key: 'cl', label: 'Zentiliter', f: 0.01 }, { key: 'l', label: 'Liter', f: 1 },
    { key: 'm3', label: 'Kubikmeter', f: 1000 }, { key: 'tsp', label: 'Teelöffel (5 ml)', f: 0.005 }, { key: 'tbsp', label: 'Esslöffel (15 ml)', f: 0.015 },
    { key: 'cup', label: 'Cup (US)', f: 0.2365882365 }, { key: 'floz', label: 'Fluid Ounce (US)', f: 0.0295735295625 },
    { key: 'gal', label: 'Gallone (US)', f: 3.785411784 }, { key: 'pt', label: 'Pint (UK)', f: 0.56826125 },
  ] },
  { key: 'speed', label: 'Geschwindigkeit', units: [
    { key: 'kmh', label: 'km/h', f: 1 / 3.6 }, { key: 'ms', label: 'm/s', f: 1 }, { key: 'mph', label: 'mph', f: 0.44704 },
    { key: 'kn', label: 'Knoten', f: 1852 / 3600 },
  ] },
  { key: 'time', label: 'Zeit', units: [
    { key: 's', label: 'Sekunden', f: 1 }, { key: 'min', label: 'Minuten', f: 60 }, { key: 'h', label: 'Stunden', f: 3600 },
    { key: 'd', label: 'Tage', f: 86400 }, { key: 'wk', label: 'Wochen', f: 604800 }, { key: 'y', label: 'Jahre (365 Tage)', f: 31536000 },
  ] },
  { key: 'data', label: 'Datenmenge', units: [
    { key: 'B', label: 'Byte', f: 1 }, { key: 'KB', label: 'Kilobyte (1000)', f: 1e3 }, { key: 'MB', label: 'Megabyte', f: 1e6 },
    { key: 'GB', label: 'Gigabyte', f: 1e9 }, { key: 'TB', label: 'Terabyte', f: 1e12 }, { key: 'KiB', label: 'Kibibyte (1024)', f: 1024 },
    { key: 'MiB', label: 'Mebibyte', f: 1024 ** 2 }, { key: 'GiB', label: 'Gibibyte', f: 1024 ** 3 }, { key: 'bit', label: 'Bit', f: 1 / 8 },
  ] },
  { key: 'energy', label: 'Energie', units: [
    { key: 'j', label: 'Joule', f: 1 }, { key: 'kj', label: 'Kilojoule', f: 1000 }, { key: 'cal', label: 'Kalorie', f: 4.184 },
    { key: 'kcal', label: 'Kilokalorie', f: 4184 }, { key: 'wh', label: 'Wattstunde', f: 3600 }, { key: 'kwh', label: 'Kilowattstunde', f: 3.6e6 },
  ] },
]

const toBase = (u: Unit, v: number) => (u.to ? u.to(v) : v * u.f!)
const fromBase = (u: Unit, v: number) => (u.from ? u.from(v) : v / u.f!)
const fmt = (n: number) => (!Number.isFinite(n) ? '–' : Math.abs(n) >= 1e12 || (n !== 0 && Math.abs(n) < 1e-6)
  ? n.toExponential(5).replace('.', ',')
  : (Math.round(n * 1e8) / 1e8).toLocaleString('de-DE', { maximumFractionDigits: 8 }))

export default function UnitTool() {
  const [catKey, setCatKey] = useState('length')
  const cat = CATS.find(c => c.key === catKey)!
  const [from, setFrom] = useState('m')
  const [to, setTo] = useState('ft')
  const [value, setValue] = useState('1')

  function changeCat(k: string) {
    const c = CATS.find(x => x.key === k)!
    setCatKey(k); setFrom(c.units[1]?.key ?? c.units[0].key); setTo(c.units[2]?.key ?? c.units[0].key)
  }

  // "1,5" und "1.5" verstehen; "1.000,5" ebenfalls
  const num = Number(value.includes(',') ? value.replace(/\./g, '').replace(',', '.') : value)
  const uFrom = cat.units.find(u => u.key === from) ?? cat.units[0]
  const uTo = cat.units.find(u => u.key === to) ?? cat.units[0]
  const base = Number.isFinite(num) ? toBase(uFrom, num) : NaN
  const result = fromBase(uTo, base)
  const all = useMemo(() => cat.units.map(u => ({ u, v: fromBase(u, base) })), [cat, base])

  return (
    <div className="pv-tool-grid">
      <div className="pv-glass pv-card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div className="pv-chips" style={{ flexWrap: 'wrap' }}>
          {CATS.map(c => <button key={c.key} className={`pv-chip ${c.key === catKey ? 'active' : ''}`} onClick={() => changeCat(c.key)}>{c.label}</button>)}
        </div>
        <div>
          <label className="pv-label">Wert</label>
          <input className="pv-input pv-big-input" inputMode="decimal" value={value} onChange={e => setValue(e.target.value)} />
        </div>
        <div className="pv-row" style={{ gap: 8, alignItems: 'flex-end' }}>
          <div className="pv-grow"><label className="pv-label">Von</label>
            <select className="pv-input" value={uFrom.key} onChange={e => setFrom(e.target.value)}>{cat.units.map(u => <option key={u.key} value={u.key}>{u.label}</option>)}</select></div>
          <button className="pv-icon-btn" aria-label="Tauschen" onClick={() => { setFrom(uTo.key); setTo(uFrom.key) }}><Icon name="swap" size={18} /></button>
          <div className="pv-grow"><label className="pv-label">Nach</label>
            <select className="pv-input" value={uTo.key} onChange={e => setTo(e.target.value)}>{cat.units.map(u => <option key={u.key} value={u.key}>{u.label}</option>)}</select></div>
        </div>
        <div className="pv-result">
          <span className="pv-muted">{value || '0'} {uFrom.label} =</span>
          <b>{fmt(result)}</b>
          <span>{uTo.label}</span>
        </div>
      </div>
      <div className="pv-glass pv-card">
        <p className="pv-label">Alle {cat.label}-Einheiten</p>
        {all.map(({ u, v }) => (
          <div key={u.key} className="pv-copy-row" style={{ cursor: 'default' }}>
            <span className="pv-muted">{u.label}</span><b>{fmt(v)}</b>
          </div>
        ))}
      </div>
    </div>
  )
}