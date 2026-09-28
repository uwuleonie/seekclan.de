'use client'

// Wunschliste: Dinge mit Link, Bild, Preis, Priorität und Kategorie sammeln.
// "Vom Link übernehmen" holt Titel, Bild und Preis automatisch von der Produktseite.

import { useCallback, useEffect, useMemo, useState } from 'react'
import Icon from './Icon'
import Portal from './Portal'
import { api } from '../_lib/planner'

export interface Wish {
  id: number
  title: string
  url: string | null
  image_url: string | null
  price_cents: number | null
  currency: string | null
  priority: number
  category: string | null
  note: string | null
  bought: boolean
  bought_at: string | null
  created_at: string
}

type Show = 'open' | 'bought' | 'all'
type Sort = 'priority' | 'new' | 'cheap' | 'expensive'

const PRIORITIES = [
  { v: 1, label: 'Irgendwann' },
  { v: 2, label: 'Normal' },
  { v: 3, label: 'Unbedingt' },
]
const CURRENCIES = ['EUR', 'USD', 'GBP', 'CHF']

function money(cents: number | null, currency: string | null) {
  if (cents === null || cents === undefined) return null
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: currency || 'EUR' }).format(cents / 100)
}
function host(url: string | null) {
  if (!url) return null
  try { return new URL(url).hostname.replace(/^www\./, '') } catch { return null }
}
/** "19,99" / "1.299,00" / "19.99" → Cent */
function parsePrice(s: string): number | null | 'invalid' {
  const t = s.trim().replace(/[€$£\s]/g, '').replace(/chf/i, '')
  if (!t) return null
  let n = t
  if (n.includes(',') && n.includes('.')) n = n.lastIndexOf(',') > n.lastIndexOf('.') ? n.replace(/\./g, '').replace(',', '.') : n.replace(/,/g, '')
  else if (n.includes(',')) n = n.replace(',', '.')
  const v = Number(n)
  return Number.isFinite(v) && v >= 0 ? Math.round(v * 100) : 'invalid'
}

interface Draft {
  title: string; url: string; image_url: string; price: string; currency: string
  priority: number; category: string; note: string
}
const EMPTY: Draft = { title: '', url: '', image_url: '', price: '', currency: 'EUR', priority: 2, category: '', note: '' }

export default function Wishlist({ toast }: { toast: (t: string, o?: { ms?: number }) => void }) {
  const [items, setItems] = useState<Wish[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [show, setShow] = useState<Show>('open')
  const [category, setCategory] = useState<string | null>(null)
  const [sort, setSort] = useState<Sort>('priority')

  const [modal, setModal] = useState<{ wish: Wish | null } | null>(null)
  const [draft, setDraft] = useState<Draft>(EMPTY)
  const [saving, setSaving] = useState(false)
  const [fetching, setFetching] = useState(false)
  const [deleteArmed, setDeleteArmed] = useState(false)

  const load = useCallback(async () => {
    try {
      setItems(await api<Wish[]>('wishlist'))
      setError(null)
    } catch (e) {
      setError((e as Error).message)
      setItems([])
    }
  }, [])
  useEffect(() => { load() }, [load])

  const categories = useMemo(
    () => [...new Set((items ?? []).map(w => w.category).filter((c): c is string => !!c))].sort((a, b) => a.localeCompare(b, 'de')),
    [items]
  )

  const visible = useMemo(() => {
    let list = (items ?? []).filter(w => (show === 'all' ? true : show === 'open' ? !w.bought : w.bought))
    if (category) list = list.filter(w => w.category === category)
    const price = (w: Wish) => w.price_cents ?? -1
    list = [...list].sort((a, b) => {
      if (show === 'all' && a.bought !== b.bought) return a.bought ? 1 : -1
      if (sort === 'new') return b.created_at.localeCompare(a.created_at)
      if (sort === 'cheap') return (price(a) < 0 ? 1e12 : price(a)) - (price(b) < 0 ? 1e12 : price(b))
      if (sort === 'expensive') return price(b) - price(a)
      return b.priority - a.priority || b.created_at.localeCompare(a.created_at)
    })
    return list
  }, [items, show, category, sort])

  const openTotal = useMemo(() => {
    const open = (items ?? []).filter(w => !w.bought && w.price_cents !== null && (w.currency ?? 'EUR') === 'EUR')
    return open.reduce((s, w) => s + (w.price_cents ?? 0), 0)
  }, [items])
  const openCount = (items ?? []).filter(w => !w.bought).length

  function openModal(wish: Wish | null) {
    setDraft(wish ? {
      title: wish.title, url: wish.url ?? '', image_url: wish.image_url ?? '',
      price: wish.price_cents !== null ? (wish.price_cents / 100).toFixed(2).replace('.', ',') : '',
      currency: wish.currency ?? 'EUR', priority: wish.priority, category: wish.category ?? '', note: wish.note ?? '',
    } : { ...EMPTY, category: category ?? '' })
    setDeleteArmed(false)
    setModal({ wish })
  }

  async function fetchPreview(url = draft.url) {
    const u = url.trim()
    if (!/^https?:\/\//i.test(u)) { toast('Link muss mit https:// beginnen'); return }
    setFetching(true)
    try {
      const p = await api<{ title: string | null; image_url: string | null; price_cents: number | null; currency: string | null }>(
        `wishlist/preview?url=${encodeURIComponent(u)}`
      )
      setDraft(d => ({
        ...d,
        title: d.title.trim() ? d.title : p.title ?? d.title,
        image_url: d.image_url.trim() ? d.image_url : p.image_url ?? '',
        price: d.price.trim() || p.price_cents === null ? d.price : (p.price_cents / 100).toFixed(2).replace('.', ','),
        currency: p.currency ?? d.currency,
      }))
      if (!p.title && !p.image_url && p.price_cents === null) toast('Die Seite gibt keine Infos her – bitte selbst ausfüllen')
    } catch (e) {
      toast((e as Error).message, { ms: 5000 })
    } finally {
      setFetching(false)
    }
  }

  async function save() {
    if (!modal) return
    if (!draft.title.trim()) { toast('Titel fehlt'); return }
    const price = parsePrice(draft.price)
    if (price === 'invalid') { toast('Preis bitte als Zahl, z.B. 19,99'); return }
    const url = draft.url.trim()
    const img = draft.image_url.trim()
    if (url && !/^https?:\/\//i.test(url)) { toast('Link muss mit https:// beginnen'); return }
    if (img && !/^https?:\/\//i.test(img)) { toast('Bild-Link muss mit https:// beginnen'); return }
    const body = {
      title: draft.title.trim(), url: url || null, image_url: img || null, price_cents: price,
      currency: draft.currency, priority: draft.priority, category: draft.category.trim() || null, note: draft.note.trim() || null,
    }
    setSaving(true)
    try {
      if (modal.wish) {
        const w = await api<Wish>(`wishlist/${modal.wish.id}`, { method: 'PATCH', json: body })
        setItems(prev => (prev ?? []).map(x => (x.id === w.id ? w : x)))
        toast('Gespeichert')
      } else {
        const w = await api<Wish>('wishlist', { method: 'POST', json: body })
        setItems(prev => [w, ...(prev ?? [])])
        toast('Zur Wunschliste hinzugefügt')
      }
      setModal(null)
    } catch (e) {
      toast(`Speichern fehlgeschlagen: ${(e as Error).message}`, { ms: 6000 })
    } finally {
      setSaving(false)
    }
  }

  async function toggleBought(w: Wish) {
    setItems(prev => (prev ?? []).map(x => (x.id === w.id ? { ...x, bought: !w.bought } : x)))
    try {
      const u = await api<Wish>(`wishlist/${w.id}`, { method: 'PATCH', json: { bought: !w.bought } })
      setItems(prev => (prev ?? []).map(x => (x.id === u.id ? u : x)))
      toast(u.bought ? 'Als gekauft markiert' : 'Wieder offen')
    } catch (e) {
      toast((e as Error).message)
      load()
    }
  }

  async function remove(w: Wish) {
    if (!deleteArmed) { setDeleteArmed(true); return }
    try {
      await api(`wishlist/${w.id}`, { method: 'DELETE' })
      setItems(prev => (prev ?? []).filter(x => x.id !== w.id))
      setModal(null)
      toast('Gelöscht')
    } catch (e) {
      toast((e as Error).message)
    }
  }

  return (
    <div className="pv-page" style={{ maxWidth: 1100 }}>
      <div className="pv-page-head">
        <div>
          <div className="pv-h2">Wunschliste</div>
          <p className="pv-subtitle">
            {openCount} offen{openTotal > 0 && ` · zusammen ${money(openTotal, 'EUR')}`}
          </p>
        </div>
        <button className="pv-btn primary" onClick={() => openModal(null)}><Icon name="plus" size={17} /> Wunsch hinzufügen</button>
      </div>

      <div className="pv-row pv-wrap" style={{ gap: 10, marginBottom: 12 }}>
        <div className="pv-seg">
          <button className={show === 'open' ? 'active' : ''} onClick={() => setShow('open')}>Offen</button>
          <button className={show === 'bought' ? 'active' : ''} onClick={() => setShow('bought')}>Gekauft</button>
          <button className={show === 'all' ? 'active' : ''} onClick={() => setShow('all')}>Alle</button>
        </div>
        <div className="pv-grow" />
        <select className="pv-input" style={{ width: 'auto', minHeight: 36 }} aria-label="Sortierung" value={sort} onChange={e => setSort(e.target.value as Sort)}>
          <option value="priority">Wichtigste zuerst</option>
          <option value="new">Neueste zuerst</option>
          <option value="cheap">Günstigste zuerst</option>
          <option value="expensive">Teuerste zuerst</option>
        </select>
      </div>

      {categories.length > 0 && (
        <div className="pv-chips" style={{ marginBottom: 14 }}>
          <button className={`pv-chip ${category === null ? 'active' : ''}`} onClick={() => setCategory(null)}>Alle Kategorien</button>
          {categories.map(c => (
            <button key={c} className={`pv-chip ${category === c ? 'active' : ''}`} onClick={() => setCategory(category === c ? null : c)}>
              <Icon name="tag" size={13} /> {c}
            </button>
          ))}
        </div>
      )}

      {error && <div className="pv-glass pv-card" style={{ color: 'var(--pv-danger)', marginBottom: 12 }}>{error}</div>}
      {items === null && <div className="pv-center" style={{ padding: 40 }}><div className="pv-spinner" /></div>}
      {items && visible.length === 0 && !error && (
        <div className="pv-glass pv-empty">
          <Icon name="gift" size={34} stroke={1.4} />
          <div>{show === 'bought' ? 'Noch nichts gekauft' : 'Noch keine Wünsche. Link einfügen und los.'}</div>
        </div>
      )}

      <div className="pv-wish-grid">
        {visible.map(w => {
          const price = money(w.price_cents, w.currency)
          const site = host(w.url)
          return (
            <article key={w.id} className={`pv-glass pv-wish ${w.bought ? 'bought' : ''}`}>
              <button className="pv-wish-img" onClick={() => openModal(w)} aria-label={`${w.title} bearbeiten`}>
                {w.image_url
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={w.image_url} alt="" loading="lazy" referrerPolicy="no-referrer" onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} />
                  : null}
                <Icon name="gift" size={30} stroke={1.3} />
                {w.priority === 3 && <span className="pv-badge new pv-wish-prio">Unbedingt</span>}
              </button>
              <div className="pv-wish-body">
                <div className="pv-wish-title">{w.title}</div>
                <div className="pv-row pv-wrap" style={{ gap: 6 }}>
                  {price && <span className="pv-wish-price">{price}</span>}
                  {w.category && <span className="pv-badge"><Icon name="tag" size={11} /> {w.category}</span>}
                  {site && <span className="pv-muted" style={{ fontSize: 12 }}>{site}</span>}
                </div>
                {w.note && <div className="pv-wish-note">{w.note}</div>}
                <div className="pv-row" style={{ gap: 6, marginTop: 'auto', paddingTop: 8 }}>
                  <button className={`pv-btn sm ${w.bought ? '' : 'primary'}`} onClick={() => toggleBought(w)}>
                    <Icon name={w.bought ? 'refresh' : 'check'} size={15} /> {w.bought ? 'Wieder offen' : 'Gekauft'}
                  </button>
                  {w.url && (
                    <a className="pv-btn sm" href={w.url} target="_blank" rel="noopener noreferrer nofollow"><Icon name="external" size={15} /> Öffnen</a>
                  )}
                  <div className="pv-grow" />
                  <button className="pv-icon-btn ghost" aria-label="Bearbeiten" onClick={() => openModal(w)}><Icon name="pencil" size={16} /></button>
                </div>
              </div>
            </article>
          )
        })}
      </div>

      {modal && (
        <Portal>
          <div className="pv-overlay sheet" onClick={e => { if (e.target === e.currentTarget) setModal(null) }}>
            <div className="pv-modal" style={{ maxWidth: 560 }}>
              <div className="pv-grip" />
              <div className="pv-h2">{modal.wish ? 'Wunsch bearbeiten' : 'Neuer Wunsch'}</div>

              <div>
                <label className="pv-label">Link zum Produkt</label>
                <div className="pv-row" style={{ gap: 6 }}>
                  <input
                    className="pv-input pv-grow" inputMode="url" placeholder="https://…" value={draft.url}
                    onChange={e => setDraft(d => ({ ...d, url: e.target.value }))}
                    onPaste={e => {
                      const t = e.clipboardData.getData('text').trim()
                      if (/^https?:\/\//i.test(t) && !draft.title.trim()) setTimeout(() => fetchPreview(t), 0)
                    }}
                  />
                  <button className="pv-btn" onClick={() => fetchPreview()} disabled={fetching || !draft.url.trim()}>
                    {fetching ? <span className="pv-spinner" style={{ width: 16, height: 16 }} /> : <Icon name="download" size={16} />} Übernehmen
                  </button>
                </div>
                <p className="pv-muted" style={{ fontSize: 12, margin: '4px 2px 0' }}>Holt Titel, Bild und Preis von der Seite (klappt nicht bei jedem Shop).</p>
              </div>

              <div>
                <label className="pv-label">Titel</label>
                <input className="pv-input" value={draft.title} onChange={e => setDraft(d => ({ ...d, title: e.target.value }))} maxLength={200} />
              </div>

              <div className="pv-row" style={{ gap: 10, alignItems: 'flex-end' }}>
                <div className="pv-grow">
                  <label className="pv-label">Preis</label>
                  <input className="pv-input" inputMode="decimal" placeholder="z.B. 19,99" value={draft.price} onChange={e => setDraft(d => ({ ...d, price: e.target.value }))} />
                </div>
                <select className="pv-input" style={{ width: 90 }} aria-label="Währung" value={draft.currency} onChange={e => setDraft(d => ({ ...d, currency: e.target.value }))}>
                  {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              <div>
                <label className="pv-label">Wie wichtig?</label>
                <div className="pv-seg" style={{ width: '100%' }}>
                  {PRIORITIES.map(p => (
                    <button key={p.v} style={{ flex: 1 }} className={draft.priority === p.v ? 'active' : ''} onClick={() => setDraft(d => ({ ...d, priority: p.v }))}>{p.label}</button>
                  ))}
                </div>
              </div>

              <div>
                <label className="pv-label">Kategorie</label>
                <input className="pv-input" list="pv-wish-cats" placeholder="z.B. Kleidung, Technik, Bücher" value={draft.category} onChange={e => setDraft(d => ({ ...d, category: e.target.value }))} maxLength={60} />
                <datalist id="pv-wish-cats">{categories.map(c => <option key={c} value={c} />)}</datalist>
              </div>

              <div>
                <label className="pv-label">Bild-Link (optional)</label>
                <div className="pv-row" style={{ gap: 8 }}>
                  {draft.image_url.trim() && /^https?:\/\//i.test(draft.image_url.trim()) && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={draft.image_url.trim()} alt="" referrerPolicy="no-referrer" style={{ width: 44, height: 44, objectFit: 'cover', borderRadius: 10, flexShrink: 0 }} />
                  )}
                  <input className="pv-input pv-grow" inputMode="url" placeholder="https://…" value={draft.image_url} onChange={e => setDraft(d => ({ ...d, image_url: e.target.value }))} />
                </div>
              </div>

              <div>
                <label className="pv-label">Notiz (Größe, Farbe …)</label>
                <textarea className="pv-input" rows={2} value={draft.note} onChange={e => setDraft(d => ({ ...d, note: e.target.value }))} maxLength={2000} style={{ resize: 'vertical' }} />
              </div>

              <div className="pv-modal-actions">
                {modal.wish && (
                  <button
                    className="pv-btn danger"
                    style={{ marginRight: 'auto', ...(deleteArmed ? { background: 'var(--pv-danger)', color: '#fff' } : {}) }}
                    onClick={() => remove(modal.wish!)}
                  >
                    <Icon name="trash" size={16} /> {deleteArmed ? 'Wirklich löschen?' : 'Löschen'}
                  </button>
                )}
                <button className="pv-btn" onClick={() => setModal(null)}>Abbrechen</button>
                <button className="pv-btn primary" onClick={save} disabled={saving || !draft.title.trim()}>Speichern</button>
              </div>
            </div>
          </div>
        </Portal>
      )}
    </div>
  )
}