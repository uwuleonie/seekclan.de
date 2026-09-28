'use client'

// Kalender: Monat, Woche, Liste.
// - Termine anlegen, bearbeiten, löschen
// - Verschieben per Ziehen (Maus: einfach ziehen · Handy: kurz gedrückt halten, dann ziehen)
// - Wiederholungen (täglich, werktags, wöchentlich, 14-tägig, monatlich, jährlich) mit Enddatum
// - Erinnerung vorher (Push + Glocke)
// - Klausuren/Tests aus dem Stundenplan und fällige Reminder erscheinen automatisch mit

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import Icon from '../_components/Icon'
import Portal from '../_components/Portal'
import { usePrivate } from '../_components/PrivateShell'
import { RECURRENCES, RECURRENCE_LABEL, type Recurrence } from '@/app/lib/recurrence'
import {
  EVENT_COLORS, EXAM_KIND, REMIND_OPTIONS, WEEKDAYS_MO, addDays, api, dateKey, fmtDayLong, fmtTime, fromKeys,
  occurrencesIn, relDay, sameDay, startOfDay, startOfWeek, timeKey,
  type Occ, type PEvent, type PExam, type PSubject, type PTask,
} from '../_lib/planner'

type View = 'month' | 'week' | 'list'
const HOUR_PX = 48

interface Draft {
  id: number | null
  occStart: Date | null // angeklicktes Vorkommen (bei Serien)
  title: string
  allDay: boolean
  date: string
  endDate: string
  start: string
  end: string
  recurrence: Recurrence
  until: string
  remind: number | null
  color: string
  location: string
  description: string
}

function readPref<T extends string>(key: string, fallback: T): T {
  try { return (localStorage.getItem(key) as T) || fallback } catch { return fallback }
}

export default function CalendarPage() {
  const { toast } = usePrivate()
  const [view, setView] = useState<View>('month')
  const [cursor, setCursor] = useState(() => startOfDay(new Date()))
  const [events, setEvents] = useState<PEvent[]>([])
  const [exams, setExams] = useState<PExam[]>([])
  const [subjects, setSubjects] = useState<PSubject[]>([])
  const [tasks, setTasks] = useState<PTask[]>([])
  const [error, setError] = useState<string | null>(null)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [saving, setSaving] = useState(false)
  const [now, setNow] = useState(() => new Date())

  // Ziehen
  const [drag, setDrag] = useState<{ occ: Occ; x: number; y: number; target: { date: string; minutes: number | null } | null } | null>(null)
  const pressRef = useRef<{ occ: Occ; x: number; y: number; timer: ReturnType<typeof setTimeout> | null; active: boolean; pointerType: string } | null>(null)
  const weekScroll = useRef<HTMLDivElement>(null)
  // Nach dem Loslassen feuert der Browser noch einen Klick auf die Zelle → der darf keinen neuen Termin öffnen
  const suppressClick = useRef(false)

  useEffect(() => {
    const isPhone = window.matchMedia('(max-width: 860px)').matches
    setView(readPref<View>('pv-cal-view', isPhone ? 'list' : 'month'))
    const d = new URLSearchParams(window.location.search).get('date')
    if (d && /^\d{4}-\d{2}-\d{2}$/.test(d)) setCursor(fromKeys(d))
    const iv = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(iv)
  }, [])

  const changeView = (v: View) => {
    setView(v)
    try { localStorage.setItem('pv-cal-view', v) } catch { /* egal */ }
  }

  /* ── Zeitraum der aktuellen Ansicht ── */
  const range = useMemo(() => {
    if (view === 'week') {
      const from = startOfWeek(cursor)
      return { from, to: addDays(from, 7) }
    }
    if (view === 'list') {
      const from = startOfDay(cursor)
      return { from, to: addDays(from, 60) }
    }
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1)
    const from = startOfWeek(first)
    return { from, to: addDays(from, 42) }
  }, [view, cursor])

  const load = useCallback(async () => {
    try {
      const [ev, ex, su, ta] = await Promise.all([
        api<PEvent[]>(`planer/events?from=${range.from.toISOString()}&to=${range.to.toISOString()}`),
        api<PExam[]>('planer/exams').catch(() => []),
        api<PSubject[]>('planer/subjects').catch(() => []),
        api<PTask[]>('planer/tasks').catch(() => []),
      ])
      setEvents(ev)
      setExams(ex)
      setSubjects(su)
      setTasks(ta)
      setError(null)
    } catch (err) {
      setError((err as Error).message)
    }
  }, [range])

  useEffect(() => { load() }, [load])

  /* Woche: beim Öffnen zu 07:00 scrollen */
  useEffect(() => {
    if (view === 'week' && weekScroll.current) weekScroll.current.scrollTop = 7 * HOUR_PX - 8
  }, [view])

  /* ── Einträge pro Tag ── */
  const occs = useMemo(() => occurrencesIn(events, range.from, range.to), [events, range])
  const subjectName = (id: number | null) => subjects.find(s => s.id === id)?.name ?? ''

  const byDay = useMemo(() => {
    const map = new Map<string, { occs: Occ[]; exams: PExam[]; tasks: PTask[] }>()
    const get = (k: string) => {
      if (!map.has(k)) map.set(k, { occs: [], exams: [], tasks: [] })
      return map.get(k)!
    }
    for (const o of occs) {
      // Mehrtägige Termine an jedem Tag anzeigen
      let d = startOfDay(o.start)
      const last = o.event.all_day ? addDays(startOfDay(o.end), o.end > o.start ? 0 : 0) : startOfDay(new Date(o.end.getTime() - 1))
      let guard = 0
      while (d <= last && guard++ < 62) {
        if (d >= range.from && d < range.to) get(dateKey(d)).occs.push(o)
        d = addDays(d, 1)
      }
      if (guard === 0) get(dateKey(o.start)).occs.push(o)
    }
    for (const e of exams) get(e.exam_date).exams.push(e)
    for (const t of tasks) {
      const at = t.due_at ?? t.remind_at
      if (!at || t.parent_id || t.done) continue
      get(dateKey(new Date(at))).tasks.push(t)
    }
    return map
  }, [occs, exams, tasks, range])

  /* ── Bearbeiten ── */
  function openNew(date: Date, minutes: number | null = null) {
    const start = minutes === null ? '09:00' : `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`
    const endMin = (minutes ?? 540) + 60
    const end = `${String(Math.min(23, Math.floor(endMin / 60))).padStart(2, '0')}:${String(endMin % 60).padStart(2, '0')}`
    setDraft({
      id: null, occStart: null, title: '', allDay: false, date: dateKey(date), endDate: dateKey(date), start, end,
      recurrence: 'none', until: '', remind: 15, color: EVENT_COLORS[0], location: '', description: '',
    })
  }

  function openEdit(o: Occ) {
    const e = o.event
    setDraft({
      id: e.id, occStart: o.start, title: e.title, allDay: e.all_day,
      date: dateKey(o.start), endDate: dateKey(e.all_day ? addDays(o.end, -0) : o.end),
      start: timeKey(o.start), end: timeKey(o.end),
      recurrence: e.recurrence, until: e.recurrence_until ?? '', remind: e.remind_minutes,
      color: e.color ?? EVENT_COLORS[0], location: e.location ?? '', description: e.description ?? '',
    })
  }

  async function save() {
    if (!draft || !draft.title.trim()) return
    setSaving(true)
    try {
      let start = draft.allDay ? fromKeys(draft.date) : fromKeys(draft.date, draft.start)
      let end = draft.allDay ? fromKeys(draft.endDate < draft.date ? draft.date : draft.endDate, '23:59') : fromKeys(draft.date, draft.end)
      if (!draft.allDay && end <= start) end = new Date(start.getTime() + 60 * 60_000)

      // Serie bearbeitet über ein einzelnes Vorkommen → ganze Serie um die Differenz verschieben
      const base = draft.id ? events.find(e => e.id === draft.id) : null
      if (base && base.recurrence !== 'none' && draft.occStart) {
        const delta = start.getTime() - draft.occStart.getTime()
        const dur = end.getTime() - start.getTime()
        start = new Date(new Date(base.start_at).getTime() + delta)
        end = new Date(start.getTime() + dur)
      }

      const body = {
        title: draft.title.trim(),
        all_day: draft.allDay,
        start_at: start.toISOString(),
        end_at: end.toISOString(),
        recurrence: draft.recurrence,
        recurrence_until: draft.recurrence !== 'none' && draft.until ? draft.until : null,
        remind_minutes: draft.remind,
        color: draft.color,
        location: draft.location || null,
        description: draft.description || null,
      }
      if (draft.id) await api(`planer/events/${draft.id}`, { method: 'PATCH', json: body })
      else await api('planer/events', { method: 'POST', json: body })
      toast(draft.id ? 'Termin gespeichert' : 'Termin angelegt')
      setDraft(null)
      load()
    } catch (err) {
      toast(`Speichern fehlgeschlagen: ${(err as Error).message}`, { ms: 6000 })
    } finally {
      setSaving(false)
    }
  }

  async function remove() {
    if (!draft?.id) return
    const base = events.find(e => e.id === draft.id)
    const msg = base && base.recurrence !== 'none' ? 'Ganze Terminserie löschen?' : 'Termin löschen?'
    if (!confirm(msg)) return
    try {
      await api(`planer/events/${draft.id}`, { method: 'DELETE' })
      toast('Termin gelöscht')
      setDraft(null)
      load()
    } catch (err) {
      toast(`Löschen fehlgeschlagen: ${(err as Error).message}`)
    }
  }

  /* ── Verschieben per Ziehen ── */
  function targetAt(x: number, y: number): { date: string; minutes: number | null } | null {
    const el = document.elementFromPoint(x, y) as HTMLElement | null
    const cell = el?.closest('[data-date]') as HTMLElement | null
    if (!cell) return null
    const date = cell.dataset.date!
    if (cell.dataset.col === 'week') {
      const rect = cell.getBoundingClientRect()
      const minutes = Math.max(0, Math.min(24 * 60 - 15, Math.round(((y - rect.top) / HOUR_PX) * 60 / 15) * 15))
      return { date, minutes }
    }
    return { date, minutes: null }
  }

  function onChipDown(e: React.PointerEvent, occ: Occ) {
    if (e.button !== 0) return
    e.stopPropagation()
    const start = { occ, x: e.clientX, y: e.clientY, timer: null as ReturnType<typeof setTimeout> | null, active: false, pointerType: e.pointerType }
    // Handy: erst nach kurzem Halten ziehen (sonst würde normales Scrollen Termine verschieben)
    if (e.pointerType !== 'mouse') {
      start.timer = setTimeout(() => {
        start.active = true
        if ('vibrate' in navigator) navigator.vibrate?.(12)
        setDrag({ occ, x: start.x, y: start.y, target: targetAt(start.x, start.y) })
      }, 350)
    }
    pressRef.current = start
  }

  useEffect(() => {
    const move = (e: PointerEvent) => {
      const p = pressRef.current
      if (!p) return
      if (!p.active) {
        const dist = Math.hypot(e.clientX - p.x, e.clientY - p.y)
        if (p.pointerType === 'mouse' && dist > 6) {
          p.active = true
        } else {
          if (dist > 10 && p.timer) { clearTimeout(p.timer); pressRef.current = null }
          return
        }
      }
      e.preventDefault()
      setDrag({ occ: p.occ, x: e.clientX, y: e.clientY, target: targetAt(e.clientX, e.clientY) })
    }
    const up = async (e: PointerEvent) => {
      const p = pressRef.current
      pressRef.current = null
      if (!p) return
      if (p.timer) clearTimeout(p.timer)
      if (!p.active) { openEdit(p.occ); return }
      suppressClick.current = true
      setTimeout(() => { suppressClick.current = false }, 400)
      const target = targetAt(e.clientX, e.clientY)
      setDrag(null)
      if (!target) return
      const o = p.occ
      const newStart = target.minutes === null
        ? (o.event.all_day ? fromKeys(target.date) : fromKeys(target.date, timeKey(o.start)))
        : fromKeys(target.date, `${String(Math.floor(target.minutes / 60)).padStart(2, '0')}:${String(target.minutes % 60).padStart(2, '0')}`)
      const delta = newStart.getTime() - o.start.getTime()
      if (!delta) return
      const base = o.event
      const body: Record<string, unknown> = {
        start_at: new Date(new Date(base.start_at).getTime() + delta).toISOString(),
        end_at: base.end_at ? new Date(new Date(base.end_at).getTime() + delta).toISOString() : null,
      }
      if (target.minutes !== null && base.all_day) {
        body.all_day = false
        body.end_at = new Date(new Date(body.start_at as string).getTime() + 60 * 60_000).toISOString()
      }
      // Optimistisch anzeigen, dann speichern
      setEvents(prev => prev.map(ev => (ev.id === base.id ? { ...ev, ...body } as PEvent : ev)))
      try {
        await api(`planer/events/${base.id}`, { method: 'PATCH', json: body })
        toast(`Verschoben auf ${relDay(newStart)}${target.minutes !== null || !base.all_day ? `, ${fmtTime(newStart)}` : ''}${base.recurrence !== 'none' ? ' (ganze Serie)' : ''}`)
      } catch (err) {
        toast(`Verschieben fehlgeschlagen: ${(err as Error).message}`)
      }
      load()
    }
    const cancel = () => { pressRef.current = null; setDrag(null) }
    window.addEventListener('pointermove', move, { passive: false })
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', cancel)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', cancel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load, toast])

  /* ── Navigation ── */
  function shift(dir: -1 | 1) {
    if (view === 'month') setCursor(c => new Date(c.getFullYear(), c.getMonth() + dir, 1))
    else if (view === 'week') setCursor(c => addDays(c, 7 * dir))
    else setCursor(c => addDays(c, 30 * dir))
  }
  const title = view === 'month'
    ? cursor.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })
    : view === 'week'
      ? `KW ${isoWeek(startOfWeek(cursor))} · ${startOfWeek(cursor).toLocaleDateString('de-DE', { day: 'numeric', month: 'short' })} – ${addDays(startOfWeek(cursor), 6).toLocaleDateString('de-DE', { day: 'numeric', month: 'short', year: 'numeric' })}`
      : `Ab ${relDay(cursor)}`

  const chip = (o: Occ, compact = false) => (
    <div
      key={o.key}
      className={`pv-chipev ${o.event.all_day ? 'allday' : ''} ${drag?.occ.key === o.key ? 'dragging' : ''}`}
      style={{ ['--c' as string]: o.event.color ?? EVENT_COLORS[0] }}
      onPointerDown={e => onChipDown(e, o)}
      onClick={e => e.stopPropagation()}
      title={o.event.title}
    >
      {!o.event.all_day && <span className="t" style={{ fontWeight: 600, flexShrink: 0 }}>{fmtTime(o.start)}</span>}
      <span>{o.event.title}</span>
      {!compact && o.event.recurrence !== 'none' && <Icon name="repeat" size={11} style={{ flexShrink: 0, opacity: 0.6 }} />}
    </div>
  )

  /* ── Monatsansicht ── */
  const monthView = (
    <div className="pv-glass pv-month">
      {WEEKDAYS_MO.map(w => <div key={w} className="pv-month-wd">{w}</div>)}
      {Array.from({ length: 42 }, (_, i) => {
        const d = addDays(range.from, i)
        const k = dateKey(d)
        const items = byDay.get(k)
        const list = items?.occs ?? []
        const extra = (items?.exams.length ?? 0) + (items?.tasks.length ?? 0)
        const maxShow = 3
        return (
          <div
            key={k}
            data-date={k}
            className={`pv-month-cell ${d.getMonth() !== cursor.getMonth() ? 'other' : ''} ${sameDay(d, now) ? 'today' : ''} ${drag?.target?.date === k ? 'drop' : ''}`}
            onClick={() => { if (suppressClick.current) return; openNew(d) }}
          >
            <span className="pv-month-num">{d.getDate()}</span>
            {items?.exams.map(ex => (
              <Link key={`x${ex.id}`} href="/private/planer/stundenplan" className="pv-chipev exam" onClick={e => e.stopPropagation()} title={ex.topic ?? ''}>
                <span>{EXAM_KIND[ex.kind]} {subjectName(ex.subject_id)}</span>
              </Link>
            ))}
            {list.slice(0, maxShow).map(o => chip(o, true))}
            {items?.tasks.slice(0, 2).map(t => (
              <Link key={`t${t.id}`} href={`/private/planer/reminder?task=${t.id}`} className="pv-chipev task" onClick={e => e.stopPropagation()}>
                <span>{t.title}</span>
              </Link>
            ))}
            {list.length > maxShow && <span className="pv-more">+{list.length - maxShow} weitere</span>}
            {extra > 0 && list.length <= maxShow && (items?.tasks.length ?? 0) > 2 && <span className="pv-more">+{(items?.tasks.length ?? 0) - 2}</span>}
          </div>
        )
      })}
    </div>
  )

  /* ── Wochenansicht ── */
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(range.from, i))
  const weekView = (
    <div className="pv-glass pv-week">
      <div />
      {weekDays.map(d => (
        <div key={dateKey(d)} className={`pv-week-head ${sameDay(d, now) ? 'today' : ''}`}>
          {WEEKDAYS_MO[(d.getDay() + 6) % 7]}<b>{d.getDate()}</b>
        </div>
      ))}
      <div style={{ fontSize: 10, color: 'var(--pv-ink-3)', padding: '6px 4px', borderBottom: '1px solid var(--pv-line)' }}>ganzt.</div>
      {weekDays.map(d => {
        const items = byDay.get(dateKey(d))
        return (
          <div key={`ad${dateKey(d)}`} className="pv-week-allday" data-date={dateKey(d)}>
            {items?.exams.map(ex => (
              <Link key={`x${ex.id}`} href="/private/planer/stundenplan" className="pv-chipev exam"><span>{EXAM_KIND[ex.kind]} {subjectName(ex.subject_id)}</span></Link>
            ))}
            {items?.occs.filter(o => o.event.all_day).map(o => chip(o, true))}
          </div>
        )
      })}
      <div className="pv-week-scroll" ref={weekScroll}>
        <div className="pv-week-hours">
          {Array.from({ length: 24 }, (_, h) => <div key={h} className="pv-week-hour">{h ? `${String(h).padStart(2, '0')}:00` : ''}</div>)}
        </div>
        {weekDays.map(d => {
          const k = dateKey(d)
          const timed = (byDay.get(k)?.occs ?? []).filter(o => !o.event.all_day)
          const lanes = layoutLanes(timed, d)
          return (
            <div
              key={k}
              data-date={k}
              data-col="week"
              className={`pv-week-col ${sameDay(d, now) ? 'today' : ''}`}
              style={{ height: 24 * HOUR_PX }}
              onClick={e => {
                if (suppressClick.current) return
                const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
                const minutes = Math.floor(((e.clientY - rect.top) / HOUR_PX) * 2) * 30
                openNew(d, Math.min(23 * 60, minutes))
              }}
            >
              {sameDay(d, now) && <div className="pv-now-line" style={{ top: (now.getHours() * 60 + now.getMinutes()) * HOUR_PX / 60 }} />}
              {drag?.target?.date === k && drag.target.minutes !== null && (
                <div className="pv-drop-slot" style={{
                  top: drag.target.minutes * HOUR_PX / 60,
                  height: Math.max(18, ((drag.occ.end.getTime() - drag.occ.start.getTime()) / 60000 || 60) * HOUR_PX / 60),
                }} />
              )}
              {lanes.map(({ o, lane, lanesTotal, top, height }) => (
                <div
                  key={o.key}
                  className={`pv-week-ev ${drag?.occ.key === o.key ? 'dragging' : ''}`}
                  style={{
                    ['--c' as string]: o.event.color ?? EVENT_COLORS[0],
                    top, height,
                    left: `calc(${(lane / lanesTotal) * 100}% + 2px)`,
                    width: `calc(${100 / lanesTotal}% - 4px)`,
                    right: 'auto',
                  }}
                  onPointerDown={e => onChipDown(e, o)}
                  onClick={e => e.stopPropagation()}
                >
                  <b>{o.event.title}</b>
                  <div style={{ opacity: 0.85 }}>{fmtTime(o.start)}–{fmtTime(o.end)}</div>
                </div>
              ))}
            </div>
          )
        })}
      </div>
    </div>
  )

  /* ── Liste ── */
  const listDays = Array.from({ length: 60 }, (_, i) => addDays(range.from, i)).filter(d => {
    const it = byDay.get(dateKey(d))
    return it && (it.occs.length || it.exams.length || it.tasks.length)
  })
  const listView = (
    <div className="pv-glass pv-card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {listDays.length === 0 && <div className="pv-empty">Keine Termine in den nächsten 60 Tagen.</div>}
      {listDays.map(d => {
        const it = byDay.get(dateKey(d))!
        return (
          <section key={dateKey(d)}>
            <p className="pv-eyebrow" style={{ marginBottom: 4, color: sameDay(d, now) ? 'var(--pv-accent)' : undefined }}>
              {['Heute', 'Morgen'].includes(relDay(d, now)) ? `${relDay(d, now)} · ` : ''}{fmtDayLong(d)}
            </p>
            <div className="pv-agenda">
              {it.exams.map(ex => (
                <Link key={`x${ex.id}`} href="/private/planer/stundenplan" className="pv-agenda-item">
                  <span className="pv-agenda-time">{ex.start_time ?? 'ganzt.'}</span>
                  <span className="pv-agenda-bar" style={{ background: '#e0913a' }} />
                  <span className="pv-grow"><b>{EXAM_KIND[ex.kind]} {subjectName(ex.subject_id)}</b>{ex.topic && <span className="pv-muted"> · {ex.topic}</span>}</span>
                </Link>
              ))}
              {it.occs.map(o => (
                <button key={o.key} className="pv-agenda-item" onClick={() => openEdit(o)}>
                  <span className="pv-agenda-time">{o.event.all_day ? 'ganzt.' : fmtTime(o.start)}</span>
                  <span className="pv-agenda-bar" style={{ background: o.event.color ?? EVENT_COLORS[0] }} />
                  <span className="pv-grow" style={{ minWidth: 0 }}>
                    <b>{o.event.title}</b>
                    <span className="pv-muted" style={{ fontSize: 12.5, display: 'block' }}>
                      {!o.event.all_day && `bis ${fmtTime(o.end)}`}{o.event.location ? ` · ${o.event.location}` : ''}
                      {o.event.recurrence !== 'none' ? ` · ${RECURRENCE_LABEL[o.event.recurrence]}` : ''}
                    </span>
                  </span>
                </button>
              ))}
              {it.tasks.map(t => (
                <Link key={`t${t.id}`} href={`/private/planer/reminder?task=${t.id}`} className="pv-agenda-item">
                  <span className="pv-agenda-time">{fmtTime(new Date((t.due_at ?? t.remind_at)!))}</span>
                  <span className="pv-agenda-bar" style={{ background: 'var(--pv-ok)' }} />
                  <span className="pv-grow"><b>{t.title}</b><span className="pv-muted"> · Reminder</span></span>
                </Link>
              ))}
            </div>
          </section>
        )
      })}
    </div>
  )

  return (
    <>
      <div className="pv-cal-head">
        <button className="pv-icon-btn" aria-label="Zurück" onClick={() => shift(-1)}><Icon name="back" size={18} /></button>
        <button className="pv-icon-btn" aria-label="Weiter" onClick={() => shift(1)}><Icon name="next" size={18} /></button>
        <button className="pv-btn sm" onClick={() => setCursor(startOfDay(new Date()))}>Heute</button>
        <span className="pv-cal-title pv-grow">{title}</span>
        <div className="pv-seg">
          <button className={view === 'month' ? 'active' : ''} onClick={() => changeView('month')}>Monat</button>
          <button className={view === 'week' ? 'active' : ''} onClick={() => changeView('week')}>Woche</button>
          <button className={view === 'list' ? 'active' : ''} onClick={() => changeView('list')}>Liste</button>
        </div>
        <button className="pv-btn primary" onClick={() => openNew(sameDay(cursor, now) || view !== 'month' ? now : cursor)}>
          <Icon name="plus" size={17} /> Termin
        </button>
      </div>

      {error && <div className="pv-glass pv-empty" style={{ color: 'var(--pv-danger)' }}>{error}</div>}

      {view === 'month' && monthView}
      {view === 'week' && weekView}
      {view === 'list' && listView}

      <p className="pv-muted pv-desktop-only" style={{ fontSize: 12, textAlign: 'center', margin: 0 }}>
        Tipp: Termine mit der Maus auf einen anderen Tag oder eine andere Uhrzeit ziehen. Am Handy kurz gedrückt halten und dann ziehen.
      </p>

      {drag && (
        <div className="pv-drag-ghost" style={{ left: drag.x, top: drag.y }}>
          {drag.occ.event.title}
          {drag.target && ` → ${relDay(fromKeys(drag.target.date))}${drag.target.minutes !== null ? `, ${String(Math.floor(drag.target.minutes / 60)).padStart(2, '0')}:${String(drag.target.minutes % 60).padStart(2, '0')}` : ''}`}
        </div>
      )}

      {draft && (
        <Portal>
          <div className="pv-overlay sheet" onClick={e => { if (e.target === e.currentTarget) setDraft(null) }}>
            <div className="pv-modal" style={{ width: 520 }}>
              <div className="pv-grip" />
              <div className="pv-row">
                <div className="pv-h2 pv-grow">{draft.id ? 'Termin bearbeiten' : 'Neuer Termin'}</div>
                <button className="pv-icon-btn ghost" aria-label="Schließen" onClick={() => setDraft(null)}><Icon name="x" /></button>
              </div>
              <input className="pv-input" placeholder="Titel" value={draft.title} autoFocus onChange={e => setDraft({ ...draft, title: e.target.value })} onKeyDown={e => { if (e.key === 'Enter') save() }} />
              <label className="pv-check-row" style={{ minHeight: 32 }}>
                <input type="checkbox" checked={draft.allDay} onChange={e => setDraft({ ...draft, allDay: e.target.checked })} /> Ganztägig
              </label>
              <div className="pv-form-grid">
                <div>
                  <label className="pv-label">{draft.allDay ? 'Von' : 'Datum'}</label>
                  <input className="pv-input" type="date" value={draft.date} onChange={e => setDraft({ ...draft, date: e.target.value, endDate: e.target.value > draft.endDate ? e.target.value : draft.endDate })} />
                </div>
                {draft.allDay ? (
                  <div>
                    <label className="pv-label">Bis</label>
                    <input className="pv-input" type="date" value={draft.endDate} min={draft.date} onChange={e => setDraft({ ...draft, endDate: e.target.value })} />
                  </div>
                ) : (
                  <div className="pv-row" style={{ gap: 6 }}>
                    <div className="pv-grow">
                      <label className="pv-label">Beginn</label>
                      <input className="pv-input" type="time" value={draft.start} onChange={e => {
                        const [h, m] = e.target.value.split(':').map(Number)
                        const [oh, om] = draft.start.split(':').map(Number)
                        const [eh, em] = draft.end.split(':').map(Number)
                        const dur = eh * 60 + em - (oh * 60 + om)
                        const newEnd = Math.min(23 * 60 + 59, h * 60 + m + Math.max(15, dur))
                        setDraft({ ...draft, start: e.target.value, end: `${String(Math.floor(newEnd / 60)).padStart(2, '0')}:${String(newEnd % 60).padStart(2, '0')}` })
                      }} />
                    </div>
                    <div className="pv-grow">
                      <label className="pv-label">Ende</label>
                      <input className="pv-input" type="time" value={draft.end} onChange={e => setDraft({ ...draft, end: e.target.value })} />
                    </div>
                  </div>
                )}
                <div>
                  <label className="pv-label">Wiederholen</label>
                  <select className="pv-input" value={draft.recurrence} onChange={e => setDraft({ ...draft, recurrence: e.target.value as Recurrence })}>
                    {RECURRENCES.map(r => <option key={r} value={r}>{RECURRENCE_LABEL[r]}</option>)}
                  </select>
                </div>
                {draft.recurrence !== 'none' ? (
                  <div>
                    <label className="pv-label">Wiederholen bis (optional)</label>
                    <input className="pv-input" type="date" value={draft.until} min={draft.date} onChange={e => setDraft({ ...draft, until: e.target.value })} />
                  </div>
                ) : <div className="pv-desktop-only" />}
                <div>
                  <label className="pv-label">Erinnerung (Push)</label>
                  <select className="pv-input" value={draft.remind ?? ''} onChange={e => setDraft({ ...draft, remind: e.target.value === '' ? null : Number(e.target.value) })}>
                    {REMIND_OPTIONS.map(o => <option key={String(o.value)} value={o.value ?? ''}>{o.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="pv-label">Ort</label>
                  <input className="pv-input" value={draft.location} onChange={e => setDraft({ ...draft, location: e.target.value })} placeholder="optional" />
                </div>
              </div>
              <div>
                <label className="pv-label">Farbe</label>
                <div className="pv-color-row">
                  {EVENT_COLORS.map(c => (
                    <button key={c} aria-label={`Farbe ${c}`} className={draft.color === c ? 'on' : ''} style={{ background: c }} onClick={() => setDraft({ ...draft, color: c })} />
                  ))}
                </div>
              </div>
              <div>
                <label className="pv-label">Notizen</label>
                <textarea className="pv-input" rows={3} value={draft.description} onChange={e => setDraft({ ...draft, description: e.target.value })} style={{ resize: 'vertical' }} />
              </div>
              {draft.id && events.find(e => e.id === draft.id)?.recurrence !== 'none' && (
                <p className="pv-muted" style={{ fontSize: 12.5, margin: 0 }}>Änderungen gelten für die ganze Serie.</p>
              )}
              <div className="pv-modal-actions">
                {draft.id && <button className="pv-btn danger" style={{ marginRight: 'auto' }} onClick={remove}><Icon name="trash" size={16} /> Löschen</button>}
                <button className="pv-btn" onClick={() => setDraft(null)}>Abbrechen</button>
                <button className="pv-btn primary" disabled={!draft.title.trim() || saving} onClick={save}>Speichern</button>
              </div>
            </div>
          </div>
        </Portal>
      )}
    </>
  )
}

/* Überschneidende Termine nebeneinander legen */
function layoutLanes(list: Occ[], day: Date) {
  const dayStart = startOfDay(day).getTime()
  const items = list.map(o => {
    const s = Math.max(o.start.getTime(), dayStart)
    const e = Math.min(Math.max(o.end.getTime(), s + 15 * 60_000), dayStart + 24 * 3600_000)
    return { o, s, e }
  }).sort((a, b) => a.s - b.s || b.e - a.e)
  const out: { o: Occ; lane: number; lanesTotal: number; top: number; height: number }[] = []
  let cluster: typeof out = []
  let clusterEnd = 0
  let laneEnds: number[] = []
  const flush = () => {
    const total = Math.max(1, laneEnds.length)
    for (const c of cluster) c.lanesTotal = total
    out.push(...cluster)
    cluster = []
    laneEnds = []
  }
  for (const it of items) {
    if (cluster.length && it.s >= clusterEnd) flush()
    let lane = laneEnds.findIndex(end => end <= it.s)
    if (lane === -1) { lane = laneEnds.length; laneEnds.push(it.e) } else laneEnds[lane] = it.e
    clusterEnd = Math.max(clusterEnd, it.e)
    cluster.push({
      o: it.o, lane, lanesTotal: 1,
      top: ((it.s - dayStart) / 60000) * HOUR_PX / 60,
      height: Math.max(20, ((it.e - it.s) / 60000) * HOUR_PX / 60 - 2),
    })
  }
  flush()
  return out
}

function isoWeek(d: Date) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  const day = t.getUTCDay() || 7
  t.setUTCDate(t.getUTCDate() + 4 - day)
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1))
  return Math.ceil(((t.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
}