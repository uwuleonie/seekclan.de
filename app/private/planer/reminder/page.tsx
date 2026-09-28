'use client'

// Reminder & To-dos
// - Listen (eigene + "Heute", "Geplant", "Alle", "Erledigt")
// - Jeder Reminder kann eine eigene To-do-Liste mit Haken haben (Unterpunkte)
// - Erinnerung mit Datum/Uhrzeit → Push + Glocke
// - Wiederholung: beim Abhaken springt der Reminder automatisch auf den nächsten Termin

import { useCallback, useEffect, useMemo, useState } from 'react'
import Icon from '../../_components/Icon'
import Portal from '../../_components/Portal'
import { usePrivate } from '../../_components/PrivateShell'
import { RECURRENCES, RECURRENCE_LABEL, type Recurrence } from '@/app/lib/recurrence'
import { EVENT_COLORS, api, dateKey, fmtTime, fromKeys, relDay, startOfDay, timeKey, type PList, type PTask } from '../../_lib/planner'

type Filter = 'today' | 'planned' | 'all' | 'done' | number

interface Draft {
  id: number | null
  title: string
  notes: string
  remindOn: boolean
  date: string
  time: string
  repeat: Recurrence
  listId: number | null
  priority: number
}

export default function ReminderPage() {
  const { toast, refreshNotifications } = usePrivate()
  const [lists, setLists] = useState<PList[]>([])
  const [tasks, setTasks] = useState<PTask[]>([])
  const [filter, setFilter] = useState<Filter>('all')
  const [error, setError] = useState<string | null>(null)
  const [quick, setQuick] = useState('')
  const [draft, setDraft] = useState<Draft | null>(null)
  const [expanded, setExpanded] = useState<Set<number>>(new Set())
  const [subInput, setSubInput] = useState<Record<number, string>>({})
  const [listModal, setListModal] = useState<{ list: PList | null; name: string; color: string } | null>(null)
  const [now, setNow] = useState(() => new Date())

  const load = useCallback(async () => {
    try {
      const [l, t] = await Promise.all([api<PList[]>('planer/lists'), api<PTask[]>('planer/tasks')])
      setLists(l)
      setTasks(t)
      setError(null)
      return t
    } catch (err) {
      setError((err as Error).message)
      return []
    }
  }, [])

  useEffect(() => {
    load().then(t => {
      const id = Number(new URLSearchParams(window.location.search).get('task'))
      const task = t.find(x => x.id === id)
      if (task) openEdit(task.parent_id ? t.find(x => x.id === task.parent_id) ?? task : task)
    })
    const iv = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(iv)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load])

  const parents = tasks.filter(t => !t.parent_id)
  const childrenOf = (id: number) => tasks.filter(t => t.parent_id === id).sort((a, b) => a.sort_order - b.sort_order || a.id - b.id)
  const when = (t: PTask) => (t.remind_at ?? t.due_at) ? new Date((t.remind_at ?? t.due_at)!) : null

  const visible = useMemo(() => {
    const endToday = startOfDay(new Date(now.getTime() + 86400000))
    return parents.filter(t => {
      if (filter === 'done') return t.done
      if (t.done) return false
      if (filter === 'today') { const w = when(t); return !!w && w < endToday }
      if (filter === 'planned') return !!when(t)
      if (filter === 'all') return true
      return t.list_id === filter
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks, filter, now])

  const counts = useMemo(() => {
    const endToday = startOfDay(new Date(now.getTime() + 86400000))
    const open = parents.filter(t => !t.done)
    const c: Record<string, number> = {
      today: open.filter(t => { const w = when(t); return !!w && w < endToday }).length,
      planned: open.filter(t => !!when(t)).length,
      all: open.length,
      done: parents.filter(t => t.done).length,
    }
    for (const l of lists) c[l.id] = open.filter(t => t.list_id === l.id).length
    return c
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks, lists, now])

  const filterName = filter === 'today' ? 'Heute' : filter === 'planned' ? 'Geplant' : filter === 'all' ? 'Alle offenen' : filter === 'done' ? 'Erledigt' : lists.find(l => l.id === filter)?.name ?? 'Liste'

  /* ── Aktionen ── */
  async function quickAdd() {
    const title = quick.trim()
    if (!title) return
    setQuick('')
    try {
      const body: Record<string, unknown> = { title, list_id: typeof filter === 'number' ? filter : null }
      if (filter === 'today') {
        const d = new Date(); d.setHours(Math.min(21, d.getHours() + 1), 0, 0, 0)
        body.remind_at = d.toISOString()
      }
      const t = await api<PTask>('planer/tasks', { method: 'POST', json: body })
      setTasks(prev => [...prev, t])
    } catch (err) {
      toast(`Anlegen fehlgeschlagen: ${(err as Error).message}`, { ms: 6000 })
    }
  }

  async function patch(t: PTask, body: Partial<PTask>) {
    setTasks(prev => prev.map(x => (x.id === t.id ? { ...x, ...body } : x)))
    try {
      const updated = await api<PTask>(`planer/tasks/${t.id}`, { method: 'PATCH', json: body })
      setTasks(prev => prev.map(x => (x.id === t.id ? updated : x)))
      return updated
    } catch (err) {
      toast(`Speichern fehlgeschlagen: ${(err as Error).message}`)
      load()
    }
  }

  async function toggle(t: PTask) {
    const updated = await patch(t, { done: !t.done })
    if (updated && t.repeat !== 'none' && !t.done && !updated.done) {
      const w = when(updated)
      toast(`Erledigt – nächstes Mal ${w ? `${relDay(w)}, ${fmtTime(w)}` : 'geplant'}`)
      load() // Unterpunkte wurden zurückgesetzt
    }
  }

  async function addSub(parent: PTask) {
    const title = (subInput[parent.id] ?? '').trim()
    if (!title) return
    setSubInput(s => ({ ...s, [parent.id]: '' }))
    try {
      const t = await api<PTask>('planer/tasks', {
        method: 'POST', json: { title, parent_id: parent.id, list_id: parent.list_id, sort_order: childrenOf(parent.id).length + 1 },
      })
      setTasks(prev => [...prev, t])
    } catch (err) {
      toast(`Anlegen fehlgeschlagen: ${(err as Error).message}`)
    }
  }

  async function removeTask(t: PTask) {
    setTasks(prev => prev.filter(x => x.id !== t.id && x.parent_id !== t.id))
    try {
      await api(`planer/tasks/${t.id}`, { method: 'DELETE' })
    } catch (err) {
      toast(`Löschen fehlgeschlagen: ${(err as Error).message}`)
      load()
    }
  }

  function openEdit(t: PTask | null) {
    const w = t ? (t.remind_at ? new Date(t.remind_at) : null) : null
    const def = new Date(Date.now() + 3600_000); def.setMinutes(0, 0, 0)
    setDraft({
      id: t?.id ?? null,
      title: t?.title ?? '',
      notes: t?.notes ?? '',
      remindOn: !!w || (!t && filter === 'today'),
      date: dateKey(w ?? def),
      time: timeKey(w ?? def),
      repeat: t?.repeat ?? 'none',
      listId: t ? t.list_id : typeof filter === 'number' ? filter : null,
      priority: t?.priority ?? 0,
    })
    if (t) setExpanded(s => new Set(s).add(t.id))
  }

  async function saveDraft() {
    if (!draft || !draft.title.trim()) return
    const body = {
      title: draft.title.trim(),
      notes: draft.notes || null,
      remind_at: draft.remindOn ? fromKeys(draft.date, draft.time).toISOString() : null,
      repeat: draft.remindOn ? draft.repeat : 'none',
      list_id: draft.listId,
      priority: draft.priority,
    }
    try {
      if (draft.id) {
        const updated = await api<PTask>(`planer/tasks/${draft.id}`, { method: 'PATCH', json: body })
        setTasks(prev => prev.map(x => (x.id === updated.id ? updated : x)))
      } else {
        const created = await api<PTask>('planer/tasks', { method: 'POST', json: body })
        setTasks(prev => [...prev, created])
        setDraft({ ...draft, id: created.id })
        setExpanded(s => new Set(s).add(created.id))
        toast('Reminder angelegt – unten kannst du To-dos hinzufügen')
        refreshNotifications()
        return
      }
      setDraft(null)
      toast('Gespeichert')
    } catch (err) {
      toast(`Speichern fehlgeschlagen: ${(err as Error).message}`, { ms: 6000 })
    }
  }

  async function saveList() {
    if (!listModal || !listModal.name.trim()) return
    try {
      if (listModal.list) {
        const u = await api<PList>(`planer/lists/${listModal.list.id}`, { method: 'PATCH', json: { name: listModal.name.trim(), color: listModal.color } })
        setLists(prev => prev.map(l => (l.id === u.id ? u : l)))
      } else {
        const l = await api<PList>('planer/lists', { method: 'POST', json: { name: listModal.name.trim(), color: listModal.color, sort_order: lists.length + 1 } })
        setLists(prev => [...prev, l])
        setFilter(l.id)
      }
      setListModal(null)
    } catch (err) {
      toast(`Liste: ${(err as Error).message}`)
    }
  }

  async function deleteList(l: PList) {
    if (!confirm(`Liste "${l.name}" löschen? Die Reminder darin bleiben erhalten (ohne Liste).`)) return
    try {
      await api(`planer/lists/${l.id}`, { method: 'DELETE' })
      setListModal(null)
      setFilter('all')
      load()
    } catch (err) {
      toast(`Löschen fehlgeschlagen: ${(err as Error).message}`)
    }
  }

  /* ── Darstellung ── */
  const smart: { key: Filter; label: string; icon: string }[] = [
    { key: 'today', label: 'Heute', icon: 'sun' },
    { key: 'planned', label: 'Geplant', icon: 'calendar' },
    { key: 'all', label: 'Alle', icon: 'list' },
    { key: 'done', label: 'Erledigt', icon: 'check' },
  ]

  const taskRow = (t: PTask) => {
    const kids = childrenOf(t.id)
    const kidsDone = kids.filter(k => k.done).length
    const w = when(t)
    const late = !!w && !t.done && w < now
    const list = lists.find(l => l.id === t.list_id)
    const open = expanded.has(t.id)
    return (
      <div key={t.id} className={`pv-task ${t.done ? 'done' : ''}`}>
        <button className={`pv-checkbox ${t.done ? 'on' : ''}`} aria-label={t.done ? 'Als offen markieren' : 'Abhaken'} onClick={() => toggle(t)}>
          {t.done && <Icon name="check" size={14} stroke={3} />}
        </button>
        <div className="pv-grow" style={{ minWidth: 0 }}>
          <div className="pv-task-title" onClick={() => openEdit(t)}>
            {t.priority > 0 && <span style={{ color: 'var(--pv-accent)', fontWeight: 800, marginRight: 5 }}>{'!'.repeat(t.priority)}</span>}
            {t.title}
          </div>
          <div className="pv-task-meta">
            {w && <span className={late ? 'late' : ''}><Icon name="bell" size={12} /> {relDay(w, now)}, {fmtTime(w)}</span>}
            {t.repeat !== 'none' && <span><Icon name="repeat" size={12} /> {RECURRENCE_LABEL[t.repeat]}</span>}
            {list && filter !== list.id && <span style={{ color: list.color ?? undefined }}>{list.name}</span>}
            {kids.length > 0 && (
              <button className="pv-btn ghost sm" style={{ minHeight: 24, padding: '1px 8px' }} onClick={() => setExpanded(s => { const n = new Set(s); if (n.has(t.id)) n.delete(t.id); else n.add(t.id); return n })}>
                <span className="pv-progress-ring">{kidsDone}/{kids.length}</span> To-dos <Icon name={open ? 'back' : 'next'} size={12} style={{ transform: 'rotate(-90deg)' }} />
              </button>
            )}
            {kids.length === 0 && !t.done && (
              <button className="pv-btn ghost sm" style={{ minHeight: 24, padding: '1px 8px' }} onClick={() => setExpanded(s => new Set(s).add(t.id))}>
                <Icon name="plus" size={12} /> To-do-Liste
              </button>
            )}
          </div>
          {t.notes && <div className="pv-muted" style={{ fontSize: 13, marginTop: 3, whiteSpace: 'pre-wrap' }}>{t.notes}</div>}
          {open && (
            <div className="pv-subtasks">
              {kids.map(k => (
                <div key={k.id} className={`pv-subtask ${k.done ? 'done' : ''}`}>
                  <button className={`pv-checkbox sm ${k.done ? 'on' : ''}`} onClick={() => patch(k, { done: !k.done })} aria-label="Abhaken">
                    {k.done && <Icon name="check" size={12} stroke={3} />}
                  </button>
                  <span className="pv-grow">{k.title}</span>
                  <button className="pv-icon-btn ghost" style={{ width: 28, height: 28 }} aria-label="Entfernen" onClick={() => removeTask(k)}><Icon name="x" size={13} /></button>
                </div>
              ))}
              <div className="pv-row" style={{ gap: 6 }}>
                <input
                  className="pv-input"
                  style={{ minHeight: 36, padding: '6px 10px', fontSize: 14 }}
                  placeholder="To-do hinzufügen"
                  value={subInput[t.id] ?? ''}
                  onChange={e => setSubInput(s => ({ ...s, [t.id]: e.target.value }))}
                  onKeyDown={e => { if (e.key === 'Enter') addSub(t) }}
                />
                <button className="pv-icon-btn" aria-label="Hinzufügen" onClick={() => addSub(t)}><Icon name="plus" size={16} /></button>
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <>
      {error && <div className="pv-glass pv-empty" style={{ color: 'var(--pv-danger)' }}>{error}</div>}
      <div className="pv-rem-layout">
        {/* Listen */}
        <aside className="pv-glass pv-card" style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: 12 }}>
          <div className="pv-chips pv-phone-only" style={{ marginBottom: 6 }}>
            {smart.map(s => (
              <button key={String(s.key)} className={`pv-chip ${filter === s.key ? 'active' : ''}`} onClick={() => setFilter(s.key)}>
                {s.label} <span className="count">{counts[String(s.key)]}</span>
              </button>
            ))}
            {lists.map(l => (
              <button key={l.id} className={`pv-chip ${filter === l.id ? 'active' : ''}`} onClick={() => setFilter(l.id)}>
                {l.name} <span className="count">{counts[l.id] ?? 0}</span>
              </button>
            ))}
            <button className="pv-chip" onClick={() => setListModal({ list: null, name: '', color: EVENT_COLORS[lists.length % EVENT_COLORS.length] })}>
              <Icon name="plus" size={13} /> Liste
            </button>
          </div>
          <div className="pv-desktop-only" style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {smart.map(s => (
              <button key={String(s.key)} className={`pv-folder-item ${filter === s.key ? 'active' : ''}`} onClick={() => setFilter(s.key)}>
                <Icon name={s.icon} size={17} /> <span className="pv-grow">{s.label}</span>
                <span className="pv-muted" style={{ fontSize: 12 }}>{counts[String(s.key)]}</span>
              </button>
            ))}
            <p className="pv-eyebrow" style={{ padding: '12px 10px 6px' }}>Meine Listen</p>
            {lists.map(l => (
              <div key={l.id} role="button" tabIndex={0} className={`pv-folder-item ${filter === l.id ? 'active' : ''}`} onClick={() => setFilter(l.id)}>
                <span className="pv-folder-dot" style={{ background: l.color ?? 'var(--pv-accent)' }} />
                <span className="pv-grow pv-ellipsis">{l.name}</span>
                <span className="pv-muted" style={{ fontSize: 12 }}>{counts[l.id] ?? 0}</span>
                <span className="pv-folder-actions">
                  <button aria-label={`${l.name} bearbeiten`} onClick={e => { e.stopPropagation(); setListModal({ list: l, name: l.name, color: l.color ?? EVENT_COLORS[0] }) }}><Icon name="pencil" size={14} /></button>
                </span>
              </div>
            ))}
            <button className="pv-folder-item" style={{ color: 'var(--pv-ink-3)' }} onClick={() => setListModal({ list: null, name: '', color: EVENT_COLORS[lists.length % EVENT_COLORS.length] })}>
              <Icon name="plus" size={16} /> Neue Liste
            </button>
          </div>
        </aside>

        {/* Reminder */}
        <section className="pv-glass pv-card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div className="pv-row">
            <div className="pv-grow">
              <div className="pv-h2">{filterName}</div>
              <div className="pv-muted" style={{ fontSize: 12.5 }}>{visible.length} {visible.length === 1 ? 'Eintrag' : 'Einträge'}</div>
            </div>
            <button className="pv-btn primary" onClick={() => openEdit(null)}><Icon name="plus" size={17} /> Reminder</button>
          </div>
          {filter !== 'done' && (
            <div className="pv-quickadd">
              <input className="pv-input" placeholder="Schnell hinzufügen … (Enter)" value={quick} onChange={e => setQuick(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') quickAdd() }} />
              <button className="pv-icon-btn" aria-label="Hinzufügen" onClick={quickAdd}><Icon name="plus" size={18} /></button>
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', margin: '0 -8px' }}>
            {visible.length === 0 && <div className="pv-empty">{filter === 'done' ? 'Noch nichts erledigt.' : 'Alles erledigt.'}</div>}
            {visible.map(taskRow)}
          </div>
        </section>
      </div>

      {/* Reminder bearbeiten */}
      {draft && (
        <Portal>
          <div className="pv-overlay sheet" onClick={e => { if (e.target === e.currentTarget) setDraft(null) }}>
            <div className="pv-modal" style={{ width: 500 }}>
              <div className="pv-grip" />
              <div className="pv-row">
                <div className="pv-h2 pv-grow">{draft.id ? 'Reminder bearbeiten' : 'Neuer Reminder'}</div>
                <button className="pv-icon-btn ghost" aria-label="Schließen" onClick={() => setDraft(null)}><Icon name="x" /></button>
              </div>
              <input className="pv-input" placeholder="Was?" value={draft.title} autoFocus onChange={e => setDraft({ ...draft, title: e.target.value })} onKeyDown={e => { if (e.key === 'Enter') saveDraft() }} />
              <textarea className="pv-input" rows={2} placeholder="Notizen (optional)" value={draft.notes} onChange={e => setDraft({ ...draft, notes: e.target.value })} style={{ resize: 'vertical' }} />
              <label className="pv-check-row" style={{ minHeight: 32 }}>
                <input type="checkbox" checked={draft.remindOn} onChange={e => setDraft({ ...draft, remindOn: e.target.checked })} /> Erinnern (Push + Glocke)
              </label>
              {draft.remindOn && (
                <div className="pv-form-grid">
                  <div><label className="pv-label">Datum</label><input className="pv-input" type="date" value={draft.date} onChange={e => setDraft({ ...draft, date: e.target.value })} /></div>
                  <div><label className="pv-label">Uhrzeit</label><input className="pv-input" type="time" value={draft.time} onChange={e => setDraft({ ...draft, time: e.target.value })} /></div>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <div className="pv-chips">
                      {[['Heute Abend', 0, '19:00'], ['Morgen früh', 1, '08:00'], ['In 1 Std.', -1, ''], ['Nächste Woche', 7, '09:00']].map(([label, days, t]) => (
                        <button key={String(label)} className="pv-chip" onClick={() => {
                          if (days === -1) { const d = new Date(Date.now() + 3600_000); setDraft({ ...draft, date: dateKey(d), time: timeKey(d) }) }
                          else { const d = new Date(); d.setDate(d.getDate() + Number(days)); setDraft({ ...draft, date: dateKey(d), time: String(t) }) }
                        }}>{label}</button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="pv-label">Wiederholen</label>
                    <select className="pv-input" value={draft.repeat} onChange={e => setDraft({ ...draft, repeat: e.target.value as Recurrence })}>
                      {RECURRENCES.map(r => <option key={r} value={r}>{RECURRENCE_LABEL[r]}</option>)}
                    </select>
                  </div>
                </div>
              )}
              <div className="pv-form-grid">
                <div>
                  <label className="pv-label">Liste</label>
                  <select className="pv-input" value={draft.listId ?? ''} onChange={e => setDraft({ ...draft, listId: e.target.value ? Number(e.target.value) : null })}>
                    <option value="">Keine Liste</option>
                    {lists.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="pv-label">Wichtigkeit</label>
                  <div className="pv-seg" style={{ width: '100%' }}>
                    {['Normal', '!', '!!', '!!!'].map((p, i) => (
                      <button key={p} className={draft.priority === i ? 'active' : ''} style={{ flex: 1, justifyContent: 'center' }} onClick={() => setDraft({ ...draft, priority: i })}>{p}</button>
                    ))}
                  </div>
                </div>
              </div>

              {draft.id && (() => {
                const parent = tasks.find(t => t.id === draft.id)
                if (!parent) return null
                return (
                  <div>
                    <label className="pv-label">To-do-Liste</label>
                    <div className="pv-subtasks" style={{ margin: 0 }}>
                      {childrenOf(parent.id).map(k => (
                        <div key={k.id} className={`pv-subtask ${k.done ? 'done' : ''}`}>
                          <button className={`pv-checkbox sm ${k.done ? 'on' : ''}`} onClick={() => patch(k, { done: !k.done })} aria-label="Abhaken">{k.done && <Icon name="check" size={12} stroke={3} />}</button>
                          <span className="pv-grow">{k.title}</span>
                          <button className="pv-icon-btn ghost" style={{ width: 28, height: 28 }} aria-label="Entfernen" onClick={() => removeTask(k)}><Icon name="x" size={13} /></button>
                        </div>
                      ))}
                      <div className="pv-row" style={{ gap: 6 }}>
                        <input className="pv-input" style={{ minHeight: 38 }} placeholder="To-do hinzufügen (Enter)" value={subInput[parent.id] ?? ''} onChange={e => setSubInput(s => ({ ...s, [parent.id]: e.target.value }))} onKeyDown={e => { if (e.key === 'Enter') addSub(parent) }} />
                        <button className="pv-icon-btn" aria-label="Hinzufügen" onClick={() => addSub(parent)}><Icon name="plus" size={16} /></button>
                      </div>
                    </div>
                  </div>
                )
              })()}

              <div className="pv-modal-actions">
                {draft.id && (
                  <button className="pv-btn danger" style={{ marginRight: 'auto' }} onClick={() => { const t = tasks.find(x => x.id === draft.id); if (t && confirm('Reminder löschen?')) { removeTask(t); setDraft(null) } }}>
                    <Icon name="trash" size={16} /> Löschen
                  </button>
                )}
                <button className="pv-btn" onClick={() => setDraft(null)}>{draft.id ? 'Schließen' : 'Abbrechen'}</button>
                <button className="pv-btn primary" disabled={!draft.title.trim()} onClick={saveDraft}>Speichern</button>
              </div>
            </div>
          </div>
        </Portal>
      )}

      {/* Liste anlegen/bearbeiten */}
      {listModal && (
        <Portal>
          <div className="pv-overlay sheet" onClick={e => { if (e.target === e.currentTarget) setListModal(null) }}>
            <div className="pv-modal">
              <div className="pv-grip" />
              <div className="pv-h2">{listModal.list ? 'Liste bearbeiten' : 'Neue Liste'}</div>
              <input className="pv-input" placeholder="z.B. Einkauf, Schule, Server" value={listModal.name} autoFocus onChange={e => setListModal({ ...listModal, name: e.target.value })} onKeyDown={e => { if (e.key === 'Enter') saveList() }} />
              <div className="pv-color-row">
                {EVENT_COLORS.map(c => <button key={c} aria-label={`Farbe ${c}`} className={listModal.color === c ? 'on' : ''} style={{ background: c }} onClick={() => setListModal({ ...listModal, color: c })} />)}
              </div>
              <div className="pv-modal-actions">
                {listModal.list && <button className="pv-btn danger" style={{ marginRight: 'auto' }} onClick={() => deleteList(listModal.list!)}><Icon name="trash" size={16} /> Löschen</button>}
                <button className="pv-btn" onClick={() => setListModal(null)}>Abbrechen</button>
                <button className="pv-btn primary" disabled={!listModal.name.trim()} onClick={saveList}>Speichern</button>
              </div>
            </div>
          </div>
        </Portal>
      )}
    </>
  )
}