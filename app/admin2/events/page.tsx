'use client'

// /admin2/events – Events mit Countdown auf der Startseite
// Vor dem Start zeigt die Startseite einen Countdown, während des Events „Läuft gerade“ mit der Restzeit.
// „Sofort beenden“ blendet ein Event überall sofort aus (kann wieder eingeschaltet werden).
// Das Kürzel (z. B. halloween-2026) bleibt fest – spätere Systeme wie das Halloween-Event hängen daran.

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '../../lib/auth-context'
import { hasWriteAccess } from '../layout'
import { compressImageFile } from '../../lib/image-compress'

type Ev = { id: number; slug: string; title: string; subtitle: string; href: string | null; accent: string; image: string | null; startsAt: string; endsAt: string; countdownFrom: string | null; active: boolean }
type Draft = { slug: string; title: string; subtitle: string; href: string; accent: string; startsAt: string; endsAt: string; countdownFrom: string; active: boolean; file: File | null; preview: string | null; removeImage: boolean }

const ACCENT = '#14b8a6'
const inputStyle = { background: 'var(--muted-bg)', border: '1px solid var(--card-border)', color: 'var(--foreground)' }
const smallBtn = { background: 'var(--background)', border: '1px solid var(--card-border)', color: 'var(--foreground)' }
const COLORS = ['#14b8a6', '#f97316', '#a855f7', '#ec4899', '#ef4444', '#eab308', '#22c55e', '#3b82f6']

// ISO ↔ Eingabefeld „datetime-local“ (in deiner Ortszeit)
const toLocal = (iso: string | null) => {
  if (!iso) return ''
  const d = new Date(iso)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}
const toIso = (local: string) => (local ? new Date(local).toISOString() : '')
const fmt = (iso: string) => new Date(iso).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
const slugify = (s: string) => s.toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60)

function status(e: Ev, now: number): { label: string; color: string } {
  if (!e.active) return { label: 'Beendet', color: '#6b7280' }
  const s = new Date(e.startsAt).getTime(), en = new Date(e.endsAt).getTime()
  const cd = e.countdownFrom ? new Date(e.countdownFrom).getTime() : 0
  if (now >= en) return { label: 'Vorbei', color: '#6b7280' }
  if (now >= s) return { label: 'Läuft gerade', color: '#22c55e' }
  if (now >= cd) return { label: 'Countdown sichtbar', color: ACCENT }
  return { label: 'Geplant', color: '#eab308' }
}

function emptyDraft(): Draft {
  const y = new Date().getFullYear()
  return { slug: '', title: '', subtitle: '', href: '', accent: ACCENT, startsAt: `${y}-10-15T00:00`, endsAt: `${y}-11-01T23:59`, countdownFrom: '', active: true, file: null, preview: null, removeImage: false }
}

export default function Admin2EventsPage() {
  const { user } = useAuth()
  const pathname = usePathname()
  const canWrite = hasWriteAccess(user?.clan_role, pathname)

  const [events, setEvents] = useState<Ev[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState<number | 'new' | null>(null)
  const [draft, setDraft] = useState<Draft>(emptyDraft)
  const [slugTouched, setSlugTouched] = useState(false)
  const [saving, setSaving] = useState(false)
  const [reload, setReload] = useState(0)
  const [now, setNow] = useState(() => Date.now())
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 30000); return () => clearInterval(t) }, [])

  const load = () => setReload(n => n + 1)
  useEffect(() => {
    if (!user) return
    let alive = true
    fetch('/api/admin2/events', { cache: 'no-store' })
      .then(async r => {
        const d = await r.json().catch(() => ({}))
        if (!alive) return
        if (!r.ok) setError(d.error || 'Fehler beim Laden')
        else { setEvents(d.events || []); setError('') }
      })
      .catch(() => { if (alive) setError('Fehler beim Laden') })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [user, reload])

  const set = (patch: Partial<Draft>) => setDraft(d => ({ ...d, ...patch }))
  const startNew = () => { setDraft(emptyDraft()); setSlugTouched(false); setEditing('new'); setError('') }
  const startEdit = (e: Ev) => {
    setDraft({
      slug: e.slug, title: e.title, subtitle: e.subtitle, href: e.href || '', accent: e.accent,
      startsAt: toLocal(e.startsAt), endsAt: toLocal(e.endsAt), countdownFrom: toLocal(e.countdownFrom),
      active: e.active, file: null, preview: e.image, removeImage: false,
    })
    setSlugTouched(true); setEditing(e.id); setError('')
  }
  const close = () => { setEditing(null); setDraft(emptyDraft()) }

  const pickFile = async (f: File) => {
    const c = await compressImageFile(f)
    set({ file: c, preview: URL.createObjectURL(c), removeImage: false })
  }

  const save = async () => {
    setSaving(true); setError('')
    const fd = new FormData()
    fd.append('slug', draft.slug)
    fd.append('title', draft.title)
    fd.append('subtitle', draft.subtitle)
    fd.append('href', draft.href)
    fd.append('accent', draft.accent)
    fd.append('startsAt', toIso(draft.startsAt))
    fd.append('endsAt', toIso(draft.endsAt))
    fd.append('countdownFrom', toIso(draft.countdownFrom))
    fd.append('active', String(draft.active))
    if (draft.file) fd.append('file', draft.file)
    if (draft.removeImage) fd.append('removeImage', 'true')
    const r = await fetch(editing === 'new' ? '/api/admin2/events' : `/api/admin2/events/${editing}`, { method: editing === 'new' ? 'POST' : 'PATCH', body: fd })
    const d = await r.json().catch(() => ({}))
    setSaving(false)
    if (!r.ok) { setError(d.error || (r.status === 413 ? 'Das Bild ist zu groß für den Server.' : `Speichern fehlgeschlagen (Fehler ${r.status})`)); return }
    close(); load()
  }

  const setActive = async (e: Ev, active: boolean) => {
    if (!active && !confirm(`„${e.title}“ sofort beenden? Es verschwindet dann sofort von der Startseite.`)) return
    await fetch(`/api/admin2/events/${e.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ active }) })
    load()
  }
  const remove = async (e: Ev) => {
    if (!confirm(`„${e.title}“ endgültig löschen?`)) return
    await fetch(`/api/admin2/events/${e.id}`, { method: 'DELETE' })
    load()
  }

  const editor = (
    <div className="rounded-xl p-4 mb-3" style={{ background: 'var(--muted-bg)', border: `1px solid ${ACCENT}55` }}>
      <p className="font-bold text-sm mb-3" style={{ color: 'var(--foreground)' }}>{editing === 'new' ? 'Neues Event' : 'Event bearbeiten'}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-xs" style={{ color: 'var(--muted)' }}>Titel
          <input value={draft.title} maxLength={80} placeholder="z. B. Halloween 2026" className="w-full mt-1 px-3 py-2 rounded-lg text-sm" style={inputStyle}
            onChange={e => set({ title: e.target.value, ...(slugTouched ? {} : { slug: slugify(e.target.value) }) })} />
        </label>
        <label className="text-xs" style={{ color: 'var(--muted)' }}>Kürzel (eindeutig, bleibt fest)
          <input value={draft.slug} maxLength={60} placeholder="z. B. halloween-2026" className="w-full mt-1 px-3 py-2 rounded-lg text-sm font-mono" style={inputStyle}
            onChange={e => { setSlugTouched(true); set({ slug: e.target.value.toLowerCase() }) }} />
        </label>
        <label className="text-xs sm:col-span-2" style={{ color: 'var(--muted)' }}>Untertitel (optional)
          <input value={draft.subtitle} maxLength={160} placeholder="z. B. Finde 100 Kürbisse auf der Website" className="w-full mt-1 px-3 py-2 rounded-lg text-sm" style={inputStyle} onChange={e => set({ subtitle: e.target.value })} />
        </label>
        <label className="text-xs sm:col-span-2" style={{ color: 'var(--muted)' }}>Link (optional) – wohin die Karte führt
          <input value={draft.href} placeholder="/halloween/2026 oder https://…" className="w-full mt-1 px-3 py-2 rounded-lg text-sm" style={inputStyle} onChange={e => set({ href: e.target.value })} />
        </label>
        <label className="text-xs" style={{ color: 'var(--muted)' }}>Start
          <input type="datetime-local" value={draft.startsAt} className="w-full mt-1 px-3 py-2 rounded-lg text-sm" style={inputStyle} onChange={e => set({ startsAt: e.target.value })} />
        </label>
        <label className="text-xs" style={{ color: 'var(--muted)' }}>Ende
          <input type="datetime-local" value={draft.endsAt} className="w-full mt-1 px-3 py-2 rounded-lg text-sm" style={inputStyle} onChange={e => set({ endsAt: e.target.value })} />
        </label>
        <label className="text-xs sm:col-span-2" style={{ color: 'var(--muted)' }}>Countdown auf der Startseite zeigen ab (leer = sofort)
          <input type="datetime-local" value={draft.countdownFrom} className="w-full mt-1 px-3 py-2 rounded-lg text-sm" style={inputStyle} onChange={e => set({ countdownFrom: e.target.value })} />
        </label>
      </div>

      <p className="text-xs mt-4 mb-2" style={{ color: 'var(--muted)' }}>Farbe der Karte</p>
      <div className="flex items-center gap-2 flex-wrap">
        {COLORS.map(c => (
          <button key={c} onClick={() => set({ accent: c })} className="w-8 h-8 rounded-full" title={c} aria-label={`Farbe ${c}`}
            style={{ background: c, outline: draft.accent === c ? '2px solid var(--foreground)' : 'none', outlineOffset: 2 }} />
        ))}
        <input type="color" value={draft.accent} onChange={e => set({ accent: e.target.value })} className="w-10 h-8 rounded cursor-pointer" title="Eigene Farbe" />
      </div>

      <p className="text-xs mt-4 mb-2" style={{ color: 'var(--muted)' }}>Bild (optional, Querformat – wird oben in der Karte gezeigt)</p>
      <div className="flex items-center gap-3 flex-wrap">
        <div className="w-32 h-16 rounded-lg overflow-hidden flex-shrink-0" style={{ background: `${draft.accent}55` }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {draft.preview && <img src={draft.preview} alt="" className="w-full h-full object-cover" />}
        </div>
        <button onClick={() => fileRef.current?.click()} className="h-9 px-3 rounded-lg text-xs" style={smallBtn}>{draft.preview ? 'Anderes Bild' : 'Bild hochladen'}</button>
        {draft.preview && <button onClick={() => set({ file: null, preview: null, removeImage: true })} className="h-9 px-3 rounded-lg text-xs" style={{ ...smallBtn, color: '#EF4444' }}>Bild entfernen</button>}
        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) pickFile(f); e.target.value = '' }} />
      </div>

      <label className="flex items-center gap-2 text-sm mt-4" style={{ color: 'var(--foreground)' }}>
        <input type="checkbox" checked={draft.active} onChange={e => set({ active: e.target.checked })} /> Aktiv (aus = sofort überall ausgeblendet)
      </label>

      {error && <p className="text-xs mt-3" style={{ color: '#EF4444' }}>{error}</p>}
      <div className="flex gap-2 mt-4">
        <button onClick={save} disabled={saving || !draft.title.trim() || !draft.slug.trim()} className="px-4 py-2 rounded-full text-sm font-medium text-white disabled:opacity-50" style={{ background: ACCENT }}>
          {saving ? 'Speichert…' : 'Speichern'}
        </button>
        <button onClick={close} className="px-4 py-2 rounded-full text-sm" style={smallBtn}>Abbrechen</button>
      </div>
    </div>
  )

  return (
    <div className="max-w-3xl">
      <div className="mb-8 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold mb-1" style={{ color: 'var(--foreground)' }}>🎉 Events</h1>
          <p style={{ color: 'var(--muted)' }}>Events mit Countdown auf der Startseite. Es wird immer das nächste aktive Event gezeigt.</p>
        </div>
        <Link href="/" target="_blank" className="px-4 py-2 rounded-full text-sm font-medium" style={smallBtn}>Startseite ansehen ↗</Link>
      </div>

      {!canWrite && <div className="card rounded-2xl px-4 py-3 mb-6 text-sm" style={{ color: 'var(--muted)' }}>Du hast hier nur Lesezugriff – bearbeiten dürfen nur Administrator/Owner.</div>}

      <div className="card rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-sm" style={{ color: 'var(--foreground)' }}>Alle Events ({events.length})</h2>
          {canWrite && editing === null && <button onClick={startNew} className="px-4 py-2 rounded-full text-sm font-medium text-white" style={{ background: ACCENT }}>+ Neues Event</button>}
        </div>

        {error && editing === null && <p className="text-sm mb-3" style={{ color: '#EF4444' }}>{error}</p>}
        {editing === 'new' && editor}

        {loading ? <p className="text-sm" style={{ color: 'var(--muted)' }}>Lädt...</p>
          : events.length === 0 && editing !== 'new' ? <p className="text-sm" style={{ color: 'var(--muted)' }}>Noch keine Events.</p>
          : (
            <div className="space-y-3">
              {events.map(e => {
                if (editing === e.id) return <div key={e.id}>{editor}</div>
                const st = status(e, now)
                return (
                  <div key={e.id} className="flex items-center gap-4 rounded-xl p-3 flex-wrap" style={{ background: 'var(--muted-bg)', borderLeft: `4px solid ${e.accent}` }}>
                    <div className="flex-1 min-w-[200px]">
                      <p className="font-semibold text-sm" style={{ color: 'var(--foreground)' }}>
                        {e.title} <span className="ml-1 text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: `${st.color}22`, color: st.color }}>{st.label}</span>
                      </p>
                      <p className="text-xs font-mono" style={{ color: 'var(--muted)' }}>{e.slug}</p>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
                        {fmt(e.startsAt)} – {fmt(e.endsAt)}{e.countdownFrom ? ` · Countdown ab ${fmt(e.countdownFrom)}` : ''}
                      </p>
                    </div>
                    {canWrite && (
                      <div className="flex items-center gap-1 flex-wrap justify-end">
                        {e.active
                          ? <button onClick={() => setActive(e, false)} className="h-8 px-3 rounded-lg text-xs font-semibold text-white" style={{ background: '#ef4444' }}>Sofort beenden</button>
                          : <button onClick={() => setActive(e, true)} className="h-8 px-3 rounded-lg text-xs" style={smallBtn}>Wieder einschalten</button>}
                        <button onClick={() => startEdit(e)} disabled={editing !== null} className="h-8 px-3 rounded-lg text-xs disabled:opacity-30" style={smallBtn}>Bearbeiten</button>
                        <button onClick={() => remove(e)} className="h-8 px-3 rounded-lg text-xs" style={{ ...smallBtn, color: '#EF4444' }}>Löschen</button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
      </div>
    </div>
  )
}