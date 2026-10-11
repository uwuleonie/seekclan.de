'use client'

// Geo-Admin → Bereiche & Kategorien: Kontinente, Abschnitte (z.B. "Natur" auf der Europa-Seite) und Länder
// umbenennen, sortieren, zeitgesteuert freischalten und sichtbar machen.
// Eine Freischaltung hier gilt ZUSÄTZLICH zur Freischaltung der einzelnen Quizzes: es zählt der spätere Zeitpunkt.

import { useMemo, useState } from 'react'
import Icon from '../../_components/Icon'
import { CATALOG, belongsTo, bySort, countryName, type GroupMeta } from '../../_lib/catalog'
import { normalize } from '../../_lib/text'
import { BEREICHE } from '../../_content/welt'
import { adminPost, countdown, fmtDate, ReleasePicker, VisibilityPicker, type AdminData, type Visibility } from './shared'

type Kind = GroupMeta['kind']
type Row = { kind: Kind; key: string; name: string; count: number }

export default function AdminGroups({ data, reload, flash }: { data: AdminData; reload: () => void; flash: (msg: string, bad?: boolean) => void }) {
  const [kind, setKind] = useState<Kind>('bereich')
  const [bereich, setBereich] = useState('europa')
  const [q, setQ] = useState('')
  const [open, setOpen] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const now = Date.parse(data.now)
  const ro = !data.canWrite

  const gm = (k: Kind, key: string) => data.groupMeta.find(g => g.kind === k && g.key === key)

  const rows: Row[] = useMemo(() => {
    let list: Row[] = []
    if (kind === 'bereich') list = BEREICHE.map(b => ({ kind, key: b.key, name: b.name, count: CATALOG.filter(e => belongsTo(e, b.key)).length }))
    else if (kind === 'section') {
      const m = new Map<string, Row>()
      for (const e of CATALOG) {
        if (e.country || e.bereich !== bereich) continue
        const key = `${e.bereich}/${e.section ?? ''}`
        const r = m.get(key) ?? { kind, key, name: e.section ?? `Ganz ${BEREICHE.find(b => b.key === bereich)?.name}`, count: 0 }
        r.count++
        m.set(key, r)
      }
      list = [...m.values()]
    } else {
      const m = new Map<string, Row>()
      for (const e of CATALOG) {
        if (!e.country || !belongsTo(e, bereich as never)) continue
        const r = m.get(e.country) ?? { kind, key: e.country, name: countryName(e.country), count: 0 }
        r.count++
        m.set(e.country, r)
      }
      list = [...m.values()].sort((a, b) => a.name.localeCompare(b.name, 'de'))
    }
    const n = normalize(q)
    if (n) list = list.filter(r => normalize(`${r.name} ${r.key} ${gm(r.kind, r.key)?.title ?? ''}`).includes(n))
    return bySort(list, r => gm(r.kind, r.key)?.sort ?? null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, bereich, q, data])

  const run = async (body: Record<string, unknown>, msg: string) => {
    setBusy(true)
    try { await adminPost(body); flash(msg); reload() } catch (e) { flash(e instanceof Error ? e.message : 'Fehler', true) } finally { setBusy(false) }
  }
  const move = (key: string, dir: -1 | 1) => {
    const keys = rows.map(r => r.key)
    const i = keys.indexOf(key), j = i + dir
    if (j < 0 || j >= keys.length) return
    ;[keys[i], keys[j]] = [keys[j], keys[i]]
    run({ action: 'order', kind, keys }, 'Reihenfolge gespeichert')
  }

  return (
    <div>
      <div className="ga-adm-filters">
        <div className="ga-seg">
          {([['bereich', 'Bereiche'], ['section', 'Abschnitte'], ['country', 'Länder']] as [Kind, string][]).map(([k, l]) => (
            <button key={k} className={kind === k ? 'active' : ''} onClick={() => { setKind(k); setOpen(null) }}>{l}</button>
          ))}
        </div>
        {kind !== 'bereich' && (
          <select className="ga-input" value={bereich} onChange={e => setBereich(e.target.value)}>
            {BEREICHE.map(b => <option key={b.key} value={b.key}>{b.name}</option>)}
          </select>
        )}
        {kind === 'country' && <input className="ga-input" placeholder="Land suchen …" value={q} onChange={e => setQ(e.target.value)} />}
      </div>
      <p className="ga-muted" style={{ fontSize: 13, margin: '6px 0 8px' }}>
        Eine Freischaltung hier gilt für alle Quizzes darin zusätzlich – es zählt immer der spätere Zeitpunkt. „Nur Admins“ blendet alles darin für Besucher aus.
      </p>

      <div className="ga-card ga-adm-table">
        <table>
          <thead><tr><th>Name</th><th>Quizzes</th><th>Freischaltung</th><th>Sichtbar</th><th /></tr></thead>
          <tbody>
            {rows.map(r => {
              const m = gm(r.kind, r.key)
              return (
                <tr key={r.key}>
                  <td>
                    <button className="ga-adm-link" onClick={() => setOpen(open === r.key ? null : r.key)}>{m?.title ?? r.name}</button>
                    {m?.title && <span className="ga-muted" style={{ fontSize: 12 }}> ({r.name})</span>}
                  </td>
                  <td>{r.count}</td>
                  <td>{m?.release_at ? <>{fmtDate(m.release_at)}{Date.parse(m.release_at) > now && <span className="ga-muted"> · {countdown(m.release_at, now)}</span>}</> : <span className="ga-muted">wie die Quizzes</span>}</td>
                  <td>{(m?.visibility ?? 'all') === 'all' ? 'Alle' : m!.visibility === 'admins' ? 'Admins' : m!.roles.join(', ')}</td>
                  <td className="ga-adm-move">
                    {!ro && <>
                      <button className="ga-icon-btn sm" disabled={busy} onClick={() => move(r.key, -1)} aria-label="Nach oben">▲</button>
                      <button className="ga-icon-btn sm" disabled={busy} onClick={() => move(r.key, 1)} aria-label="Nach unten">▼</button>
                    </>}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {open && (() => {
        const r = rows.find(x => x.key === open)
        if (!r) return null
        return <GroupEditor key={`${r.kind}:${r.key}`} row={r} meta={gm(r.kind, r.key)} busy={busy} ro={ro} onClose={() => setOpen(null)}
          onSave={(patch, release) => run({ action: 'group', kind: r.kind, key: r.key, patch, ...(release !== undefined ? { release: { at: release } } : {}) }, 'Gespeichert')} />
      })()}
    </div>
  )
}

function GroupEditor({ row, meta, busy, ro, onClose, onSave }: {
  row: Row; meta: GroupMeta | undefined; busy: boolean; ro: boolean
  onClose: () => void; onSave: (patch: Record<string, unknown>, release?: string | null) => void
}) {
  const [title, setTitle] = useState(meta?.title ?? '')
  const [desc, setDesc] = useState(meta?.description ?? '')
  const [vis, setVis] = useState<Visibility>((meta?.visibility as Visibility) ?? 'all')
  const [roles, setRoles] = useState<string[]>(meta?.roles ?? [])
  return (
    <div className="ga-modal-bg" role="dialog" aria-modal="true" onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="ga-modal ga-card ga-adm-editor">
        <div className="ga-row" style={{ justifyContent: 'space-between' }}>
          <div>
            <p className="ga-eyebrow">{({ bereich: 'Bereich', section: 'Abschnitt', country: 'Land' } as const)[row.kind]} · {row.count} Quizzes</p>
            <h2 className="ga-h2" style={{ margin: '2px 0 0' }}>{meta?.title ?? row.name}</h2>
          </div>
          <button className="ga-icon-btn" onClick={onClose} aria-label="Schließen"><Icon name="x" size={16} /></button>
        </div>
        <div className="ga-adm-grid">
          <label>Name<input className="ga-input" value={title} placeholder={row.name} onChange={e => setTitle(e.target.value)} disabled={ro} /></label>
          <label className="full">Beschreibung<textarea className="ga-input" rows={2} value={desc} onChange={e => setDesc(e.target.value)} disabled={ro} /></label>
          <div className="full"><span className="ga-adm-label">Sichtbarkeit</span><VisibilityPicker vis={vis} roles={roles} onChange={(v, r) => { setVis(v); setRoles(r) }} disabled={ro} /></div>
        </div>
        {!ro && (
          <>
            <button className="ga-btn primary" style={{ marginTop: 12 }} disabled={busy}
              onClick={() => onSave({ title: title || null, description: desc || null, visibility: vis, roles })}>
              <Icon name="check" size={15} /> Speichern
            </button>
            <div style={{ marginTop: 18 }}>
              <span className="ga-adm-label">Freischaltung für alles darin</span>
              <ReleasePicker disabled={busy} current={meta?.release_at ?? null} onApply={at => onSave({}, at)} />
              <p className="ga-muted" style={{ fontSize: 12.5, marginTop: 6 }}>„Sperren“ entfernt nur den Zeitpunkt hier – dann gelten wieder die Freischaltungen der einzelnen Quizzes.</p>
            </div>
          </>
        )}
      </div>
    </div>
  )
}