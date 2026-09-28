'use client'

// "Heute" auf der Startseite: Termine, Stundenplan, fällige Reminder, Hausaufgaben, nächste Klausuren

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import Icon from './Icon'
import { usePrivate } from './PrivateShell'
import {
  EVENT_COLORS, EXAM_KIND, addDays, api, dateKey, fmtTime, fromKeys, occurrencesIn, relDay, startOfDay,
  type Occ, type PEvent, type PExam, type PHomework, type PPeriod, type PSlot, type PSubject, type PTask,
} from '../_lib/planner'

export default function TodayCard() {
  const { toast } = usePrivate()
  const [occs, setOccs] = useState<Occ[] | null>(null)
  const [tasks, setTasks] = useState<PTask[]>([])
  const [exams, setExams] = useState<PExam[]>([])
  const [homework, setHomework] = useState<PHomework[]>([])
  const [subjects, setSubjects] = useState<PSubject[]>([])
  const [periods, setPeriods] = useState<PPeriod[]>([])
  const [slots, setSlots] = useState<PSlot[]>([])
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const from = startOfDay(new Date())
    const to = addDays(from, 1)
    try {
      const [ev, ta] = await Promise.all([
        api<PEvent[]>(`planer/events?from=${from.toISOString()}&to=${to.toISOString()}`),
        api<PTask[]>('planer/tasks'),
      ])
      setOccs(occurrencesIn(ev, from, to))
      setTasks(ta)
      setError(null)
      // Schul-Teil darf fehlen, ohne dass die Karte leer bleibt
      const [ex, hw, su, pe, sl] = await Promise.all([
        api<PExam[]>('planer/exams').catch(() => []), api<PHomework[]>('planer/homework').catch(() => []),
        api<PSubject[]>('planer/subjects').catch(() => []), api<PPeriod[]>('planer/periods').catch(() => []),
        api<PSlot[]>('planer/slots').catch(() => []),
      ])
      setExams(ex); setHomework(hw); setSubjects(su); setPeriods(pe); setSlots(sl)
    } catch (err) {
      setError((err as Error).message)
      setOccs([])
    }
  }, [])

  useEffect(() => { load() }, [load])

  const now = new Date()
  const today0 = startOfDay(now)
  const tomorrowKey = dateKey(addDays(today0, 1))
  const endToday = addDays(today0, 1)
  const wd = now.getDay() === 0 ? 7 : now.getDay()
  const subj = (id: number | null) => subjects.find(s => s.id === id)

  const dueTasks = tasks.filter(t => !t.parent_id && !t.done && (t.remind_at ?? t.due_at) && new Date((t.remind_at ?? t.due_at)!) < endToday)
  const lessons = periods
    .map(p => ({ p, slot: slots.find(s => s.weekday === wd && s.period_no === p.period_no) }))
    .filter(x => x.slot)
  const hwSoon = homework.filter(h => !h.done && h.due_date && h.due_date <= tomorrowKey)
  const examsSoon = exams.filter(e => { const d = fromKeys(e.exam_date); return d >= today0 && d < addDays(today0, 14) })

  async function checkTask(t: PTask) {
    setTasks(prev => prev.map(x => (x.id === t.id ? { ...x, done: true } : x)))
    try {
      await api(`planer/tasks/${t.id}`, { method: 'PATCH', json: { done: true } })
      toast(t.repeat !== 'none' ? 'Erledigt – nächster Termin ist geplant' : 'Erledigt')
      load()
    } catch {
      load()
    }
  }

  const empty = occs && !occs.length && !dueTasks.length && !lessons.length && !hwSoon.length && !examsSoon.length

  return (
    <section className="pv-glass pv-card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div className="pv-row">
        <div className="pv-h2 pv-grow">Heute</div>
        <Link href="/private/planer" className="pv-btn sm">Kalender <Icon name="next" size={14} /></Link>
      </div>

      {error && <div className="pv-muted" style={{ fontSize: 13, color: 'var(--pv-danger)' }}>{error}</div>}
      {occs === null && !error && <div className="pv-center" style={{ padding: 16 }}><div className="pv-spinner" /></div>}
      {empty && <div className="pv-empty" style={{ padding: 16 }}>Heute steht nichts an.</div>}

      {occs && occs.length > 0 && (
        <div className="pv-agenda">
          {occs.map(o => {
            const past = !o.event.all_day && o.end < now
            return (
              <Link key={o.key} href={`/private/planer?date=${dateKey(o.start)}`} className="pv-agenda-item" style={past ? { opacity: 0.5 } : undefined}>
                <span className="pv-agenda-time">{o.event.all_day ? 'ganzt.' : fmtTime(o.start)}</span>
                <span className="pv-agenda-bar" style={{ background: o.event.color ?? EVENT_COLORS[0] }} />
                <span className="pv-grow" style={{ minWidth: 0 }}>
                  <b className="pv-ellipsis" style={{ display: 'block' }}>{o.event.title}</b>
                  {(o.event.location || !o.event.all_day) && (
                    <span className="pv-muted" style={{ fontSize: 12 }}>{!o.event.all_day && `bis ${fmtTime(o.end)}`}{o.event.location ? ` · ${o.event.location}` : ''}</span>
                  )}
                </span>
              </Link>
            )
          })}
        </div>
      )}

      {dueTasks.length > 0 && (
        <div>
          <p className="pv-eyebrow" style={{ margin: '4px 0' }}>Reminder</p>
          {dueTasks.map(t => {
            const w = new Date((t.remind_at ?? t.due_at)!)
            return (
              <div key={t.id} className="pv-task" style={{ padding: '6px 4px' }}>
                <button className="pv-checkbox sm" aria-label="Abhaken" onClick={() => checkTask(t)} />
                <Link href={`/private/planer/reminder?task=${t.id}`} className="pv-grow" style={{ textDecoration: 'none', minWidth: 0 }}>
                  <span className="pv-ellipsis" style={{ display: 'block', fontSize: 14 }}>{t.title}</span>
                  <span style={{ fontSize: 12, color: w < now ? 'var(--pv-danger)' : 'var(--pv-ink-3)' }}>{relDay(w, now)}, {fmtTime(w)}</span>
                </Link>
              </div>
            )
          })}
        </div>
      )}

      {lessons.length > 0 && (
        <div>
          <p className="pv-eyebrow" style={{ margin: '4px 0' }}>Stundenplan</p>
          <div className="pv-chips" style={{ flexWrap: 'wrap' }}>
            {lessons.map(({ p, slot }) => {
              const s = subj(slot!.subject_id)
              return (
                <Link key={p.id} href="/private/planer/stundenplan" className="pv-chip" style={{ borderLeft: `4px solid ${s?.color ?? EVENT_COLORS[0]}` }}>
                  {p.period_no}. {s?.short || s?.name}
                </Link>
              )
            })}
          </div>
        </div>
      )}

      {hwSoon.length > 0 && (
        <div>
          <p className="pv-eyebrow" style={{ margin: '4px 0' }}>Hausaufgaben bis morgen</p>
          {hwSoon.map(h => (
            <Link key={h.id} href="/private/planer/stundenplan" className="pv-agenda-item">
              <Icon name="book" size={16} />
              <span className="pv-grow pv-ellipsis">{subj(h.subject_id)?.name ? <b>{subj(h.subject_id)?.name}: </b> : null}{h.title}</span>
              <span className="pv-muted" style={{ fontSize: 12 }}>{relDay(fromKeys(h.due_date!), now)}</span>
            </Link>
          ))}
        </div>
      )}

      {examsSoon.length > 0 && (
        <div>
          <p className="pv-eyebrow" style={{ margin: '4px 0' }}>Nächste Klausuren</p>
          {examsSoon.map(e => (
            <Link key={e.id} href="/private/planer/stundenplan" className="pv-agenda-item">
              <Icon name="school" size={16} />
              <span className="pv-grow pv-ellipsis"><b>{EXAM_KIND[e.kind]} {subj(e.subject_id)?.name ?? ''}</b>{e.topic ? ` · ${e.topic}` : ''}</span>
              <span className="pv-muted" style={{ fontSize: 12 }}>{relDay(fromKeys(e.exam_date), now)}</span>
            </Link>
          ))}
        </div>
      )}
    </section>
  )
}