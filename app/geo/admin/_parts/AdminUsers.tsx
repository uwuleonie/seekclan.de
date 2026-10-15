'use client'

// Geo-Admin → Nutzer: XP und Geo-Sternis geben/abziehen, persönlicher XP-Faktor, aus Ranglisten ausblenden, zurücksetzen.

import { Fragment, useCallback, useEffect, useState } from 'react'
import Icon from '../../_components/Icon'
import { CLAN_ROLES } from '../../_lib/xp'
import { adminPost, fmtDate, type AdminData } from './shared'

type U = {
  id: string; username: string; role: string | null; xp: number; level: number; hidden: boolean; factor: number; solved: number
  sternis: number; unlocks: number
  log: { amount: number; reason: string; slug: string | null; note: string | null; at: string }[]
  sterniLog: { amount: number; reason: string; slug: string | null; note: string | null; at: string }[]
}
const REASON: Record<string, string> = { item: 'Eintrag', milestone: '%-Stufe', perfect: 'Fehlerfrei', admin: 'Admin', hl: 'Higher Lower' }
const STERNI_REASON: Record<string, string> = { level: 'Level', 'quiz-first': 'Quiz erstmals', 'quiz-repeat': 'Quiz nochmal', unlock: 'Freigekauft', admin: 'Admin', 'hl-einsatz': 'HL-Einsatz', 'hl-wette': 'HL-Wette gewonnen', 'hl-runde': 'HL-Runde', 'hl-rekord': 'HL-Rekord', 'hl-tag': 'HL-Tagesrunde', 'hl-topf': 'HL-Duell-Einsatz', 'hl-duell': 'HL-Duell gewonnen', 'hl-team': 'HL-Team' }
const API = '/api/geo/admin/users'

export default function AdminUsers({ data, flash }: { data: AdminData; flash: (msg: string, bad?: boolean) => void }) {
  const [q, setQ] = useState('')
  const [users, setUsers] = useState<U[] | null>(null)
  const [open, setOpen] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [all, setAll] = useState({ amount: '100', note: '' })
  const ro = !data.canWrite

  const load = useCallback((query: string) => {
    fetch(`${API}?q=${encodeURIComponent(query)}`, { cache: 'no-store' })
      .then(r => r.json()).then(d => setUsers(d.users ?? [])).catch(() => setUsers([]))
  }, [])
  useEffect(() => { const t = setTimeout(() => load(q), 250); return () => clearTimeout(t) }, [q, load])

  const run = async (body: Record<string, unknown>, msg: string) => {
    setBusy(true)
    try { await adminPost(body, API); flash(msg); load(q) } catch (e) { flash(e instanceof Error ? e.message : 'Fehler', true) } finally { setBusy(false) }
  }

  return (
    <div>
      <div className="ga-adm-filters">
        <input className="ga-input" placeholder="Nutzer suchen (leer = alle mit XP)" value={q} onChange={e => setQ(e.target.value)} />
      </div>
      {!ro && (
        <div className="ga-card ga-adm-bulk">
          <div className="ga-row ga-wrap">
            <b>Allen Spielern XP geben</b>
            <input className="ga-input" style={{ width: 110 }} type="number" value={all.amount} onChange={e => setAll(a => ({ ...a, amount: e.target.value }))} />
            <input className="ga-input" style={{ flex: 1, minWidth: 160 }} placeholder="Grund (z.B. Event)" value={all.note} onChange={e => setAll(a => ({ ...a, note: e.target.value }))} />
            <button className="ga-btn sm" disabled={busy} onClick={() => { if (confirm(`${all.amount} XP an alle Spieler?`)) run({ action: 'xpAll', amount: Number(all.amount), note: all.note }, 'XP verteilt') }}>Verteilen</button>
          </div>
        </div>
      )}
      {!users ? <div className="ga-map-loading">Lädt …</div> : users.length === 0 ? <p className="ga-muted">Keine Nutzer gefunden.</p> : (
        <div className="ga-card ga-adm-table">
          <table>
            <thead><tr><th>Name</th><th>Rolle</th><th>Level</th><th>XP</th><th>Sternis</th><th>Entdeckt</th><th>Faktor</th><th>Rangliste</th></tr></thead>
            <tbody>
              {users.map(u => (
                <Fragment key={u.id}>
                  <tr>
                    <td><button className="ga-adm-link" onClick={() => setOpen(open === u.id ? null : u.id)}>{u.username}</button></td>
                    <td>{CLAN_ROLES.find(r => r.key === u.role)?.label ?? u.role ?? '–'}</td>
                    <td>{u.level}</td>
                    <td>{u.xp.toLocaleString('de-DE')}</td>
                    <td title={`${u.unlocks} Quizzes freigekauft`}>{u.sternis.toLocaleString('de-DE')}</td>
                    <td>{u.solved.toLocaleString('de-DE')}</td>
                    <td>×{String(u.factor).replace('.', ',')}</td>
                    <td>{u.hidden ? 'ausgeblendet' : 'sichtbar'}</td>
                  </tr>
                  {open === u.id && (
                    <tr className="ga-adm-expand">
                      <td colSpan={8}><UserPanel u={u} ro={ro} busy={busy} run={run} /></td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function UserPanel({ u, ro, busy, run }: { u: U; ro: boolean; busy: boolean; run: (b: Record<string, unknown>, msg: string) => void }) {
  const [amount, setAmount] = useState('50')
  const [note, setNote] = useState('')
  const [factor, setFactor] = useState(String(u.factor))
  const [st, setSt] = useState('10')
  return (
    <div className="ga-adm-userpanel">
      {!ro && (
        <div className="ga-adm-stack">
          <div className="ga-row ga-wrap">
            <input className="ga-input" style={{ width: 100 }} type="number" value={amount} onChange={e => setAmount(e.target.value)} />
            <input className="ga-input" style={{ flex: 1, minWidth: 140 }} placeholder="Grund" value={note} onChange={e => setNote(e.target.value)} />
            <button className="ga-btn sm" disabled={busy} onClick={() => run({ action: 'xp', userId: u.id, amount: Math.abs(Number(amount)), note }, `+${amount} XP für ${u.username}`)}><Icon name="plus" size={13} /> XP geben</button>
            <button className="ga-btn ghost sm" disabled={busy} onClick={() => run({ action: 'xp', userId: u.id, amount: -Math.abs(Number(amount)), note }, `−${amount} XP für ${u.username}`)}><Icon name="minus" size={13} /> abziehen</button>
          </div>
          <div className="ga-row ga-wrap">
            <input className="ga-input" style={{ width: 100 }} type="number" value={st} onChange={e => setSt(e.target.value)} />
            <button className="ga-btn sm" disabled={busy} onClick={() => run({ action: 'sternis', userId: u.id, amount: Math.abs(Number(st)), note }, `+${st} Geo-Sternis für ${u.username}`)}><Icon name="star" size={13} /> Sternis geben</button>
            <button className="ga-btn ghost sm" disabled={busy} onClick={() => run({ action: 'sternis', userId: u.id, amount: -Math.abs(Number(st)), note }, `−${st} Geo-Sternis für ${u.username}`)}><Icon name="minus" size={13} /> abziehen</button>
            <span className="ga-muted" style={{ fontSize: 12.5 }}>Kontostand {u.sternis.toLocaleString('de-DE')} · {u.unlocks} freigekauft</span>
          </div>
          <div className="ga-row ga-wrap">
            <label className="ga-row" style={{ gap: 6 }}>Persönlicher Faktor <input className="ga-input" style={{ width: 80 }} type="number" step="0.1" min={0} value={factor} onChange={e => setFactor(e.target.value)} /></label>
            <button className="ga-btn sm" disabled={busy} onClick={() => run({ action: 'factor', userId: u.id, factor: Number(factor) }, 'Faktor gespeichert')}>Speichern</button>
            <button className="ga-btn ghost sm" disabled={busy} onClick={() => run({ action: 'hidden', userId: u.id, hidden: !u.hidden }, u.hidden ? 'Wieder sichtbar' : 'Ausgeblendet')}>{u.hidden ? 'In Ranglisten zeigen' : 'Aus Ranglisten ausblenden'}</button>
          </div>
          <div className="ga-row ga-wrap">
            <span className="ga-muted">Zurücksetzen:</span>
            {([['xp', 'XP'], ['progress', 'Entdeckt-Fortschritt'], ['all', 'Alles inkl. Ergebnisse, Sternis und Freigekauftem']] as const).map(([w, l]) => (
              <button key={w} className="ga-btn ghost sm danger-text" disabled={busy} onClick={() => { if (confirm(`${l} von ${u.username} wirklich zurücksetzen? Das lässt sich nicht rückgängig machen.`)) run({ action: 'reset', userId: u.id, what: w }, `${l} zurückgesetzt`) }}>{l}</button>
            ))}
          </div>
        </div>
      )}
      <div>
        <span className="ga-adm-label">Letzte XP</span>
        {u.log.length === 0 ? <p className="ga-muted">Noch keine.</p> : (
          <table className="ga-adm-mini">
            <tbody>
              {u.log.map((l, i) => (
                <tr key={i}><td>{fmtDate(l.at)}</td><td>{l.amount > 0 ? '+' : ''}{l.amount}</td><td>{REASON[l.reason] ?? l.reason}</td><td className="ga-muted">{l.slug ?? l.note ?? ''}</td></tr>
              ))}
            </tbody>
          </table>
        )}
        <span className="ga-adm-label" style={{ marginTop: 12 }}>Letzte Geo-Sternis</span>
        {u.sterniLog.length === 0 ? <p className="ga-muted">Noch keine.</p> : (
          <table className="ga-adm-mini">
            <tbody>
              {u.sterniLog.map((l, i) => (
                <tr key={i}><td>{fmtDate(l.at)}</td><td>{l.amount > 0 ? '+' : ''}{l.amount}</td><td>{STERNI_REASON[l.reason] ?? l.reason}</td><td className="ga-muted">{l.slug ?? l.note ?? ''}</td></tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}