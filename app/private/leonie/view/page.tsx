'use client'

// Öffentliche Ansicht für geteilte Notizen (/private/leonie/view?token=…).
// Kein Login nötig — der Token im Link ist der Zugang. Die Shell (PrivateShell)
// lässt diese Seite deshalb ohne Rollenprüfung und ohne Menü durch.

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Icon from '../../_components/Icon'

interface Note {
  id: number
  title: string
  content: string
  created_at: string
  updated_at: string
  folder_name?: string | null
  folder_color?: string | null
}

function parseLinks(text: string): React.ReactNode[] {
  const mdRegex = /\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g
  const urlRegex = /(\bhttps?:\/\/[^\s<>)"]+)/g
  const processed = text.replace(mdRegex, (_m, label, url) => `\x00LINK\x00${label}\x00${url}\x00`)
  const segments = processed.split('\x00')
  const parts: React.ReactNode[] = []
  let key = 0
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i]
    if (seg === 'LINK') {
      const label = segments[++i]
      const url = segments[++i]
      parts.push(<a key={key++} href={url} target="_blank" rel="noopener noreferrer" className="pv-link">{label}</a>)
      i++
    } else if (seg) {
      const sub = seg.split(urlRegex)
      for (let j = 0; j < sub.length; j++) {
        if (j % 2 === 1) parts.push(<a key={key++} href={sub[j]} target="_blank" rel="noopener noreferrer" className="pv-link">{sub[j]}</a>)
        else if (sub[j]) parts.push(<span key={key++}>{sub[j]}</span>)
      }
    }
  }
  return parts
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
}
function safeFilename(name: string) {
  return name.replace(/[^a-z0-9äöüßÄÖÜ\-_ ]/gi, '').trim().replace(/\s+/g, '_') || 'notiz'
}
function escapeHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function downloadTxt(note: Note) {
  const body = `${note.title}\n${'-'.repeat(40)}\nZuletzt geändert: ${formatDate(note.updated_at)}\n\n${note.content}`
  const blob = new Blob([body], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${safeFilename(note.title)}.txt`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function downloadPdf(note: Note) {
  const html = `<!DOCTYPE html><html lang="de"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(note.title)}</title>
<style>
  body{font-family:Georgia,serif;max-width:700px;margin:40px auto;padding:0 20px;color:#3a1433;line-height:1.75}
  h1{font-size:1.6rem;margin-bottom:.4rem;font-style:italic}
  hr{border:none;border-top:1px solid #e3c6dc;margin:1.2rem 0}
  pre{white-space:pre-wrap;word-break:break-word;font-family:inherit;font-size:1rem}
  .meta{color:#8a6a80;font-size:.85rem}
  @media print{body{margin:0}}
</style></head><body>
<h1>${escapeHtml(note.title)}</h1>
<div class="meta">Zuletzt geändert ${formatDate(note.updated_at)}</div>
<hr>
<pre>${escapeHtml(note.content)}</pre>
</body></html>`

  if (window.matchMedia('(pointer: coarse)').matches) {
    const frame = document.createElement('iframe')
    frame.setAttribute('aria-hidden', 'true')
    frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;'
    document.body.appendChild(frame)
    const doc = frame.contentWindow?.document
    if (!doc) { document.body.removeChild(frame); return }
    doc.open(); doc.write(html); doc.close()
    setTimeout(() => {
      frame.contentWindow?.focus()
      frame.contentWindow?.print()
      setTimeout(() => document.body.removeChild(frame), 2000)
    }, 350)
    return
  }
  const win = window.open('', '_blank')
  if (!win) return
  win.document.write(html)
  win.document.close()
  win.focus()
  setTimeout(() => win.print(), 250)
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
            <button className="pv-btn sm pv-desktop-only" onClick={() => downloadPdf(selected)}><Icon name="pdf" size={15} /> PDF</button>
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
            <article className="pv-glass" style={{ maxWidth: 780, margin: '0 auto', padding: '28px 26px' }}>
              {selected.folder_name && (
                <span className="pv-badge" style={{ marginBottom: 12 }}>{selected.folder_name}</span>
              )}
              <h1 className="pv-title" style={{ fontSize: 30 }}>{selected.title}</h1>
              <p className="pv-subtitle">Zuletzt geändert {formatDate(selected.updated_at)}</p>
              <div style={{ marginTop: 18, fontSize: 16, lineHeight: 1.8, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
                {selected.content.trim()
                  ? parseLinks(selected.content)
                  : <span className="pv-muted" style={{ fontStyle: 'italic' }}>Diese Notiz ist noch leer.</span>}
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
            <button className="pv-menu-item" onClick={() => { setMenuOpen(false); setTimeout(() => downloadPdf(selected), 250) }}><Icon name="pdf" /> Als PDF speichern</button>
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