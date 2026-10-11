'use client'

// /admin2/geo – Freischaltungen für seekclan.de/geo
// Jedes Quiz ist gesperrt ("Bald verfügbar"), bis es hier freigeschaltet wird – sofort oder zu einem Datum.
// Geplante Freischaltungen sehen Besucher als "Ab <Datum>". Admins sehen in /geo immer alles (außer im Vorschau-Modus).

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '../../lib/auth-context'
import { hasWriteAccess } from '../layout'
import { CATALOG, countryName, KIND_LABEL } from '../../geo/_lib/catalog'
import { BEREICHE } from '../../geo/_content/welt'
import type { Bereich, CatalogEntry } from '../../geo/_lib/types'

type Rel = { slug: string; release_at: string; updated_at: string; updated_by_name: string | null }
type Filter = 'alle' | 'offen' | 'geplant' | 'gesperrt' | 'arbeit'

const ACCENT = '#0f5e6e'
const inputStyle = { background: 'var(--muted-bg)', border: '1px solid var(--card-border)', color: 'var(--foreground)' }
const smallBtn = { background: 'var(--background)', border: '1px solid var(--card-border)', color: 'var(--foreground)' }

const toLocal = (d: Date) => {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}
const fmt = (iso: string) => new Date(iso).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })

export default function Admin2GeoPage() {
  const { user } = useAuth()
  const pathname = usePathname()
  const canWrite = hasWriteAccess(user?.clan_role, pathname)

  const [rels, setRels] = useState<Record<string, Rel>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [reload, setReload] = useState(0)
  const [sel, setSel] = useState<string[]>([])
  const [bereich, setBereich] = useState<Bereich | 'alle'>('alle')
  const [filter, setFilter] = useState<Filter>('alle')
  const [q, setQ] = useState('')
  const [when, setWhen] = useState(() => { const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(18, 0, 0, 0); return toLocal(d) })
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 30000); return () => clearInterval(t) }, [])

  useEffect(() => {
    if (!user) return
    let alive = true
    fetch('/api/admin2/geo', { cache: 'no-store' })
      .then(async r => {
        const d = await r.json().catch(() => ({}))
        if (!alive) return
        if (!r.ok) setError(d.error || 'Fehler beim Laden')
        else {
          setRels(Object.fromEntries((d.releases as Rel[]).map(x => [x.slug, x])))
          setError('')
        }
      })
      .catch(() => { if (alive) setError('Fehler beim Laden') })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [user, reload])

  const stateOf = (e: CatalogEntry): Exclude<Filter, 'alle'> => {
    if (e.planned) return 'arbeit'
    const r = rels[e.slug]
    if (!r) return 'gesperrt'
    return new Date(r.release_at).getTime() <= now ? 'offen' : 'geplant'
  }

  const rows = useMemo(() => {
    const n = q.trim().toLowerCase()
    return CATALOG.filter(e =>
      (bereich === 'alle' || e.bereich === bereich) &&
      (filter === 'alle' || stateOf(e) === filter) &&
      (!n || `${e.title} ${e.slug} ${countryName(e.country)}`.toLowerCase().includes(n)),
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bereich, filter, q, rels, now])

  const counts = useMemo(() => {
    const c = { offen: 0, geplant: 0, gesperrt: 0, arbeit: 0 }
    for (const e of CATALOG) c[stateOf(e)]++
    return c
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rels, now])

  const send = async (method: 'PUT' | 'DELETE', slugs: string[], releaseAt?: string) => {
    const buildable = slugs.filter(s => !CATALOG.find(e => e.slug === s)?.planned)
    if (!buildable.length) return
    if (method === 'DELETE' && !confirm(`${buildable.length === 1 ? 'Dieses Quiz' : `${buildable.length} Quizzes`} wieder sperren? Besucher sehen dann „Bald verfügbar“.`)) return
    setBusy(true); setError('')
    const r = await fetch('/api/admin2/geo', {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slugs: buildable, ...(releaseAt ? { release_at: releaseAt } : {}) }),
    })
    const d = await r.json().catch(() => ({}))
    setBusy(false)
    if (!r.ok) { setError(d.error || `Fehler ${r.status}`); return }
    setSel([])
    setReload(n => n + 1)
  }
  const releaseNow = (slugs: string[]) => send('PUT', slugs, new Date().toISOString())
  const schedule = (slugs: string[]) => {
    if (!when) return
    send('PUT', slugs, new Date(when).toISOString())
  }

  const toggle = (slug: string) => setSel(s => (s.includes(slug) ? s.filter(x => x !== slug) : [...s, slug]))
  const selectable = rows.filter(e => !e.planned).map(e => e.slug)
  const allSelected = selectable.length > 0 && selectable.every(s => sel.includes(s))

  const BADGE: Record<Exclude<Filter, 'alle'>, { label: string; color: string }> = {
    offen: { label: 'Offen', color: '#22c55e' },
    geplant: { label: 'Geplant', color: '#eab308' },
    gesperrt: { label: 'Bald verfügbar', color: '#6b7280' },
    arbeit: { label: 'In Arbeit', color: '#a855f7' },
  }

  return (
    <div className="max-w-5xl w-full">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-1" style={{ color: 'var(--foreground)' }}>🌍 Geo – Freischaltungen</h1>
        <p style={{ color: 'var(--muted)' }}>
          Lege fest, wann ein Quiz auf <Link href="/geo" className="underline">seekclan.de/geo</Link> für alle offen ist.
          Ohne Freischaltung sehen Besucher „Bald verfügbar“, bei geplantem Datum „Ab …“.
          Admins sehen in /geo immer alles – mit dem Auge-Symbol oben rechts in /geo siehst du die Seite wie ein normaler Besucher.
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        {(['offen', 'geplant', 'gesperrt', 'arbeit'] as const).map(k => (
          <button key={k} onClick={() => setFilter(filter === k ? 'alle' : k)} className="rounded-xl p-3 text-left"
            style={{ background: 'var(--card)', border: `1px solid ${filter === k ? BADGE[k].color : 'var(--card-border)'}` }}>
            <p className="text-2xl font-bold" style={{ color: BADGE[k].color }}>{counts[k]}</p>
            <p className="text-xs" style={{ color: 'var(--muted)' }}>{BADGE[k].label}</p>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 mb-3">
        {(['alle', ...BEREICHE.map(b => b.key)] as const).map(b => (
          <button key={b} onClick={() => setBereich(b as Bereich | 'alle')} className="px-3 py-1.5 rounded-full text-xs font-medium"
            style={bereich === b ? { background: ACCENT, color: '#fff', border: `1px solid ${ACCENT}` } : smallBtn}>
            {b === 'alle' ? 'Alle Bereiche' : BEREICHE.find(x => x.key === b)!.name}
          </button>
        ))}
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Suchen …" className="px-3 py-1.5 rounded-full text-xs ml-auto" style={{ ...inputStyle, minWidth: 180 }} />
      </div>

      {canWrite && (
        <div className="rounded-xl p-3 mb-4 flex flex-wrap items-center gap-2 sticky z-10" style={{ top: 72, background: 'var(--card)', border: `1px solid ${ACCENT}55` }}>
          <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--foreground)' }}>
            <input type="checkbox" checked={allSelected} onChange={() => setSel(allSelected ? [] : selectable)} />
            {sel.length ? `${sel.length} ausgewählt` : 'Alle sichtbaren auswählen'}
          </label>
          <span className="flex-1" />
          <input type="datetime-local" value={when} onChange={e => setWhen(e.target.value)} className="px-3 py-1.5 rounded-lg text-sm" style={inputStyle} />
          <button disabled={busy || !sel.length || !when} onClick={() => schedule(sel)} className="px-3 py-1.5 rounded-lg text-sm disabled:opacity-40" style={smallBtn}>Zum Datum planen</button>
          <button disabled={busy || !sel.length} onClick={() => releaseNow(sel)} className="px-3 py-1.5 rounded-lg text-sm font-medium text-white disabled:opacity-40" style={{ background: ACCENT }}>Jetzt freischalten</button>
          <button disabled={busy || !sel.length} onClick={() => send('DELETE', sel)} className="px-3 py-1.5 rounded-lg text-sm disabled:opacity-40" style={{ ...smallBtn, color: '#EF4444' }}>Sperren</button>
        </div>
      )}

      {error && <p className="text-sm mb-3" style={{ color: '#EF4444' }}>{error}</p>}
      {loading ? <p style={{ color: 'var(--muted)' }}>Laden …</p> : (
        <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--card-border)' }}>
          {rows.length === 0 && <p className="p-4 text-sm" style={{ color: 'var(--muted)' }}>Nichts gefunden.</p>}
          {rows.map((e, i) => {
            const st = stateOf(e)
            const r = rels[e.slug]
            return (
              <div key={e.slug} className="flex flex-wrap items-center gap-3 px-4 py-3"
                style={{ background: 'var(--card)', borderTop: i ? '1px solid var(--card-border)' : 'none', opacity: e.planned ? 0.65 : 1 }}>
                {canWrite && <input type="checkbox" disabled={!!e.planned} checked={sel.includes(e.slug)} onChange={() => toggle(e.slug)} />}
                <div className="flex-1 min-w-[220px]">
                  <p className="font-medium text-sm" style={{ color: 'var(--foreground)' }}>{e.title}</p>
                  <p className="text-xs" style={{ color: 'var(--muted)' }}>
                    {BEREICHE.find(b => b.key === e.bereich)?.name}{e.country ? ` · ${countryName(e.country)}` : ''} · {KIND_LABEL[e.kind]} · {e.planned ? 'noch nicht gebaut' : `${e.items.length} Einträge`} · <span className="font-mono">{e.slug}</span>
                  </p>
                </div>
                <span className="text-xs px-2 py-1 rounded-full font-medium" style={{ background: `${BADGE[st].color}22`, color: BADGE[st].color }}>
                  {st === 'offen' ? `Offen seit ${fmt(r.release_at)}` : st === 'geplant' ? `Ab ${fmt(r.release_at)}` : BADGE[st].label}
                </span>
                <div className="flex gap-1.5">
                  {!e.planned && <Link href={`/geo/quiz/${e.slug}`} target="_blank" className="px-2.5 py-1 rounded-lg text-xs" style={smallBtn}>Ansehen</Link>}
                  {canWrite && !e.planned && st !== 'offen' && (
                    <button disabled={busy} onClick={() => releaseNow([e.slug])} className="px-2.5 py-1 rounded-lg text-xs text-white" style={{ background: ACCENT }}>Jetzt</button>
                  )}
                  {canWrite && !e.planned && st !== 'gesperrt' && (
                    <button disabled={busy} onClick={() => send('DELETE', [e.slug])} className="px-2.5 py-1 rounded-lg text-xs" style={{ ...smallBtn, color: '#EF4444' }}>Sperren</button>
                  )}
                </div>
                {r?.updated_by_name && <p className="w-full text-[11px]" style={{ color: 'var(--muted)', paddingLeft: canWrite ? 28 : 0 }}>zuletzt geändert von {r.updated_by_name} am {fmt(r.updated_at)}</p>}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
