'use client'

// Geo-Admin → XP-Boosts: sofort starten oder planen; laufende sehen alle als Banner mit Countdown.
// Mehrere gleichzeitige Boosts werden multipliziert (×2 und ×1,5 = ×3).

import { useState } from 'react'
import Icon from '../../_components/Icon'
import { adminPost, fmtDate, toLocalInput, type AdminData } from './shared'

export default function AdminBoosts({ data, reload, flash }: { data: AdminData; reload: () => void; flash: (msg: string, bad?: boolean) => void }) {
  const [label, setLabel] = useState('XP-Boost')
  const [factor, setFactor] = useState('2')
  const [start, setStart] = useState<'now' | 'date'>('now')
  const [startAt, setStartAt] = useState(() => { const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(18, 0, 0, 0); return toLocalInput(d) })
  const [hours, setHours] = useState('24')
  const [busy, setBusy] = useState(false)
  const now = Date.parse(data.now)
  const ro = !data.canWrite

  const run = async (body: Record<string, unknown>, msg: string) => {
    setBusy(true)
    try { await adminPost(body); flash(msg); reload() } catch (e) { flash(e instanceof Error ? e.message : 'Fehler', true) } finally { setBusy(false) }
  }
  const create = () => {
    const s = start === 'now' ? new Date() : new Date(startAt)
    const e = new Date(s.getTime() + Number(hours) * 3600_000)
    run({ action: 'boost', label, factor: Number(factor), startsAt: s.toISOString(), endsAt: e.toISOString() }, start === 'now' ? 'Boost läuft' : `Boost geplant für ${fmtDate(s.toISOString())}`)
  }

  const stateOf = (b: AdminData['boosts'][number]) => (Date.parse(b.ends_at) <= now ? 'vorbei' : Date.parse(b.starts_at) > now ? 'geplant' : 'läuft')

  return (
    <div className="ga-adm-cols">
      {!ro && (
        <section className="ga-card">
          <h3 className="ga-adm-h">Neuer Boost</h3>
          <div className="ga-adm-grid">
            <label>Name (steht im Banner)<input className="ga-input" value={label} maxLength={80} onChange={e => setLabel(e.target.value)} /></label>
            <label>Faktor<input className="ga-input" type="number" step="0.25" min={1.05} max={20} value={factor} onChange={e => setFactor(e.target.value)} /></label>
            <div className="full">
              <span className="ga-adm-label">Start</span>
              <div className="ga-row ga-wrap">
                <div className="ga-seg">
                  <button className={start === 'now' ? 'active' : ''} onClick={() => setStart('now')}>Sofort</button>
                  <button className={start === 'date' ? 'active' : ''} onClick={() => setStart('date')}>Geplant</button>
                </div>
                {start === 'date' && <input type="datetime-local" className="ga-input" style={{ width: 'auto' }} value={startAt} onChange={e => setStartAt(e.target.value)} />}
              </div>
            </div>
            <label>Dauer (Stunden)<input className="ga-input" type="number" min={0.25} step={0.25} value={hours} onChange={e => setHours(e.target.value)} /></label>
            <div className="ga-chips" style={{ alignSelf: 'end' }}>
              {[1, 3, 24, 48, 168].map(h => <button key={h} className="ga-chip sm" onClick={() => setHours(String(h))}>{h < 24 ? `${h} Std.` : `${h / 24} ${h === 24 ? 'Tag' : 'Tage'}`}</button>)}
            </div>
          </div>
          <button className="ga-btn primary" style={{ marginTop: 12 }} disabled={busy} onClick={create}><Icon name="bolt" size={15} /> {start === 'now' ? 'Boost starten' : 'Boost planen'}</button>
        </section>
      )}

      <section className="ga-card">
        <h3 className="ga-adm-h">Boosts</h3>
        {data.boosts.length === 0 ? <p className="ga-muted">Noch keine Boosts.</p> : (
          <table className="ga-adm-mini">
            <thead><tr><th>Name</th><th>Faktor</th><th>Von</th><th>Bis</th><th>Status</th><th /></tr></thead>
            <tbody>
              {data.boosts.map(b => {
                const st = stateOf(b)
                return (
                  <tr key={b.id}>
                    <td>{b.label}{b.created_by_name && <div className="ga-muted" style={{ fontSize: 12 }}>von {b.created_by_name}</div>}</td>
                    <td>×{String(b.factor).replace('.', ',')}</td>
                    <td>{fmtDate(b.starts_at)}</td>
                    <td>{fmtDate(b.ends_at)}</td>
                    <td><span className={`ga-adm-st ${st === 'läuft' ? 'offen' : st === 'geplant' ? 'geplant' : 'gesperrt'}`}>{st}</span></td>
                    <td className="ga-row" style={{ gap: 6 }}>
                      {!ro && st === 'läuft' && <button className="ga-btn sm" disabled={busy} onClick={() => run({ action: 'boostEnd', id: b.id }, 'Boost beendet')}>Beenden</button>}
                      {!ro && <button className="ga-btn ghost sm" disabled={busy} onClick={() => { if (confirm('Boost löschen?')) run({ action: 'boostDelete', id: b.id }, 'Boost gelöscht') }}>Löschen</button>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </section>
    </div>
  )
}