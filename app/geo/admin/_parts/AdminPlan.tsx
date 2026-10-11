'use client'

// Geo-Admin → Freischalt-Plan: Quizzes ohne Datum automatisch nach einem Rhythmus freischalten.
// Rhythmus = X Quizzes an einem Freischalt-Tag, danach Y Tage Pause (Vorlagen oder frei wählbar).
// Hand-gesetzte Termine bleiben immer unverändert. Mit Automatik werden neue Quizzes von selbst hinten angehängt.

import { useMemo, useState } from 'react'
import Icon from '../../_components/Icon'
import { CATALOG, bySort, countryName, isBuilt, KIND_LABEL } from '../../_lib/catalog'
import { BEREICHE } from '../../_content/welt'
import { PLAN_PRESETS, berlinDay, cleanPlan, perWeek, planQueue, planSlots, type PlanConfig } from '../../_lib/plan'
import { adminPost, fmtDate, type AdminData } from './shared'

const WD = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']
const fmtDay = (d: Date) => d.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Europe/Berlin' })
const fmtTime = (d: Date) => d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Berlin' })
const num = (n: number) => String(Math.round(n * 10) / 10).replace('.', ',')

export default function AdminPlan({ data, reload, flash }: { data: AdminData; reload: () => void; flash: (msg: string, bad?: boolean) => void }) {
  const [p, setP] = useState<PlanConfig>(() => cleanPlan(data.plan))
  const [busy, setBusy] = useState(false)
  const [sure, setSure] = useState(false)
  const [showAll, setShowAll] = useState(false)
  const ro = !data.canWrite
  const now = useMemo(() => new Date(data.now), [data.now])
  const set = (patch: Partial<PlanConfig>) => setP(x => ({ ...x, ...patch }))
  const dirty = JSON.stringify(p) !== JSON.stringify(cleanPlan(data.plan))

  const auto = useMemo(() => new Set(data.autoReleases), [data.autoReleases])
  const futureAuto = useMemo(() => data.autoReleases.filter(s => Date.parse(data.releases[s]) > now.getTime()), [data, now])
  const sorted = useMemo(() => bySort(CATALOG.filter(isBuilt), e => data.quizMeta[e.slug]?.sort ?? null), [data.quizMeta])
  // Vorschau wie beim „Neu verteilen“: zukünftige Plan-Termine zählen als frei, Hand-Termine bleiben
  const queue = useMemo(
    () => planQueue(sorted, p, s => !!data.releases[s] && !(auto.has(s) && Date.parse(data.releases[s]) > now.getTime())),
    [sorted, p, data.releases, auto, now],
  )
  const slots = useMemo(() => planSlots(p, queue.length, now, null), [p, queue.length, now])
  const withoutDate = sorted.filter(e => !data.releases[e.slug]).length
  const skipped = sorted.filter(e => p.skip.includes(e.slug))

  // Rhythmus-Leiste: die nächsten 21 Tage ab dem ersten Freischalt-Tag
  const strip = useMemo(() => {
    const demo = planSlots({ ...p, spread: 0 }, p.perDay * 21, now, null)
    const first = demo.length ? berlinDay(demo[0]) : berlinDay(now) + 1
    const counts = new Map<number, number>()
    for (const d of demo) counts.set(berlinDay(d), (counts.get(berlinDay(d)) ?? 0) + 1)
    return Array.from({ length: 21 }, (_, i) => {
      const day = first + i
      const date = new Date(day * 86400000)
      return { day, n: counts.get(day) ?? 0, wd: WD[(date.getUTCDay() + 6) % 7], dom: date.getUTCDate() }
    })
  }, [p, now])

  const run = async (body: Record<string, unknown>) => {
    setBusy(true)
    try {
      const d = await adminPost(body)
      const r = d.result as { count: number; removed: number; first: string | null; last: string | null } | null
      flash(!r ? 'Plan gespeichert'
        : body.action === 'planClear' ? `${r.removed} Plan-Termine entfernt`
        : r.count ? `${r.count} Quizzes eingeplant: ${fmtDate(r.first)} bis ${fmtDate(r.last)}` : 'Plan gespeichert – keine Quizzes ohne Termin')
      setSure(false)
      reload()
    } catch (e) { flash(e instanceof Error ? e.message : 'Fehler', true) } finally { setBusy(false) }
  }
  const toggleSkip = (slug: string) => set({ skip: p.skip.includes(slug) ? p.skip.filter(s => s !== slug) : [...p.skip, slug] })
  const preset = PLAN_PRESETS.find(x => x.perDay === p.perDay && x.pause === p.pause)
  const rows = showAll ? queue : queue.slice(0, 30)

  return (
    <div className="ga-adm-cols">
      <section className="ga-card">
        <h3 className="ga-adm-h">Freischalt-Plan</h3>
        <p className="ga-muted ga-adm-hint">
          Quizzes ohne Datum werden automatisch nach deinem Rhythmus freigeschaltet. Termine, die du von Hand setzt, bleiben immer so, wie sie sind.
        </p>
        <div className="ga-stat-row" style={{ marginTop: 6 }}>
          <div><b>{withoutDate}</b><span>ohne Termin</span></div>
          <div><b>{futureAuto.length}</b><span>vom Plan geplant</span></div>
          <div><b>{num(perWeek(p))}</b><span>pro Woche</span></div>
        </div>
        <label className={`ga-plan-switch ${p.active ? 'on' : ''}`}>
          <input type="checkbox" checked={p.active} disabled={ro} onChange={e => set({ active: e.target.checked })} />
          <span className="knob" aria-hidden="true" />
          <span>
            <b>Automatik {p.active ? 'an' : 'aus'}</b>
            <small>Neue Quizzes ohne Datum werden von selbst hinten angehängt – auch nach einem Update der Seite.</small>
          </span>
        </label>
      </section>

      <section className="ga-card">
        <h3 className="ga-adm-h">Rhythmus</h3>
        <div className="ga-plan-presets">
          {PLAN_PRESETS.map(x => (
            <button key={x.key} type="button" disabled={ro} className={`ga-plan-preset ${preset?.key === x.key ? 'active' : ''}`} onClick={() => set({ perDay: x.perDay, pause: x.pause })}>
              <b>{x.label}</b>
              <span className="ga-plan-mini" aria-hidden="true">
                {Array.from({ length: x.pause + 1 }, (_, i) => <i key={i} className={i === 0 ? 'on' : ''}>{i === 0 ? x.perDay : ''}</i>)}
              </span>
              <small>{x.hint}</small>
            </button>
          ))}
        </div>
        <div className="ga-adm-grid">
          <div>
            <span className="ga-adm-label">Quizzes pro Freischalt-Tag</span>
            <div className="ga-seg">{[1, 2, 3, 4].map(n => <button key={n} disabled={ro} className={p.perDay === n ? 'active' : ''} onClick={() => set({ perDay: n })}>{n}</button>)}</div>
          </div>
          <div>
            <span className="ga-adm-label">Danach Pause (Tage)</span>
            <div className="ga-seg">{[0, 1, 2, 3, 4, 5, 6].map(n => <button key={n} disabled={ro} className={p.pause === n ? 'active' : ''} onClick={() => set({ pause: n })}>{n}</button>)}</div>
          </div>
        </div>
        <p className="ga-muted" style={{ fontSize: 13, margin: '12px 0 6px' }}>
          {p.perDay} {p.perDay === 1 ? 'Quiz' : 'Quizzes'}{p.pause ? `, dann ${p.pause} ${p.pause === 1 ? 'Tag' : 'Tage'} Pause` : ' jeden Tag'} – im Schnitt {num(perWeek(p))} pro Woche.
        </p>
        <div className="ga-plan-strip" aria-label="Die nächsten drei Wochen">
          {strip.map(d => (
            <span key={d.day} className={d.n ? 'on' : ''} title={d.n ? `${d.n} neu` : 'Pause'}>
              <small>{d.wd}</small><b>{d.dom}</b><i>{d.n ? `+${d.n}` : ''}</i>
            </span>
          ))}
        </div>
      </section>

      <section className="ga-card">
        <h3 className="ga-adm-h">Uhrzeit & Auswahl</h3>
        <div className="ga-adm-grid">
          <label>Uhrzeit<input type="time" className="ga-input" disabled={ro} value={p.time} onChange={e => set({ time: e.target.value || '18:00' })} /></label>
          <label>Mehrere am Tag
            <select className="ga-input" disabled={ro} value={p.spread} onChange={e => set({ spread: Number(e.target.value) })}>
              <option value={0}>gleichzeitig</option>
              {[1, 2, 3, 4, 6].map(h => <option key={h} value={h}>alle {h} {h === 1 ? 'Stunde' : 'Stunden'}</option>)}
            </select>
          </label>
          <label>Frühestens ab<input type="date" className="ga-input" disabled={ro} value={p.start} onChange={e => set({ start: e.target.value })} /></label>
          <div>
            <span className="ga-adm-label">Reihenfolge</span>
            <div className="ga-seg">
              <button disabled={ro} className={p.order === 'gemischt' ? 'active' : ''} onClick={() => set({ order: 'gemischt' })}>Abwechslungsreich</button>
              <button disabled={ro} className={p.order === 'reihenfolge' ? 'active' : ''} onClick={() => set({ order: 'reihenfolge' })}>Wie sortiert</button>
            </div>
          </div>
          <div className="full">
            <span className="ga-adm-label">Bereiche</span>
            <div className="ga-chips">
              <button disabled={ro} className={`ga-chip sm ${p.bereiche.length === 0 ? 'active' : ''}`} onClick={() => set({ bereiche: [] })}>Alle</button>
              {BEREICHE.map(b => {
                const on = p.bereiche.includes(b.key)
                return <button key={b.key} disabled={ro} className={`ga-chip sm ${on ? 'active' : ''}`} onClick={() => set({ bereiche: on ? p.bereiche.filter(x => x !== b.key) : [...p.bereiche, b.key] })}>{b.name}</button>
              })}
            </div>
          </div>
        </div>
        <p className="ga-muted" style={{ fontSize: 12.5, marginTop: 10 }}>
          „Abwechslungsreich“ wechselt reihum zwischen Bereichen und Themen. „Wie sortiert“ hält sich an die Reihenfolge aus dem Reiter Quizzes.
        </p>
      </section>

      <section className="ga-card" style={{ gridColumn: '1 / -1' }}>
        <div className="ga-row ga-wrap" style={{ justifyContent: 'space-between' }}>
          <h3 className="ga-adm-h">Vorschau</h3>
          <span className="ga-muted" style={{ fontSize: 13 }}>
            {queue.length ? <>{queue.length} Quizzes · {fmtDay(slots[0])} bis {fmtDay(slots[slots.length - 1])}</> : 'Nichts zu planen'}
          </span>
        </div>
        {queue.length > 0 && (
          <table className="ga-adm-mini">
            <thead><tr><th>Termin</th><th>Quiz</th><th>Bereich</th><th /></tr></thead>
            <tbody>
              {rows.map((e, i) => {
                const newDay = i === 0 || berlinDay(slots[i]) !== berlinDay(slots[i - 1])
                return (
                  <tr key={e.slug} className={newDay ? 'ga-plan-day' : ''}>
                    <td style={{ whiteSpace: 'nowrap' }}>{newDay ? fmtDay(slots[i]) : ''} <span className="ga-muted">{fmtTime(slots[i])}</span></td>
                    <td><b>{data.quizMeta[e.slug]?.title ?? e.title}</b> <span className="ga-muted" style={{ fontSize: 12 }}>{KIND_LABEL[e.kind]}</span></td>
                    <td className="ga-muted">{BEREICHE.find(b => b.key === e.bereich)?.name}{e.country ? ` · ${countryName(e.country)}` : ''}</td>
                    <td>{!ro && <button className="ga-btn ghost sm" onClick={() => toggleSkip(e.slug)} title="Dieses Quiz nie automatisch planen">Ausnehmen</button>}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
        {queue.length > 30 && <button className="ga-btn ghost sm" style={{ marginTop: 8 }} onClick={() => setShowAll(s => !s)}>{showAll ? 'Weniger zeigen' : `Alle ${queue.length} zeigen`}</button>}
        {skipped.length > 0 && (
          <div style={{ marginTop: 14 }}>
            <span className="ga-adm-label">Ausgenommen ({skipped.length}) – werden nie automatisch geplant</span>
            <div className="ga-chips">
              {skipped.map(e => <button key={e.slug} disabled={ro} className="ga-chip sm" onClick={() => toggleSkip(e.slug)} title="Wieder aufnehmen">{e.title} <Icon name="x" size={12} /></button>)}
            </div>
          </div>
        )}
      </section>

      {!ro && (
        <div className="ga-adm-savebar">
          <button className="ga-btn primary" disabled={busy} onClick={() => run({ action: 'plan', plan: p, apply: true })}>
            <Icon name="calendar" size={15} /> Speichern & Termine verteilen
          </button>
          <button className="ga-btn" disabled={busy || !dirty} onClick={() => run({ action: 'plan', plan: p })}>Nur speichern</button>
          {futureAuto.length > 0 && (
            sure
              ? <button className="ga-btn ghost" disabled={busy} onClick={() => run({ action: 'planClear' })}>Wirklich {futureAuto.length} Plan-Termine entfernen?</button>
              : <button className="ga-btn ghost" disabled={busy} onClick={() => setSure(true)}>Plan-Termine entfernen</button>
          )}
          <span className="ga-muted" style={{ fontSize: 12.5 }}>„Termine verteilen“ legt alle zukünftigen Plan-Termine neu fest. Hand-Termine und schon freigeschaltete Quizzes bleiben.</span>
        </div>
      )}
    </div>
  )
}