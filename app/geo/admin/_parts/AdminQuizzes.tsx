'use client'

// Geo-Admin → Quizzes: suchen, filtern, mehrere auf einmal ändern, einzeln bearbeiten, Reihenfolge festlegen

import { useMemo, useState } from 'react'
import Icon from '../../_components/Icon'
import { CATALOG, bySort, countryName, isBuilt, KIND_LABEL, type QuizMeta } from '../../_lib/catalog'
import { itemCount } from '../../_lib/items'
import { normalize } from '../../_lib/text'
import { DIFFICULTIES, MODE_KEYS, MODE_LABEL, defaultDifficulty, type Difficulty, type ModeKey, type ModeRule } from '../../_lib/xp'
import { BEREICHE } from '../../_content/welt'
import type { CatalogEntry } from '../../_lib/types'
import { adminPost, countdown, fmtDate, ReleasePicker, RulePicker, VisibilityPicker, type AdminData, type Visibility } from './shared'

type Filter = 'alle' | 'offen' | 'geplant' | 'gesperrt' | 'unsichtbar' | 'arbeit' | 'geaendert'

export default function AdminQuizzes({ data, reload, flash }: { data: AdminData; reload: () => void; flash: (msg: string, bad?: boolean) => void }) {
  const [q, setQ] = useState('')
  const [bereich, setBereich] = useState<string>('alle')
  const [filter, setFilter] = useState<Filter>('alle')
  const [diffF, setDiffF] = useState<string>('alle')
  const [sel, setSel] = useState<string[]>([])
  const [edit, setEdit] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const now = Date.parse(data.now)
  const ro = !data.canWrite

  const metaOf = (slug: string): Partial<QuizMeta> => data.quizMeta[slug] ?? {}
  const diffOf = (e: CatalogEntry): { d: Difficulty; own: boolean } => {
    const m = metaOf(e.slug).difficulty
    return m ? { d: m, own: true } : { d: defaultDifficulty(e, isBuilt(e) ? itemCount(e) : 0), own: false }
  }
  const stateOf = (e: CatalogEntry): Exclude<Filter, 'alle' | 'geaendert'> => {
    if (e.planned) return 'arbeit'
    if ((metaOf(e.slug).visibility ?? 'all') !== 'all') return 'unsichtbar'
    const r = data.releases[e.slug]
    if (!r) return 'gesperrt'
    return Date.parse(r) <= now ? 'offen' : 'geplant'
  }

  const rows = useMemo(() => {
    const n = normalize(q)
    const list = CATALOG.filter(e =>
      (bereich === 'alle' || e.bereich === bereich) &&
      (filter === 'alle' || (filter === 'geaendert' ? !!data.quizMeta[e.slug] : stateOf(e) === filter)) &&
      (diffF === 'alle' || diffOf(e).d === diffF) &&
      (!n || normalize(`${metaOf(e.slug).title ?? e.title} ${e.slug} ${countryName(e.country)} ${KIND_LABEL[e.kind]}`).includes(n)),
    )
    return bySort(list, e => metaOf(e.slug).sort ?? null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, bereich, filter, diffF, data])

  const run = async (body: Record<string, unknown>, msg: string) => {
    setBusy(true)
    try { await adminPost(body); flash(msg); reload() } catch (e) { flash(e instanceof Error ? e.message : 'Fehler', true) } finally { setBusy(false) }
  }
  const patch = (slugs: string[], p: Record<string, unknown>, msg = 'Gespeichert') => run({ action: 'quiz', slugs, patch: p }, msg)
  const release = (slugs: string[], at: string | null) =>
    run({ action: 'quiz', slugs, release: { at } }, at === null ? `${slugs.length} gesperrt` : Date.parse(at) <= Date.now() + 5000 ? `${slugs.length} freigeschaltet` : `${slugs.length} geplant für ${fmtDate(at)}`)

  const move = (slug: string, dir: -1 | 1) => {
    const keys = rows.map(e => e.slug)
    const i = keys.indexOf(slug), j = i + dir
    if (i < 0 || j < 0 || j >= keys.length) return
    ;[keys[i], keys[j]] = [keys[j], keys[i]]
    run({ action: 'order', kind: 'quiz', keys }, 'Reihenfolge gespeichert')
  }

  const toggle = (slug: string) => setSel(s => (s.includes(slug) ? s.filter(x => x !== slug) : [...s, slug]))
  const allSel = rows.length > 0 && rows.every(e => sel.includes(e.slug))
  const built = sel.filter(s => isBuilt(CATALOG.find(e => e.slug === s)))

  const editing = edit ? CATALOG.find(e => e.slug === edit) : null

  return (
    <div>
      <div className="ga-adm-filters">
        <input className="ga-input" placeholder="Suchen: Titel, Land, Thema …" value={q} onChange={e => setQ(e.target.value)} />
        <select className="ga-input" value={bereich} onChange={e => setBereich(e.target.value)}>
          <option value="alle">Alle Bereiche</option>
          {BEREICHE.map(b => <option key={b.key} value={b.key}>{b.name}</option>)}
        </select>
        <select className="ga-input" value={filter} onChange={e => setFilter(e.target.value as Filter)}>
          <option value="alle">Jeder Status</option>
          <option value="offen">Offen</option>
          <option value="geplant">Geplant</option>
          <option value="gesperrt">Gesperrt</option>
          <option value="unsichtbar">Unsichtbar / nur Rollen</option>
          <option value="arbeit">In Arbeit (nicht gebaut)</option>
          <option value="geaendert">Im Adminpanel geändert</option>
        </select>
        <select className="ga-input" value={diffF} onChange={e => setDiffF(e.target.value)}>
          <option value="alle">Jede Schwierigkeit</option>
          {DIFFICULTIES.map(d => <option key={d} value={d}>{data.config.difficulties[d].label}</option>)}
        </select>
      </div>

      {sel.length > 0 && !ro && (
        <BulkBar count={sel.length} builtCount={built.length} busy={busy} data={data}
          onRelease={at => release(built, at)}
          onPatch={(p, msg) => patch(sel, p, msg)}
          onReset={() => run({ action: 'quizReset', slugs: sel }, 'Auf Standard zurückgesetzt')}
          onClear={() => setSel([])} />
      )}

      <p className="ga-muted" style={{ fontSize: 13, margin: '6px 0 8px' }}>
        {rows.length} Quizzes · Reihenfolge mit den Pfeilen ändern (gilt innerhalb der angezeigten Liste) · Klick auf einen Titel öffnet alle Einstellungen
      </p>

      <div className="ga-card ga-adm-table">
        <table>
          <thead>
            <tr>
              <th><input type="checkbox" checked={allSel} onChange={() => setSel(allSel ? [] : rows.map(e => e.slug))} aria-label="Alle auswählen" /></th>
              <th>Quiz</th><th>Bereich</th><th>Schwierigkeit</th><th>Status</th><th>Sichtbar</th><th />
            </tr>
          </thead>
          <tbody>
            {rows.map(e => {
              const m = metaOf(e.slug)
              const st = stateOf(e)
              const rel = data.releases[e.slug]
              const df = diffOf(e)
              return (
                <tr key={e.slug} className={sel.includes(e.slug) ? 'sel' : ''}>
                  <td><input type="checkbox" checked={sel.includes(e.slug)} onChange={() => toggle(e.slug)} aria-label={`${e.title} auswählen`} /></td>
                  <td>
                    <button className="ga-adm-link" onClick={() => setEdit(e.slug)}>{m.title ?? e.title}</button>
                    {m.title && <span className="ga-muted" style={{ fontSize: 12 }}> ({e.title})</span>}
                    {m.popular != null && <span className="ga-badge new" style={{ marginLeft: 6 }}>Beliebt #{m.popular}</span>}
                    <div className="ga-muted" style={{ fontSize: 12 }}>{e.slug} · {KIND_LABEL[e.kind]}{isBuilt(e) ? ` · ${itemCount(e)} Einträge` : ''}</div>
                  </td>
                  <td>{BEREICHE.find(b => b.key === e.bereich)?.name}{e.country ? ` · ${countryName(e.country)}` : ''}</td>
                  <td><span className="ga-badge diff" style={{ '--ga-diff': data.config.difficulties[df.d].color } as React.CSSProperties}>{data.config.difficulties[df.d].label}</span>{df.own && <span className="ga-muted" title="Im Adminpanel festgelegt"> ●</span>}</td>
                  <td>
                    <span className={`ga-adm-st ${st}`}>{({ offen: 'Offen', geplant: 'Geplant', gesperrt: 'Gesperrt', unsichtbar: 'Unsichtbar', arbeit: 'In Arbeit' } as const)[st]}</span>
                    {rel && Date.parse(rel) > now && <div className="ga-muted" style={{ fontSize: 12 }}>{fmtDate(rel)} · {countdown(rel, now)}{data.autoReleases.includes(e.slug) ? ' · Plan' : ''}</div>}
                  </td>
                  <td>{(m.visibility ?? 'all') === 'all' ? 'Alle' : m.visibility === 'admins' ? 'Admins' : (m.roles ?? []).join(', ') || '–'}</td>
                  <td className="ga-adm-move">
                    {!ro && <>
                      <button className="ga-icon-btn sm" disabled={busy} onClick={() => move(e.slug, -1)} aria-label="Nach oben">▲</button>
                      <button className="ga-icon-btn sm" disabled={busy} onClick={() => move(e.slug, 1)} aria-label="Nach unten">▼</button>
                    </>}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {editing && (
        <QuizEditor key={editing.slug} entry={editing} meta={metaOf(editing.slug)} release={data.releases[editing.slug] ?? null}
          data={data} busy={busy} ro={ro}
          onClose={() => setEdit(null)}
          onPatch={p => patch([editing.slug], p)}
          onRelease={at => release([editing.slug], at)}
          onReset={() => run({ action: 'quizReset', slugs: [editing.slug] }, 'Auf Standard zurückgesetzt')} />
      )}
    </div>
  )
}

/* ───────────── Mehrere Quizzes auf einmal ───────────── */

function BulkBar({ count, builtCount, busy, data, onRelease, onPatch, onReset, onClear }: {
  count: number; builtCount: number; busy: boolean; data: AdminData
  onRelease: (at: string | null) => void
  onPatch: (p: Record<string, unknown>, msg: string) => void
  onReset: () => void; onClear: () => void
}) {
  const [panel, setPanel] = useState<'release' | 'diff' | 'vis' | 'modes' | 'xp' | 'pop' | null>('release')
  const [vis, setVis] = useState<Visibility>('all')
  const [roles, setRoles] = useState<string[]>([])
  const [modes, setModes] = useState<Partial<Record<ModeKey, ModeRule>>>({})
  const [factor, setFactor] = useState('1')
  return (
    <div className="ga-card ga-adm-bulk">
      <div className="ga-row ga-wrap" style={{ justifyContent: 'space-between' }}>
        <b>{count} ausgewählt</b>
        <div className="ga-chips">
          {([['release', 'Freischalten'], ['diff', 'Schwierigkeit'], ['vis', 'Sichtbarkeit'], ['modes', 'Spielarten'], ['xp', 'XP'], ['pop', 'Beliebt']] as const).map(([k, l]) => (
            <button key={k} className={`ga-chip sm ${panel === k ? 'active' : ''}`} onClick={() => setPanel(k)}>{l}</button>
          ))}
          <button className="ga-chip sm" disabled={busy} onClick={() => { if (confirm(`Alle Änderungen an ${count} Quizzes verwerfen?`)) onReset() }}>Auf Standard</button>
          <button className="ga-chip sm" onClick={onClear}>Auswahl leeren</button>
        </div>
      </div>
      <div style={{ marginTop: 10 }}>
        {panel === 'release' && (builtCount ? <ReleasePicker disabled={busy} onApply={onRelease} /> : <p className="ga-muted">Nur gebaute Quizzes lassen sich freischalten.</p>)}
        {panel === 'diff' && (
          <div className="ga-chips">
            {DIFFICULTIES.map(d => <button key={d} className="ga-chip sm" disabled={busy} onClick={() => onPatch({ difficulty: d }, `Schwierigkeit: ${data.config.difficulties[d].label}`)}>{data.config.difficulties[d].label}</button>)}
            <button className="ga-chip sm" disabled={busy} onClick={() => onPatch({ difficulty: null }, 'Schwierigkeit: Standard')}>Standard</button>
          </div>
        )}
        {panel === 'vis' && (
          <div className="ga-adm-stack">
            <VisibilityPicker vis={vis} roles={roles} onChange={(v, r) => { setVis(v); setRoles(r) }} />
            <button className="ga-btn primary sm" disabled={busy} onClick={() => onPatch({ visibility: vis, roles }, 'Sichtbarkeit gespeichert')}>Übernehmen</button>
          </div>
        )}
        {panel === 'modes' && (
          <div className="ga-adm-stack">
            <div className="ga-adm-modes">
              {MODE_KEYS.map(k => (
                <label key={k}><span>{MODE_LABEL[k]}</span><RulePicker value={modes[k]} onChange={v => setModes(m => { const n = { ...m }; if (v === undefined) delete n[k]; else n[k] = v; return n })} /></label>
              ))}
            </div>
            <button className="ga-btn primary sm" disabled={busy} onClick={() => onPatch({ modes }, 'Spielarten gespeichert')}>Übernehmen</button>
          </div>
        )}
        {panel === 'pop' && (
          <div className="ga-row ga-wrap">
            <span className="ga-muted" style={{ fontSize: 13 }}>Festgelegte stehen immer vorne in „Beliebt“ (in der Reihenfolge der Auswahl), danach die meistgespielten.</span>
            <button className="ga-btn primary sm" disabled={busy} onClick={() => onPatch({ popular: 1 }, 'In „Beliebt“ festgelegt')}>In „Beliebt“ festlegen</button>
            <button className="ga-btn ghost sm" disabled={busy} onClick={() => onPatch({ popular: null }, 'Aus „Beliebt“ entfernt')}>Entfernen</button>
          </div>
        )}
        {panel === 'xp' && (
          <div className="ga-row ga-wrap">
            <label className="ga-row" style={{ gap: 8 }}>XP-Faktor <input className="ga-input" style={{ width: 90 }} type="number" step="0.1" min="0" value={factor} onChange={e => setFactor(e.target.value)} /></label>
            <button className="ga-btn primary sm" disabled={busy} onClick={() => onPatch({ xp: { factor: Number(factor) } }, 'XP-Faktor gespeichert')}>Übernehmen</button>
            <button className="ga-btn sm" disabled={busy} onClick={() => onPatch({ xp: { off: true } }, 'Keine XP mehr für diese Quizzes')}>Keine XP</button>
            <button className="ga-btn ghost sm" disabled={busy} onClick={() => onPatch({ xp: null }, 'XP: Standard')}>Standard</button>
          </div>
        )}
      </div>
    </div>
  )
}

/* ───────────── Ein Quiz bearbeiten ───────────── */

function QuizEditor({ entry, meta, release, data, busy, ro, onClose, onPatch, onRelease, onReset }: {
  entry: CatalogEntry; meta: Partial<QuizMeta>; release: string | null; data: AdminData; busy: boolean; ro: boolean
  onClose: () => void; onPatch: (p: Record<string, unknown>) => void; onRelease: (at: string | null) => void; onReset: () => void
}) {
  const [title, setTitle] = useState(meta.title ?? '')
  const [sub, setSub] = useState(meta.meta ?? '')
  const [desc, setDesc] = useState(meta.description ?? '')
  const [diff, setDiff] = useState<string>(meta.difficulty ?? '')
  const [sort, setSort] = useState(meta.sort != null ? String(meta.sort) : '')
  const [popular, setPopular] = useState(meta.popular != null ? String(meta.popular) : '')
  const [vis, setVis] = useState<Visibility>((meta.visibility as Visibility) ?? 'all')
  const [roles, setRoles] = useState<string[]>(meta.roles ?? [])
  const [modes, setModes] = useState<Partial<Record<ModeKey, ModeRule>>>(meta.modes ?? {})
  const [xpItem, setXpItem] = useState(meta.xp?.item != null ? String(meta.xp.item) : '')
  const [xpPerfect, setXpPerfect] = useState(meta.xp?.perfect != null ? String(meta.xp.perfect) : '')
  const [xpFactor, setXpFactor] = useState(meta.xp?.factor != null ? String(meta.xp.factor) : '')
  const [xpOff, setXpOff] = useState(!!meta.xp?.off)
  const def = defaultDifficulty(entry, isBuilt(entry) ? itemCount(entry) : 0)

  const save = () => {
    const xp: Record<string, unknown> = {}
    if (xpItem !== '') xp.item = Number(xpItem)
    if (xpPerfect !== '') xp.perfect = Number(xpPerfect)
    if (xpFactor !== '') xp.factor = Number(xpFactor)
    if (xpOff) xp.off = true
    onPatch({
      title: title || null, meta: sub || null, description: desc || null,
      difficulty: diff || null, sort: sort === '' ? null : Math.round(Number(sort)),
      popular: popular === '' ? null : Math.max(1, Math.round(Number(popular))),
      visibility: vis, roles, modes, xp,
    })
  }

  return (
    <div className="ga-modal-bg" role="dialog" aria-modal="true" onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="ga-modal ga-card ga-adm-editor">
        <div className="ga-row" style={{ justifyContent: 'space-between' }}>
          <div>
            <p className="ga-eyebrow">{entry.slug} · {KIND_LABEL[entry.kind]}</p>
            <h2 className="ga-h2" style={{ margin: '2px 0 0' }}>{meta.title ?? entry.title}</h2>
          </div>
          <button className="ga-icon-btn" onClick={onClose} aria-label="Schließen"><Icon name="x" size={16} /></button>
        </div>

        <div className="ga-adm-grid">
          <label>Titel<input className="ga-input" value={title} placeholder={entry.title} onChange={e => setTitle(e.target.value)} disabled={ro} /></label>
          <label>Kurzzeile<input className="ga-input" value={sub} placeholder={entry.meta} onChange={e => setSub(e.target.value)} disabled={ro} /></label>
          <label className="full">Beschreibung<textarea className="ga-input" rows={3} value={desc} placeholder={entry.text ?? ''} onChange={e => setDesc(e.target.value)} disabled={ro} /></label>
          <label>Schwierigkeit
            <select className="ga-input" value={diff} onChange={e => setDiff(e.target.value)} disabled={ro}>
              <option value="">Standard ({data.config.difficulties[def].label})</option>
              {DIFFICULTIES.map(d => <option key={d} value={d}>{data.config.difficulties[d].label} (×{data.config.difficulties[d].factor})</option>)}
            </select>
          </label>
          <label>Sortierung (kleiner = weiter vorne)<input className="ga-input" type="number" value={sort} placeholder="automatisch" onChange={e => setSort(e.target.value)} disabled={ro} /></label>
          <label>Platz in „Beliebt“ (leer = nur wenn viel gespielt)<input className="ga-input" type="number" min={1} value={popular} placeholder="automatisch" onChange={e => setPopular(e.target.value)} disabled={ro} /></label>
          <div className="full"><span className="ga-adm-label">Sichtbarkeit</span><VisibilityPicker vis={vis} roles={roles} onChange={(v, r) => { setVis(v); setRoles(r) }} disabled={ro} /></div>
          <div className="full">
            <span className="ga-adm-label">Spielarten (Standard = Einstellung unter „XP & Level“)</span>
            <div className="ga-adm-modes">
              {MODE_KEYS.map(k => (
                <label key={k}><span>{MODE_LABEL[k]}</span><RulePicker disabled={ro} value={modes[k]} onChange={v => setModes(m => { const n = { ...m }; if (v === undefined) delete n[k]; else n[k] = v; return n })} /></label>
              ))}
            </div>
          </div>
          <div className="full">
            <span className="ga-adm-label">XP (leer = Standard)</span>
            <div className="ga-row ga-wrap">
              <label className="ga-row" style={{ gap: 6 }}>pro Eintrag <input className="ga-input" style={{ width: 80 }} type="number" min={0} value={xpItem} placeholder={String(data.config.xp.item)} onChange={e => setXpItem(e.target.value)} disabled={ro} /></label>
              <label className="ga-row" style={{ gap: 6 }}>fehlerfrei <input className="ga-input" style={{ width: 80 }} type="number" min={0} value={xpPerfect} placeholder={String(data.config.xp.perfect)} onChange={e => setXpPerfect(e.target.value)} disabled={ro} /></label>
              <label className="ga-row" style={{ gap: 6 }}>Faktor <input className="ga-input" style={{ width: 80 }} type="number" step="0.1" min={0} value={xpFactor} placeholder="1" onChange={e => setXpFactor(e.target.value)} disabled={ro} /></label>
              <label className="ga-row" style={{ gap: 6 }}><input type="checkbox" checked={xpOff} onChange={e => setXpOff(e.target.checked)} disabled={ro} /> keine XP</label>
            </div>
          </div>
        </div>
        {!ro && (
          <div className="ga-row ga-wrap" style={{ marginTop: 14 }}>
            <button className="ga-btn primary" disabled={busy} onClick={save}><Icon name="check" size={15} /> Speichern</button>
            <button className="ga-btn ghost" disabled={busy} onClick={() => { if (confirm('Alle Änderungen an diesem Quiz verwerfen?')) onReset() }}>Auf Standard zurücksetzen</button>
          </div>
        )}

        {!entry.planned && !ro && (
          <div style={{ marginTop: 18 }}>
            <span className="ga-adm-label">Freischaltung</span>
            <ReleasePicker disabled={busy} current={release} onApply={onRelease} />
          </div>
        )}
      </div>
    </div>
  )
}