'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useAuth } from '@/app/lib/auth-context'
import { useRouter } from 'next/navigation'

/* ─── Types ─── */
interface Folder {
  id: number
  name: string
  color: string
  sort_order: number
}

interface Note {
  id: number
  folder_id: number | null
  title: string
  content: string
  created_at: string
  updated_at: string
}

interface Share {
  id: number
  token: string
  note_id: number | null
  share_all: boolean
  label: string | null
  created_at: string
  expires_at: string | null
  note_title?: string | null
}

type Panel = 'notes' | 'shares'
type Mode = 'wide' | 'tablet' | 'phone'
type Pane = 'folders' | 'list' | 'note'

/* ─── Helpers ─── */
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
      parts.push(
        <a key={key++} href={url} target="_blank" rel="noopener noreferrer" className="leonie-link">
          {label}
        </a>
      )
      i++
    } else if (seg) {
      const sub = seg.split(urlRegex)
      for (let j = 0; j < sub.length; j++) {
        if (j % 2 === 1) {
          parts.push(
            <a key={key++} href={sub[j]} target="_blank" rel="noopener noreferrer" className="leonie-link">
              {sub[j]}
            </a>
          )
        } else if (sub[j]) {
          parts.push(<span key={key++}>{sub[j]}</span>)
        }
      }
    }
  }
  return parts
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('de-DE', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
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

function buildPrintHtml(note: Note) {
  return `<!DOCTYPE html><html lang="de"><head><meta charset="utf-8">
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
<div class="meta">Erstellt ${formatDate(note.created_at)} · Geändert ${formatDate(note.updated_at)}</div>
<hr>
<pre>${escapeHtml(note.content)}</pre>
</body></html>`
}

/**
 * PDF-Export. Auf dem Desktop über ein neues Fenster.
 * Auf iOS/Android blockieren Browser window.open oft oder drucken leer —
 * dort wird stattdessen ein unsichtbarer iframe im selben Dokument gedruckt.
 */
function downloadPdf(note: Note) {
  const html = buildPrintHtml(note)
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
    alert('Popup wurde blockiert. Bitte Popups für seekclan.de erlauben.')
    return
  }
  win.document.write(html)
  win.document.close()
  win.focus()
  setTimeout(() => win.print(), 250)
}

/* ─── Component ─── */
export default function LeoniePrivatePage() {
  const { user, loading } = useAuth()
  const router = useRouter()

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

  const [newFolderName, setNewFolderName] = useState('')
  const [showNewFolder, setShowNewFolder] = useState(false)
  const [renamingFolder, setRenamingFolder] = useState<Folder | null>(null)
  const [renameValue, setRenameValue] = useState('')

  const [showActions, setShowActions] = useState(false)
  const [showShareModal, setShowShareModal] = useState(false)
  const [shareNoteId, setShareNoteId] = useState<number | null>(null)
  const [shareLabel, setShareLabel] = useState('')
  const [shareAll, setShareAll] = useState(false)
  const [shareExpires, setShareExpires] = useState('')
  const [copiedToken, setCopiedToken] = useState<string | null>(null)

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const isPhone = mode === 'phone'
  const isTablet = mode === 'tablet'

  /* ─── Breakpoint-Erkennung ─── */
  useEffect(() => {
    const phoneQ = window.matchMedia('(max-width: 767px)')
    const tabletQ = window.matchMedia('(min-width: 768px) and (max-width: 1023px)')
    const update = () => setMode(phoneQ.matches ? 'phone' : tabletQ.matches ? 'tablet' : 'wide')
    update()
    phoneQ.addEventListener('change', update)
    tabletQ.addEventListener('change', update)
    return () => {
      phoneQ.removeEventListener('change', update)
      tabletQ.removeEventListener('change', update)
    }
  }, [])

  /* ─── Zugriffsschutz ─── */
  useEffect(() => {
    if (!loading && (!user || user.username !== 'uwuleonie')) {
      router.replace('/')
    }
  }, [user, loading, router])

  /* ─── Laden ─── */
  const loadFolders = useCallback(async () => {
    const res = await fetch('/api/private/leonie/folders')
    if (res.ok) setFolders(await res.json())
  }, [])

  const loadNotes = useCallback(async (folderId: number | 'all' | 'none') => {
    let url = '/api/private/leonie/notes'
    if (folderId === 'none') url += '?folder_id=null'
    else if (folderId !== 'all') url += `?folder_id=${folderId}`
    const res = await fetch(url)
    if (res.ok) setNotes(await res.json())
  }, [])

  const loadShares = useCallback(async () => {
    const res = await fetch('/api/private/leonie/shares')
    if (res.ok) setShares(await res.json())
  }, [])

  useEffect(() => {
    if (user?.username === 'uwuleonie') {
      loadFolders()
      loadShares()
    }
  }, [user, loadFolders, loadShares])

  useEffect(() => {
    if (user?.username !== 'uwuleonie') return
    loadNotes(selectedFolder)
    setSelectedNote(null)
    setEditMode(false)
  }, [selectedFolder, loadNotes, user])

  /* ─── Body-Scroll sperren, solange ein Overlay offen ist ─── */
  useEffect(() => {
    const open = showActions || showShareModal || drawerOpen
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [showActions, showShareModal, drawerOpen])

  /* ─── Notizen ─── */
  function openNote(note: Note, edit = false) {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    setSelectedNote(note)
    setEditTitle(note.title)
    setEditContent(note.content)
    setEditMode(edit)
    if (isPhone) setPane('note')
  }

  async function createNote() {
    const fid = typeof selectedFolder === 'number' ? selectedFolder : null
    const res = await fetch('/api/private/leonie/notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, content }),
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

  function handleTitleChange(val: string) {
    setEditTitle(val)
    scheduleSave(val, editContent)
  }

  function handleContentChange(val: string) {
    setEditContent(val)
    scheduleSave(editTitle, val)
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
    if (isPhone) setPane('list')
  }

  async function moveNote(noteId: number, folderId: number | null) {
    const res = await fetch(`/api/private/leonie/notes/${noteId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ folder_id: folderId }),
    })
    if (!res.ok) return
    const updated: Note = await res.json()
    setSelectedNote(updated)
    if (selectedFolder !== 'all') loadNotes(selectedFolder)
    else setNotes(prev => prev.map(n => (n.id === updated.id ? updated : n)))
  }

  /* ─── Ordner ─── */
  function pickFolder(f: number | 'all' | 'none') {
    setSelectedFolder(f)
    setDrawerOpen(false)
    if (isPhone) setPane('list')
  }

  async function createFolder() {
    if (!newFolderName.trim()) return
    const res = await fetch('/api/private/leonie/folders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newFolderName.trim() }),
    })
    if (res.ok) {
      setNewFolderName('')
      setShowNewFolder(false)
      loadFolders()
    }
  }

  async function renameFolder() {
    if (!renamingFolder || !renameValue.trim()) { setRenamingFolder(null); return }
    await fetch(`/api/private/leonie/folders/${renamingFolder.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: renameValue.trim() }),
    })
    setRenamingFolder(null)
    setRenameValue('')
    loadFolders()
  }

  async function deleteFolder(folder: Folder) {
    if (!confirm(`Ordner "${folder.name}" löschen? Die Notizen darin bleiben erhalten.`)) return
    await fetch(`/api/private/leonie/folders/${folder.id}`, { method: 'DELETE' })
    if (selectedFolder === folder.id) setSelectedFolder('all')
    loadFolders()
  }

  /* ─── Zugriffe ─── */
  /**
   * Auf dem Handy das native Teilen-Menü öffnen (WhatsApp, Signal, Mail …),
   * sonst in die Zwischenablage kopieren.
   */
  async function shareOrCopy(token: string, label?: string | null) {
    const url = `${window.location.origin}/private/leonie/view?token=${token}`

    if (typeof navigator !== 'undefined' && navigator.share && window.matchMedia('(pointer: coarse)').matches) {
      try {
        await navigator.share({ title: label || 'Leonies Notizen', url })
        return
      } catch {
        // Abgebrochen oder nicht verfügbar → Fallback unten
      }
    }

    try {
      await navigator.clipboard.writeText(url)
      setCopiedToken(token)
      setTimeout(() => setCopiedToken(null), 2500)
    } catch {
      prompt('Link kopieren:', url)
    }
  }

  async function createShare() {
    const res = await fetch('/api/private/leonie/shares', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        note_id: shareAll ? null : shareNoteId,
        share_all: shareAll,
        label: shareLabel || null,
        expires_at: shareExpires || null,
      }),
    })
    if (!res.ok) return
    const share: Share = await res.json()
    await loadShares()
    setShowShareModal(false)
    setShareLabel('')
    setShareExpires('')
    setShareAll(false)
    setShareNoteId(null)
    shareOrCopy(share.token, share.label)
  }

  async function revokeShare(id: number) {
    if (!confirm('Zugriff widerrufen? Der Link funktioniert danach nicht mehr.')) return
    await fetch(`/api/private/leonie/shares?id=${id}`, { method: 'DELETE' })
    loadShares()
  }

  /* ─── Abgeleitete Werte ─── */
  const visibleNotes = search.trim()
    ? notes.filter(n =>
        n.title.toLowerCase().includes(search.toLowerCase()) ||
        n.content.toLowerCase().includes(search.toLowerCase())
      )
    : notes

  const folderLabel =
    selectedFolder === 'all' ? 'Alle Notizen'
    : selectedFolder === 'none' ? 'Ohne Ordner'
    : folders.find(f => f.id === selectedFolder)?.name ?? 'Notizen'

  /* ─── Ladezustand ─── */
  if (loading || !user || user.username !== 'uwuleonie') {
    return (
      <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg,#f6f0e7,#ece2d4)' }}>
        <div className="leonie-spinner" />
        <style>{`.leonie-spinner{width:28px;height:28px;border:3px solid rgba(180,140,90,.25);border-top-color:rgba(140,100,50,.7);border-radius:50%;animation:ls .8s linear infinite}@keyframes ls{to{transform:rotate(360deg)}}`}</style>
      </div>
    )
  }

  /* ─── Teil-Renderer ─── */
  const folderList = (
    <>
      <div className="leonie-sidebar-label">Ordner</div>

      <button
        className={`leonie-folder-item ${selectedFolder === 'all' ? 'active' : ''}`}
        onClick={() => pickFolder('all')}
      >
        <span className="leonie-folder-dot" style={{ background: '#c9b99a' }} />
        <span className="leonie-folder-name">Alle Notizen</span>
      </button>

      <button
        className={`leonie-folder-item ${selectedFolder === 'none' ? 'active' : ''}`}
        onClick={() => pickFolder('none')}
      >
        <span className="leonie-folder-dot" style={{ background: '#ddd0b8' }} />
        <span className="leonie-folder-name">Ohne Ordner</span>
      </button>

      {folders.map(f => (
        renamingFolder?.id === f.id ? (
          <input
            key={f.id}
            className="leonie-input"
            style={{ margin: '.2rem 0' }}
            value={renameValue}
            onChange={e => setRenameValue(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') renameFolder()
              if (e.key === 'Escape') setRenamingFolder(null)
            }}
            onBlur={renameFolder}
            autoFocus
          />
        ) : (
          <div
            key={f.id}
            className={`leonie-folder-item ${selectedFolder === f.id ? 'active' : ''}`}
            onClick={() => pickFolder(f.id)}
          >
            <span className="leonie-folder-dot" style={{ background: f.color }} />
            <span className="leonie-folder-name">{f.name}</span>
            <button
              className="leonie-folder-action"
              aria-label={`${f.name} umbenennen`}
              onClick={e => { e.stopPropagation(); setRenamingFolder(f); setRenameValue(f.name) }}
            >✎</button>
            <button
              className="leonie-folder-action"
              aria-label={`${f.name} löschen`}
              onClick={e => { e.stopPropagation(); deleteFolder(f) }}
            >✕</button>
          </div>
        )
      ))}

      {showNewFolder ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '.45rem', marginTop: '.6rem' }}>
          <input
            className="leonie-input"
            placeholder="Ordnername"
            value={newFolderName}
            onChange={e => setNewFolderName(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') createFolder()
              if (e.key === 'Escape') { setShowNewFolder(false); setNewFolderName('') }
            }}
            autoFocus
          />
          <div style={{ display: 'flex', gap: '.45rem' }}>
            <button className="leonie-btn primary" style={{ flex: 1 }} onClick={createFolder}>Erstellen</button>
            <button className="leonie-btn" onClick={() => { setShowNewFolder(false); setNewFolderName('') }}>Abbrechen</button>
          </div>
        </div>
      ) : (
        <button className="leonie-add-folder-btn" onClick={() => setShowNewFolder(true)}>+ Neuer Ordner</button>
      )}
    </>
  )

  const noteList = (
    <>
      <div className="leonie-notelist-header">
        {isPhone && (
          <button className="leonie-icon-btn" aria-label="Ordner öffnen" onClick={() => setPane('folders')}>☰</button>
        )}
        {isTablet && (
          <button className="leonie-icon-btn" aria-label="Ordner öffnen" onClick={() => setDrawerOpen(true)}>☰</button>
        )}
        <span className="leonie-notelist-title">{folderLabel} ({visibleNotes.length})</span>
        <button className="leonie-btn primary" onClick={createNote}>+ Neu</button>
      </div>

      <input
        className="leonie-search"
        type="search"
        placeholder="Durchsuchen…"
        value={search}
        onChange={e => setSearch(e.target.value)}
      />

      <div className="leonie-notelist-scroll">
        {visibleNotes.length === 0 && (
          <div className="leonie-empty-list">{search ? 'Nichts gefunden' : 'Noch keine Notizen hier'}</div>
        )}
        {visibleNotes.map(note => (
          <div
            key={note.id}
            className={`leonie-note-item ${selectedNote?.id === note.id && !isPhone ? 'active' : ''}`}
            onClick={() => openNote(note)}
          >
            <div className="leonie-note-item-title">{note.title}</div>
            <div className="leonie-note-item-meta">
              {isPhone ? formatDateShort(note.updated_at) : formatDate(note.updated_at)}
            </div>
            <div className="leonie-note-item-preview">
              {note.content.slice(0, 90).replace(/\n/g, ' ') || '—'}
            </div>
          </div>
        ))}
      </div>
    </>
  )

  const editor = !selectedNote ? (
    <div className="leonie-editor-empty">Notiz auswählen oder eine neue anlegen</div>
  ) : (
    <>
      <div className="leonie-editor-topbar">
        {isPhone && (
          <button
            className="leonie-icon-btn"
            aria-label="Zurück zur Liste"
            onClick={() => { if (editMode) finishEditing(); setPane('list') }}
          >‹</button>
        )}

        {editMode ? (
          <input
            className="leonie-editor-title-input"
            value={editTitle}
            onChange={e => handleTitleChange(e.target.value)}
            placeholder="Titel"
          />
        ) : (
          <span className="leonie-editor-title-static">{selectedNote.title}</span>
        )}

        {saving && <span className="leonie-saving">Speichert…</span>}

        {editMode ? (
          <button className="leonie-btn primary" onClick={finishEditing}>✓ Fertig</button>
        ) : (
          <button className="leonie-btn" onClick={() => setEditMode(true)}>Bearbeiten</button>
        )}

        {isPhone || isTablet ? (
          <button className="leonie-icon-btn" aria-label="Weitere Aktionen" onClick={() => setShowActions(true)}>⋯</button>
        ) : (
          <>
            <select
              className="leonie-move-select"
              aria-label="Ordner"
              value={selectedNote.folder_id ?? ''}
              onChange={e => moveNote(selectedNote.id, e.target.value ? Number(e.target.value) : null)}
            >
              <option value="">Kein Ordner</option>
              {folders.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
            <button className="leonie-btn" onClick={() => downloadTxt(selectedNote)}>TXT</button>
            <button className="leonie-btn" onClick={() => downloadPdf(selectedNote)}>PDF</button>
            <button
              className="leonie-btn"
              onClick={() => { setShareNoteId(selectedNote.id); setShareAll(false); setShowShareModal(true) }}
            >Teilen</button>
            <button className="leonie-btn danger" onClick={() => deleteNote(selectedNote)}>Löschen</button>
          </>
        )}
      </div>

      {editMode ? (
        <textarea
          className="leonie-editor-textarea"
          value={editContent}
          onChange={e => handleContentChange(e.target.value)}
          placeholder="Schreiben… Links als https://… oder [Text](https://…) einfügen — sie werden nach dem Speichern klickbar."
          autoFocus={!isPhone}
        />
      ) : (
        <div className="leonie-viewer">
          {selectedNote.content.trim()
            ? parseLinks(selectedNote.content)
            : <span style={{ color: '#c0a880', fontStyle: 'italic' }}>Noch kein Inhalt. Auf Bearbeiten tippen.</span>}
        </div>
      )}
    </>
  )

  return (
    <>
      <style>{`
        .leonie-root{
          height:100dvh;display:flex;flex-direction:column;overflow:hidden;
          background:linear-gradient(135deg,#f6f0e7 0%,#ece2d4 45%,#e5d8c4 100%);
          background-attachment:fixed;
          font-family:Georgia,'Times New Roman',serif;
          color:#3d2810;
          -webkit-text-size-adjust:100%;
        }
        .leonie-root *{box-sizing:border-box}
        .leonie-root button{-webkit-tap-highlight-color:transparent}

        /* ── Topbar ── */
        .leonie-topbar{
          flex-shrink:0;z-index:40;
          background:rgba(246,240,231,.78);
          backdrop-filter:blur(18px) saturate(1.2);-webkit-backdrop-filter:blur(18px) saturate(1.2);
          border-bottom:1px solid rgba(180,155,120,.28);
          padding:.7rem 1rem;
          padding-top:calc(.7rem + env(safe-area-inset-top));
          display:flex;align-items:center;gap:.5rem;
        }
        .leonie-logo{font-size:1rem;font-weight:600;color:#5a3e28;flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .leonie-tab{
          background:none;border:none;padding:.5rem 1rem;border-radius:999px;
          font-family:inherit;font-size:.88rem;color:#95795f;cursor:pointer;
          transition:all .15s;min-height:40px;
        }
        .leonie-tab.active{background:rgba(180,140,90,.2);color:#4a3018}
        .leonie-tab:hover:not(.active){color:#5a3e28;background:rgba(180,140,90,.08)}

        /* ── Layout ── */
        .leonie-layout{display:grid;grid-template-columns:220px 300px 1fr;flex:1;min-height:0}
        .leonie-layout.tablet{grid-template-columns:300px 1fr}
        .leonie-layout.phone{grid-template-columns:1fr}
        .leonie-col{min-width:0;min-height:0;display:flex;flex-direction:column;overflow:hidden}

        /* ── Ordner ── */
        .leonie-sidebar{
          background:rgba(246,240,231,.5);
          backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);
          border-right:1px solid rgba(180,155,120,.22);
          padding:1.2rem .85rem;overflow-y:auto;gap:.2rem;
          -webkit-overflow-scrolling:touch;
        }
        .leonie-layout.phone .leonie-sidebar{border-right:none}
        .leonie-sidebar-label{font-size:.7rem;letter-spacing:.09em;color:#b09572;padding:0 .5rem;margin-bottom:.5rem}
        .leonie-folder-item{
          display:flex;align-items:center;gap:.6rem;
          padding:.6rem .65rem;min-height:44px;flex-shrink:0;
          border-radius:10px;cursor:pointer;font-size:.9rem;color:#6b5040;
          border:none;background:none;width:100%;text-align:left;font-family:inherit;
          transition:background .12s;
        }
        .leonie-folder-item:hover{background:rgba(180,140,90,.12)}
        .leonie-folder-item.active{background:rgba(180,140,90,.24);color:#3d2810;font-weight:600}
        .leonie-folder-dot{width:9px;height:9px;border-radius:50%;flex-shrink:0}
        .leonie-folder-name{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        .leonie-folder-action{
          background:none;border:none;color:#a08868;cursor:pointer;
          font-size:.85rem;font-family:inherit;
          width:32px;height:32px;border-radius:8px;flex-shrink:0;
          transition:color .12s,background .12s;
        }
        .leonie-folder-action:hover{color:#b05040;background:rgba(180,140,90,.14)}
        .leonie-add-folder-btn{
          margin-top:.7rem;background:none;flex-shrink:0;
          border:1px dashed rgba(180,140,90,.45);border-radius:10px;
          padding:.6rem .65rem;min-height:44px;
          font-size:.85rem;color:#ae9370;cursor:pointer;font-family:inherit;text-align:left;
          transition:all .12s;
        }
        .leonie-add-folder-btn:hover{background:rgba(180,140,90,.1);color:#5a3e28;border-color:rgba(140,100,50,.5)}

        /* ── Ordner-Drawer (Tablet) ── */
        .leonie-drawer-backdrop{position:fixed;inset:0;background:rgba(40,25,10,.3);backdrop-filter:blur(4px);z-index:60;animation:lfade .18s ease}
        .leonie-drawer{
          position:fixed;top:0;left:0;bottom:0;width:280px;max-width:82vw;z-index:61;
          background:rgba(248,242,233,.95);
          backdrop-filter:blur(22px);-webkit-backdrop-filter:blur(22px);
          border-right:1px solid rgba(180,155,120,.35);
          padding:1.2rem .85rem;padding-top:calc(1.2rem + env(safe-area-inset-top));
          overflow-y:auto;display:flex;flex-direction:column;gap:.2rem;
          box-shadow:4px 0 32px rgba(70,45,20,.16);
          animation:lslide .22s cubic-bezier(.2,.8,.3,1);
        }
        @keyframes lslide{from{transform:translateX(-100%)}to{transform:none}}
        @keyframes lfade{from{opacity:0}to{opacity:1}}

        /* ── Notizliste ── */
        .leonie-notelist{
          background:rgba(240,232,218,.42);
          backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);
          border-right:1px solid rgba(180,155,120,.2);
        }
        .leonie-layout.phone .leonie-notelist{border-right:none}
        .leonie-notelist-header{padding:.9rem 1rem .6rem;display:flex;align-items:center;gap:.5rem;flex-shrink:0}
        .leonie-notelist-title{
          font-size:.85rem;letter-spacing:.04em;color:#8a6c4c;flex:1;font-weight:600;
          overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
        }
        .leonie-search{
          margin:0 1rem .6rem;flex-shrink:0;
          background:rgba(255,252,246,.65);border:1px solid rgba(180,155,120,.28);
          border-radius:10px;padding:.6rem .8rem;min-height:44px;
          font-size:16px;color:#3d2810;font-family:inherit;outline:none;
          -webkit-appearance:none;
        }
        .leonie-search:focus{border-color:rgba(140,100,50,.5);background:rgba(255,252,246,.92)}
        .leonie-search::placeholder{color:#c0a880}
        .leonie-notelist-scroll{flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;padding-bottom:env(safe-area-inset-bottom)}
        .leonie-note-item{
          padding:.85rem 1rem;border-top:1px solid rgba(180,155,120,.14);
          cursor:pointer;transition:background .1s;
        }
        .leonie-note-item:active{background:rgba(180,140,90,.16)}
        .leonie-note-item:hover{background:rgba(180,140,90,.09)}
        .leonie-note-item.active{background:rgba(180,140,90,.2)}
        .leonie-note-item-title{font-size:.95rem;color:#3d2810;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-bottom:.15rem}
        .leonie-note-item-meta{font-size:.75rem;color:#b09878}
        .leonie-note-item-preview{font-size:.8rem;color:#9a8060;margin-top:.15rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}

        /* ── Editor ── */
        .leonie-editor{background:rgba(251,246,239,.38);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px)}
        .leonie-editor-empty{flex:1;display:flex;align-items:center;justify-content:center;color:#c0a880;font-size:.95rem;font-style:italic;padding:2rem;text-align:center}
        .leonie-editor-topbar{
          padding:.7rem 1rem;display:flex;align-items:center;gap:.5rem;
          border-bottom:1px solid rgba(180,155,120,.2);flex-wrap:wrap;flex-shrink:0;
        }
        .leonie-editor-title-input,.leonie-editor-title-static{
          flex:1;min-width:110px;font-family:inherit;font-size:1.15rem;font-weight:600;
          color:#2a1a08;background:transparent;border:none;outline:none;
          overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding:.2rem 0;
        }
        .leonie-editor-title-input::placeholder{color:#c0a880}
        .leonie-editor-textarea{
          flex:1;width:100%;background:transparent;border:none;outline:none;resize:none;
          font-family:inherit;font-size:16px;color:#2a1a08;line-height:1.75;
          padding:1.2rem 1.1rem;padding-bottom:calc(1.2rem + env(safe-area-inset-bottom));
          overflow-y:auto;-webkit-overflow-scrolling:touch;
        }
        .leonie-editor-textarea::placeholder{color:#c6ae8a}
        .leonie-viewer{
          flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;
          padding:1.2rem 1.1rem;padding-bottom:calc(1.6rem + env(safe-area-inset-bottom));
          font-size:1rem;color:#2a1a08;line-height:1.78;
          white-space:pre-wrap;overflow-wrap:anywhere;max-width:78ch;
        }
        .leonie-link{color:#8b5e30;text-decoration:underline;text-underline-offset:2px;overflow-wrap:anywhere}
        .leonie-link:hover{color:#5a3010}

        /* ── Buttons ── */
        .leonie-btn{
          background:rgba(140,100,50,.1);border:1px solid rgba(140,100,50,.22);
          border-radius:10px;padding:.5rem .85rem;min-height:40px;
          font-size:.85rem;color:#5a3e28;cursor:pointer;font-family:inherit;
          transition:background .12s;white-space:nowrap;
        }
        .leonie-btn:hover{background:rgba(140,100,50,.22)}
        .leonie-btn:disabled{opacity:.4;cursor:not-allowed}
        .leonie-btn.danger{color:#a8483a;border-color:rgba(168,72,58,.25)}
        .leonie-btn.danger:hover{background:rgba(168,72,58,.12)}
        .leonie-btn.primary{background:rgba(100,70,30,.16);border-color:rgba(100,70,30,.32);font-weight:600}
        .leonie-btn.primary:hover{background:rgba(100,70,30,.26)}
        .leonie-icon-btn{
          background:rgba(140,100,50,.08);border:1px solid rgba(140,100,50,.18);
          border-radius:10px;width:40px;height:40px;flex-shrink:0;
          font-size:1.15rem;line-height:1;color:#5a3e28;cursor:pointer;font-family:inherit;
          display:flex;align-items:center;justify-content:center;transition:background .12s;
        }
        .leonie-icon-btn:hover{background:rgba(140,100,50,.2)}
        .leonie-saving{font-size:.75rem;color:#b09878;font-style:italic}
        .leonie-move-select{
          background:rgba(255,252,246,.7);border:1px solid rgba(140,100,50,.25);
          border-radius:10px;padding:.45rem .55rem;min-height:40px;max-width:150px;
          font-size:.85rem;color:#5a3e28;font-family:inherit;cursor:pointer;outline:none;
        }

        /* ── Zugriffe ── */
        .leonie-shares-panel{
          padding:1.25rem 1rem;
          padding-bottom:calc(2rem + env(safe-area-inset-bottom));
          display:flex;flex-direction:column;gap:1rem;max-width:1000px;
          flex:1;min-height:0;overflow-y:auto;-webkit-overflow-scrolling:touch;
        }
        .leonie-shares-header{display:flex;align-items:center;gap:.8rem;flex-wrap:wrap}
        .leonie-shares-title{font-size:1.15rem;color:#3d2810;font-weight:600;flex:1;min-width:150px}
        .leonie-shares-hint{font-size:.85rem;color:#95795f;line-height:1.6;max-width:62ch;margin:0}
        .leonie-glass-card{
          background:rgba(246,240,231,.55);
          backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);
          border:1px solid rgba(180,155,120,.3);border-radius:15px;padding:.2rem 1.1rem;
        }
        .leonie-share-row{display:flex;align-items:center;gap:.7rem;padding:.9rem 0;border-top:1px solid rgba(180,155,120,.16);flex-wrap:wrap}
        .leonie-share-row:first-child{border-top:none}
        .leonie-share-info{flex:1;min-width:160px}
        .leonie-share-label{font-size:.92rem;color:#3d2810;font-weight:600;overflow-wrap:anywhere}
        .leonie-share-meta{font-size:.77rem;color:#b09878;margin-top:.15rem}
        .leonie-share-badge{font-size:.73rem;padding:.2rem .6rem;border-radius:999px;background:rgba(140,100,50,.16);color:#6b5040;white-space:nowrap}
        .leonie-share-badge.all{background:rgba(90,130,80,.18);color:#3c6534}
        .leonie-share-actions{display:flex;gap:.5rem;flex-wrap:wrap}

        /* ── Overlays ── */
        .leonie-overlay{
          position:fixed;inset:0;background:rgba(40,25,10,.34);
          backdrop-filter:blur(5px);-webkit-backdrop-filter:blur(5px);
          z-index:100;display:flex;align-items:center;justify-content:center;padding:1rem;
          animation:lfade .18s ease;
        }
        .leonie-modal{
          background:rgba(250,245,236,.95);
          backdrop-filter:blur(22px);-webkit-backdrop-filter:blur(22px);
          border:1px solid rgba(180,155,120,.38);border-radius:17px;
          padding:1.7rem;width:430px;max-width:100%;max-height:88dvh;overflow-y:auto;
          display:flex;flex-direction:column;gap:.9rem;
          box-shadow:0 18px 50px rgba(70,45,20,.2);
        }
        .leonie-modal-title{font-size:1.1rem;font-weight:600;color:#3d2810}
        .leonie-input{
          background:rgba(255,252,246,.85);border:1px solid rgba(180,155,120,.32);
          border-radius:10px;padding:.65rem .8rem;min-height:44px;
          font-size:16px;color:#2a1a08;font-family:inherit;width:100%;outline:none;
          -webkit-appearance:none;
        }
        .leonie-input:focus{border-color:rgba(140,100,50,.55)}
        select.leonie-input{-webkit-appearance:menulist}
        .leonie-label{font-size:.8rem;color:#8a7060;margin-bottom:.3rem}
        .leonie-checkbox-row{display:flex;align-items:center;gap:.6rem;font-size:.9rem;color:#5a3e28;cursor:pointer;min-height:44px}
        .leonie-checkbox-row input{width:20px;height:20px;accent-color:#8b5e30}
        .leonie-modal-actions{display:flex;gap:.6rem;justify-content:flex-end;margin-top:.3rem;flex-wrap:wrap}
        .leonie-modal-actions .leonie-btn{flex:1;min-width:120px}

        /* Aktions-Sheet (Handy/Tablet) */
        .leonie-sheet-wrap{
          position:fixed;inset:0;z-index:100;display:flex;align-items:flex-end;justify-content:center;
          background:rgba(40,25,10,.34);backdrop-filter:blur(5px);-webkit-backdrop-filter:blur(5px);
          animation:lfade .18s ease;
        }
        .leonie-sheet{
          width:100%;max-width:520px;
          background:rgba(250,245,236,.96);
          backdrop-filter:blur(22px);-webkit-backdrop-filter:blur(22px);
          border:1px solid rgba(180,155,120,.38);border-bottom:none;
          border-radius:20px 20px 0 0;
          padding:1rem 1.1rem;padding-bottom:calc(1.1rem + env(safe-area-inset-bottom));
          display:flex;flex-direction:column;gap:.3rem;
          box-shadow:0 -10px 40px rgba(70,45,20,.2);
          animation:lup .24s cubic-bezier(.2,.8,.3,1);
          max-height:85dvh;overflow-y:auto;
        }
        @keyframes lup{from{transform:translateY(100%)}to{transform:none}}
        .leonie-sheet-grip{width:38px;height:4px;border-radius:2px;background:rgba(160,135,105,.45);margin:0 auto .7rem;flex-shrink:0}
        .leonie-sheet-title{font-size:.95rem;font-weight:600;color:#3d2810;padding:0 .3rem .5rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        .leonie-sheet-item{
          display:flex;align-items:center;gap:.8rem;
          background:none;border:none;width:100%;text-align:left;
          padding:.85rem .6rem;min-height:50px;border-radius:11px;
          font-family:inherit;font-size:.95rem;color:#4a3018;cursor:pointer;
          transition:background .12s;
        }
        .leonie-sheet-item:hover,.leonie-sheet-item:active{background:rgba(180,140,90,.14)}
        .leonie-sheet-item.danger{color:#a8483a}
        .leonie-sheet-icon{width:22px;text-align:center;font-size:1rem;opacity:.75;flex-shrink:0}
        .leonie-sheet-sep{height:1px;background:rgba(180,155,120,.22);margin:.4rem .3rem;flex-shrink:0}
        .leonie-sheet-field{padding:.3rem .6rem .6rem}

        .leonie-empty-list{padding:2.2rem 1.2rem;text-align:center;color:#c0a880;font-size:.88rem;font-style:italic}
        .leonie-spinner{width:28px;height:28px;border:3px solid rgba(180,140,90,.25);border-top-color:rgba(140,100,50,.7);border-radius:50%;animation:ls .8s linear infinite}
        @keyframes ls{to{transform:rotate(360deg)}}
        .leonie-toast{
          position:fixed;left:50%;transform:translateX(-50%);
          bottom:calc(1.5rem + env(safe-area-inset-bottom));
          background:rgba(74,48,24,.93);color:#f5ead0;
          padding:.7rem 1.3rem;border-radius:12px;font-size:.88rem;z-index:200;
          backdrop-filter:blur(8px);max-width:90vw;text-align:center;
        }

        @media (prefers-reduced-motion:reduce){
          .leonie-root *,.leonie-sheet,.leonie-drawer{animation:none !important;transition:none !important}
        }
      `}</style>

      <div className="leonie-root">
        <div className="leonie-topbar">
          <span className="leonie-logo">✦ Leonies Notizen</span>
          <button className={`leonie-tab ${panel === 'notes' ? 'active' : ''}`} onClick={() => setPanel('notes')}>Notizen</button>
          <button className={`leonie-tab ${panel === 'shares' ? 'active' : ''}`} onClick={() => { setPanel('shares'); loadShares() }}>Zugriffe</button>
        </div>

        {panel === 'notes' ? (
          <div className={`leonie-layout ${mode}`}>
            {mode === 'wide' && <aside className="leonie-col leonie-sidebar">{folderList}</aside>}

            {isPhone ? (
              pane === 'folders' ? (
                <aside className="leonie-col leonie-sidebar">
                  <button className="leonie-btn" style={{ marginBottom: '.8rem', alignSelf: 'flex-start' }} onClick={() => setPane('list')}>‹ Zurück</button>
                  {folderList}
                </aside>
              ) : pane === 'note' ? (
                <div className="leonie-col leonie-editor">{editor}</div>
              ) : (
                <div className="leonie-col leonie-notelist">{noteList}</div>
              )
            ) : (
              <>
                <div className="leonie-col leonie-notelist">{noteList}</div>
                <div className="leonie-col leonie-editor">{editor}</div>
              </>
            )}
          </div>
        ) : (
          <div className="leonie-shares-panel">
            <div className="leonie-shares-header">
              <span className="leonie-shares-title">Geteilte Zugriffe</span>
              <button
                className="leonie-btn primary"
                onClick={() => { setShareAll(false); setShareNoteId(null); setShowShareModal(true) }}
              >+ Zugriff erstellen</button>
            </div>
            <p className="leonie-shares-hint">
              Wer einen dieser Links hat, kommt ohne Account auf die freigegebenen Notizen — lesend, ohne Bearbeiten.
              Widerrufen macht den Link sofort ungültig.
            </p>
            <div className="leonie-glass-card">
              {shares.length === 0 && <div className="leonie-empty-list">Noch keine Zugriffe vergeben</div>}
              {shares.map(s => (
                <div key={s.id} className="leonie-share-row">
                  <div className="leonie-share-info">
                    <div className="leonie-share-label">
                      {s.label || (s.share_all ? 'Alle Notizen' : s.note_title || `Notiz #${s.note_id}`)}
                    </div>
                    <div className="leonie-share-meta">
                      Erstellt {formatDateShort(s.created_at)}
                      {s.expires_at ? ` · Läuft ab ${formatDateShort(s.expires_at)}` : ' · Unbegrenzt'}
                    </div>
                  </div>
                  <span className={`leonie-share-badge ${s.share_all ? 'all' : ''}`}>
                    {s.share_all ? 'Alle Notizen' : 'Eine Notiz'}
                  </span>
                  <div className="leonie-share-actions">
                    <button className="leonie-btn" onClick={() => shareOrCopy(s.token, s.label)}>
                      {copiedToken === s.token ? '✓ Kopiert' : 'Link teilen'}
                    </button>
                    <button className="leonie-btn danger" onClick={() => revokeShare(s.id)}>Widerrufen</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Ordner-Drawer (Tablet) */}
      {drawerOpen && isTablet && (
        <>
          <div className="leonie-drawer-backdrop" onClick={() => setDrawerOpen(false)} />
          <aside className="leonie-drawer">{folderList}</aside>
        </>
      )}

      {/* Aktions-Sheet für die offene Notiz */}
      {showActions && selectedNote && (
        <div className="leonie-sheet-wrap" onClick={e => { if (e.target === e.currentTarget) setShowActions(false) }}>
          <div className="leonie-sheet">
            <div className="leonie-sheet-grip" />
            <div className="leonie-sheet-title">{selectedNote.title}</div>

            <div className="leonie-sheet-field">
              <div className="leonie-label">Ordner</div>
              <select
                className="leonie-input"
                value={selectedNote.folder_id ?? ''}
                onChange={e => moveNote(selectedNote.id, e.target.value ? Number(e.target.value) : null)}
              >
                <option value="">Kein Ordner</option>
                {folders.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
            </div>

            <div className="leonie-sheet-sep" />

            <button className="leonie-sheet-item" onClick={() => { downloadTxt(selectedNote); setShowActions(false) }}>
              <span className="leonie-sheet-icon">↓</span> Als TXT speichern
            </button>
            <button className="leonie-sheet-item" onClick={() => { setShowActions(false); setTimeout(() => downloadPdf(selectedNote), 250) }}>
              <span className="leonie-sheet-icon">↓</span> Als PDF speichern
            </button>
            <button
              className="leonie-sheet-item"
              onClick={() => { setShowActions(false); setShareNoteId(selectedNote.id); setShareAll(false); setShowShareModal(true) }}
            >
              <span className="leonie-sheet-icon">↗</span> Zugriff teilen
            </button>

            <div className="leonie-sheet-sep" />

            <button className="leonie-sheet-item danger" onClick={() => deleteNote(selectedNote)}>
              <span className="leonie-sheet-icon">✕</span> Notiz löschen
            </button>

            <button className="leonie-btn" style={{ marginTop: '.5rem' }} onClick={() => setShowActions(false)}>Schließen</button>
          </div>
        </div>
      )}

      {/* Share-Dialog */}
      {showShareModal && (
        <div className="leonie-overlay" onClick={e => { if (e.target === e.currentTarget) setShowShareModal(false) }}>
          <div className="leonie-modal">
            <div className="leonie-modal-title">Zugriff erstellen</div>

            <div>
              <div className="leonie-label">Wofür ist dieser Link? (optional)</div>
              <input
                className="leonie-input"
                placeholder="z.B. Für Timon"
                value={shareLabel}
                onChange={e => setShareLabel(e.target.value)}
              />
            </div>

            <label className="leonie-checkbox-row">
              <input type="checkbox" checked={shareAll} onChange={e => setShareAll(e.target.checked)} />
              Zugriff auf alle Notizen geben
            </label>

            {!shareAll && (
              <div>
                <div className="leonie-label">Notiz</div>
                <select
                  className="leonie-input"
                  value={shareNoteId ?? ''}
                  onChange={e => setShareNoteId(e.target.value ? Number(e.target.value) : null)}
                >
                  <option value="">— Notiz wählen —</option>
                  {notes.map(n => <option key={n.id} value={n.id}>{n.title}</option>)}
                </select>
              </div>
            )}

            <div>
              <div className="leonie-label">Läuft ab am (optional)</div>
              <input
                className="leonie-input"
                type="datetime-local"
                value={shareExpires}
                onChange={e => setShareExpires(e.target.value)}
              />
            </div>

            <div className="leonie-modal-actions">
              <button className="leonie-btn" onClick={() => setShowShareModal(false)}>Abbrechen</button>
              <button
                className="leonie-btn primary"
                onClick={createShare}
                disabled={!shareAll && !shareNoteId}
              >Link erstellen</button>
            </div>
          </div>
        </div>
      )}

      {copiedToken && <div className="leonie-toast">✓ Link kopiert</div>}
    </>
  )
}