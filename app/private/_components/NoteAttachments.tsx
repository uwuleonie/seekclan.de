'use client'

// Darstellung von Notiz-Anhängen (Dateien aus Quick Share).
//
// Aufteilung:
//  - NoteMediaColumn: Bilder, PDFs und Videos oben rechts neben dem Text.
//    PDFs zeigen alle Seiten untereinander, der Text fließt links daran vorbei.
//  - NoteFileCards:   alle anderen Dateien (Audio, Word, ZIP, JAR …) als Karten unter dem Text.
//    Audio lässt sich direkt abspielen, Textdateien zeigen eine kurze Vorschau.
//  - NoteAttachStrip: kompakte Leiste im Bearbeiten-Modus (Reihenfolge ändern, entfernen).

import { useEffect, useState } from 'react'
import Icon from './Icon'
import PdfPages from './PdfPages'
import { KIND_ICON, extOf, formatBytes, isSideMedia, type FileUrls, type PFile } from '../_lib/files'

type Att = PFile & { attachment_id?: number }

const TEXT_EXT = ['TXT', 'MD', 'CSV', 'JSON', 'LOG', 'XML', 'YML', 'YAML', 'PROPERTIES', 'CFG', 'INI']
const isTextFile = (f: PFile) => f.mime_type.startsWith('text/') || TEXT_EXT.includes(extOf(f.original_name))

export function NoteMediaColumn({
  items, urls, onOpen,
}: { items: Att[]; urls: FileUrls; onOpen: (f: Att) => void }) {
  const media = items.filter(isSideMedia)
  if (!media.length) return null
  return (
    <aside className="pv-note-media" aria-label="Bilder und PDFs">
      {media.map(f => (
        <figure key={f.attachment_id ?? f.id} className="pv-note-media-item">
          {f.kind === 'image' && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={urls.file(f.id, true)}
              alt={f.original_name}
              loading="lazy"
              onClick={() => onOpen(f)}
              onError={e => { if (f.has_thumb) (e.currentTarget as HTMLImageElement).src = urls.thumb(f.id) }}
            />
          )}
          {f.kind === 'video' && (
            <video src={urls.file(f.id, true)} controls playsInline preload="metadata" />
          )}
          {f.kind === 'pdf' && <PdfPages url={urls.file(f.id, true)} onPageClick={() => onOpen(f)} />}
          <figcaption>
            <span className="pv-ellipsis">{f.original_name}</span>
            <a href={urls.file(f.id)} download={f.original_name} aria-label={`${f.original_name} herunterladen`} onClick={e => e.stopPropagation()}>
              <Icon name="download" size={14} />
            </a>
          </figcaption>
        </figure>
      ))}
    </aside>
  )
}

export function NoteFileCards({
  items, urls, onOpen,
}: { items: Att[]; urls: FileUrls; onOpen: (f: Att) => void }) {
  const others = items.filter(f => !isSideMedia(f))
  if (!others.length) return null
  return (
    <section className="pv-note-files" aria-label="Weitere Anhänge">
      <p className="pv-eyebrow">Anhänge · {others.length}</p>
      <div className="pv-note-files-grid">
        {others.map(f => <FileCard key={f.attachment_id ?? f.id} f={f} urls={urls} onOpen={onOpen} />)}
      </div>
    </section>
  )
}

function FileCard({ f, urls, onOpen }: { f: Att; urls: FileUrls; onOpen: (f: Att) => void }) {
  const [preview, setPreview] = useState<string | null>(null)

  // Kleine Textvorschau (erste Zeilen) für .txt, .md, .csv, .json, .log, Konfigs …
  useEffect(() => {
    if (!isTextFile(f) || f.size_bytes > 512 * 1024) return
    let cancelled = false
    fetch(urls.file(f.id))
      .then(r => (r.ok ? r.text() : ''))
      .then(t => { if (!cancelled && t) setPreview(t.split('\n').slice(0, 6).join('\n').slice(0, 400)) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [f, urls])

  return (
    <div className="pv-note-file">
      <button className="pv-note-file-main" onClick={() => onOpen(f)}>
        <span className="pv-tile-icon" style={{ width: 42, height: 42, borderRadius: 12 }}>
          <Icon name={KIND_ICON[f.kind]} size={20} />
        </span>
        <span className="pv-grow" style={{ minWidth: 0, textAlign: 'left' }}>
          <b className="pv-ellipsis" style={{ display: 'block', fontSize: 14 }}>{f.original_name}</b>
          <span className="pv-muted" style={{ fontSize: 12 }}>{extOf(f.original_name) || 'Datei'} · {formatBytes(f.size_bytes)}</span>
        </span>
      </button>
      <a className="pv-icon-btn ghost" href={urls.file(f.id)} download={f.original_name} aria-label={`${f.original_name} herunterladen`}>
        <Icon name="download" size={18} />
      </a>
      {f.kind === 'audio' && <audio src={urls.file(f.id, true)} controls preload="none" className="pv-note-file-audio" />}
      {preview && <pre className="pv-note-file-preview">{preview}</pre>}
    </div>
  )
}

/** Bearbeiten-Modus: alle Anhänge als kleine Leiste mit Pfeilen (Reihenfolge) und Entfernen */
export function NoteAttachStrip({
  items, urls, onRemove, onMove, onAdd,
}: {
  items: (PFile & { attachment_id: number })[]
  urls: FileUrls
  onRemove: (attachmentId: number) => void
  onMove: (attachmentId: number, dir: -1 | 1) => void
  onAdd: () => void
}) {
  return (
    <div className="pv-attach-strip">
      {items.map((f, i) => (
        <div key={f.attachment_id} className="pv-attach-chip" title={f.original_name}>
          <span className="pv-attach-thumb">
            {f.has_thumb
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={urls.thumb(f.id)} alt="" />
              : <Icon name={KIND_ICON[f.kind]} size={16} />}
          </span>
          <span className="pv-ellipsis" style={{ maxWidth: 130 }}>{f.original_name}</span>
          {items.length > 1 && (
            <>
              <button aria-label="Nach vorne" disabled={i === 0} onClick={() => onMove(f.attachment_id, -1)}><Icon name="back" size={13} /></button>
              <button aria-label="Nach hinten" disabled={i === items.length - 1} onClick={() => onMove(f.attachment_id, 1)}><Icon name="next" size={13} /></button>
            </>
          )}
          <button aria-label={`${f.original_name} aus Notiz entfernen`} onClick={() => onRemove(f.attachment_id)}><Icon name="x" size={13} /></button>
        </div>
      ))}
      <button className="pv-attach-chip add" onClick={onAdd}><Icon name="plus" size={14} /> Datei anhängen</button>
    </div>
  )
}