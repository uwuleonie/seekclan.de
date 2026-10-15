'use client'

// /geo/admin – Geo-Adminpanel
// Lesen: Team (Teammitglied, Administrator, Owner) · Ändern: Administrator, Owner
// Reiter: Übersicht · Quizzes · Freischalt-Plan · Bereiche & Kategorien · XP & Level · Boosts · Higher Lower · Nutzer

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useGeo } from '../_components/GeoShell'
import Icon from '../_components/Icon'
import { CATALOG_BY_SLUG } from '../_lib/catalog'
import AdminQuizzes from './_parts/AdminQuizzes'
import AdminGroups from './_parts/AdminGroups'
import AdminXp from './_parts/AdminXp'
import AdminBoosts from './_parts/AdminBoosts'
import AdminUsers from './_parts/AdminUsers'
import AdminPlan from './_parts/AdminPlan'
import AdminHl from './_parts/AdminHl'
import { countdown, fmtDate, type AdminData } from './_parts/shared'

type Tab = 'start' | 'quizzes' | 'plan' | 'gruppen' | 'xp' | 'boosts' | 'hl' | 'nutzer'
const TABS: [Tab, string, string][] = [
  ['start', 'Übersicht', 'compass'],
  ['quizzes', 'Quizzes', 'layers'],
  ['plan', 'Freischalt-Plan', 'calendar'],
  ['gruppen', 'Bereiche & Kategorien', 'globe'],
  ['xp', 'XP & Level', 'sparkle'],
  ['boosts', 'Boosts', 'bolt'],
  ['hl', 'Higher Lower', 'arrowUp'],
  ['nutzer', 'Nutzer', 'user'],
]

export default function GeoAdminPage() {
  const { isTeam, loaded } = useGeo()
  const [tab, setTab] = useState<Tab>('start')
  const [data, setData] = useState<AdminData | null>(null)
  const [error, setError] = useState('')
  const [tick, setTick] = useState(0)
  const [msg, setMsg] = useState<{ text: string; bad?: boolean } | null>(null)

  useEffect(() => {
    try { const t = new URLSearchParams(window.location.search).get('tab'); if (t && TABS.some(x => x[0] === t)) setTab(t as Tab) } catch { /* egal */ }
  }, [])
  const pick = (t: Tab) => { setTab(t); history.replaceState(null, '', `?tab=${t}`) }

  useEffect(() => {
    if (!isTeam) return
    let alive = true
    fetch('/api/geo/admin', { cache: 'no-store' })
      .then(async r => {
        const d = await r.json().catch(() => ({}))
        if (!alive) return
        if (!r.ok) setError(d.error || 'Fehler beim Laden')
        else { setData(d); setError('') }
      })
      .catch(() => { if (alive) setError('Fehler beim Laden') })
    return () => { alive = false }
  }, [isTeam, tick])

  const reload = useCallback(() => setTick(n => n + 1), [])
  const flash = useCallback((text: string, bad?: boolean) => {
    setMsg({ text, bad })
    setTimeout(() => setMsg(m => (m?.text === text ? null : m)), 3500)
  }, [])

  if (!loaded) return <div className="ga-page"><div className="ga-map-loading">Lädt …</div></div>
  if (!isTeam) {
    return (
      <div className="ga-page">
        <div className="ga-card ga-locked">
          <div className="ga-locked-icon"><Icon name="lock" size={28} /></div>
          <h1 className="ga-h2">Kein Zugriff</h1>
          <p className="ga-lead" style={{ margin: '6px auto 16px' }}>Das Geo-Adminpanel ist nur für das Team.</p>
          <Link href="/geo" className="ga-btn primary"><Icon name="back" size={15} /> Atlas</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="ga-page ga-adm">
      <p className="ga-eyebrow">Geo-Admin</p>
      <h1 className="ga-title" style={{ marginBottom: 6 }}>Atlas verwalten</h1>
      {data && !data.canWrite && <p className="ga-muted">Nur Lesen – ändern dürfen Administratoren und der Owner.</p>}

      <div className="ga-chips" style={{ margin: '14px 0 16px' }}>
        {TABS.map(([k, l, icon]) => (
          <button key={k} className={`ga-chip ${tab === k ? 'active' : ''}`} onClick={() => pick(k)}><Icon name={icon} size={15} /> {l}</button>
        ))}
      </div>

      {msg && <div className={`ga-adm-flash ${msg.bad ? 'bad' : ''}`} role="status">{msg.text}</div>}
      {error && <div className="ga-adm-flash bad">{error}</div>}

      {!data ? <div className="ga-map-loading">Lädt …</div> : (
        <>
          {tab === 'start' && <Overview data={data} go={pick} />}
          {tab === 'quizzes' && <AdminQuizzes data={data} reload={reload} flash={flash} />}
          {tab === 'plan' && <AdminPlan key={JSON.stringify(data.plan)} data={data} reload={reload} flash={flash} />}
          {tab === 'gruppen' && <AdminGroups data={data} reload={reload} flash={flash} />}
          {tab === 'xp' && <AdminXp key={data.configSavedAt ?? 'std'} data={data} reload={reload} flash={flash} />}
          {tab === 'boosts' && <AdminBoosts data={data} reload={reload} flash={flash} />}
          {tab === 'hl' && <AdminHl flash={flash} />}
          {tab === 'nutzer' && <AdminUsers data={data} flash={flash} />}
        </>
      )}
    </div>
  )
}

function Overview({ data, go }: { data: AdminData; go: (t: Tab) => void }) {
  const now = Date.parse(data.now)
  const active = data.boosts.filter(b => Date.parse(b.starts_at) <= now && Date.parse(b.ends_at) > now)
  const planned = data.boosts.filter(b => Date.parse(b.starts_at) > now)
  const nextReleases = Object.entries(data.releases).filter(([, at]) => Date.parse(at) > now).sort((a, b) => a[1].localeCompare(b[1])).slice(0, 8)
  return (
    <div className="ga-adm-cols">
      <section className="ga-card">
        <h3 className="ga-adm-h">Zahlen</h3>
        <div className="ga-stat-row" style={{ marginTop: 6 }}>
          <div><b>{data.stats.players.toLocaleString('de-DE')}</b><span>Spieler mit XP</span></div>
          <div><b>{data.stats.xp.toLocaleString('de-DE')}</b><span>XP gesamt</span></div>
          <div><b>{data.stats.xp_day.toLocaleString('de-DE')}</b><span>XP (24 Std.)</span></div>
          <div><b>{data.stats.runs_day.toLocaleString('de-DE')}</b><span>Runden (24 Std.)</span></div>
        </div>
      </section>
      <section className="ga-card">
        <h3 className="ga-adm-h">Boosts</h3>
        {active.length === 0 && planned.length === 0 ? <p className="ga-muted">Kein Boost aktiv oder geplant.</p> : (
          <>
            {active.map(b => <p key={b.id}><b>{b.label}</b> ×{String(b.factor).replace('.', ',')} · läuft bis {fmtDate(b.ends_at)}</p>)}
            {planned.map(b => <p key={b.id} className="ga-muted">{b.label} ×{String(b.factor).replace('.', ',')} · {countdown(b.starts_at, now)}</p>)}
          </>
        )}
        <button className="ga-btn sm" onClick={() => go('boosts')}><Icon name="bolt" size={14} /> Boost starten oder planen</button>
      </section>
      <section className="ga-card">
        <h3 className="ga-adm-h">Als Nächstes freigeschaltet</h3>
        {nextReleases.length === 0 ? <p className="ga-muted">Nichts geplant.</p> : (
          <table className="ga-adm-mini">
            <tbody>
              {nextReleases.map(([slug, at]) => (
                <tr key={slug}><td>{CATALOG_BY_SLUG[slug]?.title ?? slug}</td><td>{fmtDate(at)}</td><td className="ga-muted">{countdown(at, now)}</td></tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="ga-muted" style={{ fontSize: 12.5 }}>Freischalt-Plan: {data.plan.active ? `an · ${data.plan.perDay} pro Tag, ${data.plan.pause} ${data.plan.pause === 1 ? 'Tag' : 'Tage'} Pause` : 'aus'}</p>
        <div className="ga-row ga-wrap">
          <button className="ga-btn sm" onClick={() => go('plan')}><Icon name="calendar" size={14} /> Freischalt-Plan</button>
          <button className="ga-btn ghost sm" onClick={() => go('quizzes')}>Einzeln planen</button>
        </div>
      </section>
      <section className="ga-card">
        <h3 className="ga-adm-h">Meistgespielt (30 Tage)</h3>
        {data.played.length === 0 ? <p className="ga-muted">Noch keine Runden.</p> : (
          <table className="ga-adm-mini">
            <tbody>
              {data.played.slice(0, 12).map(p => <tr key={p.slug}><td>{CATALOG_BY_SLUG[p.slug]?.title ?? p.slug}</td><td>{p.n} Runden</td></tr>)}
            </tbody>
          </table>
        )}
      </section>
    </div>
  )
}