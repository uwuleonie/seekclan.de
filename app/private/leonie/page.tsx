'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/app/lib/auth-context'
import Icon from '../_components/Icon'
import Portal from '../_components/Portal'
import { usePrivate } from '../_components/PrivateShell'

/* ─── Typen ─── */
interface Folder { id: number; name: string; color: string; sort_order: number }
interface Note { id: number; folder_id: number | null; title: string; content: string; created_at: string; updated_at: string }
interface Share {
  id: number; token: string; note_id: number | null; share_all: boolean; label: string | null
  created_at: string; expires_at: string | null; note_title?: string | null
}

type Panel = 'notes' | 'shares'
type Mode = 'wide' | 'tablet' | 'phone'
type Pane = 'folders' | 'list' | 'note'

// Ordnerfarben passend zum Design (Rosa → Violett)
const FOLDER_COLORS = ['#d93690', '#a93bc9', '#7c4ae0', '#e36aa8', '#c07bd8', '#5b8def', '#25845c', '#e0913a']

/* ─── Helfer ─── */
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
  return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}
function formatDateShort(iso: string) {
  return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' })
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

function buildPrintHtml(note: Note) {
  return `<!DOCTYPE html><html lang="de"><head><meta charset="utf-8">
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
<div class="meta">Erstellt ${formatDate(note.created_at)} · Geändert ${formatDate(note.updated_at)}</div>
<hr>
<pre>${escapeHtml(note.content)}</pre>
</body></html>`
}

/** PDF über den Druckdialog. Auf Handys per unsichtbarem iframe (Popups werden dort oft blockiert). */
function downloadPdf(note: Note, toast: (t: string) => void) {
  const html = buildPrintHtml(note)
  const isTouch = window.matchMedia('(pointer: coarse)').matches
  if (isTouch) {
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
  if (!win) { toast('Popup wurde blockiert – bitte Popups für seekclan.de erlauben'); return }
  win.document.write(html)
  win.document.close()
  win.focus()
  setTimeout(() => win.print(), 250)
}

/* ─── Seite ─── */
export default function LeonieNotesPage() {
  const { user, loading } = useAuth()
  const { toast } = usePrivate()
  const isLeonie = user?.username === 'uwuleonie'

  const rootRef = useRef<HTMLDivElement>(null)
  const [mode, setMode] = useState<Mode>('wide')
  const [pane, setPane] = useState<Pane>('list')
  const [drawerOpen, setDrawerOpen] = useState(false)

  const [folders, setFolders] = useState<Folder[]>([])
  const [notes, setNotes] = useState<Note[]>([])
  const [shares, setShares] = useState<Share[]>([])
  const [selectedFolder, setSelectedFolder] = useState<number | 'all' | 'none'>('all')
  const [selectedNote, setSelectedNote] = useState<Note | null>(null)
  const [panel, setPanel] = useState<Panel>('notes')
  const [editMode, setEditMode] = useState(false)
  const [editTitle, setEditTitle] = useState('')
  const [editContent, setEditContent] = useState('')
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')

  const [folderModal, setFolderModal] = useState<{ folder: Folder | null } | null>(null)
  const [folderName, setFolderName] = useState('')
  const [folderColor, setFolderColor] = useState(FOLDER_COLORS[0])
  const [folderDeleteArmed, setFolderDeleteArmed] = useState(false)

  const [showActions, setShowActions] = useState(false)
  const [showShareModal, setShowShareModal] = useState(false)
  const [shareNoteId, setShareNoteId] = useState<number | null>(null)
  const [shareLabel, setShareLabel] = useState('')
  const [shareAll, setShareAll] = useState(false)
  const [shareExpires, setShareExpires] = useState('')

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingNoteId = useRef<number | null>(null)
  const isPhone = mode === 'phone'
  const isTablet = mode === 'tablet'

  /* Breite des Inhaltsbereichs messen (Seitenleiste der Shell nimmt Platz weg) */
  useEffect(() => {
    const el = rootRef.current
    if (!el) return
    const update = () => {
      const w = el.getBoundingClientRect().width
      setMode(w < 640 ? 'phone' : w < 980 ? 'tablet' : 'wide')
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [isLeonie])

  /* Notiz direkt öffnen, wenn aus der Übersicht verlinkt (?note=ID) */
  useEffect(() => {
    const id = Number(new URLSearchParams(window.location.search).get('note'))
    if (id) pendingNoteId.current = id
  }, [])

  /* Laden */
  const loadFolders = useCallback(async () => {
    const res = await fetch('/api/private/leonie/folders')
    if (res.ok) setFolders(await res.json())
  }, [])

  const loadNotes = useCallback(async (folderId: number | 'all' | 'none') => {
    let url = '/api/private/leonie/notes'
    if (folderId === 'none') url += '?folder_id=null'
    else if (folderId !== 'all') url += `?folder_id=${folderId}`
    const res = await fetch(url)
    if (res.ok) {
      const list: Note[] = await res.json()
      setNotes(list)
      if (pendingNoteId.current) {
        const n = list.find(x => x.id === pendingNoteId.current)
        pendingNoteId.current = null
        if (n) openNote(n)
      }
    }
  }, [])

  const loadShares = useCallback(async () => {
    const res = await fetch('/api/private/leonie/shares')
    if (res.ok) setShares(await res.json())
  }, [])

  useEffect(() => {
    if (isLeonie) { loadFolders(); loadShares() }
  }, [isLeonie, loadFolders, loadShares])

  useEffect(() => {
    if (!isLeonie) return
    loadNotes(selectedFolder)
    setSelectedNote(null)
    setEditMode(false)
  }, [selectedFolder, loadNotes, isLeonie])

  /* Notizen */
  function openNote(note: Note, edit = false) {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    setSelectedNote(note)
    setEditTitle(note.title)
    setEditContent(note.content)
    setEditMode(edit)
    setPane('note')
  }

  async function createNote() {
    const fid = typeof selectedFolder === 'number' ? selectedFolder : null
    const res = await fetch('/api/private/leonie/notes', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Neue Notiz', content: '', folder_id: fid }),
    })
    if (!res.ok) return
    const note: Note = await res.json()
    setNotes(prev => [note, ...prev])
    openNote(note, true)
  }

  async function saveNote(noteId: number, title: string, content: string) {
    setSaving(true)
    const res = await fetch(`/api/private/leonie/notes/${noteId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title, content }),
    })
    if (res.ok) {
      const updated: Note = await res.json()
      setSelectedNote(prev => (prev && prev.id === updated.id ? updated : prev))
      setNotes(prev => prev.map(n => (n.id === updated.id ? updated : n)))
    }
    setSaving(false)
  }

  function scheduleSave(title: string, content: string) {
    if (!selectedNote) return
    const id = selectedNote.id
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => saveNote(id, title, content), 1200)
  }

  function finishEditing() {
    if (!selectedNote) return
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveNote(selectedNote.id, editTitle, editContent)
    setEditMode(false)
  }

  async function deleteNote(note: Note) {
    if (!confirm(`Notiz "${note.title}" endgültig löschen?`)) return
    await fetch(`/api/private/leonie/notes/${note.id}`, { method: 'DELETE' })
    setSelectedNote(null)
    setEditMode(false)
    setShowActions(false)
    setNotes(prev => prev.filter(n => n.id !== note.id))
    setPane('list')
    toast('Notiz gelöscht')
  }

  async function moveNote(noteId: number, folderId: number | null) {
    const res = await fetch(`/api/private/leonie/notes/${noteId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ folder_id: folderId }),
    })
    if (!res.ok) return
    const updated: Note = await res.json()
    setSelectedNote(updated)
    if (selectedFolder !== 'all') loadNotes(selectedFolder)
    else setNotes(prev => prev.map(n => (n.id === updated.id ? updated : n)))
  }

  /* Ordner */
  function pickFolder(f: number | 'all' | 'none') {
    setSelectedFolder(f)
    setDrawerOpen(false)
    setPane('list')
  }

  function openFolderModal(folder: Folder | null) {
    setFolderName(folder?.name ?? '')
    setFolderColor(folder?.color && FOLDER_COLORS.includes(folder.color) ? folder.color : FOLDER_COLORS[folders.length % FOLDER_COLORS.length])
    setFolderDeleteArmed(false)
    setFolderModal({ folder })
  }

  /** Fehlermeldung vom Server lesen (statt still nichts zu tun) */
  async function errorText(res: Response) {
    const data = await res.json().catch(() => ({}))
    return data.error || `Fehler ${res.status}`
  }

  async function saveFolder() {
    if (!folderModal || !folderName.trim()) return
    const body = JSON.stringify({ name: folderName.trim(), color: folderColor })
    const res = folderModal.folder
      ? await fetch(`/api/private/leonie/folders/${folderModal.folder.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body })
      : await fetch('/api/private/leonie/folders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body })
    if (!res.ok) {
      toast(`Speichern fehlgeschlagen: ${await errorText(res)}`, { ms: 6000 })
      return
    }
    toast(folderModal.folder ? 'Ordner gespeichert' : 'Ordner erstellt')
    setFolderModal(null)
    loadFolders()
  }

  async function deleteFolder(folder: Folder) {
    // Zweistufig im Dialog statt Browser-Popup (confirm() wird von manchen Handys/Browsern blockiert)
    if (!folderDeleteArmed) { setFolderDeleteArmed(true); return }
    const res = await fetch(`/api/private/leonie/folders/${folder.id}`, { method: 'DELETE' })
    if (!res.ok) {
      toast(`Löschen fehlgeschlagen: ${await errorText(res)}`, { ms: 6000 })
      return
    }
    toast(`Ordner "${folder.name}" gelöscht – die Notizen bleiben erhalten`)
    if (selectedFolder === folder.id) setSelectedFolder('all')
    setFolderModal(null)
    loadFolders()
  }

  /* Zugriffe (Teilen per Link) */
  async function shareOrCopy(token: string, label?: string | null) {
    const url = `${window.location.origin}/private/leonie/view?token=${token}`
    if (navigator.share && window.matchMedia('(pointer: coarse)').matches) {
      try { await navigator.share({ title: label || 'Leonies Notizen', url }); return } catch { /* Fallback */ }
    }
    try {
      await navigator.clipboard.writeText(url)
      toast('Link kopiert')
    } catch {
      prompt('Link kopieren:', url)
    }
  }

  async function createShare() {
    const res = await fetch('/api/private/leonie/shares', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        note_id: shareAll ? null : shareNoteId, share_all: shareAll,
        label: shareLabel || null, expires_at: shareExpires || null,
      }),
    })
    if (!res.ok) return
    const share: Share = await res.json()
    await loadShares()
    setShowShareModal(false)
    setShareLabel(''); setShareExpires(''); setShareAll(false); setShareNoteId(null)
    shareOrCopy(share.token, share.label)
  }

  async function revokeShare(id: number) {
    if (!confirm('Zugriff widerrufen? Der Link funktioniert danach nicht mehr.')) return
    await fetch(`/api/private/leonie/shares?id=${id}`, { method: 'DELETE' })
    loadShares()
    toast('Zugriff widerrufen')
  }

  /* Abgeleitet */
  const q = search.trim().toLowerCase()
  const visibleNotes = q ? notes.filter(n => n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q)) : notes
  const folderLabel =
    selectedFolder === 'all' ? 'Alle Notizen'
      : selectedFolder === 'none' ? 'Ohne Ordner'
        : folders.find(f => f.id === selectedFolder)?.name ?? 'Notizen'

  /* ── Zustände ohne Zugriff ── */
  if (loading) return <div className="pv-center"><div className="pv-spinner" /></div>
  if (!isLeonie) {
    return (
      <div className="pv-center">
        <div className="pv-glass pv-card" style={{ padding: 32, maxWidth: 420 }}>
          <p className="pv-title" style={{ fontSize: 24, marginBottom: 8 }}>Leonies Notizen</p>
          <p className="pv-muted" style={{ margin: '0 0 18px', fontSize: 14 }}>Dieser Bereich gehört Leonie und ist nur mit ihrem Account sichtbar.</p>
          <Link href="/private" className="pv-btn"><Icon name="home" size={17} /> Zur Übersicht</Link>
        </div>
      </div>
    )
  }

  /* ── Bausteine ── */
  const folderList = (
    <>
      <p className="pv-eyebrow" style={{ padding: '0 10px 8px' }}>Ordner</p>
      <button className={`pv-folder-item ${selectedFolder === 'all' ? 'active' : ''}`} onClick={() => pickFolder('all')}>
        <Icon name="notes" size={17} /> <span className="pv-grow pv-ellipsis">Alle Notizen</span>
      </button>
      <button className={`pv-folder-item ${selectedFolder === 'none' ? 'active' : ''}`} onClick={() => pickFolder('none')}>
        <Icon name="file" size={17} /> <span className="pv-grow pv-ellipsis">Ohne Ordner</span>
      </button>
      {folders.map(f => (
        <div
          key={f.id}
          role="button"
          tabIndex={0}
          className={`pv-folder-item ${selectedFolder === f.id ? 'active' : ''}`}
          onClick={() => pickFolder(f.id)}
          onKeyDown={e => { if (e.key === 'Enter') pickFolder(f.id) }}
        >
          <span className="pv-folder-dot" style={{ background: f.color }} />
          <span className="pv-grow pv-ellipsis">{f.name}</span>
          <span className="pv-folder-actions">
            <button aria-label={`${f.name} bearbeiten`} onClick={e => { e.stopPropagation(); openFolderModal(f) }}>
              <Icon name="pencil" size={15} />
            </button>
          </span>
        </div>
      ))}
      <button className="pv-folder-item" style={{ color: 'var(--pv-ink-3)', marginTop: 6 }} onClick={() => openFolderModal(null)}>
        <Icon name="folderPlus" size={17} /> Neuer Ordner
      </button>
    </>
  )

  const noteList = (
    <>
      <div className="pv-notes-listhead">
        {isPhone && (
          <button className="pv-icon-btn" aria-label="Ordner" onClick={() => setPane('folders')}><Icon name="folder" size={18} /></button>
        )}
        {isTablet && (
          <button className="pv-icon-btn" aria-label="Ordner" onClick={() => setDrawerOpen(true)}><Icon name="folder" size={18} /></button>
        )}
        <div className="pv-grow" style={{ minWidth: 0 }}>
          <div className="pv-h2 pv-ellipsis" style={{ fontSize: 19 }}>{folderLabel}</div>
          <div className="pv-muted" style={{ fontSize: 12 }}>{visibleNotes.length} Notizen</div>
        </div>
        <button className="pv-btn primary sm" onClick={createNote}><Icon name="plus" size={16} /> Neu</button>
      </div>
      <div style={{ padding: '0 14px 10px' }}>
        <label className="pv-search">
          <Icon name="search" size={16} />
          <input className="pv-input" type="search" placeholder="Durchsuchen" value={search} onChange={e => setSearch(e.target.value)} />
        </label>
      </div>
      <div className="pv-notes-scroll">
        {visibleNotes.length === 0 && <div className="pv-empty">{search ? 'Nichts gefunden' : 'Noch keine Notizen hier'}</div>}
        {visibleNotes.map(note => (
          <button key={note.id} className={`pv-note-item ${selectedNote?.id === note.id && !isPhone ? 'active' : ''}`} onClick={() => openNote(note)}>
            <div className="pv-note-item-title pv-ellipsis">{note.title}</div>
            <div className="pv-note-item-meta">{isPhone ? formatDateShort(note.updated_at) : formatDate(note.updated_at)}</div>
            <div className="pv-note-item-prev pv-ellipsis">{note.content.slice(0, 100).replace(/\n/g, ' ') || 'Leer'}</div>
          </button>
        ))}
      </div>
    </>
  )

  const editor = !selectedNote ? (
    <div className="pv-center pv-muted">
      <Icon name="notes" size={40} stroke={1.3} />
      Notiz auswählen oder eine neue anlegen
    </div>
  ) : (
    <>
      <div className="pv-editor-bar">
        {isPhone && (
          <button className="pv-icon-btn" aria-label="Zurück" onClick={() => { if (editMode) finishEditing(); setPane('list') }}>
            <Icon name="back" size={18} />
          </button>
        )}
        {editMode ? (
          <input className="pv-editor-title" value={editTitle} onChange={e => { setEditTitle(e.target.value); scheduleSave(e.target.value, editContent) }} placeholder="Titel" />
        ) : (
          <span className="pv-editor-title pv-ellipsis">{selectedNote.title}</span>
        )}
        {saving && <span className="pv-muted" style={{ fontSize: 12 }}>Speichert …</span>}
        {editMode ? (
          <button className="pv-btn primary sm" onClick={finishEditing}><Icon name="check" size={16} /> Fertig</button>
        ) : (
          <button className="pv-btn sm" onClick={() => setEditMode(true)}><Icon name="pencil" size={15} /> Bearbeiten</button>
        )}
        {mode !== 'wide' ? (
          <button className="pv-icon-btn" aria-label="Weitere Aktionen" onClick={() => setShowActions(true)}><Icon name="more" size={18} /></button>
        ) : (
          <>
            <select
              className="pv-input"
              style={{ width: 'auto', maxWidth: 160, minHeight: 32, padding: '4px 8px', fontSize: 13 }}
              aria-label="Ordner"
              value={selectedNote.folder_id ?? ''}
              onChange={e => moveNote(selectedNote.id, e.target.value ? Number(e.target.value) : null)}
            >
              <option value="">Kein Ordner</option>
              {folders.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
            <button className="pv-btn sm" onClick={() => downloadTxt(selectedNote)}>TXT</button>
            <button className="pv-btn sm" onClick={() => downloadPdf(selectedNote, toast)}>PDF</button>
            <button className="pv-btn sm" onClick={() => { setShareNoteId(selectedNote.id); setShareAll(false); setShowShareModal(true) }}>
              <Icon name="link" size={15} /> Teilen
            </button>
            <button className="pv-icon-btn ghost" aria-label="Löschen" onClick={() => deleteNote(selectedNote)}>
              <Icon name="trash" size={17} style={{ color: 'var(--pv-danger)' }} />
            </button>
          </>
        )}
      </div>
      {editMode ? (
        <textarea
          className="pv-editor-text"
          value={editContent}
          onChange={e => { setEditContent(e.target.value); scheduleSave(editTitle, e.target.value) }}
          placeholder="Schreiben … Links als https://… oder [Text](https://…) einfügen – sie werden nach dem Speichern klickbar."
          autoFocus={!isPhone}
        />
      ) : (
        <div className="pv-editor-view" onDoubleClick={() => setEditMode(true)}>
          {selectedNote.content.trim()
            ? parseLinks(selectedNote.content)
            : <span className="pv-muted" style={{ fontStyle: 'italic' }}>Noch kein Inhalt. Auf Bearbeiten tippen.</span>}
        </div>
      )}
    </>
  )

  return (
    <div ref={rootRef} style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      {/* Umschalter Notizen / Zugriffe */}
      <div className="pv-row" style={{ padding: '14px 16px 10px', borderBottom: '1px solid var(--pv-glass-border)' }}>
        <div className="pv-grow pv-desktop-only">
          <span className="pv-title" style={{ fontSize: 24 }}>Notizen</span>
        </div>
        <div className="pv-seg">
          <button className={panel === 'notes' ? 'active' : ''} onClick={() => setPanel('notes')}><Icon name="notes" size={16} /> Notizen</button>
          <button className={panel === 'shares' ? 'active' : ''} onClick={() => { setPanel('shares'); loadShares() }}>
            <Icon name="link" size={16} /> Geteilte Links {shares.length > 0 && <span className="pv-badge">{shares.length}</span>}
          </button>
        </div>
      </div>

      {panel === 'notes' ? (
        <div className={`pv-notes ${mode}`}>
          {mode === 'wide' && <aside className="pv-notes-col pv-notes-folders">{folderList}</aside>}
          {isPhone ? (
            pane === 'folders' ? (
              <aside className="pv-notes-col pv-notes-folders">
                <button className="pv-btn sm" style={{ alignSelf: 'flex-start', marginBottom: 10 }} onClick={() => setPane('list')}>
                  <Icon name="back" size={15} /> Zurück
                </button>
                {folderList}
              </aside>
            ) : pane === 'note' && selectedNote ? (
              <div className="pv-notes-col pv-editor">{editor}</div>
            ) : (
              <div className="pv-notes-col pv-notes-list">{noteList}</div>
            )
          ) : (
            <>
              <div className="pv-notes-col pv-notes-list">{noteList}</div>
              <div className="pv-notes-col pv-editor">{editor}</div>
            </>
          )}
        </div>
      ) : (
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: 16 }}>
          <div className="pv-page" style={{ maxWidth: 900 }}>
            <div className="pv-page-head">
              <div>
                <div className="pv-h2">Geteilte Links</div>
                <p className="pv-subtitle" style={{ maxWidth: '60ch' }}>
                  Wer einen dieser Links hat, kann die freigegebenen Notizen ohne Account lesen (nicht bearbeiten). Widerrufen macht den Link sofort ungültig.
                </p>
              </div>
              <button className="pv-btn primary" onClick={() => { setShareAll(false); setShareNoteId(null); setShowShareModal(true) }}>
                <Icon name="plus" size={17} /> Link erstellen
              </button>
            </div>
            <div className="pv-glass" style={{ padding: '4px 18px' }}>
              {shares.length === 0 && <div className="pv-empty">Noch keine Links vergeben</div>}
              {shares.map(s => (
                <div key={s.id} className="pv-share-row">
                  <div className="pv-grow" style={{ minWidth: 160 }}>
                    <div style={{ fontWeight: 600, overflowWrap: 'anywhere' }}>
                      {s.label || (s.share_all ? 'Alle Notizen' : s.note_title || `Notiz #${s.note_id}`)}
                    </div>
                    <div className="pv-muted" style={{ fontSize: 12 }}>
                      Erstellt {formatDateShort(s.created_at)}{s.expires_at ? ` · läuft ab ${formatDateShort(s.expires_at)}` : ' · unbegrenzt'}
                    </div>
                  </div>
                  <span className={`pv-badge ${s.share_all ? 'ok' : ''}`}>{s.share_all ? 'Alle Notizen' : 'Eine Notiz'}</span>
                  <div className="pv-row">
                    <button className="pv-btn sm" onClick={() => shareOrCopy(s.token, s.label)}><Icon name="link" size={15} /> Link</button>
                    <button className="pv-btn sm danger" onClick={() => revokeShare(s.id)}>Widerrufen</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Ordner-Schublade (mittlere Breite) */}
      {drawerOpen && isTablet && (
        <Portal>
          <div className="pv-overlay" style={{ justifyContent: 'flex-start', padding: 0 }} onClick={e => { if (e.target === e.currentTarget) setDrawerOpen(false) }}>
            <aside className="pv-modal" style={{ height: '100%', maxHeight: 'none', width: 290, borderRadius: '0 24px 24px 0', gap: 2 }}>
              {folderList}
            </aside>
          </div>
        </Portal>
      )}

      {/* Aktionen (Handy / mittlere Breite) */}
      {showActions && selectedNote && (
        <Portal>
          <div className="pv-overlay sheet" onClick={e => { if (e.target === e.currentTarget) setShowActions(false) }}>
            <div className="pv-modal">
              <div className="pv-grip" />
              <div className="pv-ellipsis" style={{ fontWeight: 600 }}>{selectedNote.title}</div>
              <div>
                <label className="pv-label">Ordner</label>
                <select className="pv-input" value={selectedNote.folder_id ?? ''} onChange={e => moveNote(selectedNote.id, e.target.value ? Number(e.target.value) : null)}>
                  <option value="">Kein Ordner</option>
                  {folders.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                </select>
              </div>
              <div className="pv-sep" />
              <button className="pv-menu-item" onClick={() => { downloadTxt(selectedNote); setShowActions(false) }}><Icon name="download" /> Als TXT speichern</button>
              <button className="pv-menu-item" onClick={() => { setShowActions(false); setTimeout(() => downloadPdf(selectedNote, toast), 250) }}><Icon name="pdf" /> Als PDF speichern</button>
              <button className="pv-menu-item" onClick={() => { setShowActions(false); setShareNoteId(selectedNote.id); setShareAll(false); setShowShareModal(true) }}><Icon name="link" /> Link teilen</button>
              <div className="pv-sep" />
              <button className="pv-menu-item danger" onClick={() => deleteNote(selectedNote)}><Icon name="trash" /> Notiz löschen</button>
              <button className="pv-btn" onClick={() => setShowActions(false)}>Schließen</button>
            </div>
          </div>
        </Portal>
      )}

      {/* Ordner anlegen / bearbeiten */}
      {folderModal && (
        <Portal>
          <div className="pv-overlay sheet" onClick={e => { if (e.target === e.currentTarget) setFolderModal(null) }}>
            <div className="pv-modal">
              <div className="pv-grip" />
              <div className="pv-h2">{folderModal.folder ? 'Ordner bearbeiten' : 'Neuer Ordner'}</div>
              <input className="pv-input" placeholder="Ordnername" value={folderName} onChange={e => setFolderName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') saveFolder() }} autoFocus />
              <div>
                <label className="pv-label">Farbe</label>
                <div className="pv-row pv-wrap">
                  {FOLDER_COLORS.map(c => (
                    <button
                      key={c}
                      aria-label={`Farbe ${c}`}
                      onClick={() => setFolderColor(c)}
                      style={{
                        width: 30, height: 30, borderRadius: '50%', background: c, cursor: 'pointer',
                        border: folderColor === c ? '3px solid #fff' : '3px solid transparent',
                        boxShadow: folderColor === c ? `0 0 0 2px ${c}` : 'none',
                      }}
                    />
                  ))}
                </div>
              </div>
              <div className="pv-modal-actions">
                {folderModal.folder && (
                  <button
                    className="pv-btn danger"
                    style={{ marginRight: 'auto', ...(folderDeleteArmed ? { background: 'var(--pv-danger)', color: '#fff' } : {}) }}
                    onClick={() => deleteFolder(folderModal.folder!)}
                  >
                    <Icon name="trash" size={16} /> {folderDeleteArmed ? 'Wirklich löschen?' : 'Löschen'}
                  </button>
                )}
                <button className="pv-btn" onClick={() => setFolderModal(null)}>Abbrechen</button>
                <button className="pv-btn primary" onClick={saveFolder} disabled={!folderName.trim()}>Speichern</button>
              </div>
            </div>
          </div>
        </Portal>
      )}

      {/* Link erstellen */}
      {showShareModal && (
        <Portal>
          <div className="pv-overlay sheet" onClick={e => { if (e.target === e.currentTarget) setShowShareModal(false) }}>
            <div className="pv-modal">
              <div className="pv-grip" />
              <div className="pv-h2">Link erstellen</div>
              <div>
                <label className="pv-label">Wofür ist dieser Link? (optional)</label>
                <input className="pv-input" placeholder="z.B. Für Timon" value={shareLabel} onChange={e => setShareLabel(e.target.value)} />
              </div>
              <label className="pv-check-row">
                <input type="checkbox" checked={shareAll} onChange={e => setShareAll(e.target.checked)} />
                Zugriff auf alle Notizen geben
              </label>
              {!shareAll && (
                <div>
                  <label className="pv-label">Notiz</label>
                  <select className="pv-input" value={shareNoteId ?? ''} onChange={e => setShareNoteId(e.target.value ? Number(e.target.value) : null)}>
                    <option value="">Notiz wählen</option>
                    {notes.map(n => <option key={n.id} value={n.id}>{n.title}</option>)}
                  </select>
                </div>
              )}
              <div>
                <label className="pv-label">Läuft ab am (optional)</label>
                <input className="pv-input" type="datetime-local" value={shareExpires} onChange={e => setShareExpires(e.target.value)} />
              </div>
              <div className="pv-modal-actions">
                <button className="pv-btn" onClick={() => setShowShareModal(false)}>Abbrechen</button>
                <button className="pv-btn primary" onClick={createShare} disabled={!shareAll && !shareNoteId}>Link erstellen</button>
              </div>
            </div>
          </div>
        </Portal>
      )}
    </div>
  )
}