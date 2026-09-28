'use client'

// Öffentliche Ansicht für geteilte Notizen (/private/leonie/view?token=…).
// Kein Login nötig — der Token im Link ist der Zugang. Die Shell (PrivateShell)
// lässt diese Seite deshalb ohne Rollenprüfung und ohne Menü durch.

import { Suspense, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Icon from '../../_components/Icon'
import { NoteFileCards, NoteMediaColumn } from '../../_components/NoteAttachments'
import { shareUrls, type PFile } from '../../_lib/files'
import { downloadTxt, noteHtml, printNote, type Paper } from '../../_lib/rich'

interface Note {
  id: number
  title: string
  content: string
  content_html?: string | null
  paper?: Paper | null
  created_at: string
  updated_at: string
  folder_name?: string | null
  folder_color?: string | null
  attachments?: PFile[]
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function ViewContent() {
  const params = useSearchParams()
  const token = params.get('token')

  const [notes, setNotes] = useState<Note[]>([])
  const [label, setLabel] = useState<string | null>(null)
  const [shareAll, setShareAll] = useState(false)
  const [selected, setSelected] = useState<Note | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [listOpen, setListOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    if (!token) {
      setError('Kein Zugangslink angegeben.')
      setLoading(false)
      return
    }
    fetch(`/api/private/leonie/shares/validate?token=${encodeURIComponent(token)}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) { setError(data.error); return }
        setNotes(data.notes)
        setLabel(data.label)
        setShareAll(data.share_all)
        if (data.notes.length > 0) setSelected(data.notes[0])
      })
      .catch(() => setError('Verbindung fehlgeschlagen.'))
      .finally(() => setLoading(false))
  }, [token])

  // Anhänge laufen über eine eigene Route, die nur Dateien dieses Links herausgibt
  const urls = useMemo(() => shareUrls(token ?? ''), [token])
  const openAttachment = (f: PFile) => window.open(urls.file(f.id, true), '_blank', 'noopener')

  if (loading) return <div className="pv-center"><div className="pv-spinner" /></div>

  if (error) {
    return (
      <div className="pv-center">
        <div className="pv-glass pv-card" style={{ padding: 32, maxWidth: 380 }}>
          <Icon name="link" size={34} stroke={1.4} style={{ color: 'var(--pv-accent)' }} />
          <p className="pv-h2" style={{ margin: '10px 0 6px' }}>Link nicht verfügbar</p>
          <p className="pv-muted" style={{ margin: 0, fontSize: 14 }}>{error}</p>
        </div>
      </div>
    )
  }

  const noteButtons = notes.map(n => (
    <button
      key={n.id}
      className={`pv-note-item ${selected?.id === n.id ? 'active' : ''}`}
      onClick={() => { setSelected(n); setListOpen(false) }}
    >
      <div className="pv-note-item-title pv-ellipsis">{n.title}</div>
      <div className="pv-note-item-meta">{formatDate(n.updated_at)}{n.folder_name ? ` · ${n.folder_name}` : ''}</div>
    </button>
  ))

  return (
    <>
      <header className="pv-row" style={{
        padding: '12px 16px', paddingTop: 'calc(12px + env(safe-area-inset-top))',
        background: 'rgba(255,255,255,0.4)', borderBottom: '1px solid var(--pv-glass-border)',
        backdropFilter: 'var(--pv-blur)', WebkitBackdropFilter: 'var(--pv-blur)', position: 'relative', zIndex: 2,
      }}>
        {shareAll && (
          <button className="pv-icon-btn pv-phone-only" aria-label="Notizen" onClick={() => setListOpen(true)}>
            <Icon name="menu" size={18} />
          </button>
        )}
        <span className="pv-brand-mark" style={{ width: 34, height: 34, fontSize: 18 }}>L</span>
        <span className="pv-grow pv-ellipsis" style={{ fontFamily: 'var(--pv-serif)', fontStyle: 'italic', fontSize: 20 }}>
          {label || 'Leonies Notizen'}
        </span>
        {selected && (
          <>
            <button className="pv-btn sm pv-desktop-only" onClick={() => downloadTxt(selected)}><Icon name="download" size={15} /> TXT</button>
            <button className="pv-btn sm pv-desktop-only" onClick={() => printNote(selected)}><Icon name="pdf" size={15} /> PDF</button>
            <button className="pv-icon-btn pv-phone-only" aria-label="Exportieren" onClick={() => setMenuOpen(true)}><Icon name="more" size={18} /></button>
          </>
        )}
      </header>

      <div style={{ flex: 1, minHeight: 0, display: 'flex', position: 'relative', zIndex: 1 }}>
        {shareAll && (
          <aside className="pv-desktop-only" style={{
            width: 290, flexShrink: 0, overflowY: 'auto', padding: '16px 10px',
            background: 'rgba(255,255,255,0.28)', borderRight: '1px solid var(--pv-glass-border)',
          }}>
            <p className="pv-eyebrow" style={{ padding: '0 10px 8px' }}>{notes.length} Notizen</p>
            {noteButtons}
          </aside>
        )}
        <main style={{ flex: 1, minWidth: 0, overflowY: 'auto', padding: '28px 18px calc(40px + env(safe-area-inset-bottom))' }}>
          {!selected ? (
            <div className="pv-empty">Keine Notiz freigegeben</div>
          ) : (
            <article className="pv-glass" style={{ maxWidth: selected.attachments?.length ? 1100 : 780, margin: '0 auto', padding: '28px 26px' }}>
              {selected.folder_name && (
                <span className="pv-badge" style={{ marginBottom: 12 }}>{selected.folder_name}</span>
              )}
              <h1 className="pv-title" style={{ fontSize: 30 }}>{selected.title}</h1>
              <p className="pv-subtitle">Zuletzt geändert {formatDate(selected.updated_at)}</p>
              {/* Inhalt ist beim Speichern gereinigt worden (app/lib/rich-html.ts) */}
              <div className="pv-rich pv-rich-static" data-paper={selected.paper ?? 'plain'} style={{ marginTop: 18 }}>
                <div className="pv-rich-page">
                  <NoteMediaColumn items={selected.attachments ?? []} urls={urls} onOpen={openAttachment} />
                  {selected.content.trim() || selected.content_html
                    ? <div className="pv-rich-content" dangerouslySetInnerHTML={{ __html: noteHtml(selected) }} />
                    : <span className="pv-muted" style={{ fontStyle: 'italic' }}>Diese Notiz ist noch leer.</span>}
                  <NoteFileCards items={selected.attachments ?? []} urls={urls} onOpen={openAttachment} />
                </div>
              </div>
            </article>
          )}
        </main>
      </div>

      {listOpen && (
        <div className="pv-overlay sheet" onClick={e => { if (e.target === e.currentTarget) setListOpen(false) }}>
          <div className="pv-modal">
            <div className="pv-grip" />
            <div className="pv-h2">{notes.length} Notizen</div>
            <div style={{ maxHeight: '55dvh', overflowY: 'auto' }}>{noteButtons}</div>
            <button className="pv-btn" onClick={() => setListOpen(false)}>Schließen</button>
          </div>
        </div>
      )}

      {menuOpen && selected && (
        <div className="pv-overlay sheet" onClick={e => { if (e.target === e.currentTarget) setMenuOpen(false) }}>
          <div className="pv-modal">
            <div className="pv-grip" />
            <div className="pv-ellipsis" style={{ fontWeight: 600 }}>{selected.title}</div>
            <button className="pv-menu-item" onClick={() => { downloadTxt(selected); setMenuOpen(false) }}><Icon name="download" /> Als TXT speichern</button>
            <button className="pv-menu-item" onClick={() => { setMenuOpen(false); setTimeout(() => printNote(selected), 250) }}><Icon name="pdf" /> Als PDF speichern</button>
            <button className="pv-btn" onClick={() => setMenuOpen(false)}>Schließen</button>
          </div>
        </div>
      )}
    </>
  )
}

export default function LeonieViewPage() {
  return (
    <Suspense fallback={<div className="pv-center"><div className="pv-spinner" /></div>}>
      <ViewContent />
    </Suspense>
  )
}