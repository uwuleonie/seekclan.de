'use client'

// Bausteine für das Geo-Adminpanel: Server-Aufrufe, Rollen-Auswahl, Freischalt-Auswahl, Spielarten-Regeln

import { useState } from 'react'
import { CLAN_ROLES, type ModeRule } from '../../_lib/xp'

export interface AdminData {
  canWrite: boolean
  config: import('../../_lib/xp').GeoConfig
  configSavedAt: string | null
  quizMeta: Record<string, import('../../_lib/catalog').QuizMeta>
  groupMeta: import('../../_lib/catalog').GroupMeta[]
  releases: Record<string, string>
  /** Quizzes, deren Termin vom Freischalt-Plan stammt */
  autoReleases: string[]
  plan: import('../../_lib/plan').PlanConfig
  boosts: { id: number; label: string; factor: number; starts_at: string; ends_at: string; created_by_name: string | null }[]
  stats: { players: number; xp: number; xp_day: number; runs_day: number }
  played: { slug: string; n: number }[]
  now: string
}

/** POST an /api/geo/admin (oder Unterpfad); wirft bei Fehler */
export async function adminPost(body: Record<string, unknown>, path = '/api/geo/admin') {
  const r = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  const d = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(d.error || `Fehler ${r.status}`)
  return d
}

export const toLocalInput = (d: Date) => {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}
export const fmtDate = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '–'

/** Countdown-Text bis zu einem Zeitpunkt */
export function countdown(iso: string, now: number) {
  const ms = Date.parse(iso) - now
  if (ms <= 0) return null
  const m = Math.floor(ms / 60000), d = Math.floor(m / 1440), h = Math.floor((m % 1440) / 60)
  return d ? `in ${d} T ${h} Std.` : h ? `in ${h} Std. ${m % 60} Min.` : `in ${m % 60} Min.`
}

/* ── Rollen ── */

export function RolePicker({ value, onChange, disabled }: { value: string[]; onChange: (v: string[]) => void; disabled?: boolean }) {
  return (
    <div className="ga-chips">
      {CLAN_ROLES.map(r => {
        const on = value.includes(r.key)
        return (
          <button key={r.key} type="button" disabled={disabled} className={`ga-chip sm ${on ? 'active' : ''}`}
            onClick={() => onChange(on ? value.filter(x => x !== r.key) : [...value, r.key])}>{r.label}</button>
        )
      })}
    </div>
  )
}

/* ── Sichtbarkeit ── */

export type Visibility = 'all' | 'roles' | 'admins'
export function VisibilityPicker({ vis, roles, onChange, disabled }: {
  vis: Visibility; roles: string[]; onChange: (vis: Visibility, roles: string[]) => void; disabled?: boolean
}) {
  return (
    <div className="ga-adm-stack">
      <div className="ga-seg">
        {([['all', 'Alle'], ['roles', 'Nur Rollen'], ['admins', 'Nur Admins']] as [Visibility, string][]).map(([v, l]) => (
          <button key={v} type="button" disabled={disabled} className={vis === v ? 'active' : ''} onClick={() => onChange(v, roles)}>{l}</button>
        ))}
      </div>
      {vis === 'roles' && <RolePicker value={roles} onChange={r => onChange('roles', r)} disabled={disabled} />}
    </div>
  )
}

/* ── Freischaltung: sofort · Datum · Countdown · sperren ── */

export function ReleasePicker({ onApply, disabled, current, allowLock = true }: {
  onApply: (at: string | null) => void; disabled?: boolean; current?: string | null; allowLock?: boolean
}) {
  const [how, setHow] = useState<'now' | 'date' | 'in'>('date')
  const [date, setDate] = useState(() => { const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(18, 0, 0, 0); return toLocalInput(d) })
  const [hours, setHours] = useState(24)
  const at = () => (how === 'now' ? new Date() : how === 'date' ? new Date(date) : new Date(Date.now() + hours * 3600_000)).toISOString()
  return (
    <div className="ga-adm-stack">
      {current !== undefined && <span className="ga-muted" style={{ fontSize: 12.5 }}>Aktuell: {current ? fmtDate(current) : 'gesperrt'}</span>}
      <div className="ga-seg">
        <button type="button" className={how === 'now' ? 'active' : ''} onClick={() => setHow('now')}>Sofort</button>
        <button type="button" className={how === 'date' ? 'active' : ''} onClick={() => setHow('date')}>Datum</button>
        <button type="button" className={how === 'in' ? 'active' : ''} onClick={() => setHow('in')}>Countdown</button>
      </div>
      {how === 'date' && <input type="datetime-local" className="ga-input" value={date} onChange={e => setDate(e.target.value)} />}
      {how === 'in' && (
        <label className="ga-row" style={{ gap: 8 }}>
          in <input type="number" min={0.25} step={0.25} className="ga-input" style={{ width: 90 }} value={hours} onChange={e => setHours(Number(e.target.value))} /> Stunden
        </label>
      )}
      <div className="ga-row ga-wrap">
        <button type="button" className="ga-btn primary sm" disabled={disabled} onClick={() => onApply(at())}>Freischalten</button>
        {allowLock && <button type="button" className="ga-btn ghost sm" disabled={disabled} onClick={() => onApply(null)}>Sperren</button>}
      </div>
    </div>
  )
}

/* ── Regel für eine Spielart ── */

export function RulePicker({ value, onChange, disabled, allowDefault = true }: {
  value: ModeRule | undefined; onChange: (v: ModeRule | undefined) => void; disabled?: boolean; allowDefault?: boolean
}) {
  const kind = value === undefined ? 'default' : Array.isArray(value) ? 'roles' : value
  return (
    <div className="ga-adm-stack">
      <select className="ga-input sm" disabled={disabled} value={kind}
        onChange={e => {
          const k = e.target.value
          onChange(k === 'default' ? undefined : k === 'roles' ? (Array.isArray(value) ? value : ['teammitglied', 'administrator', 'owner']) : (k as ModeRule))
        }}>
        {allowDefault && <option value="default">Standard</option>}
        <option value="all">Alle</option>
        <option value="login">Nur Eingeloggte</option>
        <option value="roles">Nur Rollen …</option>
        <option value="none">Niemand</option>
      </select>
      {Array.isArray(value) && <RolePicker value={value} onChange={onChange} disabled={disabled} />}
    </div>
  )
}