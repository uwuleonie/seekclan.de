'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/app/lib/auth-context'
import Icon from '../_components/Icon'
import Portal from '../_components/Portal'
import { usePrivate } from '../_components/PrivateShell'
import FileViewer from '../_components/FileViewer'
import AttachPicker from '../_components/AttachPicker'
import RichEditor from '../_components/RichEditor'
import Wishlist from '../_components/Wishlist'
import { NoteAttachStrip, NoteFileCards, NoteMediaColumn } from '../_components/NoteAttachments'
import { privateUrls, triggerDownload, type NoteAttachment } from '../_lib/files'
import { PAPERS, downloadTxt, noteHtml, printNote, type Paper } from '../_lib/rich'

/* ─── Typen ─── */
interface Folder { id: number; name: string; color: string; sort_order: number; parent_id: number | null }
interface Note {
  id: number; folder_id: number | null; title: string; content: string; content_html?: string | null
  paper: Paper; pinned: boolean; created_at: string; updated_at: string
}
interface Share {
  id: number; token: string; note_id: number | null; share_all: boolean; label: string | null
  created_at: string; expires_at: string | null; note_title?: string | null
}

type Panel = 'notes' | 'wishes' | 'shares'
type Mode = 'wide' | 'tablet' | 'phone'
type Pane = 'folders' | 'list' | 'note'
type FolderSel = number | 'all' | 'none'
type Filter = 'all' | 'pinned' | 'attach' | 'lined' | 'grid'
type Sort = 'updated' | 'created' | 'title'

// Ordnerfarben passend zum Design (Rosa → Violett)
const FOLDER_COLORS = ['#d93690', '#a93bc9', '#7c4ae0', '#e36aa8', '#c07bd8', '#5b8def', '#25845c', '#e0913a']

/* ─── Helfer ─── */
function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}
function formatDateShort(iso: string) {
  return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' })
}
function readPref<T>(key: string, fallback: T): T {
  try { const v = localStorage.getItem(key); return v ? (JSON.parse(v) as T) : fallback } catch { return fallback }
}
function writePref(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)) } catch { /* egal */ }
}

/** Ordner als Baum: Kinder je Oberordner + Hilfsfunktionen */
function useFolderTree(folders: Folder[]) {
  return useMemo(() => {
    const byId = new Map(folders.map(f => [f.id, f]))
    const children = new Map<number | null, Folder[]>()
    for (const f of folders) {
      // Oberordner existiert nicht (mehr) → als Hauptordner zeigen
      const p = f.parent_id !== null && byId.has(f.parent_id) ? f.parent_id : null
      if (!children.has(p)) children.set(p, [])
      children.get(p)!.push(f)
    }
    const descendants = (id: number): number[] => {
      const out = [id]
      for (const c of children.get(id) ?? []) out.push(...descendants(c.id))
      return out
    }
    const path = (id: number): Folder[] => {
      const out: Folder[] = []
      let cur = byId.get(id)
      const seen = new Set<number>()
      while (cur && !seen.has(cur.id)) {
        out.unshift(cur)
        seen.add(cur.id)
        cur = cur.parent_id !== null ? byId.get(cur.parent_id) : undefined
      }
      return out
    }
    /** Flache Liste in Baum-Reihenfolge mit Tiefe (für Auswahllisten) */
    const flat: { folder: Folder; depth: number }[] = []
    const walk = (p: number | null, depth: number) => {
      for (const f of children.get(p) ?? []) { flat.push({ folder: f, depth }); walk(f.id, depth + 1) }
    }
    walk(null, 0)
    return { byId, children, descendants, path, flat }
  }, [folders])
}

async function errorText(res: Response) {
  const data = await res.json().catch(() => ({}))
  return data.error || `Fehler ${res.status}`
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
  const [panel, setPanel] = useState<Panel>('notes')

  const [folders, setFolders] = useState<Folder[]>([])
  const [notes, setNotes] = useState<Note[]>([])
  const [notesError, setNotesError] = useState<string | null>(null)
  const [shares, setShares] = useState<Share[]>([])
  const [selectedFolder, setSelectedFolder] = useState<FolderSel>('all')
  const [collapsed, setCollapsed] = useState<number[]>([])
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [sort, setSort] = useState<Sort>('updated')

  // Geöffnete Notiz (mit formatiertem Inhalt)
  const [current, setCurrent] = useState<Note | null>(null)
  const [openingId, setOpeningId] = useState<number | null>(null)
  const [editMode, setEditMode] = useState(false)
  const [editTitle, setEditTitle] = useState('')
  const [saving, setSaving] = useState(false)

  const [folderModal, setFolderModal] = useState<{ folder: Folder | null; parent: number | null } | null>(null)
  const [folderName, setFolderName] = useState('')
  const [folderColor, setFolderColor] = useState(FOLDER_COLORS[0])
  const [folderParent, setFolderParent] = useState<number | null>(null)
  const [folderDeleteArmed, setFolderDeleteArmed] = useState(false)

  const [showActions, setShowActions] = useState(false)
  const [deleteArmed, setDeleteArmed] = useState(false)
  const [showShareModal, setShowShareModal] = useState(false)
  const [shareNoteId, setShareNoteId] = useState<number | null>(null)
  const [shareLabel, setShareLabel] = useState('')
  const [shareAll, setShareAll] = useState(false)
  const [shareExpires, setShareExpires] = useState('')

  // Anhänge (Dateien aus Quick Share)
  const [attachments, setAttachments] = useState<NoteAttachment[]>([])
  const [attError, setAttError] = useState<string | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [viewerIndex, setViewerIndex] = useState<number | null>(null)
  const [clipCounts, setClipCounts] = useState<Record<string, number>>({})

  // Automatisch speichern: Änderungen sammeln und nach kurzer Pause schicken
  const pending = useRef<{ id: number; patch: Record<string, unknown> } | null>(null)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingNoteId = useRef<number | null>(null)
  const isPhone = mode === 'phone'
  const isTablet = mode === 'tablet'
  const tree = useFolderTree(folders)

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

  /* Einstellungen merken + Notiz direkt öffnen (?note=ID), Reiter (?tab=wunschliste) */
  useEffect(() => {
    setCollapsed(readPref<number[]>('pv-notes-collapsed', []))
    setSort(readPref<Sort>('pv-notes-sort', 'updated'))
    const sp = new URLSearchParams(window.location.search)
    const id = Number(sp.get('note'))
    if (id) pendingNoteId.current = id
    if (sp.get('tab') === 'wunschliste') setPanel('wishes')
  }, [])

  /* ── Laden ── */
  const loadFolders = useCallback(async () => {
    const res = await fetch('/api/private/leonie/folders', { cache: 'no-store' })
    if (res.ok) setFolders(await res.json())
    else toast(`Ordner: ${await errorText(res)}`, { ms: 6000 })
  }, [toast])

  const loadNotes = useCallback(async () => {
    const res = await fetch('/api/private/leonie/notes', { cache: 'no-store' })
    if (!res.ok) { setNotesError(await errorText(res)); return }
    setNotesError(null)
    const list: Note[] = await res.json()
    setNotes(list)
    if (pendingNoteId.current) {
      const n = list.find(x => x.id === pendingNoteId.current)
      pendingNoteId.current = null
      if (n) openNote(n)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const loadShares = useCallback(async () => {
    const res = await fetch('/api/private/leonie/shares', { cache: 'no-store' })
    if (res.ok) setShares(await res.json())
  }, [])

  const loadClipCounts = useCallback(async () => {
    const res = await fetch('/api/private/leonie/attachments', { cache: 'no-store' })
    if (res.ok) setClipCounts(await res.json())
  }, [])

  useEffect(() => {
    if (isLeonie) { loadFolders(); loadNotes(); loadShares(); loadClipCounts() }
  }, [isLeonie, loadFolders, loadNotes, loadShares, loadClipCounts])

  /* Anhänge der geöffneten Notiz laden */
  const noteId = current?.id
  useEffect(() => {
    setAttachments([])
    setAttError(null)
    setViewerIndex(null)
    if (!noteId) return
    let cancelled = false
    fetch(`/api/private/leonie/notes/${noteId}/attachments`)
      .then(async r => {
        const d = await r.json().catch(() => ({}))
        if (!r.ok) throw new Error(d.error || `Fehler ${r.status}`)
        return d as NoteAttachment[]
      })
      .then(list => { if (!cancelled) setAttachments(list) })
      .catch(e => { if (!cancelled) setAttError((e as Error).message) })
    return () => { cancelled = true }
  }, [noteId])

  /* Beim Verlassen der Seite noch offene Änderungen speichern */
  useEffect(() => {
    const flushOnHide = () => { if (document.visibilityState === 'hidden') flush(true) }
    document.addEventListener('visibilitychange', flushOnHide)
    return () => { document.removeEventListener('visibilitychange', flushOnHide); flush(true) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /* ── Speichern ── */
  async function sendPatch(id: number, patch: Record<string, unknown>, keepalive = false) {
    setSaving(true)
    try {
      const res = await fetch(`/api/private/leonie/notes/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch), keepalive,
      })
      if (!res.ok) { toast(`Speichern fehlgeschlagen: ${await errorText(res)}`, { ms: 7000 }); return null }
      const updated: Note = await res.json()
      setNotes(prev => prev.map(n => (n.id === updated.id ? { ...n, ...updated, content_html: undefined } : n)))
      setCurrent(prev => (prev && prev.id === updated.id ? { ...prev, ...updated, content_html: prev.content_html } : prev))
      return updated
    } catch {
      toast('Speichern fehlgeschlagen – keine Verbindung', { ms: 6000 })
      return null
    } finally {
      setSaving(false)
    }
  }

  function flush(keepalive = false) {
    if (saveTimer.current) { clearTimeout(saveTimer.current); saveTimer.current = null }
    const p = pending.current
    pending.current = null
    if (p && Object.keys(p.patch).length) return sendPatch(p.id, p.patch, keepalive && JSON.stringify(p.patch).length < 60_000)
    return Promise.resolve(null)
  }

  function queue(id: number, patch: Record<string, unknown>) {
    if (pending.current && pending.current.id !== id) flush()
    pending.current = { id, patch: { ...(pending.current?.patch ?? {}), ...patch } }
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => flush(), 1100)
  }

  /* ── Notizen ── */
  async function openNote(note: Note, edit = false) {
    await flush()
    setDeleteArmed(false)
    setOpeningId(note.id)
    setPane('note')
    try {
      const res = await fetch(`/api/private/leonie/notes/${note.id}`, { cache: 'no-store' })
      if (!res.ok) throw new Error(await errorText(res))
      const full: Note = await res.json()
      setCurrent(full)
      setEditTitle(full.title)
      setEditMode(edit)
    } catch (e) {
      toast(`Notiz konnte nicht geladen werden: ${(e as Error).message}`, { ms: 6000 })
      setPane('list')
    } finally {
      setOpeningId(null)
    }
  }

  async function createNote() {
    await flush()
    const fid = typeof selectedFolder === 'number' ? selectedFolder : null
    const res = await fetch('/api/private/leonie/notes', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Neue Notiz', content: '', content_html: '<p></p>', folder_id: fid }),
    })
    if (!res.ok) { toast(`Anlegen fehlgeschlagen: ${await errorText(res)}`, { ms: 6000 }); return }
    const note: Note = await res.json()
    setNotes(prev => [{ ...note, content_html: undefined }, ...prev])
    setFilter('all')
    setCurrent(note)
    setEditTitle(note.title)
    setEditMode(true)
    setPane('note')
  }

  function onContent(html: string, text: string) {
    if (!current) return
    setCurrent(prev => (prev ? { ...prev, content_html: html, content: text } : prev))
    setNotes(prev => prev.map(n => (n.id === current.id ? { ...n, content: text } : n)))
    queue(current.id, { content_html: html, content: text })
  }

  function onTitle(t: string) {
    if (!current) return
    setEditTitle(t)
    setNotes(prev => prev.map(n => (n.id === current.id ? { ...n, title: t || 'Ohne Titel' } : n)))
    queue(current.id, { title: t })
  }

  function finishEditing() {
    flush()
    setEditMode(false)
  }

  async function setPaper(p: Paper) {
    if (!current) return
    setCurrent(prev => (prev ? { ...prev, paper: p } : prev))
    await sendPatch(current.id, { paper: p })
  }

  async function togglePin(n: Note) {
    const updated = await sendPatch(n.id, { pinned: !n.pinned })
    if (updated) toast(updated.pinned ? 'Angeheftet – steht jetzt oben' : 'Nicht mehr angeheftet')
  }

  async function deleteNote(note: Note) {
    // Zweistufig statt Browser-Popup (confirm() wird von manchen Handys blockiert)
    if (!deleteArmed) { setDeleteArmed(true); setTimeout(() => setDeleteArmed(false), 4000); return }
    pending.current = null
    if (saveTimer.current) clearTimeout(saveTimer.current)
    const res = await fetch(`/api/private/leonie/notes/${note.id}`, { method: 'DELETE' })
    if (!res.ok) { toast(`Löschen fehlgeschlagen: ${await errorText(res)}`, { ms: 6000 }); return }
    setCurrent(null)
    setEditMode(false)
    setShowActions(false)
    setDeleteArmed(false)
    setNotes(prev => prev.filter(n => n.id !== note.id))
    setPane('list')
    toast('Notiz gelöscht')
  }

  async function moveNote(id: number, folderId: number | null) {
    await flush()
    const updated = await sendPatch(id, { folder_id: folderId })
    if (updated) toast(folderId ? `Verschoben nach "${tree.byId.get(folderId)?.name ?? 'Ordner'}"` : 'Aus dem Ordner genommen')
  }

  /* Anhänge */
  async function attachFiles(ids: number[]) {
    if (!current) return
    const res = await fetch(`/api/private/leonie/notes/${current.id}/attachments`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ file_ids: ids }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) { toast(`Anhängen fehlgeschlagen: ${data.error || res.status}`, { ms: 6000 }); return }
    setAttachments(data)
    setAttError(null)
    setPickerOpen(false)
    toast(ids.length === 1 ? 'Datei angehängt' : `${ids.length} Dateien angehängt`)
    loadClipCounts()
  }

  async function removeAttachment(attachmentId: number) {
    if (!current) return
    const res = await fetch(`/api/private/leonie/notes/${current.id}/attachments?attachment_id=${attachmentId}`, { method: 'DELETE' })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) { toast(`Entfernen fehlgeschlagen: ${data.error || res.status}`, { ms: 6000 }); return }
    setAttachments(data)
    setViewerIndex(null)
    toast('Aus der Notiz entfernt – die Datei bleibt in Quick Share')
    loadClipCounts()
  }

  async function moveAttachment(attachmentId: number, dir: -1 | 1) {
    if (!current) return
    const order = attachments.map(a => a.attachment_id)
    const i = order.indexOf(attachmentId)
    const j = i + dir
    if (i < 0 || j < 0 || j >= order.length) return
    ;[order[i], order[j]] = [order[j], order[i]]
    setAttachments(prev => order.map(id => prev.find(a => a.attachment_id === id)!))
    const res = await fetch(`/api/private/leonie/notes/${current.id}/attachments`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ order }),
    })
    if (res.ok) setAttachments(await res.json())
  }

  /* ── Ordner ── */
  function pickFolder(f: FolderSel) {
    setSelectedFolder(f)
    setDrawerOpen(false)
    setPane('list')
  }

  function toggleCollapse(id: number) {
    setCollapsed(prev => {
      const next = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
      writePref('pv-notes-collapsed', next)
      return next
    })
  }

  function openFolderModal(folder: Folder | null, parent: number | null = null) {
    setFolderName(folder?.name ?? '')
    setFolderColor(folder?.color && FOLDER_COLORS.includes(folder.color) ? folder.color : (parent !== null ? tree.byId.get(parent)?.color : null) ?? FOLDER_COLORS[folders.length % FOLDER_COLORS.length])
    setFolderParent(folder ? folder.parent_id : parent)
    setFolderDeleteArmed(false)
    setFolderModal({ folder, parent })
  }

  async function saveFolder() {
    if (!folderModal || !folderName.trim()) return
    const body = JSON.stringify({ name: folderName.trim(), color: folderColor, parent_id: folderParent })
    const res = folderModal.folder
      ? await fetch(`/api/private/leonie/folders/${folderModal.folder.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body })
      : await fetch('/api/private/leonie/folders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body })
    if (!res.ok) { toast(`Speichern fehlgeschlagen: ${await errorText(res)}`, { ms: 6000 }); return }
    const saved: Folder = await res.json()
    toast(folderModal.folder ? 'Ordner gespeichert' : folderParent ? 'Unterordner erstellt' : 'Ordner erstellt')
    // Oberordner aufklappen, damit der neue Unterordner sichtbar ist
    if (saved.parent_id !== null && collapsed.includes(saved.parent_id)) toggleCollapse(saved.parent_id)
    setFolderModal(null)
    loadFolders()
  }

  async function deleteFolder(folder: Folder) {
    if (!folderDeleteArmed) { setFolderDeleteArmed(true); return }
    const res = await fetch(`/api/private/leonie/folders/${folder.id}`, { method: 'DELETE' })
    if (!res.ok) { toast(`Löschen fehlgeschlagen: ${await errorText(res)}`, { ms: 6000 }); return }
    const parentName = folder.parent_id !== null ? tree.byId.get(folder.parent_id)?.name : null
    toast(`Ordner "${folder.name}" gelöscht – Inhalt liegt jetzt in ${parentName ? `"${parentName}"` : '"Ohne Ordner"'}`, { ms: 5000 })
    if (selectedFolder === folder.id) setSelectedFolder(folder.parent_id ?? 'all')
    setFolderModal(null)
    loadFolders()
    loadNotes()
  }

  /* ── Zugriffe (Teilen per Link) ── */
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
    await flush()
    const res = await fetch('/api/private/leonie/shares', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        note_id: shareAll ? null : shareNoteId, share_all: shareAll,
        label: shareLabel || null, expires_at: shareExpires || null,
      }),
    })
    if (!res.ok) { toast(`Link erstellen fehlgeschlagen: ${await errorText(res)}`, { ms: 6000 }); return }
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

  /* ── Abgeleitet ── */
  const folderScope = useMemo(
    () => (typeof selectedFolder === 'number' ? new Set(tree.descendants(selectedFolder)) : null),
    [selectedFolder, tree]
  )
  const counts = useMemo(() => {
    const direct = new Map<number, number>()
    for (const n of notes) if (n.folder_id !== null) direct.set(n.folder_id, (direct.get(n.folder_id) ?? 0) + 1)
    const total = (id: number): number => tree.descendants(id).reduce((s, d) => s + (direct.get(d) ?? 0), 0)
    return { total, none: notes.filter(n => n.folder_id === null || !tree.byId.has(n.folder_id)).length }
  }, [notes, tree])

  const visibleNotes = useMemo(() => {
    const q = search.trim().toLowerCase()
    let list = notes.filter(n => {
      if (selectedFolder === 'none' && n.folder_id !== null && tree.byId.has(n.folder_id)) return false
      if (folderScope && (n.folder_id === null || !folderScope.has(n.folder_id))) return false
      if (filter === 'pinned' && !n.pinned) return false
      if (filter === 'attach' && !(clipCounts[n.id] > 0)) return false
      if ((filter === 'lined' || filter === 'grid') && n.paper !== filter) return false
      if (q && !n.title.toLowerCase().includes(q) && !n.content.toLowerCase().includes(q)) return false
      return true
    })
    list = [...list].sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
      if (sort === 'title') return a.title.localeCompare(b.title, 'de', { numeric: true })
      if (sort === 'created') return b.created_at.localeCompare(a.created_at)
      return b.updated_at.localeCompare(a.updated_at)
    })
    return list
  }, [notes, search, selectedFolder, folderScope, filter, sort, clipCounts, tree])

  const folderLabel =
    selectedFolder === 'all' ? 'Alle Notizen'
      : selectedFolder === 'none' ? 'Ohne Ordner'
        : tree.byId.get(selectedFolder)?.name ?? 'Notizen'
  const crumbs = typeof selectedFolder === 'number' ? tree.path(selectedFolder).slice(0, -1) : []

  const folderOptions = (exclude: number[] = []) =>
    tree.flat.filter(x => !exclude.includes(x.folder.id)).map(({ folder, depth }) => (
      <option key={folder.id} value={folder.id}>{'   '.repeat(depth)}{depth ? '└ ' : ''}{folder.name}</option>
    ))

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
  const renderFolder = (f: Folder, depth: number): React.ReactNode => {
    const kids = tree.children.get(f.id) ?? []
    const open = !collapsed.includes(f.id)
    return (
      <div key={f.id}>
        <div
          role="button"
          tabIndex={0}
          className={`pv-folder-item ${selectedFolder === f.id ? 'active' : ''}`}
          style={{ paddingLeft: 10 + depth * 16 }}
          onClick={() => pickFolder(f.id)}
          onKeyDown={e => { if (e.key === 'Enter') pickFolder(f.id) }}
        >
          {kids.length > 0 ? (
            <button
              className="pv-folder-toggle"
              aria-label={open ? 'Zuklappen' : 'Aufklappen'}
              onClick={e => { e.stopPropagation(); toggleCollapse(f.id) }}
            >
              <Icon name={open ? 'chevronDown' : 'chevronRight'} size={14} />
            </button>
          ) : <span className="pv-folder-spacer" />}
          <span className="pv-folder-dot" style={{ background: f.color }} />
          <span className="pv-grow pv-ellipsis">{f.name}</span>
          <span className="pv-folder-count">{counts.total(f.id) || ''}</span>
          <span className="pv-folder-actions">
            <button aria-label={`Unterordner in ${f.name}`} title="Unterordner anlegen" onClick={e => { e.stopPropagation(); openFolderModal(null, f.id) }}>
              <Icon name="plus" size={15} />
            </button>
            <button aria-label={`${f.name} bearbeiten`} title="Bearbeiten" onClick={e => { e.stopPropagation(); openFolderModal(f) }}>
              <Icon name="pencil" size={15} />
            </button>
          </span>
        </div>
        {open && kids.map(k => renderFolder(k, depth + 1))}
      </div>
    )
  }

  const folderList = (
    <>
      <p className="pv-eyebrow" style={{ padding: '0 10px 8px' }}>Ordner</p>
      <button className={`pv-folder-item ${selectedFolder === 'all' ? 'active' : ''}`} onClick={() => pickFolder('all')}>
        <Icon name="notes" size={17} /> <span className="pv-grow pv-ellipsis">Alle Notizen</span>
        <span className="pv-folder-count">{notes.length || ''}</span>
      </button>
      <button className={`pv-folder-item ${selectedFolder === 'none' ? 'active' : ''}`} onClick={() => pickFolder('none')}>
        <Icon name="file" size={17} /> <span className="pv-grow pv-ellipsis">Ohne Ordner</span>
        <span className="pv-folder-count">{counts.none || ''}</span>
      </button>
      {(tree.children.get(null) ?? []).map(f => renderFolder(f, 0))}
      <button className="pv-folder-item" style={{ color: 'var(--pv-ink-3)', marginTop: 6 }} onClick={() => openFolderModal(null)}>
        <Icon name="folderPlus" size={17} /> Neuer Ordner
      </button>
    </>
  )

  const FILTERS: { v: Filter; label: string; icon?: string }[] = [
    { v: 'all', label: 'Alle' },
    { v: 'pinned', label: 'Angeheftet', icon: 'pin' },
    { v: 'attach', label: 'Mit Anhang', icon: 'clip' },
    { v: 'lined', label: 'Liniert' },
    { v: 'grid', label: 'Kariert' },
  ]

  const noteList = (
    <>
      <div className="pv-notes-listhead">
        {isPhone && <button className="pv-icon-btn" aria-label="Ordner" onClick={() => setPane('folders')}><Icon name="folder" size={18} /></button>}
        {isTablet && <button className="pv-icon-btn" aria-label="Ordner" onClick={() => setDrawerOpen(true)}><Icon name="folder" size={18} /></button>}
        <div className="pv-grow" style={{ minWidth: 0 }}>
          {crumbs.length > 0 && (
            <div className="pv-crumbs">
              {crumbs.map(c => (
                <span key={c.id} className="pv-row" style={{ gap: 4 }}>
                  <button className="pv-link" style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer', font: 'inherit', color: 'inherit' }} onClick={() => pickFolder(c.id)}>{c.name}</button>
                  <Icon name="chevronRight" size={11} />
                </span>
              ))}
            </div>
          )}
          <div className="pv-h2 pv-ellipsis" style={{ fontSize: 19 }}>{folderLabel}</div>
          <div className="pv-muted" style={{ fontSize: 12 }}>{visibleNotes.length} {visibleNotes.length === 1 ? 'Notiz' : 'Notizen'}{folderScope && folderScope.size > 1 ? ' · mit Unterordnern' : ''}</div>
        </div>
        <button className="pv-btn primary sm" onClick={createNote}><Icon name="plus" size={16} /> Neu</button>
      </div>
      <div style={{ padding: '0 14px 8px' }}>
        <label className="pv-search">
          <Icon name="search" size={16} />
          <input className="pv-input" type="search" placeholder="Titel und Text durchsuchen" value={search} onChange={e => setSearch(e.target.value)} />
        </label>
      </div>
      <div className="pv-notes-filters">
        <div className="pv-chips">
          {FILTERS.map(f => (
            <button key={f.v} className={`pv-chip ${filter === f.v ? 'active' : ''}`} onClick={() => setFilter(f.v)}>
              {f.icon && <Icon name={f.icon} size={13} />} {f.label}
            </button>
          ))}
        </div>
        <select className="pv-input" aria-label="Sortierung" value={sort} onChange={e => { setSort(e.target.value as Sort); writePref('pv-notes-sort', e.target.value) }}>
          <option value="updated">Zuletzt geändert</option>
          <option value="created">Neueste</option>
          <option value="title">A–Z</option>
        </select>
      </div>
      <div className="pv-notes-scroll">
        {notesError && <div className="pv-empty" style={{ color: 'var(--pv-danger)' }}>{notesError}</div>}
        {!notesError && visibleNotes.length === 0 && (
          <div className="pv-empty">{search || filter !== 'all' ? 'Nichts gefunden' : 'Noch keine Notizen hier'}</div>
        )}
        {visibleNotes.map(note => {
          const folder = note.folder_id !== null ? tree.byId.get(note.folder_id) : undefined
          return (
            <button key={note.id} className={`pv-note-item ${current?.id === note.id && !isPhone ? 'active' : ''}`} onClick={() => openNote(note)}>
              <div className="pv-note-item-title">
                {note.pinned && <Icon name="pin" size={13} className="pv-note-pin" />}
                <span className="pv-ellipsis">{note.title}</span>
                {openingId === note.id && <span className="pv-spinner" style={{ width: 13, height: 13, marginLeft: 'auto' }} />}
              </div>
              <div className="pv-note-item-meta">
                {isPhone ? formatDateShort(note.updated_at) : formatDate(note.updated_at)}
                {selectedFolder === 'all' && folder && <> · <span style={{ color: folder.color }}>{folder.name}</span></>}
                {clipCounts[note.id] > 0 && <span className="pv-note-clip"><Icon name="clip" size={12} /> {clipCounts[note.id]}</span>}
              </div>
              <div className="pv-note-item-prev pv-ellipsis">{note.content.slice(0, 120).replace(/\n+/g, ' ') || 'Leer'}</div>
            </button>
          )
        })}
      </div>
    </>
  )

  const openAttachment = (f: NoteAttachment) => setViewerIndex(attachments.findIndex(a => a.attachment_id === f.attachment_id))

  const editor = !current ? (
    <div className="pv-center pv-muted">
      {openingId ? <div className="pv-spinner" /> : <><Icon name="notes" size={40} stroke={1.3} />Notiz auswählen oder eine neue anlegen</>}
    </div>
  ) : (
    <>
      <div className="pv-editor-bar">
        {isPhone && (
          <button className="pv-icon-btn" aria-label="Zurück" onClick={() => { flush(); setEditMode(false); setPane('list') }}>
            <Icon name="back" size={18} />
          </button>
        )}
        {editMode ? (
          <input className="pv-editor-title" value={editTitle} onChange={e => onTitle(e.target.value)} placeholder="Titel" />
        ) : (
          <span className="pv-editor-title pv-ellipsis" onDoubleClick={() => setEditMode(true)}>{current.title}</span>
        )}
        {saving && <span className="pv-muted" style={{ fontSize: 12 }}>Speichert …</span>}
        <button className={`pv-icon-btn ${current.pinned ? 'active' : 'ghost'}`} aria-label={current.pinned ? 'Nicht mehr anheften' : 'Anheften'} title={current.pinned ? 'Angeheftet' : 'Anheften'} onClick={() => togglePin(current)}>
          <Icon name="pin" size={17} />
        </button>
        {editMode ? (
          <button className="pv-btn primary sm" onClick={finishEditing}><Icon name="check" size={16} /> Fertig</button>
        ) : (
          <button className="pv-btn sm" onClick={() => setEditMode(true)}><Icon name="pencil" size={15} /> Bearbeiten</button>
        )}
        {mode !== 'wide' ? (
          <button className="pv-icon-btn" aria-label="Weitere Aktionen" onClick={() => { setDeleteArmed(false); setShowActions(true) }}><Icon name="more" size={18} /></button>
        ) : (
          <>
            <select
              className="pv-input"
              style={{ width: 'auto', maxWidth: 170, minHeight: 32, padding: '4px 8px', fontSize: 13 }}
              aria-label="Ordner"
              value={current.folder_id ?? ''}
              onChange={e => moveNote(current.id, e.target.value ? Number(e.target.value) : null)}
            >
              <option value="">Kein Ordner</option>
              {folderOptions()}
            </select>
            {!editMode && (
              <select className="pv-input" style={{ width: 'auto', minHeight: 32, padding: '4px 8px', fontSize: 13 }} aria-label="Papier" value={current.paper} onChange={e => setPaper(e.target.value as Paper)}>
                {PAPERS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            )}
            <button className="pv-btn sm" onClick={() => setPickerOpen(true)}><Icon name="clip" size={15} /> Anhängen</button>
            <button className="pv-btn sm" onClick={() => downloadTxt({ ...current, title: editTitle || current.title })}>TXT</button>
            <button className="pv-btn sm" onClick={() => printNote({ ...current, title: editTitle || current.title }, () => toast('Popup wurde blockiert – bitte Popups für seekclan.de erlauben'))}>PDF</button>
            <button className="pv-btn sm" onClick={() => { setShareNoteId(current.id); setShareAll(false); setShowShareModal(true) }}>
              <Icon name="link" size={15} /> Teilen
            </button>
            <button
              className={`pv-btn sm ${deleteArmed ? 'danger' : 'ghost'}`}
              aria-label="Löschen"
              style={deleteArmed ? { background: 'var(--pv-danger)', color: '#fff' } : undefined}
              onClick={() => deleteNote(current)}
            >
              <Icon name="trash" size={16} style={deleteArmed ? undefined : { color: 'var(--pv-danger)' }} />{deleteArmed && ' Löschen?'}
            </button>
          </>
        )}
      </div>
      {attError && (
        <div className="pv-muted" style={{ fontSize: 12.5, padding: '8px 16px', color: 'var(--pv-danger)', borderBottom: '1px solid var(--pv-line)' }}>
          Anhänge: {attError}
        </div>
      )}
      {editMode && attachments.length > 0 && (
        <NoteAttachStrip items={attachments} urls={privateUrls} onRemove={removeAttachment} onMove={moveAttachment} onAdd={() => setPickerOpen(true)} />
      )}
      <RichEditor
        key={current.id}
        html={noteHtml(current)}
        editable={editMode}
        paper={current.paper}
        onChange={onContent}
        onPaperChange={setPaper}
        toast={t => toast(t)}
        autoFocus={!isPhone}
        placeholder="Schreiben … Formatierung oben in der Leiste, Links einfach einfügen."
        before={!editMode ? <NoteMediaColumn items={attachments} urls={privateUrls} onOpen={f => openAttachment(f as NoteAttachment)} /> : null}
        after={!editMode ? <NoteFileCards items={attachments} urls={privateUrls} onOpen={f => openAttachment(f as NoteAttachment)} /> : null}
      />
    </>
  )

  return (
    <div ref={rootRef} style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      {/* Umschalter Notizen / Wunschliste / Zugriffe */}
      <div className="pv-row" style={{ padding: '14px 16px 10px', borderBottom: '1px solid var(--pv-glass-border)' }}>
        <div className="pv-grow pv-desktop-only">
          <span className="pv-title" style={{ fontSize: 24 }}>{panel === 'wishes' ? 'Wunschliste' : 'Notizen'}</span>
        </div>
        <div className="pv-seg" style={isPhone ? { width: '100%' } : undefined}>
          <button style={isPhone ? { flex: 1 } : undefined} className={panel === 'notes' ? 'active' : ''} onClick={() => setPanel('notes')}><Icon name="notes" size={16} /> Notizen</button>
          <button style={isPhone ? { flex: 1 } : undefined} className={panel === 'wishes' ? 'active' : ''} onClick={() => { flush(); setPanel('wishes') }}><Icon name="gift" size={16} /> Wünsche</button>
          <button style={isPhone ? { flex: 1 } : undefined} className={panel === 'shares' ? 'active' : ''} onClick={() => { flush(); setPanel('shares'); loadShares() }}>
            <Icon name="link" size={16} /> {isPhone ? 'Links' : 'Geteilte Links'} {shares.length > 0 && <span className="pv-badge">{shares.length}</span>}
          </button>
        </div>
      </div>

      {panel === 'notes' && (
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
            ) : pane === 'note' && (current || openingId) ? (
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
      )}

      {panel === 'wishes' && (
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: 16 }}>
          <Wishlist toast={(t, o) => toast(t, o)} />
        </div>
      )}

      {panel === 'shares' && (
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
            <aside className="pv-modal" style={{ height: '100%', maxHeight: 'none', width: 300, borderRadius: '0 24px 24px 0', gap: 2, overflowY: 'auto' }}>
              {folderList}
            </aside>
          </div>
        </Portal>
      )}

      {/* Aktionen (Handy / mittlere Breite) */}
      {showActions && current && (
        <Portal>
          <div className="pv-overlay sheet" onClick={e => { if (e.target === e.currentTarget) setShowActions(false) }}>
            <div className="pv-modal">
              <div className="pv-grip" />
              <div className="pv-ellipsis" style={{ fontWeight: 600 }}>{current.title}</div>
              <div className="pv-row" style={{ gap: 10 }}>
                <div className="pv-grow">
                  <label className="pv-label">Ordner</label>
                  <select className="pv-input" value={current.folder_id ?? ''} onChange={e => moveNote(current.id, e.target.value ? Number(e.target.value) : null)}>
                    <option value="">Kein Ordner</option>
                    {folderOptions()}
                  </select>
                </div>
                <div style={{ width: 120 }}>
                  <label className="pv-label">Papier</label>
                  <select className="pv-input" value={current.paper} onChange={e => setPaper(e.target.value as Paper)}>
                    {PAPERS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                  </select>
                </div>
              </div>
              <div className="pv-sep" />
              <button className="pv-menu-item" onClick={() => { togglePin(current); setShowActions(false) }}><Icon name="pin" /> {current.pinned ? 'Nicht mehr anheften' : 'Anheften'}</button>
              <button className="pv-menu-item" onClick={() => { downloadTxt({ ...current, title: editTitle || current.title }); setShowActions(false) }}><Icon name="download" /> Als TXT speichern</button>
              <button className="pv-menu-item" onClick={() => { setShowActions(false); setTimeout(() => printNote({ ...current, title: editTitle || current.title }, () => toast('Popup wurde blockiert')), 250) }}><Icon name="pdf" /> Als PDF speichern</button>
              <button className="pv-menu-item" onClick={() => { setShowActions(false); setPickerOpen(true) }}><Icon name="clip" /> Datei aus Quick Share anhängen</button>
              <button className="pv-menu-item" onClick={() => { setShowActions(false); setShareNoteId(current.id); setShareAll(false); setShowShareModal(true) }}><Icon name="link" /> Link teilen</button>
              <div className="pv-sep" />
              <button className="pv-menu-item danger" onClick={() => deleteNote(current)}><Icon name="trash" /> {deleteArmed ? 'Wirklich löschen? Nochmal tippen' : 'Notiz löschen'}</button>
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
              <div className="pv-h2">{folderModal.folder ? 'Ordner bearbeiten' : folderParent !== null ? 'Neuer Unterordner' : 'Neuer Ordner'}</div>
              <input className="pv-input" placeholder="Ordnername" value={folderName} onChange={e => setFolderName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') saveFolder() }} autoFocus maxLength={80} />
              <div>
                <label className="pv-label">Liegt in</label>
                <select className="pv-input" value={folderParent ?? ''} onChange={e => setFolderParent(e.target.value ? Number(e.target.value) : null)}>
                  <option value="">Hauptebene (kein Oberordner)</option>
                  {folderOptions(folderModal.folder ? tree.descendants(folderModal.folder.id) : [])}
                </select>
              </div>
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
              {folderModal.folder && folderDeleteArmed && (
                <p className="pv-muted" style={{ margin: 0, fontSize: 13 }}>
                  Notizen und Unterordner gehen nicht verloren – sie wandern eine Ebene höher.
                </p>
              )}
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

      {/* Dateien aus Quick Share anhängen */}
      {pickerOpen && current && (
        <AttachPicker excludeIds={attachments.map(a => a.id)} onClose={() => setPickerOpen(false)} onPick={attachFiles} />
      )}

      {/* Anhang groß ansehen */}
      {viewerIndex !== null && attachments[viewerIndex] && (
        <FileViewer
          files={attachments}
          index={viewerIndex}
          onIndex={setViewerIndex}
          onClose={() => setViewerIndex(null)}
          onDownload={f => triggerDownload(f.id, f.original_name)}
          toast={t => toast(t)}
          actions={[{
            label: 'Aus Notiz entfernen',
            icon: 'x',
            danger: true,
            onClick: f => {
              const a = attachments.find(x => x.id === f.id)
              if (a) removeAttachment(a.attachment_id)
            },
          }]}
        />
      )}
    </div>
  )
}