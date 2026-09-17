'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'

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
      parts.push(<a key={key++} href={url} target="_blank" rel="noopener noreferrer" className="lv-link">{label}</a>)
      i++
    } else if (seg) {
      const sub = seg.split(urlRegex)
      for (let j = 0; j < sub.length; j++) {
        if (j % 2 === 1) parts.push(<a key={key++} href={sub[j]} target="_blank" rel="noopener noreferrer" className="lv-link">{sub[j]}</a>)
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
  const body = `${note.title}\n${'─'.repeat(40)}\nZuletzt geändert: ${formatDate(note.updated_at)}\n\n${note.content}`
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
  body{font-family:Georgia,serif;max-width:700px;margin:40px auto;padding:0 20px;color:#2a1f1f;line-height:1.75}
  h1{font-size:1.6rem;margin-bottom:.4rem}
  hr{border:none;border-top:1px solid #c9b99a;margin:1.2rem 0}
  a{color:#8b6a3e}
  pre{white-space:pre-wrap;word-break:break-word;font-family:inherit;font-size:1rem}
  .meta{color:#8a7a6a;font-size:.85rem}
  @media print{body{margin:0}}
</style></head><body>
<h1>${escapeHtml(note.title)}</h1>
<div class="meta">Zuletzt geändert ${formatDate(note.updated_at)}</div>
<hr>
<pre>${escapeHtml(note.content)}</pre>
</body></html>`

  const isTouch = typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches

  if (isTouch) {
    const frame = document.createElement('iframe')
    frame.setAttribute('aria-hidden', 'true')
    frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;'
    document.body.appendChild(frame)
    const doc = frame.contentWindow?.document
    if (!doc) { document.body.removeChild(frame); return }
    doc.open()
    doc.write(html)
    doc.close()
    setTimeout(() => {
      frame.contentWindow?.focus()
      frame.contentWindow?.print()
      setTimeout(() => document.body.removeChild(frame), 2000)
    }, 350)
    return
  }

  const win = window.open('', '_blank')
  if (!win) {
    alert('Popup wurde blockiert. Bitte Popups erlauben.')
    return
  }
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
  const [isNarrow, setIsNarrow] = useState(false)
  const [listOpen, setListOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    const q = window.matchMedia('(max-width: 819px)')
    const update = () => setIsNarrow(q.matches)
    update()
    q.addEventListener('change', update)
    return () => q.removeEventListener('change', update)
  }, [])

  useEffect(() => {
    const open = listOpen || menuOpen
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [listOpen, menuOpen])

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
      .catch(() => setError('Die Notizen konnten nicht geladen werden.'))
      .finally(() => setLoading(false))
  }, [token])

  if (loading) {
    return <div className="lv-center"><div className="lv-spinner" /></div>
  }

  if (error) {
    return (
      <div className="lv-center">
        <div className="lv-error-card">
          <div style={{ fontSize: '1.6rem', marginBottom: '.5rem' }}>✦</div>
          <div style={{ color: '#6b5040', fontSize: '.95rem' }}>{error}</div>
        </div>
      </div>
    )
  }

  const noteButtons = notes.map(n => (
    <button
      key={n.id}
      className={`lv-note-btn ${selected?.id === n.id ? 'active' : ''}`}
      onClick={() => { setSelected(n); setListOpen(false) }}
    >
      {n.title}
    </button>
  ))

  return (
    <>
      <div className="lv-header">
        {shareAll && isNarrow && (
          <button className="lv-icon-btn" aria-label="Notizen" onClick={() => setListOpen(true)}>☰</button>
        )}
        <span className="lv-logo">✦ {label || 'Leonies Notizen'}</span>
        {selected && (
          isNarrow ? (
            <button className="lv-icon-btn" aria-label="Exportieren" onClick={() => setMenuOpen(true)}>⋯</button>
          ) : (
            <>
              <button className="lv-btn" onClick={() => downloadTxt(selected)}>TXT</button>
              <button className="lv-btn" onClick={() => downloadPdf(selected)}>PDF</button>
            </>
          )
        )}
      </div>

      <div className={shareAll && !isNarrow ? 'lv-layout lv-layout-split' : 'lv-layout'}>
        {shareAll && !isNarrow && (
          <aside className="lv-sidebar">
            <div className="lv-sidebar-label">{notes.length} Notizen</div>
            {noteButtons}
          </aside>
        )}

        <div className="lv-main">
          {!selected ? (
            <div className="lv-empty">Keine Notiz freigegeben</div>
          ) : (
            <div className="lv-viewer">
              {selected.folder_name && (
                <div className="lv-folder-badge" style={{ background: `${selected.folder_color || '#c9b99a'}33` }}>
                  {selected.folder_name}
                </div>
              )}
              <h1 className="lv-note-title">{selected.title}</h1>
              <div className="lv-note-meta">Zuletzt geändert {formatDate(selected.updated_at)}</div>
              <div className="lv-note-body">
                {selected.content.trim()
                  ? parseLinks(selected.content)
                  : <span style={{ color: '#c0a880', fontStyle: 'italic' }}>Diese Notiz ist noch leer.</span>}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Notizliste als Sheet (Handy/Tablet) */}
      {listOpen && (
        <div className="lv-sheet-wrap" onClick={e => { if (e.target === e.currentTarget) setListOpen(false) }}>
          <div className="lv-sheet">
            <div className="lv-sheet-grip" />
            <div className="lv-sheet-title">{notes.length} Notizen</div>
            <div className="lv-sheet-list">{noteButtons}</div>
            <button className="lv-btn" style={{ marginTop: '.6rem' }} onClick={() => setListOpen(false)}>Schließen</button>
          </div>
        </div>
      )}

      {/* Export-Sheet (Handy/Tablet) */}
      {menuOpen && selected && (
        <div className="lv-sheet-wrap" onClick={e => { if (e.target === e.currentTarget) setMenuOpen(false) }}>
          <div className="lv-sheet">
            <div className="lv-sheet-grip" />
            <div className="lv-sheet-title">{selected.title}</div>
            <button className="lv-sheet-item" onClick={() => { downloadTxt(selected); setMenuOpen(false) }}>
              <span className="lv-sheet-icon">↓</span> Als TXT speichern
            </button>
            <button className="lv-sheet-item" onClick={() => { setMenuOpen(false); setTimeout(() => downloadPdf(selected), 250) }}>
              <span className="lv-sheet-icon">↓</span> Als PDF speichern
            </button>
            <button className="lv-btn" style={{ marginTop: '.6rem' }} onClick={() => setMenuOpen(false)}>Schließen</button>
          </div>
        </div>
      )}
    </>
  )
}

export default function LeonieViewPage() {
  return (
    <div className="lv-root">
      <style>{`
        .lv-root{
          height:100dvh;display:flex;flex-direction:column;overflow:hidden;
          background:linear-gradient(135deg,#f6f0e7 0%,#ece2d4 45%,#e5d8c4 100%);
          background-attachment:fixed;
          font-family:Georgia,'Times New Roman',serif;color:#3d2810;
          -webkit-text-size-adjust:100%;
        }
        .lv-root *{box-sizing:border-box}
        .lv-root button{-webkit-tap-highlight-color:transparent}

        .lv-center{flex:1;display:flex;align-items:center;justify-content:center;padding:1rem}
        .lv-spinner{width:28px;height:28px;border:3px solid rgba(180,140,90,.25);border-top-color:rgba(140,100,50,.7);border-radius:50%;animation:lvs .8s linear infinite}
        @keyframes lvs{to{transform:rotate(360deg)}}
        .lv-error-card{
          background:rgba(246,240,231,.7);
          backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);
          border:1px solid rgba(180,155,120,.32);border-radius:15px;
          padding:2rem 2.2rem;text-align:center;max-width:380px;
        }

        .lv-header{
          flex-shrink:0;z-index:20;
          background:rgba(246,240,231,.78);
          backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px);
          border-bottom:1px solid rgba(180,155,120,.28);
          padding:.7rem 1rem;padding-top:calc(.7rem + env(safe-area-inset-top));
          display:flex;align-items:center;gap:.5rem;
        }
        .lv-logo{font-size:1rem;font-weight:600;color:#5a3e28;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        .lv-btn{
          background:rgba(140,100,50,.1);border:1px solid rgba(140,100,50,.22);
          border-radius:10px;padding:.5rem .85rem;min-height:40px;
          font-size:.85rem;color:#5a3e28;cursor:pointer;font-family:inherit;
          transition:background .12s;white-space:nowrap;
        }
        .lv-btn:hover{background:rgba(140,100,50,.22)}
        .lv-icon-btn{
          background:rgba(140,100,50,.08);border:1px solid rgba(140,100,50,.18);
          border-radius:10px;width:40px;height:40px;flex-shrink:0;
          font-size:1.15rem;line-height:1;color:#5a3e28;cursor:pointer;font-family:inherit;
          display:flex;align-items:center;justify-content:center;transition:background .12s;
        }
        .lv-icon-btn:hover{background:rgba(140,100,50,.2)}

        .lv-layout{flex:1;min-height:0}
        .lv-layout-split{display:grid;grid-template-columns:260px 1fr}
        .lv-sidebar{
          overflow-y:auto;-webkit-overflow-scrolling:touch;
          background:rgba(246,240,231,.5);
          backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);
          border-right:1px solid rgba(180,155,120,.22);
          padding:1.2rem .85rem;display:flex;flex-direction:column;gap:.2rem;
        }
        .lv-sidebar-label{font-size:.7rem;letter-spacing:.09em;color:#b09572;padding:0 .5rem;margin-bottom:.5rem}
        .lv-note-btn{
          display:block;width:100%;text-align:left;background:none;border:none;
          padding:.6rem .7rem;min-height:44px;border-radius:10px;cursor:pointer;
          font-family:inherit;font-size:.9rem;color:#5a3e28;transition:background .12s;
          overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex-shrink:0;
        }
        .lv-note-btn:hover,.lv-note-btn:active{background:rgba(180,140,90,.14)}
        .lv-note-btn.active{background:rgba(180,140,90,.24);font-weight:600;color:#3d2810}

        .lv-main{display:flex;flex-direction:column;min-height:0;overflow-y:auto;-webkit-overflow-scrolling:touch;background:rgba(251,246,239,.32);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px)}
        .lv-viewer{padding:1.5rem 1.1rem;padding-bottom:calc(2rem + env(safe-area-inset-bottom));max-width:78ch}
        .lv-folder-badge{display:inline-block;padding:.2rem .6rem;border-radius:999px;font-size:.75rem;color:#5a3e28;margin-bottom:.9rem}
        .lv-note-title{font-size:1.4rem;font-weight:600;color:#2a1a08;margin:0 0 .3rem;overflow-wrap:anywhere}
        .lv-note-meta{font-size:.78rem;color:#b09878;margin-bottom:1.4rem}
        .lv-note-body{font-size:1rem;color:#2a1a08;line-height:1.78;white-space:pre-wrap;overflow-wrap:anywhere}
        .lv-link{color:#8b5e30;text-decoration:underline;text-underline-offset:2px;overflow-wrap:anywhere}
        .lv-link:hover{color:#5a3010}
        .lv-empty{flex:1;display:flex;align-items:center;justify-content:center;color:#c0a880;font-style:italic;padding:2rem;text-align:center}

        .lv-sheet-wrap{
          position:fixed;inset:0;z-index:100;display:flex;align-items:flex-end;justify-content:center;
          background:rgba(40,25,10,.34);backdrop-filter:blur(5px);-webkit-backdrop-filter:blur(5px);
          animation:lvfade .18s ease;
        }
        @keyframes lvfade{from{opacity:0}to{opacity:1}}
        .lv-sheet{
          width:100%;max-width:520px;
          background:rgba(250,245,236,.96);
          backdrop-filter:blur(22px);-webkit-backdrop-filter:blur(22px);
          border:1px solid rgba(180,155,120,.38);border-bottom:none;
          border-radius:20px 20px 0 0;
          padding:1rem 1.1rem;padding-bottom:calc(1.1rem + env(safe-area-inset-bottom));
          display:flex;flex-direction:column;gap:.3rem;
          box-shadow:0 -10px 40px rgba(70,45,20,.2);
          animation:lvup .24s cubic-bezier(.2,.8,.3,1);
          max-height:85dvh;
        }
        @keyframes lvup{from{transform:translateY(100%)}to{transform:none}}
        .lv-sheet-grip{width:38px;height:4px;border-radius:2px;background:rgba(160,135,105,.45);margin:0 auto .7rem;flex-shrink:0}
        .lv-sheet-title{font-size:.95rem;font-weight:600;color:#3d2810;padding:0 .3rem .5rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex-shrink:0}
        .lv-sheet-list{overflow-y:auto;-webkit-overflow-scrolling:touch;display:flex;flex-direction:column;gap:.15rem;min-height:0}
        .lv-sheet-item{
          display:flex;align-items:center;gap:.8rem;
          background:none;border:none;width:100%;text-align:left;
          padding:.85rem .6rem;min-height:50px;border-radius:11px;
          font-family:inherit;font-size:.95rem;color:#4a3018;cursor:pointer;transition:background .12s;
        }
        .lv-sheet-item:hover,.lv-sheet-item:active{background:rgba(180,140,90,.14)}
        .lv-sheet-icon{width:22px;text-align:center;font-size:1rem;opacity:.75;flex-shrink:0}

        @media (prefers-reduced-motion:reduce){
          .lv-root *,.lv-sheet{animation:none !important;transition:none !important}
        }
      `}</style>
      <Suspense fallback={<div className="lv-center"><div className="lv-spinner" /></div>}>
        <ViewContent />
      </Suspense>
    </div>
  )
}