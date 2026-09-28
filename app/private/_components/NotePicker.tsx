'use client'

// Auswahl-Dialog in Quick Share: Datei(en) in eine Notiz übernehmen.
// Man kann eine bestehende Notiz wählen oder direkt eine neue anlegen.

import { useEffect, useMemo, useState } from 'react'
import Icon from './Icon'
import Portal from './Portal'
import { formatWhen } from '../_lib/files'

interface NoteLite { id: number; title: string; content: string; updated_at: string }

export default function NotePicker({
  count, onClose, onPick,
}: {
  count: number
  onClose: () => void
  onPick: (note: { id: number; title: string }) => Promise<void> | void
}) {
  const [notes, setNotes] = useState<NoteLite[] | null>(null)
  const [search, setSearch] = useState('')
  const [busy, setBusy] = useState(false)
  const [newTitle, setNewTitle] = useState('')

  useEffect(() => {
    fetch('/api/private/leonie/notes')
      .then(r => (r.ok ? r.json() : []))
      .then(setNotes)
      .catch(() => setNotes([]))
  }, [])

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    return (notes ?? []).filter(n => !q || n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q))
  }, [notes, search])

  async function pick(note: { id: number; title: string }) {
    setBusy(true)
    try { await onPick(note) } finally { setBusy(false) }
  }

  async function createAndPick() {
    const title = newTitle.trim() || 'Neue Notiz'
    setBusy(true)
    try {
      const res = await fetch('/api/private/leonie/notes', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title, content: '' }),
      })
      if (!res.ok) return
      const note = await res.json()
      await onPick({ id: note.id, title: note.title })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Portal>
      <div className="pv-overlay sheet" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
        <div className="pv-modal">
          <div className="pv-grip" />
          <div className="pv-row">
            <div className="pv-grow">
              <div className="pv-h2">In Notiz übernehmen</div>
              <div className="pv-muted" style={{ fontSize: 13 }}>{count === 1 ? '1 Datei' : `${count} Dateien`} anhängen an …</div>
            </div>
            <button className="pv-icon-btn ghost" aria-label="Schließen" onClick={onClose}><Icon name="x" /></button>
          </div>

          <div className="pv-row">
            <input
              className="pv-input"
              placeholder="Neue Notiz: Titel"
              value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') createAndPick() }}
            />
            <button className="pv-btn primary" disabled={busy} onClick={createAndPick}><Icon name="plus" size={17} /> Neu</button>
          </div>

          <label className="pv-search">
            <Icon name="search" size={16} />
            <input className="pv-input" type="search" placeholder="Bestehende Notiz suchen" value={search} onChange={e => setSearch(e.target.value)} />
          </label>

          <div style={{ maxHeight: '46dvh', overflowY: 'auto', margin: '0 -6px' }}>
            {notes === null && <div className="pv-center"><div className="pv-spinner" /></div>}
            {notes !== null && visible.length === 0 && <div className="pv-empty">Keine Notiz gefunden</div>}
            {visible.map(n => (
              <button key={n.id} className="pv-note-item" disabled={busy} onClick={() => pick(n)}>
                <div className="pv-note-item-title pv-ellipsis">{n.title}</div>
                <div className="pv-note-item-meta">{formatWhen(n.updated_at)}</div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </Portal>
  )
}