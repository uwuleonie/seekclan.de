'use client'

// Vollbild-Ansicht für eine Datei aus Quick Share (Bilder, Videos, Audio, PDF, Text).
// PC: Pfeiltasten + Esc · Handy: nach links/rechts wischen

import { useEffect, useRef, useState } from 'react'
import Icon from './Icon'
import Portal from './Portal'
import {
  KIND_ICON, SHARE_MAX_BYTES, canShareFiles, extOf, formatBytes, formatWhen, privateUrls, type FileUrls, type PFile,
} from '../_lib/files'

/** Zusätzliche Menüpunkte (z.B. "Zu Notiz hinzufügen", "Aus Notiz entfernen") */
export interface ViewerAction {
  label: string
  icon: string
  danger?: boolean
  onClick: (f: PFile) => void
}

/**
 * Vorschau hat nicht geklappt → beim Server nachfragen, woran es liegt,
 * damit statt "nicht möglich" ein echter Grund dasteht.
 */
async function diagnose(url: string): Promise<string> {
  try {
    const res = await fetch(url, { headers: { Range: 'bytes=0-15' }, cache: 'no-store' })
    if (res.status === 401 || res.status === 403) return 'Keine Berechtigung – bitte neu einloggen'
    if (res.status === 404) {
      const data = await res.json().catch(() => null)
      return data?.code === 'FILE_MISSING' ? 'Datei fehlt auf dem Server-Speicher' : 'Datei nicht gefunden'
    }
    if (!res.ok) return `Server-Fehler ${res.status}`
    const bytes = new Uint8Array(await res.arrayBuffer())
    if (!bytes.length || bytes.every(b => b === 0)) return 'Datei ist leer oder beschädigt'
    const type = res.headers.get('content-type') || 'unbekannt'
    return `Dein Browser kann dieses Format nicht anzeigen (${type})`
  } catch {
    return 'Server nicht erreichbar'
  }
}

const TEXT_EXT = ['TXT', 'MD', 'CSV', 'JSON', 'LOG', 'XML', 'YML', 'YAML', 'PROPERTIES', 'CFG', 'INI']

export default function FileViewer({
  files, index, onIndex, onClose, onDownload, onRename, onMove, onDelete, onShown, toast, actions = [], urls = privateUrls,
}: {
  files: PFile[]
  index: number
  onIndex: (i: number) => void
  onClose: () => void
  onDownload: (f: PFile) => void
  onRename?: (f: PFile) => void
  onMove?: (f: PFile) => void
  onDelete?: (f: PFile) => void
  onShown?: (f: PFile) => void
  toast: (t: string) => void
  actions?: ViewerAction[]
  /** Woher die Datei geladen wird (privat oder über geteilten Link) */
  urls?: FileUrls
}) {
  const fileUrl = urls.file
  const thumbUrl = urls.thumb
  const file = files[index]
  const [failed, setFailed] = useState(false)
  const [failReason, setFailReason] = useState<string | null>(null)
  const [text, setText] = useState<string | null>(null)
  const [sharing, setSharing] = useState(false)
  const [menu, setMenu] = useState(false)
  const touch = useRef<{ x: number; y: number } | null>(null)
  const shareable = canShareFiles()

  const ext = file ? extOf(file.original_name) : ''
  const isText = !!file && (file.mime_type.startsWith('text/') || TEXT_EXT.includes(ext))

  useEffect(() => {
    setFailed(false)
    setFailReason(null)
    setText(null)
    setMenu(false)
    if (!file) return
    onShown?.(file)
    if (isText && file.size_bytes <= 2 * 1024 * 1024) {
      fetch(fileUrl(file.id)).then(r => r.text()).then(setText).catch(() => setFailed(true))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file?.id])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowRight' && index < files.length - 1) onIndex(index + 1)
      if (e.key === 'ArrowLeft' && index > 0) onIndex(index - 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [index, files.length, onClose, onIndex])

  // Bei einem Fehler den Grund herausfinden (nur einmal pro Datei)
  useEffect(() => {
    if (!failed || !file || failReason) return
    let cancelled = false
    diagnose(fileUrl(file.id, true)).then(r => { if (!cancelled) setFailReason(r) })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [failed, file?.id])

  if (!file) return null

  async function shareToDevice() {
    if (!file) return
    setSharing(true)
    try {
      const blob = await (await fetch(fileUrl(file.id))).blob()
      const f = new File([blob], file.original_name, { type: file.mime_type })
      await navigator.share({ files: [f] })
    } catch (err) {
      if ((err as Error)?.name !== 'AbortError') toast('Teilen nicht möglich – bitte Herunterladen nutzen')
    } finally {
      setSharing(false)
    }
  }

  const canShowImage = file.kind === 'image' && !failed
  const stage = (() => {
    if (canShowImage) {
      return (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={file.id}
          src={fileUrl(file.id, true)}
          alt={file.original_name}
          onError={() => setFailed(true)}
          style={file.has_thumb ? { background: `center / contain no-repeat url(${thumbUrl(file.id)})` } : undefined}
        />
      )
    }
    if (file.kind === 'image' && failed && file.has_thumb) {
      // z.B. HEIC in Chrome: Original kann der Browser nicht anzeigen → Vorschaubild zeigen
      // eslint-disable-next-line @next/next/no-img-element
      return <img key={`t${file.id}`} src={thumbUrl(file.id)} alt={file.original_name} />
    }
    if (file.kind === 'video' && !failed) {
      return <video key={file.id} src={fileUrl(file.id, true)} controls playsInline autoPlay preload="metadata" onError={() => setFailed(true)} />
    }
    if (file.kind === 'audio' && !failed) {
      return (
        <div className="pv-viewer-generic">
          <Icon name="audio" size={46} />
          <audio key={file.id} src={fileUrl(file.id, true)} controls autoPlay onError={() => setFailed(true)} style={{ width: 'min(420px, 80vw)' }} />
        </div>
      )
    }
    if (file.kind === 'pdf') {
      return <iframe key={file.id} src={fileUrl(file.id, true)} title={file.original_name} />
    }
    if (isText && text !== null) return <pre>{text}</pre>
    return (
      <div className="pv-viewer-generic">
        <Icon name={KIND_ICON[file.kind]} size={52} stroke={1.4} />
        <div>
          <div style={{ fontWeight: 600, fontSize: 17, wordBreak: 'break-word' }}>{file.original_name}</div>
          <div style={{ opacity: 0.65, fontSize: 13, marginTop: 4 }}>
            {ext || 'Datei'} · {formatBytes(file.size_bytes)}
            {failed && ' · Vorschau nicht möglich'}
          </div>
          {failed && (
            <div style={{ opacity: 0.8, fontSize: 13, marginTop: 6 }}>
              {failReason ?? 'Grund wird geprüft …'}
            </div>
          )}
        </div>
        <button className="pv-btn primary" onClick={() => onDownload(file)}>
          <Icon name="download" size={18} /> Herunterladen
        </button>
      </div>
    )
  })()

  return (
    <Portal>
      <div className="pv-viewer" role="dialog" aria-modal="true" aria-label={file.original_name}>
        <div className="pv-viewer-bar">
          <button className="pv-icon-btn" aria-label="Schließen" onClick={onClose}><Icon name="x" /></button>
          <div className="pv-viewer-title">
            <div className="pv-ellipsis">{file.original_name}</div>
            <div className="pv-ellipsis">
              {formatBytes(file.size_bytes)} · {formatWhen(file.created_at)}
              {file.source_device ? ` · vom ${file.source_device}` : ''}
              {file.width && file.height ? ` · ${file.width} × ${file.height}` : ''}
            </div>
          </div>
          <span style={{ fontSize: 12, opacity: 0.6 }}>{index + 1} / {files.length}</span>
        </div>

        <div
          className="pv-viewer-stage"
          onClick={e => { if (e.target === e.currentTarget) onClose() }}
          onTouchStart={e => { touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY } }}
          onTouchEnd={e => {
            const start = touch.current
            touch.current = null
            if (!start || e.changedTouches.length !== 1) return
            const dx = e.changedTouches[0].clientX - start.x
            const dy = e.changedTouches[0].clientY - start.y
            if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.5) return
            if (dx < 0 && index < files.length - 1) onIndex(index + 1)
            if (dx > 0 && index > 0) onIndex(index - 1)
          }}
        >
          {index > 0 && (
            <button className="pv-viewer-nav prev" aria-label="Vorherige" onClick={() => onIndex(index - 1)}><Icon name="back" /></button>
          )}
          {stage}
          {index < files.length - 1 && (
            <button className="pv-viewer-nav next" aria-label="Nächste" onClick={() => onIndex(index + 1)}><Icon name="next" /></button>
          )}
        </div>

        <div className="pv-viewer-foot">
          <button className="pv-btn primary" onClick={() => onDownload(file)}>
            <Icon name="download" size={18} /> Herunterladen
          </button>
          {shareable && (file.kind === 'image' || file.kind === 'video') && file.size_bytes <= SHARE_MAX_BYTES && (
            <button className="pv-btn" onClick={shareToDevice} disabled={sharing}>
              <Icon name="save" size={18} /> {sharing ? 'Lädt …' : 'Sichern'}
            </button>
          )}
          <button className="pv-btn" onClick={() => setMenu(true)}>
            <Icon name="more" size={18} /> Mehr
          </button>
        </div>

        {menu && (
          <div className="pv-overlay sheet" onClick={e => { if (e.target === e.currentTarget) setMenu(false) }}>
            <div className="pv-modal" style={{ width: 360 }}>
              <div className="pv-grip" />
              <div className="pv-ellipsis" style={{ fontWeight: 600 }}>{file.original_name}</div>
              {actions.map(a => (
                <button key={a.label} className={`pv-menu-item ${a.danger ? 'danger' : ''}`} onClick={() => { setMenu(false); a.onClick(file) }}>
                  <Icon name={a.icon} /> {a.label}
                </button>
              ))}
              {onRename && (
                <button className="pv-menu-item" onClick={() => { setMenu(false); onRename(file) }}><Icon name="pencil" /> Umbenennen</button>
              )}
              {onMove && (
                <button className="pv-menu-item" onClick={() => { setMenu(false); onMove(file) }}><Icon name="move" /> In Ordner verschieben</button>
              )}
              <a className="pv-menu-item" href={fileUrl(file.id, true)} target="_blank" rel="noopener noreferrer" onClick={() => setMenu(false)}>
                <Icon name="eye" /> In neuem Tab öffnen
              </a>
              {onDelete && (
                <>
                  <div className="pv-sep" />
                  <button className="pv-menu-item danger" onClick={() => { setMenu(false); onDelete(file) }}><Icon name="trash" /> Löschen</button>
                </>
              )}
              <button className="pv-btn" onClick={() => setMenu(false)}>Schließen</button>
            </div>
          </div>
        )}
      </div>
    </Portal>
  )
}