'use client'

// /admin2/halloween – Verwaltung des Halloween-Events
// Ein Halloween-Event = ein Event aus „Events & Countdown“ mit dem Kürzel halloween-JAHR.
// Hier: Jahr anlegen (optional Fragen/Shop/Kürbisse vom Vorjahr übernehmen), Einstellungen, Quizfragen,
// Kürbisse (Platzier-Modus), Shop, Käufe und Spieler. „Sofort beenden“ blendet alles sofort aus.

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '../../lib/auth-context'
import { hasWriteAccess } from '../layout'
import { compressImageFile } from '../../lib/image-compress'

type Diff = 'easy' | 'medium' | 'hard'
type HwListEvent = {
  id: number; slug: string; title: string; accent: string; startsAt: string; endsAt: string; active: boolean
  halloween: null | { enabled: boolean; pumpkins: number; questions: number; items: number; players: number }
}
type Question = { id: number; difficulty: Diff; question: string; answers: string[]; correctIndex: number; timeLimit: number; active: boolean; asked: number; rightCount: number }
type Pumpkin = { id: number; pagePath: string; anchor: string; x: number; y: number; size: number; difficulty: Diff | 'random'; active: boolean; foundBy: number }
type Item = { id: number; name: string; description: string; image: string | null; price: number; stock: number | null; perUserLimit: number | null; rewardType: 'manual' | 'mailbox'; templateId: number | null; position: number; active: boolean; sold: number }
type Purchase = { id: number; itemId: number | null; itemName: string; price: number; status: 'offen' | 'erledigt' | 'zugestellt'; note: string; at: string; user: string; username: string }
type Player = { id: string; name: string; username: string; found: number; earned: number; spent: number; candies: number; correct: number; wrong: number; timeout: number; lastAt: string }
type Detail = {
  event: { id: number; slug: string; title: string; startsAt: string; endsAt: string; active: boolean; href: string | null }
  config: { enabled: boolean; candyFind: number; candy: Record<Diff, number>; shopUntil: string | null; music: string | null }
  questions: Question[]; pumpkins: Pumpkin[]; items: Item[]; purchases: Purchase[]; players: Player[]
  templates: { id: number; name: string }[]
}

const ACCENT = '#f97316'
const inputStyle = { background: 'var(--muted-bg)', border: '1px solid var(--card-border)', color: 'var(--foreground)' }
const smallBtn = { background: 'var(--background)', border: '1px solid var(--card-border)', color: 'var(--foreground)' }
const DIFFS: Diff[] = ['easy', 'medium', 'hard']
const DIFF_LABEL: Record<string, string> = { random: 'Zufällig', easy: 'Einfach', medium: 'Mittel', hard: 'Schwer' }
const DIFF_COLOR: Record<string, string> = { random: '#a855f7', easy: '#22c55e', medium: '#eab308', hard: '#ef4444' }
const TABS = [
  { key: 'settings', label: 'Einstellungen' },
  { key: 'questions', label: 'Quizfragen' },
  { key: 'pumpkins', label: 'Kürbisse' },
  { key: 'shop', label: 'Shop' },
  { key: 'purchases', label: 'Käufe' },
  { key: 'players', label: 'Spieler' },
] as const
type TabKey = typeof TABS[number]['key']

const toLocal = (iso: string | null) => {
  if (!iso) return ''
  const d = new Date(iso)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}
const toIso = (local: string) => (local ? new Date(local).toISOString() : '')
const fmt = (iso: string) => new Date(iso).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })

async function api(url: string, method: string, body?: unknown) {
  const isForm = body instanceof FormData
  const r = await fetch(url, {
    method,
    headers: body && !isForm ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? (isForm ? body : JSON.stringify(body)) : undefined,
  })
  const d = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(d.error || (r.status === 413 ? 'Datei zu groß für den Server' : `Fehler ${r.status}`))
  return d
}

function statusOf(e: { active: boolean; startsAt: string; endsAt: string }, now: number) {
  if (!e.active) return { label: 'Beendet', color: '#6b7280' }
  if (now >= new Date(e.endsAt).getTime()) return { label: 'Vorbei', color: '#6b7280' }
  if (now >= new Date(e.startsAt).getTime()) return { label: 'Läuft gerade', color: '#22c55e' }
  return { label: 'Startet bald', color: '#eab308' }
}

// Platzier-Modus für die nächste Seite einschalten (die Kürbis-Ebene liest das beim Laden)
function armPlacing() {
  try { sessionStorage.setItem('hw-place', '1') } catch { /* egal */ }
}

function Chip({ color, children }: { color: string; children: React.ReactNode }) {
  return <span className="text-xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap" style={{ background: `${color}22`, color }}>{children}</span>
}

// ═════════════════════════════════════════════════════════════════════════════

export default function Admin2HalloweenPage() {
  const { user } = useAuth()
  const pathname = usePathname()
  const canWrite = hasWriteAccess(user?.clan_role, pathname)

  const [events, setEvents] = useState<HwListEvent[]>([])
  const [selected, setSelected] = useState<number | null>(null)
  const [detail, setDetail] = useState<Detail | null>(null)
  const [tab, setTab] = useState<TabKey>('settings')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reloadList, setReloadList] = useState(0)
  const [reloadDetail, setReloadDetail] = useState(0)
  const [now] = useState(() => Date.now())

  const refreshList = () => setReloadList(n => n + 1)
  const refresh = () => setReloadDetail(n => n + 1)

  useEffect(() => {
    if (!user) return
    let alive = true
    fetch('/api/admin2/halloween', { cache: 'no-store' })
      .then(async r => {
        const d = await r.json().catch(() => ({}))
        if (!alive) return
        if (!r.ok) { setError(d.error || 'Fehler beim Laden'); return }
        const list: HwListEvent[] = d.events || []
        setEvents(list)
        setError('')
        setSelected(cur => (cur && list.some(e => e.id === cur) ? cur : (list.find(e => e.halloween && e.active) || list[0])?.id ?? null))
      })
      .catch(() => { if (alive) setError('Fehler beim Laden') })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [user, reloadList])

  const sel = events.find(e => e.id === selected) || null

  useEffect(() => {
    if (!sel?.halloween) return
    let alive = true
    fetch(`/api/admin2/halloween/${sel.id}`, { cache: 'no-store' })
      .then(async r => {
        const d = await r.json().catch(() => ({}))
        if (!alive) return
        if (r.ok) setDetail(d)
        else setError(d.error || 'Fehler beim Laden')
      })
      .catch(() => {})
    return () => { alive = false }
  }, [sel?.id, sel?.halloween, reloadDetail])

  const shownDetail = detail && sel && detail.event.id === sel.id ? detail : null

  const enable = async () => {
    if (!sel) return
    try { await api('/api/admin2/halloween', 'POST', { eventId: sel.id }); refreshList() } catch (e) { alert((e as Error).message) }
  }
  const setActive = async (active: boolean) => {
    if (!sel) return
    if (!active && !confirm('Halloween sofort beenden?\n\nKürbisse, Zähler, Shop-Seite und die Karte auf der Startseite verschwinden sofort für alle. Alle Daten bleiben gespeichert – du kannst es wieder einschalten.')) return
    try { await api(`/api/admin2/events/${sel.id}`, 'PATCH', { active }); refreshList(); refresh() } catch (e) { alert((e as Error).message) }
  }

  const year = sel?.slug.split('-')[1]
  const st = sel ? statusOf(sel, now) : null

  return (
    <div className="max-w-5xl">
      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold mb-1" style={{ color: 'var(--foreground)' }}>🎃 Halloween</h1>
          <p style={{ color: 'var(--muted)' }}>Kürbisjagd mit Quiz, Süßigkeiten und Shop. Jedes Jahr ist ein eigenes Event (halloween-2026, halloween-2027 …).</p>
        </div>
      </div>

      {!canWrite && <div className="card rounded-2xl px-4 py-3 mb-6 text-sm" style={{ color: 'var(--muted)' }}>Du hast hier nur Lesezugriff – bearbeiten dürfen nur Administrator/Owner.</div>}
      {error && <p className="text-sm mb-4" style={{ color: '#EF4444' }}>{error}</p>}

      {loading ? <p className="text-sm" style={{ color: 'var(--muted)' }}>Lädt...</p> : (
        <>
          {/* Jahre */}
          <div className="card rounded-2xl p-4 mb-6">
            <div className="flex items-center gap-2 flex-wrap">
              {events.map(e => (
                <button key={e.id} onClick={() => { setSelected(e.id); setTab('settings') }} className="h-9 px-4 rounded-full text-sm font-medium"
                  style={selected === e.id ? { background: ACCENT, color: '#fff' } : smallBtn}>
                  {e.title}{!e.halloween ? ' (aus)' : ''}
                </button>
              ))}
              {canWrite && <NewYear events={events} onCreated={id => { setSelected(id); refreshList() }} />}
            </div>
            {events.length === 0 && <p className="text-sm mt-3" style={{ color: 'var(--muted)' }}>Noch kein Halloween-Event. Lege oben das erste Jahr an – Start 15.10., Ende 01.11. (lässt sich unter „Events &amp; Countdown“ ändern).</p>}
          </div>

          {sel && !sel.halloween && (
            <div className="card rounded-2xl p-6">
              <p className="text-sm mb-3" style={{ color: 'var(--foreground)' }}>Für <b>{sel.title}</b> ({sel.slug}) ist Halloween noch nicht eingeschaltet.</p>
              {canWrite && <button onClick={enable} className="px-4 py-2 rounded-full text-sm font-medium text-white" style={{ background: ACCENT }}>Halloween einschalten</button>}
            </div>
          )}

          {sel?.halloween && (
            <>
              {/* Kopf des gewählten Jahres */}
              <div className="card rounded-2xl p-5 mb-4" style={{ borderLeft: `4px solid ${sel.active ? ACCENT : '#6b7280'}` }}>
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div>
                    <p className="font-bold text-lg flex items-center gap-2 flex-wrap" style={{ color: 'var(--foreground)' }}>{sel.title} {st && <Chip color={st.color}>{st.label}</Chip>}</p>
                    <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>{fmt(sel.startsAt)} – {fmt(sel.endsAt)} · <Link href="/admin2/events" className="underline">Zeiten ändern</Link></p>
                    <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>
                      {sel.halloween.pumpkins} Kürbisse · {sel.halloween.questions} Fragen · {sel.halloween.items} Shop-Artikel · {sel.halloween.players} Spieler
                    </p>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <Link href={`/halloween/${year}`} target="_blank" className="h-9 px-4 rounded-full text-sm inline-flex items-center" style={smallBtn}>Event-Seite ↗</Link>
                    {canWrite && sel.active && (
                      <Link href="/?hw-place=1" onClick={armPlacing} className="h-9 px-4 rounded-full text-sm font-medium text-white inline-flex items-center" style={{ background: ACCENT }}>Platzier-Modus starten</Link>
                    )}
                    {canWrite && (sel.active
                      ? <button onClick={() => setActive(false)} className="h-9 px-4 rounded-full text-sm font-semibold text-white" style={{ background: '#ef4444' }}>Sofort beenden</button>
                      : <button onClick={() => setActive(true)} className="h-9 px-4 rounded-full text-sm" style={smallBtn}>Wieder einschalten</button>)}
                  </div>
                </div>
              </div>

              {/* Reiter */}
              <div className="flex gap-1 mb-4 flex-wrap">
                {TABS.map(t => {
                  const count = shownDetail ? ({ questions: shownDetail.questions.length, pumpkins: shownDetail.pumpkins.length, shop: shownDetail.items.length, purchases: shownDetail.purchases.filter(p => p.status === 'offen').length, players: shownDetail.players.length } as Record<string, number>)[t.key] : undefined
                  return (
                    <button key={t.key} onClick={() => setTab(t.key)} className="h-9 px-4 rounded-full text-sm font-medium"
                      style={tab === t.key ? { background: 'var(--foreground)', color: 'var(--background)' } : smallBtn}>
                      {t.label}{count ? ` (${count})` : ''}
                    </button>
                  )
                })}
              </div>

              {!shownDetail ? <p className="text-sm" style={{ color: 'var(--muted)' }}>Lädt...</p> : (
                <div key={shownDetail.event.id} className="card rounded-2xl p-5">
                  {tab === 'settings' && <SettingsTab d={shownDetail} canWrite={canWrite} onSaved={() => { refresh(); refreshList() }} />}
                  {tab === 'questions' && <QuestionsTab d={shownDetail} canWrite={canWrite} onChange={() => { refresh(); refreshList() }} />}
                  {tab === 'pumpkins' && <PumpkinsTab d={shownDetail} canWrite={canWrite} onChange={() => { refresh(); refreshList() }} />}
                  {tab === 'shop' && <ShopTab d={shownDetail} canWrite={canWrite} onChange={() => { refresh(); refreshList() }} />}
                  {tab === 'purchases' && <PurchasesTab d={shownDetail} canWrite={canWrite} onChange={refresh} />}
                  {tab === 'players' && <PlayersTab d={shownDetail} canWrite={canWrite} onChange={() => { refresh(); refreshList() }} />}
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  )
}

// ── Neues Jahr ──────────────────────────────────────────────────────────────

function NewYear({ events, onCreated }: { events: HwListEvent[]; onCreated: (id: number) => void }) {
  const [open, setOpen] = useState(false)
  const nextYear = useMemo(() => {
    const years = events.map(e => Number(e.slug.split('-')[1])).filter(Boolean)
    return years.length ? Math.max(...years) + 1 : new Date().getFullYear()
  }, [events])
  const [year, setYear] = useState<number | null>(null)
  const [copyFrom, setCopyFrom] = useState<string>('')
  const [copy, setCopy] = useState({ copyQuestions: true, copyItems: true, copyPumpkins: false })
  const [busy, setBusy] = useState(false)
  const y = year ?? nextYear

  const create = async () => {
    setBusy(true)
    try {
      const d = await api('/api/admin2/halloween', 'POST', { create: { year: y, copyFrom: copyFrom ? Number(copyFrom) : undefined, ...copy } })
      setOpen(false)
      onCreated(d.eventId)
    } catch (e) { alert((e as Error).message) }
    setBusy(false)
  }

  if (!open) return <button onClick={() => setOpen(true)} className="h-9 px-4 rounded-full text-sm" style={smallBtn}>+ Neues Jahr</button>
  const withConfig = events.filter(e => e.halloween)
  return (
    <div className="w-full mt-3 rounded-xl p-4" style={{ background: 'var(--muted-bg)', border: `1px solid ${ACCENT}55` }}>
      <p className="font-bold text-sm mb-3" style={{ color: 'var(--foreground)' }}>Neues Halloween-Jahr</p>
      <div className="flex gap-3 flex-wrap items-end">
        <label className="text-xs" style={{ color: 'var(--muted)' }}>Jahr
          <input type="number" value={y} min={2024} max={2100} onChange={e => setYear(Number(e.target.value))} className="block w-28 mt-1 px-3 py-2 rounded-lg text-sm" style={inputStyle} />
        </label>
        {withConfig.length > 0 && (
          <label className="text-xs" style={{ color: 'var(--muted)' }}>Übernehmen von
            <select value={copyFrom} onChange={e => setCopyFrom(e.target.value)} className="block mt-1 px-3 py-2 rounded-lg text-sm" style={inputStyle}>
              <option value="">– nichts, leer starten –</option>
              {withConfig.map(e => <option key={e.id} value={e.id}>{e.title}</option>)}
            </select>
          </label>
        )}
      </div>
      {copyFrom && (
        <div className="flex gap-4 flex-wrap mt-3 text-sm" style={{ color: 'var(--foreground)' }}>
          <label className="flex items-center gap-2"><input type="checkbox" checked={copy.copyQuestions} onChange={e => setCopy(c => ({ ...c, copyQuestions: e.target.checked }))} /> Quizfragen</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={copy.copyItems} onChange={e => setCopy(c => ({ ...c, copyItems: e.target.checked }))} /> Shop-Artikel</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={copy.copyPumpkins} onChange={e => setCopy(c => ({ ...c, copyPumpkins: e.target.checked }))} /> Kürbis-Verstecke</label>
        </div>
      )}
      <p className="text-xs mt-3" style={{ color: 'var(--muted)' }}>Legt das Event halloween-{y} an: Start 15.10.{y} 00:00, Ende 01.11.{y} 23:59, Link /halloween/{y}. Countdown auf der Startseite sofort sichtbar. Zeiten danach unter „Events &amp; Countdown“ änderbar.</p>
      <div className="flex gap-2 mt-3">
        <button onClick={create} disabled={busy} className="px-4 py-2 rounded-full text-sm font-medium text-white disabled:opacity-50" style={{ background: ACCENT }}>{busy ? 'Legt an…' : 'Anlegen'}</button>
        <button onClick={() => setOpen(false)} className="px-4 py-2 rounded-full text-sm" style={smallBtn}>Abbrechen</button>
      </div>
    </div>
  )
}

// ── Einstellungen ──────────────────────────────────────────────────────────

function SettingsTab({ d, canWrite, onSaved }: { d: Detail; canWrite: boolean; onSaved: () => void }) {
  const c = d.config
  const [enabled, setEnabled] = useState(c.enabled)
  const [find, setFind] = useState(String(c.candyFind))
  const [easy, setEasy] = useState(String(c.candy.easy))
  const [medium, setMedium] = useState(String(c.candy.medium))
  const [hard, setHard] = useState(String(c.candy.hard))
  const [shopUntil, setShopUntil] = useState(toLocal(c.shopUntil))
  const [music, setMusic] = useState<File | null>(null)
  const [removeMusic, setRemoveMusic] = useState(false)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const save = async () => {
    setBusy(true); setMsg('')
    const fd = new FormData()
    fd.append('enabled', String(enabled))
    fd.append('candyFind', find); fd.append('candyEasy', easy); fd.append('candyMedium', medium); fd.append('candyHard', hard)
    fd.append('shopUntil', toIso(shopUntil))
    if (music) fd.append('music', music)
    if (removeMusic) fd.append('removeMusic', 'true')
    try { await api(`/api/admin2/halloween/${d.event.id}`, 'PATCH', fd); setMsg('Gespeichert'); setMusic(null); setRemoveMusic(false); onSaved() }
    catch (e) { setMsg((e as Error).message) }
    setBusy(false)
  }

  const resetAll = async () => {
    const t = prompt('ALLE Funde, Süßigkeiten und Käufe dieses Jahres löschen (z. B. nach dem Testen)?\n\nZum Bestätigen RESET eintippen:')
    if (t !== 'RESET') return
    try { await api(`/api/admin2/halloween/${d.event.id}/reset`, 'POST', { confirm: 'RESET' }); onSaved() } catch (e) { alert((e as Error).message) }
  }

  const num = (label: string, v: string, set: (s: string) => void, hint: string) => (
    <label className="text-xs" style={{ color: 'var(--muted)' }}>{label}
      <input type="number" min={0} max={1000} value={v} disabled={!canWrite} onChange={e => set(e.target.value)} className="w-full mt-1 px-3 py-2 rounded-lg text-sm" style={inputStyle} />
      <span className="block mt-1">{hint}</span>
    </label>
  )

  return (
    <div>
      <h2 className="font-bold text-sm mb-3" style={{ color: 'var(--foreground)' }}>Süßigkeiten</h2>
      <div className="grid gap-3 sm:grid-cols-4">
        {num('Kürbis gefunden', find, setFind, 'für jeden Fund')}
        {num('Einfache Frage', easy, setEasy, 'extra bei richtig')}
        {num('Mittlere Frage', medium, setMedium, 'extra bei richtig')}
        {num('Schwere Frage', hard, setHard, 'extra bei richtig')}
      </div>

      <h2 className="font-bold text-sm mt-6 mb-3" style={{ color: 'var(--foreground)' }}>Shop</h2>
      <label className="text-xs block max-w-xs" style={{ color: 'var(--muted)' }}>Shop offen bis (leer = bis Event-Ende)
        <input type="datetime-local" value={shopUntil} disabled={!canWrite} onChange={e => setShopUntil(e.target.value)} className="w-full mt-1 px-3 py-2 rounded-lg text-sm" style={inputStyle} />
      </label>
      <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>Tipp: ein paar Tage nach dem Event-Ende, damit alle noch einkaufen können.</p>

      <h2 className="font-bold text-sm mt-6 mb-3" style={{ color: 'var(--foreground)' }}>Musik auf der Event-Seite</h2>
      <div className="flex items-center gap-3 flex-wrap">
        {c.music && !removeMusic && !music && <audio controls src={c.music} className="h-9" />}
        {music && <span className="text-sm" style={{ color: 'var(--foreground)' }}>Neu: {music.name}</span>}
        {!c.music && !music && <span className="text-sm" style={{ color: 'var(--muted)' }}>Keine Musik hochgeladen</span>}
        {removeMusic && <span className="text-sm" style={{ color: '#ef4444' }}>Wird beim Speichern entfernt</span>}
        {canWrite && <button onClick={() => fileRef.current?.click()} className="h-9 px-3 rounded-lg text-xs" style={smallBtn}>{c.music ? 'Andere Datei' : 'MP3 hochladen'}</button>}
        {canWrite && c.music && !removeMusic && <button onClick={() => { setRemoveMusic(true); setMusic(null) }} className="h-9 px-3 rounded-lg text-xs" style={{ ...smallBtn, color: '#EF4444' }}>Entfernen</button>}
        <input ref={fileRef} type="file" accept="audio/mpeg,audio/ogg,audio/mp4,.mp3,.ogg,.m4a" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) { setMusic(f); setRemoveMusic(false) } e.target.value = '' }} />
      </div>
      <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>MP3, OGG oder M4A, max. 15 MB. Läuft in Schleife, Besucher können pausieren.</p>

      <h2 className="font-bold text-sm mt-6 mb-3" style={{ color: 'var(--foreground)' }}>Schalter</h2>
      <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--foreground)' }}>
        <input type="checkbox" checked={enabled} disabled={!canWrite} onChange={e => setEnabled(e.target.checked)} /> Kürbisse und Shop eingeschaltet
      </label>
      <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>Aus = keine Kürbisse und kein Shop, die Countdown-Karte auf der Startseite bleibt. Alles auf einmal weg: oben „Sofort beenden“.</p>

      {canWrite && (
        <div className="flex items-center gap-3 mt-6">
          <button onClick={save} disabled={busy} className="px-5 py-2 rounded-full text-sm font-medium text-white disabled:opacity-50" style={{ background: ACCENT }}>{busy ? 'Speichert…' : 'Speichern'}</button>
          {msg && <span className="text-sm" style={{ color: msg === 'Gespeichert' ? '#22c55e' : '#ef4444' }}>{msg}</span>}
        </div>
      )}

      {canWrite && (
        <div className="mt-8 pt-5" style={{ borderTop: '1px solid var(--card-border)' }}>
          <h2 className="font-bold text-sm mb-1" style={{ color: '#ef4444' }}>Testdaten löschen</h2>
          <p className="text-xs mb-3" style={{ color: 'var(--muted)' }}>Vor dem Start können Administrator/Owner schon Kürbisse sammeln und im Shop kaufen (Vorschau). Damit am 15.10. alle bei 0 anfangen: hier alle Funde und Käufe dieses Jahres löschen. Fragen, Kürbisse und Shop bleiben.</p>
          <button onClick={resetAll} className="h-9 px-4 rounded-full text-sm font-semibold text-white" style={{ background: '#ef4444' }}>Alle Funde &amp; Käufe löschen</button>
        </div>
      )}
    </div>
  )
}

// ── Quizfragen ─────────────────────────────────────────────────────────────

type QDraft = { difficulty: Diff; question: string; answers: string[]; correctIndex: number; timeLimit: number; active: boolean }
const emptyQ = (difficulty: Diff = 'easy'): QDraft => ({ difficulty, question: '', answers: ['', ''], correctIndex: 0, timeLimit: difficulty === 'easy' ? 15 : difficulty === 'medium' ? 20 : 25, active: true })

function QuestionsTab({ d, canWrite, onChange }: { d: Detail; canWrite: boolean; onChange: () => void }) {
  const [filter, setFilter] = useState<Diff | 'all'>('all')
  const [editing, setEditing] = useState<number | 'new' | null>(null)
  const [draft, setDraft] = useState<QDraft>(emptyQ())
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const counts = DIFFS.reduce((o, k) => ({ ...o, [k]: d.questions.filter(q => q.difficulty === k && q.active).length }), {} as Record<Diff, number>)
  const list = d.questions.filter(q => filter === 'all' || q.difficulty === filter)

  const startNew = () => { setDraft(emptyQ(filter === 'all' ? 'easy' : filter)); setEditing('new'); setErr('') }
  const startEdit = (q: Question) => { setDraft({ difficulty: q.difficulty, question: q.question, answers: [...q.answers], correctIndex: q.correctIndex, timeLimit: q.timeLimit, active: q.active }); setEditing(q.id); setErr('') }
  const save = async () => {
    setBusy(true); setErr('')
    try {
      if (editing === 'new') await api(`/api/admin2/halloween/${d.event.id}/questions`, 'POST', draft)
      else await api(`/api/admin2/halloween/${d.event.id}/questions/${editing}`, 'PATCH', draft)
      if (editing === 'new') setDraft(emptyQ(draft.difficulty)); else setEditing(null)
      onChange()
    } catch (e) { setErr((e as Error).message) }
    setBusy(false)
  }
  const toggle = async (q: Question) => { try { await api(`/api/admin2/halloween/${d.event.id}/questions/${q.id}`, 'PATCH', { active: !q.active }); onChange() } catch (e) { alert((e as Error).message) } }
  const remove = async (q: Question) => {
    if (!confirm(`Frage löschen?\n\n${q.question}`)) return
    try { await api(`/api/admin2/halloween/${d.event.id}/questions/${q.id}`, 'DELETE'); onChange() } catch (e) { alert((e as Error).message) }
  }

  const setAns = (i: number, v: string) => setDraft(x => ({ ...x, answers: x.answers.map((a, j) => (j === i ? v : a)) }))
  const addAns = () => setDraft(x => (x.answers.length < 4 ? { ...x, answers: [...x.answers, ''] } : x))
  const delAns = (i: number) => setDraft(x => {
    if (x.answers.length <= 2) return x
    const answers = x.answers.filter((_, j) => j !== i)
    const correctIndex = x.correctIndex === i ? 0 : x.correctIndex > i ? x.correctIndex - 1 : x.correctIndex
    return { ...x, answers, correctIndex }
  })

  const editor = (
    <div className="rounded-xl p-4 mb-3" style={{ background: 'var(--muted-bg)', border: `1px solid ${ACCENT}55` }}>
      <p className="font-bold text-sm mb-3" style={{ color: 'var(--foreground)' }}>{editing === 'new' ? 'Neue Frage' : 'Frage bearbeiten'}</p>
      <div className="flex gap-2 mb-3 flex-wrap">
        {DIFFS.map(k => (
          <button key={k} onClick={() => setDraft(x => ({ ...x, difficulty: k }))} className="h-8 px-3 rounded-full text-xs font-semibold"
            style={draft.difficulty === k ? { background: DIFF_COLOR[k], color: '#fff' } : smallBtn}>{DIFF_LABEL[k]} (+{d.config.candy[k]})</button>
        ))}
      </div>
      <textarea value={draft.question} maxLength={300} rows={2} placeholder="Frage, z. B. Welches Mob droppt Knochen?" onChange={e => setDraft(x => ({ ...x, question: e.target.value }))} className="w-full px-3 py-2 rounded-lg text-sm" style={inputStyle} />
      <p className="text-xs mt-3 mb-2" style={{ color: 'var(--muted)' }}>Antworten (2–4) – Kreis = richtige Antwort</p>
      <div className="space-y-2">
        {draft.answers.map((a, i) => (
          <div key={i} className="flex items-center gap-2">
            <input type="radio" name="correct" checked={draft.correctIndex === i} onChange={() => setDraft(x => ({ ...x, correctIndex: i }))} aria-label={`Antwort ${i + 1} ist richtig`} />
            <input value={a} maxLength={120} placeholder={`Antwort ${String.fromCharCode(65 + i)}`} onChange={e => setAns(i, e.target.value)} className="flex-1 px-3 py-2 rounded-lg text-sm"
              style={{ ...inputStyle, ...(draft.correctIndex === i ? { borderColor: '#22c55e' } : {}) }} />
            {draft.answers.length > 2 && <button onClick={() => delAns(i)} className="h-8 w-8 rounded-lg text-xs" style={{ ...smallBtn, color: '#EF4444' }} aria-label="Antwort entfernen">✕</button>}
          </div>
        ))}
      </div>
      {draft.answers.length < 4 && <button onClick={addAns} className="h-8 px-3 rounded-lg text-xs mt-2" style={smallBtn}>+ Antwort</button>}
      <div className="flex gap-4 items-end flex-wrap mt-3">
        <label className="text-xs" style={{ color: 'var(--muted)' }}>Zeit (Sekunden)
          <input type="number" min={5} max={120} value={draft.timeLimit} onChange={e => setDraft(x => ({ ...x, timeLimit: Number(e.target.value) }))} className="block w-28 mt-1 px-3 py-2 rounded-lg text-sm" style={inputStyle} />
        </label>
        <label className="flex items-center gap-2 text-sm pb-2" style={{ color: 'var(--foreground)' }}>
          <input type="checkbox" checked={draft.active} onChange={e => setDraft(x => ({ ...x, active: e.target.checked }))} /> Aktiv
        </label>
      </div>
      {err && <p className="text-xs mt-3" style={{ color: '#EF4444' }}>{err}</p>}
      <div className="flex gap-2 mt-4">
        <button onClick={save} disabled={busy || !draft.question.trim()} className="px-4 py-2 rounded-full text-sm font-medium text-white disabled:opacity-50" style={{ background: ACCENT }}>{busy ? 'Speichert…' : editing === 'new' ? 'Speichern & nächste' : 'Speichern'}</button>
        <button onClick={() => setEditing(null)} className="px-4 py-2 rounded-full text-sm" style={smallBtn}>{editing === 'new' ? 'Fertig' : 'Abbrechen'}</button>
      </div>
    </div>
  )

  return (
    <div>
      <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
        <div className="flex gap-1 flex-wrap">
          <button onClick={() => setFilter('all')} className="h-8 px-3 rounded-full text-xs font-medium" style={filter === 'all' ? { background: 'var(--foreground)', color: 'var(--background)' } : smallBtn}>Alle ({d.questions.length})</button>
          {DIFFS.map(k => (
            <button key={k} onClick={() => setFilter(k)} className="h-8 px-3 rounded-full text-xs font-medium" style={filter === k ? { background: DIFF_COLOR[k], color: '#fff' } : smallBtn}>{DIFF_LABEL[k]} ({counts[k]})</button>
          ))}
        </div>
        {canWrite && editing === null && <button onClick={startNew} className="px-4 py-2 rounded-full text-sm font-medium text-white" style={{ background: ACCENT }}>+ Neue Frage</button>}
      </div>
      {DIFFS.some(k => counts[k] === 0) && (
        <p className="text-xs mb-3" style={{ color: 'var(--muted)' }}>
          Ohne Fragen in einer Schwierigkeit wird bei „Zufällig“ einfach eine andere genommen. Gibt es gar keine Fragen, bekommt man nur die Süßigkeiten fürs Finden.
          Jeder Spieler bekommt möglichst keine Frage doppelt – also lieber viele Fragen anlegen.
        </p>
      )}
      {editing === 'new' && editor}
      {list.length === 0 ? <p className="text-sm" style={{ color: 'var(--muted)' }}>Noch keine Fragen.</p> : (
        <div className="space-y-2">
          {list.map(q => editing === q.id ? <div key={q.id}>{editor}</div> : (
            <div key={q.id} className="rounded-xl p-3" style={{ background: 'var(--muted-bg)', opacity: q.active ? 1 : 0.55, borderLeft: `4px solid ${DIFF_COLOR[q.difficulty]}` }}>
              <div className="flex items-start gap-3 flex-wrap">
                <div className="flex-1 min-w-[220px]">
                  <p className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>{q.question}</p>
                  <div className="flex gap-1.5 flex-wrap mt-2">
                    {q.answers.map((a, i) => (
                      <span key={i} className="text-xs px-2 py-1 rounded-lg" style={i === q.correctIndex ? { background: '#22c55e22', color: '#22c55e', fontWeight: 600 } : { background: 'var(--background)', color: 'var(--muted)' }}>{a}</span>
                    ))}
                  </div>
                  <p className="text-xs mt-2" style={{ color: 'var(--muted)' }}>
                    {DIFF_LABEL[q.difficulty]} · {q.timeLimit} s · {q.asked}× gestellt{q.asked ? ` · ${Math.round((q.rightCount / q.asked) * 100)} % richtig` : ''}{q.active ? '' : ' · inaktiv'}
                  </p>
                </div>
                {canWrite && (
                  <div className="flex gap-1">
                    <button onClick={() => toggle(q)} className="h-8 px-3 rounded-lg text-xs" style={smallBtn}>{q.active ? 'Deaktivieren' : 'Aktivieren'}</button>
                    <button onClick={() => startEdit(q)} disabled={editing !== null} className="h-8 px-3 rounded-lg text-xs disabled:opacity-30" style={smallBtn}>Bearbeiten</button>
                    <button onClick={() => remove(q)} className="h-8 px-3 rounded-lg text-xs" style={{ ...smallBtn, color: '#EF4444' }}>Löschen</button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Kürbisse ───────────────────────────────────────────────────────────────

function PumpkinsTab({ d, canWrite, onChange }: { d: Detail; canWrite: boolean; onChange: () => void }) {
  const groups = useMemo(() => {
    const m = new Map<string, Pumpkin[]>()
    for (const p of d.pumpkins) m.set(p.pagePath, [...(m.get(p.pagePath) || []), p])
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  }, [d.pumpkins])
  const active = d.pumpkins.filter(p => p.active)
  const byDiff = (['random', ...DIFFS] as const).map(k => ({ k, n: active.filter(p => p.difficulty === k).length }))

  const patch = async (p: Pumpkin, body: Record<string, unknown>) => { try { await api(`/api/admin2/halloween/${d.event.id}/pumpkins/${p.id}`, 'PATCH', body); onChange() } catch (e) { alert((e as Error).message) } }
  const remove = async (p: Pumpkin) => {
    if (!confirm(p.foundBy ? `Diesen Kürbis haben ${p.foundBy} Spieler gefunden – sie verlieren die Süßigkeiten dafür. Trotzdem löschen?` : 'Kürbis löschen?')) return
    try { await api(`/api/admin2/halloween/${d.event.id}/pumpkins/${p.id}`, 'DELETE'); onChange() } catch (e) { alert((e as Error).message) }
  }

  return (
    <div>
      <div className="flex items-start justify-between gap-3 flex-wrap mb-4">
        <div>
          <p className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>{active.length} <span className="text-sm font-normal" style={{ color: 'var(--muted)' }}>aktive Kürbisse auf {groups.length} Seiten</span></p>
          <div className="flex gap-1.5 flex-wrap mt-2">{byDiff.map(x => <Chip key={x.k} color={DIFF_COLOR[x.k]}>{DIFF_LABEL[x.k]}: {x.n}</Chip>)}</div>
        </div>
        {canWrite && <Link href="/?hw-place=1" onClick={armPlacing} className="px-4 py-2 rounded-full text-sm font-medium text-white" style={{ background: ACCENT }}>Platzier-Modus starten</Link>}
      </div>
      <p className="text-xs mb-4" style={{ color: 'var(--muted)' }}>
        So geht&apos;s: „Platzier-Modus starten“ → du landest auf der Startseite mit einer Leiste unten. Jeder Klick versteckt dort einen Kürbis. Zum Wechseln der Seite „Klick versteckt Kürbis“ ausschalten, hinnavigieren, wieder einschalten.
        Kürbisse hängen an dem Bereich, auf den du klickst, und wandern mit, wenn die Seite auf dem Handy anders aussieht. Elemente, die es nur am PC gibt, sind auf dem Handy nicht sichtbar – dort also lieber nicht verstecken.
      </p>
      {groups.length === 0 ? <p className="text-sm" style={{ color: 'var(--muted)' }}>Noch keine Kürbisse versteckt.</p> : groups.map(([path, list]) => (
        <div key={path} className="mb-4">
          <div className="flex items-center justify-between gap-2 mb-2">
            <p className="text-sm font-semibold font-mono" style={{ color: 'var(--foreground)' }}>{path} <span className="font-sans font-normal text-xs" style={{ color: 'var(--muted)' }}>({list.length})</span></p>
            {canWrite && <Link href={`${path}?hw-place=1`} onClick={armPlacing} className="text-xs underline" style={{ color: ACCENT }}>Hier platzieren ↗</Link>}
          </div>
          <div className="space-y-1.5">
            {list.map(p => (
              <div key={p.id} className="flex items-center gap-2 rounded-lg px-3 py-2 flex-wrap text-xs" style={{ background: 'var(--muted-bg)', opacity: p.active ? 1 : 0.5 }}>
                <span className="font-mono" style={{ color: 'var(--muted)' }}>#{p.id}</span>
                <span className="flex-1 min-w-[120px]" style={{ color: 'var(--muted)' }}>Größe {p.size} · gefunden von {p.foundBy}</span>
                {canWrite ? (
                  <>
                    <select value={p.difficulty} onChange={e => patch(p, { difficulty: e.target.value })} className="px-2 py-1 rounded-lg text-xs" style={inputStyle}>
                      {(['random', ...DIFFS] as const).map(k => <option key={k} value={k}>{DIFF_LABEL[k]}</option>)}
                    </select>
                    <button onClick={() => patch(p, { active: !p.active })} className="h-7 px-2 rounded-lg" style={smallBtn}>{p.active ? 'Ausblenden' : 'Einblenden'}</button>
                    <button onClick={() => remove(p)} className="h-7 px-2 rounded-lg" style={{ ...smallBtn, color: '#EF4444' }}>Löschen</button>
                  </>
                ) : <Chip color={DIFF_COLOR[p.difficulty]}>{DIFF_LABEL[p.difficulty]}</Chip>}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Shop ───────────────────────────────────────────────────────────────────

type IDraft = { name: string; description: string; price: string; stock: string; perUserLimit: string; rewardType: 'manual' | 'mailbox'; templateId: string; position: string; active: boolean; file: File | null; preview: string | null; removeImage: boolean }
const emptyItem = (): IDraft => ({ name: '', description: '', price: '20', stock: '', perUserLimit: '', rewardType: 'manual', templateId: '', position: '0', active: true, file: null, preview: null, removeImage: false })

function ShopTab({ d, canWrite, onChange }: { d: Detail; canWrite: boolean; onChange: () => void }) {
  const [editing, setEditing] = useState<number | 'new' | null>(null)
  const [draft, setDraft] = useState<IDraft>(emptyItem())
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const set = (p: Partial<IDraft>) => setDraft(x => ({ ...x, ...p }))

  const startNew = () => { setDraft({ ...emptyItem(), position: String(d.items.length) }); setEditing('new'); setErr('') }
  const startEdit = (it: Item) => {
    setDraft({
      name: it.name, description: it.description, price: String(it.price), stock: it.stock == null ? '' : String(it.stock),
      perUserLimit: it.perUserLimit == null ? '' : String(it.perUserLimit), rewardType: it.rewardType, templateId: it.templateId == null ? '' : String(it.templateId),
      position: String(it.position), active: it.active, file: null, preview: it.image, removeImage: false,
    })
    setEditing(it.id); setErr('')
  }
  const save = async () => {
    setBusy(true); setErr('')
    const fd = new FormData()
    fd.append('name', draft.name); fd.append('description', draft.description); fd.append('price', draft.price)
    fd.append('stock', draft.stock); fd.append('perUserLimit', draft.perUserLimit); fd.append('rewardType', draft.rewardType)
    fd.append('templateId', draft.templateId); fd.append('position', draft.position); fd.append('active', String(draft.active))
    if (draft.file) fd.append('file', draft.file)
    if (draft.removeImage) fd.append('removeImage', 'true')
    try {
      await api(editing === 'new' ? `/api/admin2/halloween/${d.event.id}/items` : `/api/admin2/halloween/${d.event.id}/items/${editing}`, editing === 'new' ? 'POST' : 'PATCH', fd)
      setEditing(null); onChange()
    } catch (e) { setErr((e as Error).message) }
    setBusy(false)
  }
  const toggle = async (it: Item) => { try { await api(`/api/admin2/halloween/${d.event.id}/items/${it.id}`, 'PATCH', { active: !it.active }); onChange() } catch (e) { alert((e as Error).message) } }
  const remove = async (it: Item) => {
    if (!confirm(`„${it.name}“ löschen? Bisherige Käufe bleiben in der Liste.`)) return
    try { await api(`/api/admin2/halloween/${d.event.id}/items/${it.id}`, 'DELETE'); onChange() } catch (e) { alert((e as Error).message) }
  }
  const pick = async (f: File) => { const c = await compressImageFile(f); set({ file: c, preview: URL.createObjectURL(c), removeImage: false }) }

  const editor = (
    <div className="rounded-xl p-4 mb-3" style={{ background: 'var(--muted-bg)', border: `1px solid ${ACCENT}55` }}>
      <p className="font-bold text-sm mb-3" style={{ color: 'var(--foreground)' }}>{editing === 'new' ? 'Neuer Artikel' : 'Artikel bearbeiten'}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-xs sm:col-span-2" style={{ color: 'var(--muted)' }}>Name
          <input value={draft.name} maxLength={80} placeholder="z. B. Kürbis-Kopf" onChange={e => set({ name: e.target.value })} className="w-full mt-1 px-3 py-2 rounded-lg text-sm" style={inputStyle} />
        </label>
        <label className="text-xs sm:col-span-2" style={{ color: 'var(--muted)' }}>Beschreibung (optional)
          <textarea value={draft.description} maxLength={400} rows={2} onChange={e => set({ description: e.target.value })} className="w-full mt-1 px-3 py-2 rounded-lg text-sm" style={inputStyle} />
        </label>
        <label className="text-xs" style={{ color: 'var(--muted)' }}>Preis (Süßigkeiten)
          <input type="number" min={0} value={draft.price} onChange={e => set({ price: e.target.value })} className="w-full mt-1 px-3 py-2 rounded-lg text-sm" style={inputStyle} />
        </label>
        <label className="text-xs" style={{ color: 'var(--muted)' }}>Reihenfolge (kleiner = weiter vorne)
          <input type="number" value={draft.position} onChange={e => set({ position: e.target.value })} className="w-full mt-1 px-3 py-2 rounded-lg text-sm" style={inputStyle} />
        </label>
        <label className="text-xs" style={{ color: 'var(--muted)' }}>Bestand gesamt (leer = unbegrenzt)
          <input type="number" min={0} value={draft.stock} onChange={e => set({ stock: e.target.value })} className="w-full mt-1 px-3 py-2 rounded-lg text-sm" style={inputStyle} />
        </label>
        <label className="text-xs" style={{ color: 'var(--muted)' }}>Max. pro Spieler (leer = unbegrenzt)
          <input type="number" min={1} value={draft.perUserLimit} onChange={e => set({ perUserLimit: e.target.value })} className="w-full mt-1 px-3 py-2 rounded-lg text-sm" style={inputStyle} />
        </label>
      </div>

      <p className="text-xs mt-4 mb-2" style={{ color: 'var(--muted)' }}>Wie bekommt man es?</p>
      <div className="flex gap-2 flex-wrap">
        <button onClick={() => set({ rewardType: 'manual' })} className="h-8 px-3 rounded-full text-xs font-semibold" style={draft.rewardType === 'manual' ? { background: ACCENT, color: '#fff' } : smallBtn}>Team vergibt von Hand</button>
        <button onClick={() => set({ rewardType: 'mailbox' })} className="h-8 px-3 rounded-full text-xs font-semibold" style={draft.rewardType === 'mailbox' ? { background: ACCENT, color: '#fff' } : smallBtn}>Automatisch in die Ingame-Mailbox</button>
      </div>
      {draft.rewardType === 'manual'
        ? <p className="text-xs mt-2" style={{ color: 'var(--muted)' }}>Käufe landen im Reiter „Käufe“ – dort auf „Erledigt“ setzen, wenn vergeben (z. B. Rang, Discord-Rolle, Item).</p>
        : (
          <label className="text-xs block mt-2" style={{ color: 'var(--muted)' }}>Admin-Item (aus „Admin-Items“)
            <select value={draft.templateId} onChange={e => set({ templateId: e.target.value })} className="block w-full max-w-sm mt-1 px-3 py-2 rounded-lg text-sm" style={inputStyle}>
              <option value="">– auswählen –</option>
              {d.templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            <span className="block mt-1">Spieler brauchen einen verknüpften Minecraft-Account.{d.templates.length === 0 ? ' Noch keine Admin-Items vorhanden.' : ''}</span>
          </label>
        )}

      <p className="text-xs mt-4 mb-2" style={{ color: 'var(--muted)' }}>Bild (optional)</p>
      <div className="flex items-center gap-3 flex-wrap">
        <div className="w-24 h-16 rounded-lg overflow-hidden flex-shrink-0" style={{ background: '#2a1638' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {draft.preview && <img src={draft.preview} alt="" className="w-full h-full object-cover" />}
        </div>
        <button onClick={() => fileRef.current?.click()} className="h-9 px-3 rounded-lg text-xs" style={smallBtn}>{draft.preview ? 'Anderes Bild' : 'Bild hochladen'}</button>
        {draft.preview && <button onClick={() => set({ file: null, preview: null, removeImage: true })} className="h-9 px-3 rounded-lg text-xs" style={{ ...smallBtn, color: '#EF4444' }}>Bild entfernen</button>}
        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) pick(f); e.target.value = '' }} />
      </div>

      <label className="flex items-center gap-2 text-sm mt-4" style={{ color: 'var(--foreground)' }}>
        <input type="checkbox" checked={draft.active} onChange={e => set({ active: e.target.checked })} /> Im Shop sichtbar
      </label>
      {err && <p className="text-xs mt-3" style={{ color: '#EF4444' }}>{err}</p>}
      <div className="flex gap-2 mt-4">
        <button onClick={save} disabled={busy || !draft.name.trim()} className="px-4 py-2 rounded-full text-sm font-medium text-white disabled:opacity-50" style={{ background: ACCENT }}>{busy ? 'Speichert…' : 'Speichern'}</button>
        <button onClick={() => setEditing(null)} className="px-4 py-2 rounded-full text-sm" style={smallBtn}>Abbrechen</button>
      </div>
    </div>
  )

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-bold text-sm" style={{ color: 'var(--foreground)' }}>Shop-Artikel ({d.items.length})</h2>
        {canWrite && editing === null && <button onClick={startNew} className="px-4 py-2 rounded-full text-sm font-medium text-white" style={{ background: ACCENT }}>+ Neuer Artikel</button>}
      </div>
      {editing === 'new' && editor}
      {d.items.length === 0 && editing !== 'new' ? <p className="text-sm" style={{ color: 'var(--muted)' }}>Noch keine Artikel.</p> : (
        <div className="space-y-2">
          {d.items.map(it => editing === it.id ? <div key={it.id}>{editor}</div> : (
            <div key={it.id} className="flex items-center gap-3 rounded-xl p-3 flex-wrap" style={{ background: 'var(--muted-bg)', opacity: it.active ? 1 : 0.55 }}>
              <div className="w-16 h-12 rounded-lg overflow-hidden flex-shrink-0" style={{ background: '#2a1638' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {it.image && <img src={it.image} alt="" className="w-full h-full object-cover" />}
              </div>
              <div className="flex-1 min-w-[200px]">
                <p className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>{it.name} <span className="font-normal" style={{ color: ACCENT }}>· {it.price} Süßigkeiten</span></p>
                <p className="text-xs" style={{ color: 'var(--muted)' }}>
                  {it.sold} verkauft{it.stock != null ? ` · Bestand ${Math.max(0, it.stock - it.sold)}/${it.stock}` : ''}{it.perUserLimit != null ? ` · max. ${it.perUserLimit}× pro Spieler` : ''}
                  {' · '}{it.rewardType === 'mailbox' ? `Mailbox: ${d.templates.find(t => t.id === it.templateId)?.name || 'Item fehlt!'}` : 'von Hand'}{it.active ? '' : ' · ausgeblendet'}
                </p>
              </div>
              {canWrite && (
                <div className="flex gap-1">
                  <button onClick={() => toggle(it)} className="h-8 px-3 rounded-lg text-xs" style={smallBtn}>{it.active ? 'Ausblenden' : 'Einblenden'}</button>
                  <button onClick={() => startEdit(it)} disabled={editing !== null} className="h-8 px-3 rounded-lg text-xs disabled:opacity-30" style={smallBtn}>Bearbeiten</button>
                  <button onClick={() => remove(it)} className="h-8 px-3 rounded-lg text-xs" style={{ ...smallBtn, color: '#EF4444' }}>Löschen</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Käufe ──────────────────────────────────────────────────────────────────

const P_STATUS: Record<Purchase['status'], { label: string; color: string }> = {
  offen: { label: 'Offen', color: '#eab308' },
  erledigt: { label: 'Erledigt', color: '#22c55e' },
  zugestellt: { label: 'In Mailbox', color: '#3b82f6' },
}

function PurchasesTab({ d, canWrite, onChange }: { d: Detail; canWrite: boolean; onChange: () => void }) {
  const [onlyOpen, setOnlyOpen] = useState(true)
  const list = d.purchases.filter(p => !onlyOpen || p.status === 'offen')

  const setStatus = async (p: Purchase, status: Purchase['status'], note = p.note) => { try { await api(`/api/admin2/halloween/${d.event.id}/purchases/${p.id}`, 'PATCH', { status, note }); onChange() } catch (e) { alert((e as Error).message) } }
  const editNote = (p: Purchase) => { const n = prompt('Notiz (z. B. „Rang vergeben am 20.10.“):', p.note); if (n !== null) setStatus(p, p.status, n) }
  const cancel = async (p: Purchase) => {
    if (!confirm(`Kauf von ${p.user} stornieren?\n\n${p.itemName} – ${p.price} Süßigkeiten gehen zurück an den Spieler.${p.status === 'zugestellt' ? '\n\nAchtung: das Item liegt evtl. schon in der Ingame-Mailbox.' : ''}`)) return
    try { await api(`/api/admin2/halloween/${d.event.id}/purchases/${p.id}`, 'DELETE'); onChange() } catch (e) { alert((e as Error).message) }
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <h2 className="font-bold text-sm" style={{ color: 'var(--foreground)' }}>Käufe ({d.purchases.length}) · offen: {d.purchases.filter(p => p.status === 'offen').length}</h2>
        <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--foreground)' }}><input type="checkbox" checked={onlyOpen} onChange={e => setOnlyOpen(e.target.checked)} /> Nur offene</label>
      </div>
      {list.length === 0 ? <p className="text-sm" style={{ color: 'var(--muted)' }}>{onlyOpen ? 'Keine offenen Käufe.' : 'Noch keine Käufe.'}</p> : (
        <div className="space-y-2">
          {list.map(p => (
            <div key={p.id} className="flex items-center gap-3 rounded-xl p-3 flex-wrap" style={{ background: 'var(--muted-bg)' }}>
              <div className="flex-1 min-w-[200px]">
                <p className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>{p.itemName} <span className="font-normal" style={{ color: 'var(--muted)' }}>für {p.user}{p.user !== p.username ? ` (${p.username})` : ''}</span></p>
                <p className="text-xs" style={{ color: 'var(--muted)' }}>{fmt(p.at)} · {p.price} Süßigkeiten{p.note ? ` · ${p.note}` : ''}</p>
              </div>
              <Chip color={P_STATUS[p.status].color}>{P_STATUS[p.status].label}</Chip>
              {canWrite && (
                <div className="flex gap-1">
                  {p.status === 'offen'
                    ? <button onClick={() => setStatus(p, 'erledigt')} className="h-8 px-3 rounded-lg text-xs font-semibold text-white" style={{ background: '#22c55e' }}>Erledigt</button>
                    : p.status === 'erledigt' && <button onClick={() => setStatus(p, 'offen')} className="h-8 px-3 rounded-lg text-xs" style={smallBtn}>Wieder offen</button>}
                  <button onClick={() => editNote(p)} className="h-8 px-3 rounded-lg text-xs" style={smallBtn}>Notiz</button>
                  <button onClick={() => cancel(p)} className="h-8 px-3 rounded-lg text-xs" style={{ ...smallBtn, color: '#EF4444' }}>Stornieren</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Spieler ────────────────────────────────────────────────────────────────

function PlayersTab({ d, canWrite, onChange }: { d: Detail; canWrite: boolean; onChange: () => void }) {
  const [q, setQ] = useState('')
  const list = d.players.filter(p => !q || p.name.toLowerCase().includes(q.toLowerCase()) || p.username.toLowerCase().includes(q.toLowerCase()))
  const reset = async (p: Player) => {
    if (!confirm(`Fortschritt von ${p.name} löschen?\n\nAlle ${p.found} Funde, ${p.earned} Süßigkeiten und Käufe dieses Jahres werden gelöscht.`)) return
    try { await api(`/api/admin2/halloween/${d.event.id}/players/${p.id}`, 'DELETE'); onChange() } catch (e) { alert((e as Error).message) }
  }
  const total = d.players.reduce((s, p) => s + p.found, 0)
  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <h2 className="font-bold text-sm" style={{ color: 'var(--foreground)' }}>{d.players.length} Spieler · {total} Funde insgesamt</h2>
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Spieler suchen" className="px-3 py-2 rounded-lg text-sm" style={inputStyle} />
      </div>
      {list.length === 0 ? <p className="text-sm" style={{ color: 'var(--muted)' }}>Noch niemand.</p> : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm" style={{ color: 'var(--foreground)' }}>
            <thead>
              <tr className="text-xs text-left" style={{ color: 'var(--muted)' }}>
                <th className="py-2 pr-3">#</th><th className="py-2 pr-3">Spieler</th><th className="py-2 pr-3">Kürbisse</th><th className="py-2 pr-3">Richtig / Falsch / Zeit</th>
                <th className="py-2 pr-3">Gesammelt</th><th className="py-2 pr-3">Ausgegeben</th><th className="py-2 pr-3">Übrig</th><th className="py-2 pr-3">Zuletzt</th>{canWrite && <th />}
              </tr>
            </thead>
            <tbody>
              {list.map((p, i) => (
                <tr key={p.id} style={{ borderTop: '1px solid var(--card-border)' }}>
                  <td className="py-2 pr-3" style={{ color: 'var(--muted)' }}>{i + 1}</td>
                  <td className="py-2 pr-3 font-semibold">{p.name}{p.name !== p.username && <span className="font-normal text-xs" style={{ color: 'var(--muted)' }}> ({p.username})</span>}</td>
                  <td className="py-2 pr-3">{p.found}</td>
                  <td className="py-2 pr-3"><span style={{ color: '#22c55e' }}>{p.correct}</span> / <span style={{ color: '#ef4444' }}>{p.wrong}</span> / <span style={{ color: 'var(--muted)' }}>{p.timeout}</span></td>
                  <td className="py-2 pr-3">{p.earned}</td>
                  <td className="py-2 pr-3">{p.spent}</td>
                  <td className="py-2 pr-3 font-semibold" style={{ color: ACCENT }}>{p.candies}</td>
                  <td className="py-2 pr-3 text-xs" style={{ color: 'var(--muted)' }}>{p.lastAt ? fmt(p.lastAt) : ''}</td>
                  {canWrite && <td className="py-2"><button onClick={() => reset(p)} className="h-7 px-2 rounded-lg text-xs" style={{ ...smallBtn, color: '#EF4444' }}>Zurücksetzen</button></td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}