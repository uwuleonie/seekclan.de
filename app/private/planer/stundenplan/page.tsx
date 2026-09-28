'use client'

// Stundenplan
// - eigene Stundenzeiten (1. Stunde 08:00–08:45 …) frei einstellbar
// - Fächer mit Farbe, Kürzel, Raum, Lehrkraft
// - Zelle antippen → Fach wählen
// - Hausaufgaben: "zur nächsten Stunde", "übernächste Stunde" oder festes Datum
// - Klausuren/Tests mit Countdown (erscheinen auch im Kalender + Erinnerung am Vorabend)

import { useCallback, useEffect, useMemo, useState } from 'react'
import Icon from '../../_components/Icon'
import Portal from '../../_components/Portal'
import { usePrivate } from '../../_components/PrivateShell'
import {
  EVENT_COLORS, EXAM_KIND, api, dateKey, fromKeys, nextLessonDate, relDay, startOfDay,
  type PExam, type PHomework, type PPeriod, type PSlot, type PSubject,
} from '../../_lib/planner'

const DAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa']
const PRESET: [string, string][] = [
  ['08:00', '08:45'], ['08:50', '09:35'], ['09:55', '10:40'], ['10:45', '11:30'],
  ['11:50', '12:35'], ['12:40', '13:25'], ['13:45', '14:30'], ['14:35', '15:20'],
]

type DueMode = 'next' | 'next2' | 'date' | 'none'

export default function StundenplanPage() {
  const { toast } = usePrivate()
  const [subjects, setSubjects] = useState<PSubject[]>([])
  const [periods, setPeriods] = useState<PPeriod[]>([])
  const [slots, setSlots] = useState<PSlot[]>([])
  const [homework, setHomework] = useState<PHomework[]>([])
  const [exams, setExams] = useState<PExam[]>([])
  const [error, setError] = useState<string | null>(null)
  const [saturday, setSaturday] = useState(false)
  const [now, setNow] = useState(() => new Date())

  const [cell, setCell] = useState<{ weekday: number; period: number } | null>(null)
  const [subjectsOpen, setSubjectsOpen] = useState(false)
  const [subjectDraft, setSubjectDraft] = useState<Partial<PSubject> & { id?: number } | null>(null)
  const [periodsOpen, setPeriodsOpen] = useState(false)
  const [periodDraft, setPeriodDraft] = useState<{ start: string; end: string }>({ start: '', end: '' })
  const [hwDraft, setHwDraft] = useState<{ subject_id: number | null; title: string; mode: DueMode; date: string } | null>(null)
  const [examDraft, setExamDraft] = useState<Partial<PExam> & { id?: number } | null>(null)
  const [showDoneHw, setShowDoneHw] = useState(false)

  const load = useCallback(async () => {
    try {
      const [s, p, sl, h, e] = await Promise.all([
        api<PSubject[]>('planer/subjects'), api<PPeriod[]>('planer/periods'), api<PSlot[]>('planer/slots'),
        api<PHomework[]>('planer/homework'), api<PExam[]>('planer/exams'),
      ])
      setSubjects(s); setPeriods(p); setSlots(sl); setHomework(h); setExams(e)
      setError(null)
    } catch (err) {
      setError((err as Error).message)
    }
  }, [])

  useEffect(() => {
    load()
    try { setSaturday(localStorage.getItem('pv-tt-sat') === '1') } catch { /* egal */ }
    const iv = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(iv)
  }, [load])

  const subj = (id: number | null) => subjects.find(s => s.id === id)
  const days = saturday ? 6 : 5
  const todayWd = now.getDay() === 0 ? 7 : now.getDay()
  const nowMin = now.getHours() * 60 + now.getMinutes()
  const toMin = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m }
  const currentPeriod = periods.find(p => nowMin >= toMin(p.start_time) && nowMin < toMin(p.end_time))?.period_no

  /* ── Zelle setzen ── */
  async function setSlot(weekday: number, period: number, subjectId: number | null) {
    try {
      await api('planer/slots', { method: 'PUT', json: { weekday, period_no: period, subject_id: subjectId } })
      setSlots(prev => {
        const rest = prev.filter(s => !(s.weekday === weekday && s.period_no === period))
        return subjectId ? [...rest, { id: 0, weekday, period_no: period, subject_id: subjectId, room: null }] : rest
      })
      setCell(null)
    } catch (err) {
      toast(`Speichern fehlgeschlagen: ${(err as Error).message}`)
    }
  }

  /* ── Fächer ── */
  async function saveSubject() {
    if (!subjectDraft?.name?.trim()) return
    const body = {
      name: subjectDraft.name.trim(), short: subjectDraft.short || null, color: subjectDraft.color ?? EVENT_COLORS[0],
      room: subjectDraft.room || null, teacher: subjectDraft.teacher || null,
    }
    try {
      if (subjectDraft.id) await api(`planer/subjects/${subjectDraft.id}`, { method: 'PATCH', json: body })
      else await api('planer/subjects', { method: 'POST', json: body })
      setSubjectDraft(null)
      load()
    } catch (err) {
      toast(`Fach: ${(err as Error).message}`)
    }
  }
  async function deleteSubject(s: PSubject) {
    if (!confirm(`Fach "${s.name}" löschen? Es verschwindet auch aus dem Stundenplan.`)) return
    await api(`planer/subjects/${s.id}`, { method: 'DELETE' }).catch(err => toast((err as Error).message))
    setSubjectDraft(null)
    load()
  }

  /* ── Stundenzeiten ── */
  async function addPeriod(start: string, end: string, no?: number) {
    const period_no = no ?? (periods.length ? Math.max(...periods.map(p => p.period_no)) + 1 : 1)
    await api('planer/periods', { method: 'POST', json: { period_no, start_time: start, end_time: end } })
  }
  async function usePreset() {
    try {
      for (let i = 0; i < PRESET.length; i++) {
        if (!periods.find(p => p.period_no === i + 1)) await addPeriod(PRESET[i][0], PRESET[i][1], i + 1)
      }
      load()
    } catch (err) {
      toast(`Zeiten: ${(err as Error).message}`)
    }
  }
  async function updatePeriod(p: PPeriod, field: 'start_time' | 'end_time', value: string) {
    if (!value) return
    setPeriods(prev => prev.map(x => (x.id === p.id ? { ...x, [field]: value } : x)))
    await api(`planer/periods/${p.id}`, { method: 'PATCH', json: { [field]: value } }).catch(err => toast((err as Error).message))
  }
  async function deletePeriod(p: PPeriod) {
    await api(`planer/periods/${p.id}`, { method: 'DELETE' }).catch(err => toast((err as Error).message))
    load()
  }

  /* ── Hausaufgaben ── */
  function dueFor(mode: DueMode, subjectId: number | null, date: string): string | null {
    if (mode === 'none') return null
    if (mode === 'date') return date || null
    if (!subjectId) return null
    return nextLessonDate(subjectId, slots, new Date(), mode === 'next2' ? 1 : 0)
  }
  async function saveHomework() {
    if (!hwDraft?.title.trim()) return
    const due = dueFor(hwDraft.mode, hwDraft.subject_id, hwDraft.date)
    if ((hwDraft.mode === 'next' || hwDraft.mode === 'next2') && !due) {
      toast('Dieses Fach steht noch nicht im Stundenplan – bitte Datum wählen')
      return
    }
    try {
      await api('planer/homework', { method: 'POST', json: { subject_id: hwDraft.subject_id, title: hwDraft.title.trim(), due_date: due } })
      toast(due ? `Hausaufgabe bis ${relDay(fromKeys(due))}` : 'Hausaufgabe eingetragen')
      setHwDraft(null)
      load()
    } catch (err) {
      toast(`Hausaufgabe: ${(err as Error).message}`)
    }
  }
  async function toggleHw(h: PHomework) {
    setHomework(prev => prev.map(x => (x.id === h.id ? { ...x, done: !x.done } : x)))
    await api(`planer/homework/${h.id}`, { method: 'PATCH', json: { done: !h.done } }).catch(() => load())
  }
  async function deleteHw(h: PHomework) {
    setHomework(prev => prev.filter(x => x.id !== h.id))
    await api(`planer/homework/${h.id}`, { method: 'DELETE' }).catch(() => load())
  }

  /* ── Klausuren ── */
  async function saveExam() {
    if (!examDraft?.exam_date) return
    const body = {
      subject_id: examDraft.subject_id ?? null, kind: examDraft.kind ?? 'klausur', exam_date: examDraft.exam_date,
      start_time: examDraft.start_time || null, topic: examDraft.topic || null, notes: examDraft.notes || null,
    }
    try {
      if (examDraft.id) await api(`planer/exams/${examDraft.id}`, { method: 'PATCH', json: body })
      else await api('planer/exams', { method: 'POST', json: body })
      setExamDraft(null)
      load()
    } catch (err) {
      toast(`Klausur: ${(err as Error).message}`)
    }
  }
  async function deleteExam(id: number) {
    if (!confirm('Eintrag löschen?')) return
    await api(`planer/exams/${id}`, { method: 'DELETE' }).catch(err => toast((err as Error).message))
    setExamDraft(null)
    load()
  }

  const today0 = startOfDay(now)
  const openHw = useMemo(() => homework.filter(h => showDoneHw || !h.done), [homework, showDoneHw])
  const upcomingExams = exams.filter(e => fromKeys(e.exam_date) >= today0)
  const pastExams = exams.filter(e => fromKeys(e.exam_date) < today0)
  const daysUntil = (d: string) => Math.round((fromKeys(d).getTime() - today0.getTime()) / 86400000)

  return (
    <>
      {error && <div className="pv-glass pv-empty" style={{ color: 'var(--pv-danger)' }}>{error}</div>}

      {/* Stundenplan */}
      <section className="pv-glass pv-card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div className="pv-row pv-wrap">
          <div className="pv-h2" style={{ flex: '1 1 160px' }}>Stundenplan</div>
          <button className="pv-btn sm" onClick={() => setSubjectsOpen(true)}><Icon name="book" size={15} /> Fächer ({subjects.length})</button>
          <button className="pv-btn sm" onClick={() => setPeriodsOpen(true)}><Icon name="clock" size={15} /> Zeiten</button>
          <label className="pv-check-row" style={{ minHeight: 32, fontSize: 13 }}>
            <input type="checkbox" checked={saturday} onChange={e => { setSaturday(e.target.checked); try { localStorage.setItem('pv-tt-sat', e.target.checked ? '1' : '0') } catch { /* egal */ } }} /> Samstag
          </label>
        </div>

        {periods.length === 0 ? (
          <div className="pv-empty">
            Noch keine Stundenzeiten. Du kannst sie selbst eintragen oder mit Beispielzeiten starten und diese anpassen.
            <div className="pv-row" style={{ justifyContent: 'center', marginTop: 12 }}>
              <button className="pv-btn primary" onClick={usePreset}>Beispielzeiten (8 Stunden ab 08:00)</button>
              <button className="pv-btn" onClick={() => setPeriodsOpen(true)}>Selbst eintragen</button>
            </div>
          </div>
        ) : (
          <div className="pv-tt" style={{ gridTemplateColumns: `64px repeat(${days}, minmax(0, 1fr))` }}>
            <div className="pv-tt-h" />
            {DAYS.slice(0, days).map((d, i) => <div key={d} className={`pv-tt-h ${todayWd === i + 1 ? 'today' : ''}`}>{d}</div>)}
            {periods.map(p => (
              <div key={p.id} style={{ display: 'contents' }}>
                <div className="pv-tt-p"><b>{p.period_no}.</b>{p.start_time}<br />{p.end_time}</div>
                {Array.from({ length: days }, (_, i) => {
                  const slot = slots.find(s => s.weekday === i + 1 && s.period_no === p.period_no)
                  const s = slot ? subj(slot.subject_id) : undefined
                  const isNow = todayWd === i + 1 && currentPeriod === p.period_no
                  return (
                    <div key={i} className={`pv-tt-cell ${isNow ? 'pv-tt-now' : ''}`} onClick={() => setCell({ weekday: i + 1, period: p.period_no })}>
                      {s && (
                        <div className="pv-tt-sub" style={{ ['--c' as string]: s.color ?? EVENT_COLORS[0] }}>
                          <span className="pv-ellipsis">{s.short || s.name}</span>
                          {(slot?.room || s.room) && <small>{slot?.room || s.room}</small>}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="pv-dash">
        {/* Hausaufgaben */}
        <section className="pv-glass pv-card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div className="pv-row">
            <div className="pv-h2 pv-grow">Hausaufgaben</div>
            <button className="pv-btn sm ghost" onClick={() => setShowDoneHw(v => !v)}>{showDoneHw ? 'Erledigte ausblenden' : 'Erledigte zeigen'}</button>
            <button className="pv-btn primary sm" onClick={() => setHwDraft({ subject_id: subjects[0]?.id ?? null, title: '', mode: 'next', date: dateKey(new Date(Date.now() + 86400000)) })}>
              <Icon name="plus" size={15} /> Neu
            </button>
          </div>
          {openHw.length === 0 && <div className="pv-empty" style={{ padding: 18 }}>Keine offenen Hausaufgaben.</div>}
          <div style={{ margin: '0 -8px' }}>
            {openHw.map(h => {
              const s = subj(h.subject_id)
              const late = h.due_date && !h.done && fromKeys(h.due_date) < today0
              return (
                <div key={h.id} className={`pv-task ${h.done ? 'done' : ''}`}>
                  <button className={`pv-checkbox ${h.done ? 'on' : ''}`} onClick={() => toggleHw(h)} aria-label="Abhaken">{h.done && <Icon name="check" size={14} stroke={3} />}</button>
                  <div className="pv-grow" style={{ minWidth: 0 }}>
                    <div className="pv-task-title">{h.title}</div>
                    <div className="pv-task-meta">
                      {s && <span style={{ color: s.color ?? undefined, fontWeight: 600 }}>{s.name}</span>}
                      {h.due_date && <span className={late ? 'late' : ''}>bis {relDay(fromKeys(h.due_date), now)}</span>}
                    </div>
                  </div>
                  <button className="pv-icon-btn ghost" aria-label="Löschen" onClick={() => deleteHw(h)}><Icon name="trash" size={15} /></button>
                </div>
              )
            })}
          </div>
        </section>

        {/* Klausuren */}
        <section className="pv-glass pv-card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div className="pv-row">
            <div className="pv-h2 pv-grow">Klausuren & Tests</div>
            <button className="pv-btn primary sm" onClick={() => setExamDraft({ subject_id: subjects[0]?.id ?? null, kind: 'klausur', exam_date: dateKey(new Date(Date.now() + 7 * 86400000)) })}>
              <Icon name="plus" size={15} /> Neu
            </button>
          </div>
          {upcomingExams.length === 0 && <div className="pv-empty" style={{ padding: 18 }}>Keine anstehenden Klausuren.</div>}
          {upcomingExams.map(e => {
            const s = subj(e.subject_id)
            const n = daysUntil(e.exam_date)
            return (
              <button key={e.id} className="pv-agenda-item" onClick={() => setExamDraft(e)}>
                <span className="pv-exam-count">{n === 0 ? 'heute' : n === 1 ? 'morgen' : n}{n > 1 && <small>Tage</small>}</span>
                <span className="pv-grow" style={{ minWidth: 0 }}>
                  <b>{EXAM_KIND[e.kind]} {s?.name ?? ''}</b>
                  <span className="pv-muted" style={{ display: 'block', fontSize: 12.5 }}>
                    {fromKeys(e.exam_date).toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'short' })}
                    {e.start_time ? `, ${e.start_time}` : ''}{e.topic ? ` · ${e.topic}` : ''}
                  </span>
                </span>
              </button>
            )
          })}
          {pastExams.length > 0 && <p className="pv-muted" style={{ fontSize: 12, margin: 0 }}>{pastExams.length} vergangene Einträge</p>}
        </section>
      </div>

      {/* Zelle: Fach wählen */}
      {cell && (
        <Portal>
          <div className="pv-overlay sheet" onClick={e => { if (e.target === e.currentTarget) setCell(null) }}>
            <div className="pv-modal">
              <div className="pv-grip" />
              <div className="pv-h2">{DAYS[cell.weekday - 1]}, {cell.period}. Stunde</div>
              {subjects.length === 0 && <p className="pv-muted" style={{ margin: 0 }}>Lege zuerst Fächer an.</p>}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 6 }}>
                {subjects.map(s => (
                  <button key={s.id} className="pv-btn" style={{ justifyContent: 'flex-start', borderLeft: `5px solid ${s.color ?? EVENT_COLORS[0]}` }} onClick={() => setSlot(cell.weekday, cell.period, s.id)}>
                    <span className="pv-ellipsis">{s.name}</span>
                  </button>
                ))}
              </div>
              <div className="pv-modal-actions">
                <button className="pv-btn" onClick={() => { setCell(null); setSubjectsOpen(true); setSubjectDraft({ color: EVENT_COLORS[subjects.length % EVENT_COLORS.length] }) }}><Icon name="plus" size={15} /> Neues Fach</button>
                <button className="pv-btn danger" onClick={() => setSlot(cell.weekday, cell.period, null)}>Leeren</button>
                <button className="pv-btn" onClick={() => setCell(null)}>Schließen</button>
              </div>
            </div>
          </div>
        </Portal>
      )}

      {/* Fächer */}
      {subjectsOpen && (
        <Portal>
          <div className="pv-overlay sheet" onClick={e => { if (e.target === e.currentTarget) { setSubjectsOpen(false); setSubjectDraft(null) } }}>
            <div className="pv-modal" style={{ width: 500 }}>
              <div className="pv-grip" />
              <div className="pv-row">
                <div className="pv-h2 pv-grow">Fächer</div>
                <button className="pv-icon-btn ghost" aria-label="Schließen" onClick={() => { setSubjectsOpen(false); setSubjectDraft(null) }}><Icon name="x" /></button>
              </div>
              {subjectDraft ? (
                <>
                  <div className="pv-form-grid">
                    <div><label className="pv-label">Name</label><input className="pv-input" autoFocus value={subjectDraft.name ?? ''} onChange={e => setSubjectDraft({ ...subjectDraft, name: e.target.value })} placeholder="z.B. Mathematik" /></div>
                    <div><label className="pv-label">Kürzel</label><input className="pv-input" value={subjectDraft.short ?? ''} onChange={e => setSubjectDraft({ ...subjectDraft, short: e.target.value })} placeholder="z.B. Ma" maxLength={8} /></div>
                    <div><label className="pv-label">Raum</label><input className="pv-input" value={subjectDraft.room ?? ''} onChange={e => setSubjectDraft({ ...subjectDraft, room: e.target.value })} /></div>
                    <div><label className="pv-label">Lehrkraft</label><input className="pv-input" value={subjectDraft.teacher ?? ''} onChange={e => setSubjectDraft({ ...subjectDraft, teacher: e.target.value })} /></div>
                  </div>
                  <div className="pv-color-row">
                    {EVENT_COLORS.map(c => <button key={c} aria-label={`Farbe ${c}`} className={subjectDraft.color === c ? 'on' : ''} style={{ background: c }} onClick={() => setSubjectDraft({ ...subjectDraft, color: c })} />)}
                  </div>
                  <div className="pv-modal-actions">
                    {subjectDraft.id && <button className="pv-btn danger" style={{ marginRight: 'auto' }} onClick={() => deleteSubject(subjectDraft as PSubject)}><Icon name="trash" size={15} /> Löschen</button>}
                    <button className="pv-btn" onClick={() => setSubjectDraft(null)}>Zurück</button>
                    <button className="pv-btn primary" disabled={!subjectDraft.name?.trim()} onClick={saveSubject}>Speichern</button>
                  </div>
                </>
              ) : (
                <>
                  {subjects.map(s => (
                    <button key={s.id} className="pv-menu-item" onClick={() => setSubjectDraft(s)}>
                      <span className="pv-folder-dot" style={{ background: s.color ?? EVENT_COLORS[0], width: 12, height: 12 }} />
                      <span className="pv-grow">{s.name}{s.short ? <span className="pv-muted"> · {s.short}</span> : null}</span>
                      <span className="pv-muted" style={{ fontSize: 12 }}>{[s.room, s.teacher].filter(Boolean).join(' · ')}</span>
                    </button>
                  ))}
                  <button className="pv-btn primary" onClick={() => setSubjectDraft({ color: EVENT_COLORS[subjects.length % EVENT_COLORS.length] })}><Icon name="plus" size={16} /> Fach hinzufügen</button>
                </>
              )}
            </div>
          </div>
        </Portal>
      )}

      {/* Stundenzeiten */}
      {periodsOpen && (
        <Portal>
          <div className="pv-overlay sheet" onClick={e => { if (e.target === e.currentTarget) setPeriodsOpen(false) }}>
            <div className="pv-modal">
              <div className="pv-grip" />
              <div className="pv-row">
                <div className="pv-h2 pv-grow">Stundenzeiten</div>
                <button className="pv-icon-btn ghost" aria-label="Schließen" onClick={() => setPeriodsOpen(false)}><Icon name="x" /></button>
              </div>
              {periods.map(p => (
                <div key={p.id} className="pv-row">
                  <b style={{ width: 32 }}>{p.period_no}.</b>
                  <input className="pv-input" type="time" defaultValue={p.start_time} onBlur={e => updatePeriod(p, 'start_time', e.target.value)} />
                  <span className="pv-muted">–</span>
                  <input className="pv-input" type="time" defaultValue={p.end_time} onBlur={e => updatePeriod(p, 'end_time', e.target.value)} />
                  <button className="pv-icon-btn ghost" aria-label="Stunde entfernen" onClick={() => deletePeriod(p)}><Icon name="trash" size={15} /></button>
                </div>
              ))}
              <div className="pv-row">
                <b style={{ width: 32 }}>+</b>
                <input className="pv-input" type="time" value={periodDraft.start} onChange={e => setPeriodDraft({ ...periodDraft, start: e.target.value })} />
                <span className="pv-muted">–</span>
                <input className="pv-input" type="time" value={periodDraft.end} onChange={e => setPeriodDraft({ ...periodDraft, end: e.target.value })} />
                <button className="pv-icon-btn" aria-label="Stunde hinzufügen" disabled={!periodDraft.start || !periodDraft.end} onClick={async () => {
                  try { await addPeriod(periodDraft.start, periodDraft.end); setPeriodDraft({ start: '', end: '' }); load() } catch (err) { toast((err as Error).message) }
                }}><Icon name="plus" size={16} /></button>
              </div>
              {periods.length === 0 && <button className="pv-btn" onClick={usePreset}>Beispielzeiten einfügen</button>}
            </div>
          </div>
        </Portal>
      )}

      {/* Hausaufgabe */}
      {hwDraft && (
        <Portal>
          <div className="pv-overlay sheet" onClick={e => { if (e.target === e.currentTarget) setHwDraft(null) }}>
            <div className="pv-modal">
              <div className="pv-grip" />
              <div className="pv-h2">Neue Hausaufgabe</div>
              <select className="pv-input" value={hwDraft.subject_id ?? ''} onChange={e => setHwDraft({ ...hwDraft, subject_id: e.target.value ? Number(e.target.value) : null })}>
                <option value="">Ohne Fach</option>
                {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <textarea className="pv-input" rows={3} autoFocus placeholder="Was ist zu tun? z.B. S. 42 Nr. 3–5" value={hwDraft.title} onChange={e => setHwDraft({ ...hwDraft, title: e.target.value })} />
              <label className="pv-label" style={{ marginBottom: 0 }}>Fällig</label>
              <div className="pv-chips">
                {([['next', 'Nächste Stunde'], ['next2', 'Übernächste Stunde'], ['date', 'Datum'], ['none', 'Ohne Termin']] as [DueMode, string][]).map(([m, l]) => (
                  <button key={m} className={`pv-chip ${hwDraft.mode === m ? 'active' : ''}`} onClick={() => setHwDraft({ ...hwDraft, mode: m })}>{l}</button>
                ))}
              </div>
              {hwDraft.mode === 'date' && <input className="pv-input" type="date" value={hwDraft.date} onChange={e => setHwDraft({ ...hwDraft, date: e.target.value })} />}
              {(hwDraft.mode === 'next' || hwDraft.mode === 'next2') && (
                <p className="pv-muted" style={{ fontSize: 13, margin: 0 }}>
                  {(() => {
                    const d = dueFor(hwDraft.mode, hwDraft.subject_id, '')
                    return d ? `= ${fromKeys(d).toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })}` : 'Fach steht noch nicht im Stundenplan.'
                  })()}
                </p>
              )}
              <div className="pv-modal-actions">
                <button className="pv-btn" onClick={() => setHwDraft(null)}>Abbrechen</button>
                <button className="pv-btn primary" disabled={!hwDraft.title.trim()} onClick={saveHomework}>Speichern</button>
              </div>
            </div>
          </div>
        </Portal>
      )}

      {/* Klausur */}
      {examDraft && (
        <Portal>
          <div className="pv-overlay sheet" onClick={e => { if (e.target === e.currentTarget) setExamDraft(null) }}>
            <div className="pv-modal">
              <div className="pv-grip" />
              <div className="pv-h2">{examDraft.id ? 'Eintrag bearbeiten' : 'Klausur / Test eintragen'}</div>
              <div className="pv-form-grid">
                <div>
                  <label className="pv-label">Fach</label>
                  <select className="pv-input" value={examDraft.subject_id ?? ''} onChange={e => setExamDraft({ ...examDraft, subject_id: e.target.value ? Number(e.target.value) : null })}>
                    <option value="">Ohne Fach</option>
                    {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="pv-label">Art</label>
                  <select className="pv-input" value={examDraft.kind ?? 'klausur'} onChange={e => setExamDraft({ ...examDraft, kind: e.target.value as PExam['kind'] })}>
                    {Object.entries(EXAM_KIND).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                  </select>
                </div>
                <div><label className="pv-label">Datum</label><input className="pv-input" type="date" value={examDraft.exam_date ?? ''} onChange={e => setExamDraft({ ...examDraft, exam_date: e.target.value })} /></div>
                <div><label className="pv-label">Uhrzeit (optional)</label><input className="pv-input" type="time" value={examDraft.start_time ?? ''} onChange={e => setExamDraft({ ...examDraft, start_time: e.target.value })} /></div>
              </div>
              <input className="pv-input" placeholder="Thema, z.B. Analysis, Kapitel 3–5" value={examDraft.topic ?? ''} onChange={e => setExamDraft({ ...examDraft, topic: e.target.value })} />
              <textarea className="pv-input" rows={2} placeholder="Notizen (optional)" value={examDraft.notes ?? ''} onChange={e => setExamDraft({ ...examDraft, notes: e.target.value })} />
              <p className="pv-muted" style={{ fontSize: 12.5, margin: 0 }}>Erscheint im Kalender. Am Vorabend um 17 Uhr kommt eine Erinnerung.</p>
              <div className="pv-modal-actions">
                {examDraft.id && <button className="pv-btn danger" style={{ marginRight: 'auto' }} onClick={() => deleteExam(examDraft.id!)}><Icon name="trash" size={15} /> Löschen</button>}
                <button className="pv-btn" onClick={() => setExamDraft(null)}>Abbrechen</button>
                <button className="pv-btn primary" disabled={!examDraft.exam_date} onClick={saveExam}>Speichern</button>
              </div>
            </div>
          </div>
        </Portal>
      )}
    </>
  )
}