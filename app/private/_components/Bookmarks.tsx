'use client'

// Lesezeichenleiste zum Ausklappen: am PC in der Seitenleiste, am Handy über das Lesezeichen-Symbol oben.
// Gespeichert in der Datenbank → auf allen Geräten gleich.

import { useCallback, useEffect, useState } from 'react'
import Icon from './Icon'

export interface Bookmark { id: number; title: string; url: string; color: string | null; sort_order: number }

const COLORS = ['#d93690', '#a93bc9', '#7c4ae0', '#5b6ee8', '#3f9bb5', '#25845c', '#e0913a', '#c0344f']
const OPEN_KEY = 'pv-bookmarks-open'

function hostOf(url: string) {
  try { return new URL(url).hostname.replace(/^www\./, '') } catch { return url }
}

async function api<T>(path: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const { json, ...rest } = init ?? {}
  const res = await fetch(`/api/private/bookmarks${path}`, {
    cache: 'no-store', ...rest,
    headers: json !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: json !== undefined ? JSON.stringify(json) : undefined,
  })
  const d = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error((d as { error?: string }).error || `Fehler ${res.status}`)
  return d as T
}

export default function Bookmarks({ variant, toast, onNavigate }: {
  variant: 'side' | 'sheet'
  toast: (t: string) => void
  /** z.B. Handy-Menü schließen, nachdem ein Link geöffnet wurde */
  onNavigate?: () => void
}) {
  const [items, setItems] = useState<Bookmark[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState(true)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState<{ id: number | null; title: string; url: string; color: string } | null>(null)

  const load = useCallback(async () => {
    try { setItems(await api<Bookmark[]>('')); setError(null) } catch (e) { setError((e as Error).message); setItems([]) }
  }, [])

  useEffect(() => {
    load()
    if (variant === 'side') { try { setOpen(localStorage.getItem(OPEN_KEY) !== '0') } catch { /* egal */ } }
  }, [load, variant])

  function toggle() {
    setOpen(o => { try { localStorage.setItem(OPEN_KEY, o ? '0' : '1') } catch { /* egal */ } return !o })
  }

  async function save() {
    if (!form) return
    let url = form.url.trim()
    if (!url) { toast('Link fehlt'); return }
    if (!/^https?:\/\//i.test(url)) url = `https://${url}`
    const title = form.title.trim() || hostOf(url)
    try {
      if (form.id) {
        const b = await api<Bookmark>(`/${form.id}`, { method: 'PATCH', json: { title, url, color: form.color } })
        setItems(prev => (prev ?? []).map(x => (x.id === b.id ? b : x)))
      } else {
        const b = await api<Bookmark>('', { method: 'POST', json: { title, url, color: form.color, sort_order: (items?.length ?? 0) } })
        setItems(prev => [...(prev ?? []), b])
      }
      setForm(null)
    } catch (e) { toast(`Speichern fehlgeschlagen: ${(e as Error).message}`) }
  }

  async function remove(b: Bookmark) {
    try {
      await api(`/${b.id}`, { method: 'DELETE' })
      setItems(prev => (prev ?? []).filter(x => x.id !== b.id))
      toast(`„${b.title}“ entfernt`)
    } catch (e) { toast((e as Error).message) }
  }

  async function move(b: Bookmark, dir: -1 | 1) {
    const list = [...(items ?? [])]
    const i = list.findIndex(x => x.id === b.id)
    const j = i + dir
    if (j < 0 || j >= list.length) return
    ;[list[i], list[j]] = [list[j], list[i]]
    setItems(list)
    // Reihenfolge der beiden getauschten speichern
    await Promise.all([list[i], list[j]].map(x => api(`/${x.id}`, { method: 'PATCH', json: { sort_order: list.indexOf(x) } }).catch(() => null)))
  }

  const list = (
    <div className="pv-bm-list">
      {error && <div className="pv-muted" style={{ fontSize: 12, color: 'var(--pv-danger)', padding: '4px 10px' }}>{error}</div>}
      {items?.length === 0 && !form && !error && (
        <div className="pv-muted" style={{ fontSize: 12.5, padding: '4px 10px' }}>Noch keine Lesezeichen.</div>
      )}
      {items?.map((b, i) => (
        <div key={b.id} className="pv-bm-item">
          <a href={b.url} target="_blank" rel="noopener noreferrer" className="pv-bm-link" onClick={onNavigate} title={b.url}>
            <span className="pv-bm-badge" style={{ background: b.color ?? COLORS[i % COLORS.length] }}>{b.title.slice(0, 1).toUpperCase()}</span>
            <span className="pv-ellipsis">{b.title}</span>
          </a>
          {editing && (
            <span className="pv-bm-actions">
              <button aria-label="Nach oben" onClick={() => move(b, -1)} disabled={i === 0}><Icon name="chevronDown" size={13} style={{ transform: 'rotate(180deg)' }} /></button>
              <button aria-label="Bearbeiten" onClick={() => setForm({ id: b.id, title: b.title, url: b.url, color: b.color ?? COLORS[0] })}><Icon name="pencil" size={13} /></button>
              <button aria-label="Löschen" onClick={() => remove(b)}><Icon name="trash" size={13} /></button>
            </span>
          )}
        </div>
      ))}
      {form ? (
        <form className="pv-bm-form" onSubmit={e => { e.preventDefault(); save() }}>
          <input className="pv-input" placeholder="https://…" inputMode="url" value={form.url} onChange={e => setForm({ ...form, url: e.target.value })} autoFocus />
          <input className="pv-input" placeholder="Name (optional)" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} maxLength={80} />
          <div className="pv-row" style={{ gap: 4 }}>
            {COLORS.map(c => (
              <button type="button" key={c} className={`pv-swatch ${form.color === c ? 'active' : ''}`} style={{ background: c, width: 20, height: 20 }} aria-label={c} onClick={() => setForm({ ...form, color: c })} />
            ))}
          </div>
          <div className="pv-row" style={{ gap: 6 }}>
            <button type="submit" className="pv-btn sm primary pv-grow">Speichern</button>
            <button type="button" className="pv-btn sm" onClick={() => setForm(null)}>Abbrechen</button>
          </div>
        </form>
      ) : (
        <div className="pv-row" style={{ gap: 4, padding: '2px 4px' }}>
          <button className="pv-bm-small" onClick={() => setForm({ id: null, title: '', url: '', color: COLORS[(items?.length ?? 0) % COLORS.length] })}>
            <Icon name="plus" size={14} /> Hinzufügen
          </button>
          {(items?.length ?? 0) > 0 && (
            <button className={`pv-bm-small ${editing ? 'active' : ''}`} onClick={() => setEditing(e => !e)}>
              <Icon name={editing ? 'check' : 'pencil'} size={13} /> {editing ? 'Fertig' : 'Bearbeiten'}
            </button>
          )}
        </div>
      )}
    </div>
  )

  if (variant === 'sheet') return list

  return (
    <div className="pv-bm">
      <button className="pv-bm-head" onClick={toggle} aria-expanded={open}>
        <Icon name="bookmark" size={15} />
        <span className="pv-grow">Lesezeichen</span>
        {items && items.length > 0 && <span className="pv-folder-count">{items.length}</span>}
        <Icon name={open ? 'chevronDown' : 'chevronRight'} size={14} />
      </button>
      {open && list}
    </div>
  )
}