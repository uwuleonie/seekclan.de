'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Icon from '../_components/Icon'
import Portal from '../_components/Portal'
import FileViewer from '../_components/FileViewer'
import { usePrivate } from '../_components/PrivateShell'
import { getDeviceId, getDeviceLabel } from '../_lib/device'
import {
  KIND_ICON, KIND_LABEL, dayGroup, extOf, formatBytes, formatWhen, thumbUrl, fileUrl, triggerDownload,
  type FileKind, type PFile, type PFolder, type PStorage,
} from '../_lib/files'

type FolderFilter = 'all' | 'none' | number
type SortKey = 'new' | 'old' | 'name' | 'size'
type Modal =
  | { type: 'rename'; file: PFile }
  | { type: 'move'; ids: number[] }
  | { type: 'delete'; ids: number[] }
  | { type: 'folder-new' }
  | { type: 'folder-edit'; folder: PFolder }
  | null

const KINDS: (FileKind | 'all')[] = ['all', 'image', 'video', 'document', 'pdf', 'audio', 'archive', 'other']

function readPref<T extends string>(key: string, fallback: T): T {
  try { return (localStorage.getItem(key) as T) || fallback } catch { return fallback }
}
function writePref(key: string, value: string) {
  try { localStorage.setItem(key, value) } catch { /* egal */ }
}

export default function QuickSharePage() {
  const { toast, stamp, refreshStamp, upload, setUploadFolder } = usePrivate()

  const [files, setFiles] = useState<PFile[]>([])
  const [folders, setFolders] = useState<PFolder[]>([])
  const [storage, setStorage] = useState<PStorage | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)

  const [kind, setKind] = useState<FileKind | 'all'>('all')
  const [folder, setFolder] = useState<FolderFilter>('all')
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<SortKey>('new')
  const [view, setView] = useState<'grid' | 'list'>('grid')

  const [selecting, setSelecting] = useState(false)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [viewerIndex, setViewerIndex] = useState<number | null>(null)
  const [modal, setModal] = useState<Modal>(null)
  const [nameInput, setNameInput] = useState('')
  const [moveTarget, setMoveTarget] = useState<string>('')
  const [deleteArmed, setDeleteArmed] = useState(false)

  const mediaInput = useRef<HTMLInputElement>(null)
  const anyInput = useRef<HTMLInputElement>(null)
  const cameraInput = useRef<HTMLInputElement>(null)
  const knownIds = useRef<Set<number> | null>(null)
  const longPress = useRef<{ timer: ReturnType<typeof setTimeout> | null; fired: boolean }>({ timer: null, fired: false })

  const myDevice = typeof window !== 'undefined' ? getDeviceId() : ''
  const deviceLabel = typeof window !== 'undefined' ? getDeviceLabel() : 'PC'
  const isPhone = deviceLabel !== 'PC'

  useEffect(() => {
    setView(readPref<'grid' | 'list'>('pv-files-view', 'grid'))
    setSort(readPref<SortKey>('pv-files-sort', 'new'))
  }, [])

  /* ── Laden ── */
  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/private/files', { cache: 'no-store' })
      if (!res.ok) throw new Error()
      const data: { files: PFile[]; folders: PFolder[]; storage: PStorage } = await res.json()

      // Neue Dateien von einem anderen Gerät melden (nicht beim ersten Laden)
      if (knownIds.current) {
        const fresh = data.files.filter(f => !knownIds.current!.has(f.id) && f.device_id !== getDeviceId())
        if (fresh.length) {
          const from = fresh[0].source_device ? ` vom ${fresh[0].source_device}` : ''
          toast(fresh.length === 1 ? `Neue Datei${from}: ${fresh[0].original_name}` : `${fresh.length} neue Dateien${from}`, { ms: 5000 })
        }
      }
      knownIds.current = new Set(data.files.map(f => f.id))

      setFiles(data.files)
      setFolders(data.folders)
      setStorage(data.storage)
      setLoadError(false)
    } catch {
      setLoadError(true)
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => { load() }, [load])

  // Stempel aus der Shell ändert sich → etwas ist neu/anders → nachladen
  const firstStamp = useRef(true)
  useEffect(() => {
    if (!stamp) return
    if (firstStamp.current) { firstStamp.current = false; return }
    load()
  }, [stamp, load])

  // Neue Uploads landen im gerade geöffneten Ordner
  useEffect(() => {
    setUploadFolder(typeof folder === 'number' ? folder : null)
  }, [folder, setUploadFolder])
  useEffect(() => () => setUploadFolder(null), [setUploadFolder])

  /* ── Abgeleitete Listen ── */
  const inFolder = useMemo(
    () => files.filter(f => folder === 'all' || (folder === 'none' ? f.folder_id === null : f.folder_id === folder)),
    [files, folder]
  )
  const kindCounts = useMemo(() => {
    const c: Record<string, number> = { all: inFolder.length }
    for (const f of inFolder) c[f.kind] = (c[f.kind] ?? 0) + 1
    return c
  }, [inFolder])

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    const list = inFolder.filter(f => (kind === 'all' || f.kind === kind) && (!q || f.original_name.toLowerCase().includes(q)))
    const sorted = [...list]
    if (sort === 'old') sorted.sort((a, b) => a.created_at.localeCompare(b.created_at))
    if (sort === 'name') sorted.sort((a, b) => a.original_name.localeCompare(b.original_name, 'de', { numeric: true }))
    if (sort === 'size') sorted.sort((a, b) => b.size_bytes - a.size_bytes)
    return sorted
  }, [inFolder, kind, search, sort])

  const groups = useMemo(() => {
    if (sort !== 'new' && sort !== 'old') return [{ label: '', items: visible }]
    const out: { label: string; items: PFile[] }[] = []
    for (const f of visible) {
      const label = dayGroup(f.created_at)
      if (!out.length || out[out.length - 1].label !== label) out.push({ label, items: [] })
      out[out.length - 1].items.push(f)
    }
    return out
  }, [visible, sort])

  const isNew = (f: PFile) => !f.seen_at && f.device_id !== myDevice
  const unseenHere = visible.filter(isNew)

  /* ── Aktionen ── */
  function pick(input: HTMLInputElement | null) {
    input?.click()
  }
  function onPicked(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files?.length) {
      upload(e.target.files)
      toast(e.target.files.length === 1 ? 'Wird gesendet …' : `${e.target.files.length} Dateien werden gesendet …`)
    }
    e.target.value = ''
  }

  const markSeen = useCallback((f: PFile) => {
    if (f.seen_at || f.device_id === getDeviceId()) return
    const now = new Date().toISOString()
    setFiles(prev => prev.map(x => (x.id === f.id ? { ...x, seen_at: now } : x)))
    fetch(`/api/private/files/${f.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ seen: true }),
    }).then(() => refreshStamp()).catch(() => {})
  }, [refreshStamp])

  async function markAllSeen() {
    const ids = unseenHere.map(f => f.id)
    if (!ids.length) return
    const now = new Date().toISOString()
    setFiles(prev => prev.map(x => (ids.includes(x.id) ? { ...x, seen_at: now } : x)))
    await fetch('/api/private/files/bulk', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'seen', ids }),
    })
    refreshStamp()
  }

  function download(f: PFile) {
    triggerDownload(f.id, f.original_name)
    markSeen(f)
  }

  async function downloadMany(ids: number[]) {
    const list = files.filter(f => ids.includes(f.id))
    if (list.length > 1) toast(`${list.length} Downloads starten – ggf. im Browser "mehrere Downloads erlauben"`, { ms: 5000 })
    for (const f of list) {
      download(f)
      await new Promise(r => setTimeout(r, 450))
    }
  }

  function toggleSelect(id: number) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function exitSelect() {
    setSelecting(false)
    setSelected(new Set())
  }

  function onFileClick(f: PFile) {
    if (longPress.current.fired) { longPress.current.fired = false; return }
    if (selecting) { toggleSelect(f.id); return }
    setViewerIndex(visible.findIndex(x => x.id === f.id))
  }

  function onPressStart(f: PFile) {
    longPress.current.fired = false
    if (longPress.current.timer) clearTimeout(longPress.current.timer)
    longPress.current.timer = setTimeout(() => {
      longPress.current.fired = true
      setSelecting(true)
      toggleSelect(f.id)
      if ('vibrate' in navigator) navigator.vibrate?.(15)
    }, 480)
  }
  function onPressEnd() {
    if (longPress.current.timer) clearTimeout(longPress.current.timer)
    longPress.current.timer = null
  }

  async function doRename() {
    if (modal?.type !== 'rename') return
    const name = nameInput.trim()
    if (!name) return
    const res = await fetch(`/api/private/files/${modal.file.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }),
    })
    if (res.ok) {
      const updated: PFile = await res.json()
      setFiles(prev => prev.map(x => (x.id === updated.id ? updated : x)))
      toast('Umbenannt')
    } else toast('Umbenennen fehlgeschlagen')
    setModal(null)
  }

  async function doMove() {
    if (modal?.type !== 'move') return
    const folderId = moveTarget ? Number(moveTarget) : null
    const res = await fetch('/api/private/files/bulk', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'move', ids: modal.ids, folder_id: folderId }),
    })
    if (res.ok) {
      setFiles(prev => prev.map(x => (modal.ids.includes(x.id) ? { ...x, folder_id: folderId } : x)))
      const target = folderId ? folders.find(f => f.id === folderId)?.name : 'Ohne Ordner'
      toast(`${modal.ids.length === 1 ? 'Datei' : `${modal.ids.length} Dateien`} verschoben nach: ${target}`)
      load()
    } else toast('Verschieben fehlgeschlagen')
    setModal(null)
    exitSelect()
  }

  async function doDelete() {
    if (modal?.type !== 'delete') return
    const ids = modal.ids
    const res = await fetch('/api/private/files/bulk', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'delete', ids }),
    })
    if (res.ok) {
      setFiles(prev => prev.filter(x => !ids.includes(x.id)))
      toast(ids.length === 1 ? 'Gelöscht' : `${ids.length} Dateien gelöscht`)
      // Offene Ansicht anpassen
      if (viewerIndex !== null) {
        const remaining = visible.filter(x => !ids.includes(x.id))
        if (!remaining.length) setViewerIndex(null)
        else setViewerIndex(Math.min(viewerIndex, remaining.length - 1))
      }
      load()
      refreshStamp()
    } else toast('Löschen fehlgeschlagen')
    setModal(null)
    exitSelect()
  }

  async function errorText(res: Response) {
    const data = await res.json().catch(() => ({}))
    return data.error || `Fehler ${res.status}`
  }

  async function saveFolder() {
    const name = nameInput.trim()
    if (!name) return
    if (modal?.type === 'folder-new') {
      const res = await fetch('/api/private/files/folders', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }),
      })
      if (!res.ok) { toast(`Ordner anlegen fehlgeschlagen: ${await errorText(res)}`, { ms: 6000 }); return }
      const f: PFolder = await res.json()
      setFolders(prev => [...prev, f].sort((a, b) => a.name.localeCompare(b.name, 'de')))
      setFolder(f.id)
      toast(`Ordner "${f.name}" erstellt – neue Uploads landen dort`)
    } else if (modal?.type === 'folder-edit') {
      const res = await fetch(`/api/private/files/folders/${modal.folder.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }),
      })
      if (!res.ok) { toast(`Umbenennen fehlgeschlagen: ${await errorText(res)}`, { ms: 6000 }); return }
      setFolders(prev => prev.map(f => (f.id === modal.folder.id ? { ...f, name } : f)))
      toast('Ordner umbenannt')
    }
    setModal(null)
  }

  async function deleteFolder(f: PFolder) {
    // Zweistufig im Dialog statt Browser-Popup (confirm() wird von manchen Handys/Browsern blockiert)
    if (!deleteArmed) { setDeleteArmed(true); return }
    const res = await fetch(`/api/private/files/folders/${f.id}`, { method: 'DELETE' })
    if (!res.ok) { toast(`Löschen fehlgeschlagen: ${await errorText(res)}`, { ms: 6000 }); return }
    toast(`Ordner "${f.name}" gelöscht – die Dateien bleiben erhalten`)
    setFolder('all')
    setModal(null)
    load()
  }

  function openModal(m: Modal, initialName = '') {
    setNameInput(initialName)
    setDeleteArmed(false)
    if (m?.type === 'move') {
      const first = files.find(f => f.id === m.ids[0])
      setMoveTarget(first?.folder_id ? String(first.folder_id) : '')
    }
    setModal(m)
  }

  /* ── Darstellung ── */
  const folderName = folder === 'all' ? null : folder === 'none' ? 'Ohne Ordner' : folders.find(f => f.id === folder)?.name
  const totalSize = files.reduce((s, f) => s + f.size_bytes, 0)

  const renderFile = (f: PFile) => {
    const sel = selected.has(f.id)
    return (
      <div
        key={f.id}
        className={`pv-file ${sel ? 'selected' : ''}`}
        onClick={() => onFileClick(f)}
        onPointerDown={e => { if (e.pointerType === 'touch') onPressStart(f) }}
        onPointerUp={onPressEnd}
        onPointerLeave={onPressEnd}
        onPointerCancel={onPressEnd}
        onContextMenu={e => { if (isPhone) e.preventDefault() }}
        role="button"
        tabIndex={0}
        onKeyDown={e => { if (e.key === 'Enter') onFileClick(f) }}
        aria-label={f.original_name}
      >
        {isNew(f) && <span className="pv-badge new">Neu</span>}
        {selecting && <span className="pv-check">{sel && <Icon name="check" size={15} stroke={2.6} />}</span>}
        <div className="pv-file-thumb">
          {f.has_thumb ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={thumbUrl(f.id)} alt="" loading="lazy" decoding="async" draggable={false} />
          ) : f.kind === 'video' && view === 'grid' ? (
            <>
              <video src={`${fileUrl(f.id, true)}#t=0.5`} preload="metadata" muted playsInline />
              <span className="pv-file-play"><span><Icon name="play" size={16} /></span></span>
            </>
          ) : (
            <Icon name={KIND_ICON[f.kind]} size={view === 'grid' ? 38 : 24} stroke={1.4} />
          )}
          {!f.has_thumb && f.kind !== 'video' && extOf(f.original_name) && (
            <span className="pv-file-ext">{extOf(f.original_name)}</span>
          )}
        </div>
        <div className="pv-file-info">
          <div className="pv-file-name pv-ellipsis">{f.original_name}</div>
          <div className="pv-file-sub pv-ellipsis">
            {formatBytes(f.size_bytes)} · {formatWhen(f.created_at)}
            {f.source_device ? ` · ${f.source_device}` : ''}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="pv-page">
      {/* Kopf */}
      <div className="pv-page-head">
        <div>
          <p className="pv-eyebrow">Handy · PC · Ablage</p>
          <h1 className="pv-title pv-desktop-only">Quick Share</h1>
          <p className="pv-subtitle">
            {files.length} {files.length === 1 ? 'Datei' : 'Dateien'} · {formatBytes(totalSize)}
            {storage?.free != null && ` · ${formatBytes(storage.free)} frei auf dem Server`}
          </p>
        </div>
        <div className="pv-row">
          {unseenHere.length > 0 && (
            <button className="pv-btn sm" onClick={markAllSeen}>
              <Icon name="check" size={15} /> {unseenHere.length} als gesehen
            </button>
          )}
          <span className="pv-badge ok" title="Neue Dateien erscheinen automatisch">
            <Icon name="wifi" size={13} /> Live
          </span>
        </div>
      </div>

      {/* Senden */}
      <section className="pv-drop">
        <div className="pv-drop-icon"><Icon name="upload" size={28} /></div>
        <div className="pv-grow pv-drop-text">
          <div className="pv-h2">Dateien senden</div>
          <div className="pv-muted" style={{ fontSize: 14 }}>
            Hierher ziehen, mit Strg+V einfügen oder auswählen – jede Größe, jeder Dateityp.
            {folderName && typeof folder === 'number' && <> Ziel: <b>{folderName}</b></>}
          </div>
        </div>
        <div className="pv-drop-actions">
          <button className="pv-btn primary lg" onClick={() => pick(mediaInput.current)}>
            <Icon name="image" /> Fotos & Videos
          </button>
          <button className="pv-btn lg" onClick={() => pick(anyInput.current)}>
            <Icon name="file" /> Dateien
          </button>
          {isPhone && (
            <button className="pv-btn lg span" onClick={() => pick(cameraInput.current)}>
              <Icon name="camera" /> Foto aufnehmen
            </button>
          )}
        </div>
        <input ref={mediaInput} type="file" accept="image/*,video/*" multiple hidden onChange={onPicked} />
        <input ref={anyInput} type="file" multiple hidden onChange={onPicked} />
        <input ref={cameraInput} type="file" accept="image/*" capture="environment" hidden onChange={onPicked} />
      </section>

      {/* Ordner */}
      <div className="pv-chips" role="tablist" aria-label="Ordner">
        <button className={`pv-chip ${folder === 'all' ? 'active' : ''}`} onClick={() => setFolder('all')}>
          Alle Dateien <span className="count">{files.length}</span>
        </button>
        <button className={`pv-chip ${folder === 'none' ? 'active' : ''}`} onClick={() => setFolder('none')}>
          Ohne Ordner
        </button>
        {folders.map(f => (
          <span key={f.id} style={{ display: 'inline-flex', gap: 4, flexShrink: 0 }}>
            <button className={`pv-chip ${folder === f.id ? 'active' : ''}`} onClick={() => setFolder(f.id)}>
              <Icon name="folder" size={15} /> {f.name} <span className="count">{files.filter(x => x.folder_id === f.id).length}</span>
            </button>
            {folder === f.id && (
              <button className="pv-chip" aria-label={`Ordner ${f.name} bearbeiten`} title="Umbenennen oder löschen" onClick={() => openModal({ type: 'folder-edit', folder: f }, f.name)}>
                <Icon name="pencil" size={14} /> Bearbeiten
              </button>
            )}
          </span>
        ))}
        <button className="pv-chip" onClick={() => openModal({ type: 'folder-new' })}>
          <Icon name="folderPlus" size={15} /> Ordner
        </button>
      </div>

      {/* Werkzeuge */}
      <div className="pv-toolbar">
        <label className="pv-search">
          <Icon name="search" size={17} />
          <input className="pv-input" type="search" placeholder="Dateien durchsuchen" value={search} onChange={e => setSearch(e.target.value)} />
        </label>
        <select
          className="pv-input"
          style={{ width: 'auto', minWidth: 140, flex: isPhone ? 1 : undefined }}
          value={sort}
          onChange={e => { setSort(e.target.value as SortKey); writePref('pv-files-sort', e.target.value) }}
          aria-label="Sortieren"
        >
          <option value="new">Neueste zuerst</option>
          <option value="old">Älteste zuerst</option>
          <option value="name">Name A–Z</option>
          <option value="size">Größte zuerst</option>
        </select>
        <div className="pv-seg">
          <button className={view === 'grid' ? 'active' : ''} aria-label="Raster" onClick={() => { setView('grid'); writePref('pv-files-view', 'grid') }}>
            <Icon name="grid" size={17} />
          </button>
          <button className={view === 'list' ? 'active' : ''} aria-label="Liste" onClick={() => { setView('list'); writePref('pv-files-view', 'list') }}>
            <Icon name="list" size={17} />
          </button>
        </div>
        <button className={`pv-icon-btn ${selecting ? 'active' : ''}`} aria-label="Auswählen" onClick={() => (selecting ? exitSelect() : setSelecting(true))}>
          <Icon name="select" size={19} />
        </button>
      </div>

      <div className="pv-chips">
        {KINDS.filter(k => k === 'all' || kindCounts[k]).map(k => (
          <button key={k} className={`pv-chip ${kind === k ? 'active' : ''}`} onClick={() => setKind(k)}>
            {k !== 'all' && <Icon name={KIND_ICON[k as FileKind]} size={15} />}
            {KIND_LABEL[k]} <span className="count">{kindCounts[k] ?? 0}</span>
          </button>
        ))}
      </div>

      {/* Dateien */}
      {loading ? (
        <div className="pv-center"><div className="pv-spinner" /></div>
      ) : loadError ? (
        <div className="pv-glass pv-empty">
          Dateien konnten nicht geladen werden.
          <div style={{ marginTop: 12 }}><button className="pv-btn" onClick={load}><Icon name="refresh" size={16} /> Erneut versuchen</button></div>
        </div>
      ) : visible.length === 0 ? (
        <div className="pv-glass pv-empty">
          <Icon name={search ? 'search' : 'share'} size={40} stroke={1.3} />
          <div style={{ fontWeight: 600, color: 'var(--pv-ink)' }}>
            {search ? 'Nichts gefunden' : files.length ? 'Hier ist noch nichts' : 'Noch keine Dateien'}
          </div>
          <div style={{ marginTop: 4 }}>
            {files.length ? 'Anderen Ordner oder Filter wählen.' : 'Öffne diese Seite am Handy und tippe auf "Fotos & Videos" – sie erscheinen hier sofort am PC.'}
          </div>
        </div>
      ) : (
        groups.map(g => (
          <section key={g.label || 'all'} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {g.label && <p className="pv-eyebrow" style={{ marginTop: 4 }}>{g.label} · {g.items.length}</p>}
            <div className={`pv-grid ${view === 'list' ? 'list' : ''}`}>{g.items.map(renderFile)}</div>
          </section>
        ))
      )}

      {/* Auswahl-Leiste */}
      {selecting && (
        <div className="pv-bulk pv-glass strong">
          <span style={{ fontWeight: 600, fontSize: 14, marginRight: 'auto' }}>{selected.size} ausgewählt</span>
          <button className="pv-btn sm" onClick={() => setSelected(selected.size === visible.length ? new Set() : new Set(visible.map(f => f.id)))}>
            {selected.size === visible.length ? 'Keine' : 'Alle'}
          </button>
          <button className="pv-btn sm" disabled={!selected.size} onClick={() => downloadMany([...selected])}>
            <Icon name="download" size={15} /> Laden
          </button>
          <button className="pv-btn sm" disabled={!selected.size} onClick={() => openModal({ type: 'move', ids: [...selected] })}>
            <Icon name="move" size={15} /> Verschieben
          </button>
          <button className="pv-btn sm danger" disabled={!selected.size} onClick={() => openModal({ type: 'delete', ids: [...selected] })}>
            <Icon name="trash" size={15} /> Löschen
          </button>
          <button className="pv-icon-btn ghost" aria-label="Auswahl beenden" onClick={exitSelect}><Icon name="x" size={18} /></button>
        </div>
      )}

      {/* Ansicht */}
      {viewerIndex !== null && visible[viewerIndex] && (
        <FileViewer
          files={visible}
          index={viewerIndex}
          onIndex={setViewerIndex}
          onClose={() => setViewerIndex(null)}
          onDownload={download}
          onRename={f => openModal({ type: 'rename', file: f }, f.original_name)}
          onMove={f => openModal({ type: 'move', ids: [f.id] })}
          onDelete={f => openModal({ type: 'delete', ids: [f.id] })}
          onShown={markSeen}
          toast={t => toast(t)}
        />
      )}

      {/* Dialoge */}
      {modal && (
        <Portal>
          <div className="pv-overlay sheet" onClick={e => { if (e.target === e.currentTarget) setModal(null) }}>
            <div className="pv-modal">
              <div className="pv-grip" />
  
              {modal.type === 'rename' && (
                <>
                  <div className="pv-h2">Umbenennen</div>
                  <input className="pv-input" value={nameInput} onChange={e => setNameInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') doRename() }} autoFocus />
                  <div className="pv-modal-actions">
                    <button className="pv-btn" onClick={() => setModal(null)}>Abbrechen</button>
                    <button className="pv-btn primary" onClick={doRename} disabled={!nameInput.trim()}>Speichern</button>
                  </div>
                </>
              )}
  
              {modal.type === 'move' && (
                <>
                  <div className="pv-h2">{modal.ids.length === 1 ? 'Datei verschieben' : `${modal.ids.length} Dateien verschieben`}</div>
                  <div>
                    <label className="pv-label">Ordner</label>
                    <select className="pv-input" value={moveTarget} onChange={e => setMoveTarget(e.target.value)}>
                      <option value="">Ohne Ordner</option>
                      {folders.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                    </select>
                  </div>
                  <div className="pv-modal-actions">
                    <button className="pv-btn" onClick={() => setModal(null)}>Abbrechen</button>
                    <button className="pv-btn primary" onClick={doMove}>Verschieben</button>
                  </div>
                </>
              )}
  
              {modal.type === 'delete' && (
                <>
                  <div className="pv-h2">{modal.ids.length === 1 ? 'Datei löschen?' : `${modal.ids.length} Dateien löschen?`}</div>
                  <p className="pv-muted" style={{ margin: 0, fontSize: 14 }}>
                    {modal.ids.length === 1 ? `"${files.find(f => f.id === modal.ids[0])?.original_name}"` : 'Die ausgewählten Dateien'} werden
                    endgültig vom Server entfernt – auf allen Geräten.
                  </p>
                  <div className="pv-modal-actions">
                    <button className="pv-btn" onClick={() => setModal(null)}>Abbrechen</button>
                    <button className="pv-btn primary" style={{ background: 'var(--pv-danger)' }} onClick={doDelete}>Löschen</button>
                  </div>
                </>
              )}
  
              {(modal.type === 'folder-new' || modal.type === 'folder-edit') && (
                <>
                  <div className="pv-h2">{modal.type === 'folder-new' ? 'Neuer Ordner' : 'Ordner bearbeiten'}</div>
                  <input className="pv-input" placeholder="z.B. Urlaub, Screenshots, Dokumente" value={nameInput} onChange={e => setNameInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') saveFolder() }} autoFocus />
                  <div className="pv-modal-actions">
                    {modal.type === 'folder-edit' && (
                      <button
                        className="pv-btn danger"
                        style={{ marginRight: 'auto', ...(deleteArmed ? { background: 'var(--pv-danger)', color: '#fff' } : {}) }}
                        onClick={() => deleteFolder(modal.folder)}
                      >
                        <Icon name="trash" size={16} /> {deleteArmed ? 'Wirklich löschen?' : 'Löschen'}
                      </button>
                    )}
                    <button className="pv-btn" onClick={() => setModal(null)}>Abbrechen</button>
                    <button className="pv-btn primary" onClick={saveFolder} disabled={!nameInput.trim()}>Speichern</button>
                  </div>
                </>
              )}
            </div>
          </div>
        </Portal>
      )}
    </div>
  )
}