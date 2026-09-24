'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  BdoCategory, BdoEdition, BdoNominee, BdoResult, BdoStat, BdoKind,
  categoryLabel, parseImport, scoringOf,
} from '@/app/lib/ballondor'
import { B, glass, goldText, Portrait } from './BdoUi'

type AdminData = {
  editions: BdoEdition[]
  edition: BdoEdition | null
  categories: BdoCategory[]
  nominees: BdoNominee[]
  results: BdoResult[]
  tips: { category_id: number; pick_nominee_id: number | null; ranking: number[] | null; updated_at: string; username: string | null; gast_name: string | null }[]
}

type Tab = 'ausgabe' | 'import' | 'kategorien' | 'nominierte' | 'ergebnisse' | 'tipps'

const input: React.CSSProperties = {
  background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(212,175,106,0.25)', borderRadius: 9, padding: '8px 10px',
  color: B.text, fontSize: 13, outline: 'none', fontFamily: B.sans, width: '100%', boxSizing: 'border-box',
}
const btn = (primary = false): React.CSSProperties => ({
  padding: '8px 14px', borderRadius: 9, cursor: 'pointer', fontSize: 12, fontWeight: 600, fontFamily: B.sans,
  border: primary ? 'none' : '1px solid rgba(212,175,106,0.3)',
  background: primary ? 'linear-gradient(135deg,#f3d9a0,#d4af6a 55%,#b08a44)' : 'transparent',
  color: primary ? '#1a1206' : B.goldL,
})
const label: React.CSSProperties = { fontSize: 10, color: B.muted, textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 4px' }

// ISO ↔ datetime-local
const toLocal = (iso: string | null) => {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}
const fromLocal = (v: string) => (v ? new Date(v).toISOString() : null)

// Bild verkleinern → Data-URL (max. 600×750, JPEG)
function resizeImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const img = new Image()
      img.onload = () => {
        const maxW = 600, maxH = 750
        const s = Math.min(1, maxW / img.width, maxH / img.height)
        const canvas = document.createElement('canvas')
        canvas.width = Math.round(img.width * s)
        canvas.height = Math.round(img.height * s)
        const ctx = canvas.getContext('2d')
        if (!ctx) return reject(new Error('Canvas nicht verfügbar'))
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        resolve(canvas.toDataURL('image/jpeg', 0.86))
      }
      img.onerror = () => reject(new Error('Bild konnte nicht gelesen werden'))
      img.src = reader.result as string
    }
    reader.onerror = () => reject(new Error('Datei konnte nicht gelesen werden'))
    reader.readAsDataURL(file)
  })
}

export default function BdoAdminPanel({ editionSlug, onClose }: { editionSlug: string | null; onClose: () => void }) {
  const [slug, setSlug] = useState<string | null>(editionSlug)
  const [data, setData] = useState<AdminData | null>(null)
  const [tab, setTab] = useState<Tab>('ausgabe')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  const load = useCallback(async (s: string | null = slug) => {
    const res = await fetch(`/api/ballondor/admin${s ? `?edition=${encodeURIComponent(s)}` : ''}`)
    const d = await res.json()
    if (!res.ok) { setMsg({ type: 'err', text: d.error || 'Fehler' }); return }
    setData(d)
    if (d.edition && !s) setSlug(d.edition.slug)
  }, [slug])

  useEffect(() => { load() }, [load])

  const act = async (body: any, okText = 'Gespeichert') => {
    setBusy(true); setMsg(null)
    try {
      const res = await fetch('/api/ballondor/admin', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const d = await res.json()
      if (!res.ok) { setMsg({ type: 'err', text: d.error || 'Fehler' }); setBusy(false); return null }
      setMsg({ type: 'ok', text: okText })
      setTimeout(() => setMsg(null), 3000)
      await load()
      setBusy(false)
      return d
    } catch (e: any) {
      setMsg({ type: 'err', text: e.message ?? 'Netzwerkfehler' })
      setBusy(false)
      return null
    }
  }

  const ed = data?.edition ?? null
  const nomineeMap = useMemo(() => new Map((data?.nominees ?? []).map(n => [n.id, n])), [data])

  const TABS: [Tab, string][] = [
    ['ausgabe', 'Ausgabe'], ['import', 'Import'], ['kategorien', 'Kategorien'],
    ['nominierte', 'Nominierte'], ['ergebnisse', 'Ergebnisse'], ['tipps', `Tipps${data ? ` (${data.tips.length})` : ''}`],
  ]

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 9700, background: 'rgba(3,2,5,0.82)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'stretch', justifyContent: 'center', padding: 14 }}>
      <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 1100, background: '#0a0806', border: '1px solid rgba(212,175,106,0.25)', borderRadius: 18, display: 'flex', flexDirection: 'column', overflow: 'hidden', color: B.text, fontFamily: B.sans }}>
        {/* Kopf */}
        <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(212,175,106,0.15)', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span style={{ fontFamily: B.serif, fontSize: 24, fontWeight: 600, ...goldText }}>Ballon d&apos;Or · Admin</span>
          <select value={slug ?? ''} onChange={e => { setSlug(e.target.value); load(e.target.value) }} style={{ ...input, width: 'auto' }}>
            {(data?.editions ?? []).map(e => <option key={e.id} value={e.slug} style={{ background: '#111' }}>{e.title}{e.is_active ? ' (aktiv)' : ''}</option>)}
          </select>
          <span style={{ flex: 1 }} />
          {msg && <span style={{ fontSize: 12, fontWeight: 600, color: msg.type === 'ok' ? B.green : B.red }}>{msg.type === 'ok' ? '✓ ' : '⚠ '}{msg.text}</span>}
          <button onClick={onClose} style={{ ...btn(), fontSize: 16, padding: '4px 12px' }}>×</button>
        </div>
        <div style={{ display: 'flex', gap: 4, padding: '10px 18px', borderBottom: '1px solid rgba(212,175,106,0.12)', overflowX: 'auto' }}>
          {TABS.map(([k, l]) => (
            <button key={k} onClick={() => setTab(k)}
              style={{ padding: '7px 14px', borderRadius: 9, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap',
                background: tab === k ? 'rgba(212,175,106,0.2)' : 'transparent', color: tab === k ? B.goldL : B.muted }}>{l}</button>
          ))}
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 18 }}>
          {!data && <p style={{ color: B.muted }}>Lade…</p>}
          {data && tab === 'ausgabe' && <EditionTab data={data} busy={busy} act={act} onCreated={s => { setSlug(s); load(s) }} />}
          {data && tab === 'import' && (ed ? <ImportTab edition={ed} busy={busy} act={act} /> : <NoEdition />)}
          {data && tab === 'kategorien' && (ed ? <CategoriesTab data={data} nomineeMap={nomineeMap} busy={busy} act={act} /> : <NoEdition />)}
          {data && tab === 'nominierte' && (ed ? <NomineesTab data={data} busy={busy} act={act} /> : <NoEdition />)}
          {data && tab === 'ergebnisse' && (ed ? <ResultsTab data={data} nomineeMap={nomineeMap} busy={busy} act={act} /> : <NoEdition />)}
          {data && tab === 'tipps' && (ed ? <TipsTab data={data} nomineeMap={nomineeMap} /> : <NoEdition />)}
        </div>
      </div>
    </div>
  )
}

function NoEdition() {
  return <p style={{ color: B.muted, fontSize: 13 }}>Lege zuerst im Tab „Ausgabe" eine Ausgabe an.</p>
}

type ActFn = (body: any, okText?: string) => Promise<any>

// ── Ausgabe ───────────────────────────────────────────────────────────────────
function EditionTab({ data, busy, act, onCreated }: { data: AdminData; busy: boolean; act: ActFn; onCreated: (slug: string) => void }) {
  const ed = data.edition
  const [title, setTitle] = useState(ed?.title ?? '')
  const [ceremony, setCeremony] = useState(toLocal(ed?.ceremony_at ?? null))
  const [close, setClose] = useState(toLocal(ed?.tips_close_at ?? null))
  const [newSlug, setNewSlug] = useState('')
  useEffect(() => { setTitle(ed?.title ?? ''); setCeremony(toLocal(ed?.ceremony_at ?? null)); setClose(toLocal(ed?.tips_close_at ?? null)) }, [ed?.id])

  return (
    <div style={{ display: 'grid', gap: 18, maxWidth: 640 }}>
      {ed && (
        <div style={{ ...glass(), padding: 16, display: 'grid', gap: 12 }}>
          <p style={{ margin: 0, fontFamily: B.serif, fontSize: 22, ...goldText }}>Ausgabe {ed.slug}</p>
          <div><p style={label}>Titel</p><input style={input} value={title} onChange={e => setTitle(e.target.value)} /></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div><p style={label}>Verleihung</p><input type="datetime-local" style={input} value={ceremony} onChange={e => setCeremony(e.target.value)} /></div>
            <div><p style={label}>Tippschluss</p><input type="datetime-local" style={input} value={close} onChange={e => setClose(e.target.value)} /></div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button style={btn(true)} disabled={busy} onClick={() => act({ action: 'update_edition', id: ed.id, title, ceremony_at: fromLocal(ceremony), tips_close_at: fromLocal(close) })}>Speichern</button>
            {!ed.is_active
              ? <button style={btn()} disabled={busy} onClick={() => act({ action: 'update_edition', id: ed.id, title, ceremony_at: fromLocal(ceremony), tips_close_at: fromLocal(close), is_active: true }, 'Als aktive Ausgabe gesetzt')}>Als aktiv setzen</button>
              : <span style={{ fontSize: 12, color: B.green, alignSelf: 'center' }}>✓ Aktive Ausgabe (wird unter /ballondor angezeigt)</span>}
          </div>
        </div>
      )}
      <div style={{ ...glass(), padding: 16, display: 'grid', gap: 10 }}>
        <p style={{ margin: 0, fontFamily: B.serif, fontSize: 20, ...goldText }}>Neue Ausgabe anlegen</p>
        <p style={{ margin: 0, fontSize: 12, color: B.muted }}>z.B. „2027". Danach Nominierte über den Import-Tab einfügen.</p>
        <div style={{ display: 'flex', gap: 8 }}>
          <input style={input} placeholder="Jahr / Kürzel" value={newSlug} onChange={e => setNewSlug(e.target.value.replace(/[^a-zA-Z0-9-]/g, ''))} />
          <button style={btn(true)} disabled={busy || !newSlug} onClick={async () => { const d = await act({ action: 'create_edition', slug: newSlug }, 'Ausgabe angelegt'); if (d?.edition) { onCreated(d.edition.slug); setNewSlug('') } }}>Anlegen</button>
        </div>
      </div>
    </div>
  )
}

// ── Import ────────────────────────────────────────────────────────────────────
function ImportTab({ edition, busy, act }: { edition: BdoEdition; busy: boolean; act: ActFn }) {
  const [text, setText] = useState('')
  const parsed = useMemo(() => parseImport(text), [text])
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
      <div style={{ display: 'grid', gap: 10, alignContent: 'start' }}>
        <p style={{ margin: 0, fontSize: 12, color: B.muted, lineHeight: 1.6 }}>
          Offizielle Nominiertenliste komplett einfügen. Überschriften wie <b style={{ color: B.goldL }}>„Men&apos;s Goalkeeper of the Year 2026 nominees"</b> werden zu Kategorien,
          Zeilen wie <b style={{ color: B.goldL }}>„Name (Land, Verein)"</b> zu Nominierten. Mehrfachnominierte werden zusammengeführt. Erneutes Importieren ergänzt nur Fehlendes.
        </p>
        <textarea value={text} onChange={e => setText(e.target.value)} rows={18} placeholder="Men's Ballon d'Or 2026 nominees&#10;Jude Bellingham (England, Real Madrid)&#10;…"
          style={{ ...input, fontFamily: 'ui-monospace, monospace', fontSize: 12, resize: 'vertical' }} />
        <button style={btn(true)} disabled={busy || parsed.length === 0}
          onClick={async () => { const d = await act({ action: 'import', edition_id: edition.id, text }, 'Import abgeschlossen'); if (d) setText('') }}>
          {parsed.length ? `${parsed.length} Kategorien importieren` : 'Importieren'}
        </button>
      </div>
      <div style={{ ...glass(), padding: 14, maxHeight: 520, overflowY: 'auto' }}>
        <p style={{ ...label, marginBottom: 10 }}>Vorschau</p>
        {parsed.length === 0 && <p style={{ fontSize: 12, color: B.muted }}>Noch nichts erkannt.</p>}
        {parsed.map(c => (
          <div key={c.name} style={{ marginBottom: 12 }}>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: B.goldL }}>{categoryLabel(c.name)} <span style={{ fontWeight: 400, color: B.muted }}>({c.name})</span></p>
            <p style={{ margin: '2px 0 4px', fontSize: 11, color: B.muted }}>
              {c.gender === 'm' ? 'Herren' : c.gender === 'w' ? 'Damen' : 'ohne Geschlecht'} · {c.kind === 'ranking' ? 'Rangliste' : 'Gewinner'} · {c.nominee_type} · {c.nominees.length} Nominierte
            </p>
            <p style={{ margin: 0, fontSize: 11, color: 'rgba(246,236,214,0.75)', lineHeight: 1.5 }}>{c.nominees.map(n => n.name).join(', ')}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Kategorien ────────────────────────────────────────────────────────────────
function CategoriesTab({ data, nomineeMap, busy, act }: { data: AdminData; nomineeMap: Map<number, BdoNominee>; busy: boolean; act: ActFn }) {
  const [edits, setEdits] = useState<Record<number, { name: string; kind: BdoKind; sort: number; winner: string; exact: string; diff1: string; diff2: string }>>({})
  const get = (c: BdoCategory) => {
    if (edits[c.id]) return edits[c.id]
    const s = scoringOf(c)
    return { name: c.name, kind: c.kind, sort: c.sort, winner: String(s.winner), exact: String(s.exact), diff1: String(s.diff1), diff2: String(s.diff2) }
  }
  const set = (c: BdoCategory, patch: Partial<ReturnType<typeof get>>) => setEdits(p => ({ ...p, [c.id]: { ...get(c), ...patch } }))

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <p style={{ margin: 0, fontSize: 12, color: B.muted }}>Punkte pro Kategorie frei einstellbar. Bei Ranglisten zählt „Gewinner" für den richtigen Platz 1 zusätzlich.</p>
      {data.categories.map(c => {
        const e = get(c)
        const num = (k: 'winner' | 'exact' | 'diff1' | 'diff2', l: string) => (
          <div style={{ width: 78 }}><p style={label}>{l}</p><input style={input} inputMode="numeric" value={e[k]} onChange={ev => set(c, { [k]: ev.target.value.replace(/[^0-9]/g, '') } as any)} /></div>
        )
        return (
          <div key={c.id} style={{ ...glass(), padding: 14, display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 240px' }}>
              <p style={label}>{categoryLabel(c.name)} · {c.gender === 'm' ? 'Herren' : c.gender === 'w' ? 'Damen' : '—'} · {c.nominee_ids.length} Nominierte</p>
              <input style={input} value={e.name} onChange={ev => set(c, { name: ev.target.value })} />
            </div>
            <div style={{ width: 120 }}>
              <p style={label}>Typ</p>
              <select style={input} value={e.kind} onChange={ev => set(c, { kind: ev.target.value as BdoKind })}>
                <option value="winner" style={{ background: '#111' }}>Gewinner</option>
                <option value="ranking" style={{ background: '#111' }}>Rangliste</option>
              </select>
            </div>
            <div style={{ width: 70 }}><p style={label}>Reihenf.</p><input style={input} inputMode="numeric" value={e.sort} onChange={ev => set(c, { sort: Number(ev.target.value.replace(/[^0-9]/g, '')) || 0 })} /></div>
            {num('winner', 'Gewinner')}
            {e.kind === 'ranking' && <>{num('exact', 'Exakt')}{num('diff1', '±1')}{num('diff2', '±2')}</>}
            <button style={btn(true)} disabled={busy} onClick={async () => {
              const scoring: any = { winner: Number(e.winner) || 0 }
              if (e.kind === 'ranking') Object.assign(scoring, { exact: Number(e.exact) || 0, diff1: Number(e.diff1) || 0, diff2: Number(e.diff2) || 0 })
              if (await act({ action: 'update_category', id: c.id, name: e.name, kind: e.kind, sort: e.sort, scoring })) setEdits(p => { const n = { ...p }; delete n[c.id]; return n })
            }}>Speichern</button>
            <button style={{ ...btn(), color: B.red, borderColor: 'rgba(229,115,115,0.4)' }} disabled={busy}
              onClick={() => { if (confirm(`Kategorie „${c.name}" samt Tipps und Ergebnis löschen?`)) act({ action: 'delete_category', id: c.id }, 'Kategorie gelöscht') }}>Löschen</button>
            <p style={{ flex: '1 1 100%', margin: 0, fontSize: 11, color: B.faint, lineHeight: 1.5 }}>
              {c.nominee_ids.map(id => nomineeMap.get(id)?.name).filter(Boolean).join(', ')}
            </p>
          </div>
        )
      })}
      {data.categories.length === 0 && <p style={{ color: B.muted, fontSize: 13 }}>Noch keine Kategorien — über „Import" anlegen.</p>}
    </div>
  )
}

// ── Nominierte ────────────────────────────────────────────────────────────────
function NomineesTab({ data, busy, act }: { data: AdminData; busy: boolean; act: ActFn }) {
  const [q, setQ] = useState('')
  const [selId, setSelId] = useState<number | null>(null)
  const list = data.nominees.filter(n => !q.trim() || `${n.name} ${n.club ?? ''} ${n.country ?? ''}`.toLowerCase().includes(q.toLowerCase()))
  const sel = data.nominees.find(n => n.id === selId) ?? null
  const withPhoto = data.nominees.filter(n => n.photo_url).length

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(240px, 300px) minmax(0, 1fr)', gap: 16, minHeight: 420 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minHeight: 0 }}>
        <input style={input} placeholder="Suchen…" value={q} onChange={e => setQ(e.target.value)} />
        <p style={{ margin: 0, fontSize: 11, color: B.muted }}>{data.nominees.length} Nominierte · {withPhoto} mit Foto</p>
        <div style={{ overflowY: 'auto', maxHeight: 560, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {list.map(n => (
            <button key={n.id} onClick={() => setSelId(n.id)}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 6, borderRadius: 10, cursor: 'pointer', textAlign: 'left', color: B.text,
                border: `1px solid ${selId === n.id ? B.gold : 'transparent'}`, background: selId === n.id ? 'rgba(212,175,106,0.12)' : 'rgba(255,255,255,0.02)' }}>
              <Portrait n={n} size={30} radius={6} />
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{n.name}</span>
                <span style={{ display: 'block', fontSize: 10, color: B.muted }}>{n.gender === 'm' ? 'Herren' : n.gender === 'w' ? 'Damen' : ''} · {n.nominee_type}{n.stats.length ? ` · ${n.stats.length} Stats` : ''}</span>
              </span>
              {!n.photo_url && <span title="Kein Foto" style={{ width: 6, height: 6, borderRadius: '50%', background: B.goldD }} />}
            </button>
          ))}
        </div>
      </div>
      <div>{sel ? <NomineeEditor key={sel.id} n={sel} busy={busy} act={act} /> : <p style={{ color: B.muted, fontSize: 13 }}>Nominierten auswählen, um Foto, Position, Geburtsdatum und Statistiken zu pflegen.</p>}</div>
    </div>
  )
}

function NomineeEditor({ n, busy, act }: { n: BdoNominee; busy: boolean; act: ActFn }) {
  const [f, setF] = useState({ name: n.name, country: n.country ?? '', club: n.club ?? '', photo_url: n.photo_url ?? '', position: n.position ?? '', birthdate: n.birthdate ?? '', bio: n.bio ?? '' })
  const [stats, setStats] = useState<BdoStat[]>(n.stats.length ? n.stats : [])
  const [imgErr, setImgErr] = useState<string | null>(null)
  const preview: BdoNominee = { ...n, ...f, photo_url: f.photo_url || null, stats }

  const presets = n.nominee_type === 'club'
    ? ['Titel', 'Spiele', 'Siege', 'Tore']
    : n.nominee_type === 'coach'
      ? ['Titel', 'Spiele', 'Siege', 'Siegquote']
      : ['Spiele', 'Tore', 'Vorlagen', 'Titel', 'Zu Null', 'Nominierungen']

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 190px', gap: 16 }}>
      <div style={{ display: 'grid', gap: 10, alignContent: 'start' }}>
        <div><p style={label}>Name</p><input style={input} value={f.name} onChange={e => setF({ ...f, name: e.target.value })} /></div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div><p style={label}>Land</p><input style={input} value={f.country} onChange={e => setF({ ...f, country: e.target.value })} /></div>
          <div><p style={label}>Verein</p><input style={input} value={f.club} onChange={e => setF({ ...f, club: e.target.value })} /></div>
          <div><p style={label}>Position</p><input style={input} placeholder="z.B. Stürmer" value={f.position} onChange={e => setF({ ...f, position: e.target.value })} /></div>
          <div><p style={label}>Geburtsdatum</p><input type="date" style={input} value={f.birthdate} onChange={e => setF({ ...f, birthdate: e.target.value })} /></div>
        </div>
        <div>
          <p style={label}>Foto (URL oder Datei)</p>
          <div style={{ display: 'flex', gap: 8 }}>
            <input style={input} placeholder="https://…" value={f.photo_url.startsWith('data:') ? '(hochgeladenes Bild)' : f.photo_url} onChange={e => setF({ ...f, photo_url: e.target.value })} />
            <label style={{ ...btn(), whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center' }}>
              Datei…
              <input type="file" accept="image/*" style={{ display: 'none' }} onChange={async e => {
                const file = e.target.files?.[0]; if (!file) return
                setImgErr(null)
                try { setF(p => ({ ...p, photo_url: '' })); const url = await resizeImage(file); setF(p => ({ ...p, photo_url: url })) } catch (err: any) { setImgErr(err.message) }
                e.target.value = ''
              }} />
            </label>
            {f.photo_url && <button style={btn()} onClick={() => setF({ ...f, photo_url: '' })}>Entfernen</button>}
          </div>
          {imgErr && <p style={{ margin: '4px 0 0', fontSize: 11, color: B.red }}>{imgErr}</p>}
        </div>

        <div>
          <p style={label}>Statistiken</p>
          <div style={{ display: 'grid', gap: 6 }}>
            {stats.map((s, i) => (
              <div key={i} style={{ display: 'flex', gap: 6 }}>
                <input style={input} placeholder="Bezeichnung" value={s.label} onChange={e => setStats(p => p.map((x, j) => j === i ? { ...x, label: e.target.value } : x))} />
                <input style={{ ...input, width: 110 }} placeholder="Wert" value={s.value} onChange={e => setStats(p => p.map((x, j) => j === i ? { ...x, value: e.target.value } : x))} />
                <button style={btn()} onClick={() => setStats(p => p.filter((_, j) => j !== i))}>×</button>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 6 }}>
            {presets.filter(p => !stats.some(s => s.label === p)).map(p => (
              <button key={p} style={{ ...btn(), padding: '4px 10px', fontSize: 11 }} onClick={() => setStats(s => [...s, { label: p, value: '' }])}>+ {p}</button>
            ))}
            <button style={{ ...btn(), padding: '4px 10px', fontSize: 11 }} onClick={() => setStats(s => [...s, { label: '', value: '' }])}>+ Eigene</button>
          </div>
        </div>

        <div><p style={label}>Beschreibung (optional)</p><textarea style={{ ...input, resize: 'vertical' }} rows={3} value={f.bio} onChange={e => setF({ ...f, bio: e.target.value })} /></div>

        <div><button style={btn(true)} disabled={busy} onClick={() => act({ action: 'update_nominee', id: n.id, ...f, stats })}>Speichern</button></div>
      </div>
      <div>
        <p style={label}>Vorschau</p>
        <Portrait n={preview} size="100%" />
        <p style={{ margin: '8px 0 0', fontSize: 12, fontWeight: 600, color: B.goldL }}>{f.name}</p>
        <p style={{ margin: 0, fontSize: 11, color: B.muted }}>{[f.club, f.country].filter(Boolean).join(' · ')}</p>
      </div>
    </div>
  )
}

// ── Ergebnisse ────────────────────────────────────────────────────────────────
function ResultsTab({ data, nomineeMap, busy, act }: { data: AdminData; nomineeMap: Map<number, BdoNominee>; busy: boolean; act: ActFn }) {
  const [catId, setCatId] = useState<number | null>(data.categories[0]?.id ?? null)
  const cat = data.categories.find(c => c.id === catId) ?? null
  const res = data.results.find(r => r.category_id === catId)
  const [winner, setWinner] = useState<number | null>(null)
  const [positions, setPositions] = useState<Record<number, string>>({})

  useEffect(() => {
    setWinner(res?.winner_nominee_id ?? null)
    const p: Record<number, string> = {}
    ;(res?.ranking ?? []).forEach((id, i) => { p[id] = String(i + 1) })
    setPositions(p)
  }, [catId, res?.winner_nominee_id, res?.ranking?.join(',')])

  if (!cat) return <p style={{ color: B.muted }}>Keine Kategorien.</p>
  const nominees = cat.nominee_ids.map(id => nomineeMap.get(id)).filter(Boolean) as BdoNominee[]

  // Rangliste aus Platz-Eingaben
  const rankingFromInputs = () => {
    const entries = nominees.map(n => ({ id: n.id, p: parseInt(positions[n.id] ?? '') })).filter(e => !isNaN(e.p))
    entries.sort((a, b) => a.p - b.p)
    return entries.map(e => e.id)
  }
  const dupPositions = (() => {
    const seen = new Map<string, number>()
    for (const v of Object.values(positions)) if (v) seen.set(v, (seen.get(v) ?? 0) + 1)
    return new Set([...seen].filter(([, c]) => c > 1).map(([v]) => v))
  })()

  const save = (publish: boolean) => {
    if (cat.kind === 'winner') return act({ action: 'set_result', category_id: cat.id, winner_nominee_id: winner, publish }, publish ? 'Ergebnis veröffentlicht' : 'Als Entwurf gespeichert')
    return act({ action: 'set_result', category_id: cat.id, ranking: rankingFromInputs(), publish }, publish ? 'Ergebnis veröffentlicht' : 'Als Entwurf gespeichert')
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(200px, 260px) minmax(0, 1fr)', gap: 16 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {data.categories.map(c => {
          const r = data.results.find(x => x.category_id === c.id)
          return (
            <button key={c.id} onClick={() => setCatId(c.id)}
              style={{ padding: '8px 10px', borderRadius: 9, cursor: 'pointer', textAlign: 'left', color: B.text, fontSize: 12,
                border: `1px solid ${catId === c.id ? B.gold : 'transparent'}`, background: catId === c.id ? 'rgba(212,175,106,0.12)' : 'rgba(255,255,255,0.02)', display: 'flex', gap: 6 }}>
              <span style={{ flex: 1 }}>{categoryLabel(c.name)} <span style={{ color: B.muted }}>{c.gender === 'm' ? 'H' : c.gender === 'w' ? 'D' : ''}</span></span>
              <span style={{ color: r?.published_at ? B.green : r ? B.gold : B.faint }}>{r?.published_at ? '●' : r ? '◐' : '○'}</span>
            </button>
          )
        })}
        <p style={{ margin: '8px 0 0', fontSize: 10, color: B.faint }}>● veröffentlicht · ◐ Entwurf · ○ offen</p>
      </div>

      <div style={{ display: 'grid', gap: 12, alignContent: 'start' }}>
        <p style={{ margin: 0, fontFamily: B.serif, fontSize: 24, ...goldText }}>{categoryLabel(cat.name)}</p>
        {cat.kind === 'winner' ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 8 }}>
            {nominees.map(n => (
              <button key={n.id} onClick={() => setWinner(n.id)}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 8, borderRadius: 10, cursor: 'pointer', textAlign: 'left', color: B.text,
                  border: `1px solid ${winner === n.id ? B.goldL : 'rgba(212,175,106,0.15)'}`, background: winner === n.id ? 'rgba(212,175,106,0.18)' : 'transparent' }}>
                <Portrait n={n} size={30} radius={6} />
                <span style={{ fontSize: 12, fontWeight: 600 }}>{winner === n.id ? '🏆 ' : ''}{n.name}</span>
              </button>
            ))}
          </div>
        ) : (
          <>
            <p style={{ margin: 0, fontSize: 12, color: B.muted }}>Offizielle Platzierung eintragen (1 = Gewinner). Nicht platzierte leer lassen.</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: 6 }}>
              {[...nominees].sort((a, b) => (parseInt(positions[a.id] ?? '') || 999) - (parseInt(positions[b.id] ?? '') || 999) || a.name.localeCompare(b.name)).map(n => {
                const v = positions[n.id] ?? ''
                return (
                  <div key={n.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 6, borderRadius: 9, background: 'rgba(255,255,255,0.03)' }}>
                    <input inputMode="numeric" value={v} onChange={e => setPositions(p => ({ ...p, [n.id]: e.target.value.replace(/[^0-9]/g, '') }))}
                      style={{ ...input, width: 46, textAlign: 'center', borderColor: dupPositions.has(v) ? B.red : 'rgba(212,175,106,0.25)' }} />
                    <Portrait n={n} size={26} radius={5} />
                    <span style={{ fontSize: 12, flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{n.name}</span>
                  </div>
                )
              })}
            </div>
            {dupPositions.size > 0 && <p style={{ margin: 0, fontSize: 12, color: B.red }}>⚠ Doppelte Plätze: {[...dupPositions].join(', ')}</p>}
          </>
        )}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <button style={btn()} disabled={busy} onClick={() => save(false)}>Als Entwurf speichern</button>
          <button style={btn(true)} disabled={busy || (cat.kind === 'winner' ? !winner : dupPositions.size > 0 || rankingFromInputs().length === 0)} onClick={() => save(true)}>Veröffentlichen &amp; werten</button>
          {res && <button style={{ ...btn(), color: B.red, borderColor: 'rgba(229,115,115,0.4)' }} disabled={busy} onClick={() => { if (confirm('Ergebnis dieser Kategorie löschen?')) act({ action: 'delete_result', category_id: cat.id }, 'Ergebnis gelöscht') }}>Ergebnis löschen</button>}
          <span style={{ fontSize: 11, color: B.muted }}>{res?.published_at ? `Veröffentlicht am ${new Date(res.published_at).toLocaleString('de-DE')}` : 'Punkte zählen erst nach dem Veröffentlichen.'}</span>
        </div>
      </div>
    </div>
  )
}

// ── Tipps ─────────────────────────────────────────────────────────────────────
function TipsTab({ data, nomineeMap }: { data: AdminData; nomineeMap: Map<number, BdoNominee> }) {
  const people = [...new Set(data.tips.map(t => t.username || t.gast_name || '?'))].sort((a, b) => a.localeCompare(b))
  const cats = data.categories
  return (
    <div style={{ overflowX: 'auto' }}>
      <p style={{ margin: '0 0 10px', fontSize: 12, color: B.muted }}>{people.length} Tipper · Zelle zeigt Gewinnertipp bzw. Platz 1 der Rangliste</p>
      <table style={{ borderCollapse: 'separate', borderSpacing: 3, fontSize: 11 }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left', color: B.muted, padding: '4px 8px', position: 'sticky', left: 0, background: '#0a0806' }}>Tipper</th>
            {cats.map(c => <th key={c.id} style={{ color: B.gold, padding: '4px 8px', minWidth: 110, fontWeight: 600 }}>{categoryLabel(c.name)}<br /><span style={{ color: B.muted, fontWeight: 400 }}>{c.gender === 'm' ? 'Herren' : c.gender === 'w' ? 'Damen' : ''}</span></th>)}
            <th style={{ color: B.muted, padding: '4px 8px' }}>Anzahl</th>
          </tr>
        </thead>
        <tbody>
          {people.map(p => {
            const mine = data.tips.filter(t => (t.username || t.gast_name) === p)
            return (
              <tr key={p}>
                <td style={{ padding: '5px 8px', fontWeight: 700, color: B.goldL, whiteSpace: 'nowrap', position: 'sticky', left: 0, background: '#0a0806' }}>{p}</td>
                {cats.map(c => {
                  const t = mine.find(x => x.category_id === c.id)
                  const id = t?.pick_nominee_id ?? t?.ranking?.[0] ?? null
                  return <td key={c.id} style={{ padding: '5px 8px', borderRadius: 6, background: t ? 'rgba(212,175,106,0.08)' : 'rgba(255,255,255,0.02)', color: t ? B.text : B.faint, whiteSpace: 'nowrap' }}>{id ? nomineeMap.get(id)?.name ?? '?' : '–'}</td>
                })}
                <td style={{ padding: '5px 8px', textAlign: 'center', color: B.muted }}>{mine.length}/{cats.length}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
      {people.length === 0 && <p style={{ color: B.muted, fontSize: 13 }}>Noch keine Tipps.</p>}
    </div>
  )
}