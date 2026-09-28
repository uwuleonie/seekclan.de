'use client'

// Auswahl-Dialog: Dateien aus Quick Share an eine Notiz hängen.
// Mehrfachauswahl, Suche, Filter nach Dateiart. Neue Dateien lassen sich direkt
// vom Gerät hochladen — sie erscheinen hier automatisch, sobald sie fertig sind.

import { useEffect, useMemo, useRef, useState } from 'react'
import Icon from './Icon'
import Portal from './Portal'
import { usePrivate } from './PrivateShell'
import FileThumb, { showsExtension } from './FileThumb'
import { KIND_LABEL, extOf, formatBytes, formatWhen, type FileKind, type PFile } from '../_lib/files'

const KINDS: (FileKind | 'all')[] = ['all', 'image', 'pdf', 'video', 'document', 'audio', 'archive', 'other']

export default function AttachPicker({
  excludeIds, onClose, onPick, title = 'Aus Quick Share anhängen',
  subtitle = 'Bilder & PDFs erscheinen oben rechts, alles andere als Karte darunter.', onlyKind, single = false, confirmLabel = 'anhängen',
}: {
  excludeIds: number[]
  onClose: () => void
  onPick: (ids: number[]) => Promise<void> | void
  title?: string
  subtitle?: string
  /** Nur diese Dateiart anzeigen (z.B. 'image' für die Bildbearbeitung) */
  onlyKind?: FileKind
  /** Nur eine Datei auswählbar */
  single?: boolean
  /** Text auf dem Bestätigen-Knopf, z.B. "öffnen" */
  confirmLabel?: string
}) {
  const { stamp, upload } = usePrivate()
  const [files, setFiles] = useState<PFile[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [kind, setKind] = useState<FileKind | 'all'>('all')
  const [selected, setSelected] = useState<number[]>([])
  const [busy, setBusy] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const knownIds = useRef<Set<number> | null>(null)
  const waitingForUpload = useRef(false)

  // Laden + bei jeder Änderung in Quick Share (z.B. gerade hochgeladen) aktualisieren
  useEffect(() => {
    fetch('/api/private/files', { cache: 'no-store' })
      .then(async r => {
        const d = await r.json().catch(() => ({}))
        if (!r.ok) throw new Error(d.error || `Fehler ${r.status}`)
        return d.files as PFile[]
      })
      .then(list => {
        // Direkt hier hochgeladene Dateien automatisch auswählen
        if (knownIds.current && waitingForUpload.current) {
          const fresh = list.filter(f => !knownIds.current!.has(f.id)).map(f => f.id)
          if (fresh.length) setSelected(s => (single ? [fresh[0]] : [...s, ...fresh.filter(id => !s.includes(id))]))
        }
        knownIds.current = new Set(list.map(f => f.id))
        setFiles(list)
        setError(null)
      })
      .catch(e => setError((e as Error).message))
  }, [stamp])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const available = useMemo(
    () => (files ?? []).filter(f => !excludeIds.includes(f.id) && (!onlyKind || f.kind === onlyKind)),
    [files, excludeIds, onlyKind]
  )
  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    return available.filter(f => (kind === 'all' || f.kind === kind) && (!q || f.original_name.toLowerCase().includes(q)))
  }, [available, kind, search])
  const counts = useMemo(() => {
    const c: Record<string, number> = { all: available.length }
    for (const f of available) c[f.kind] = (c[f.kind] ?? 0) + 1
    return c
  }, [available])

  const toggle = (id: number) => setSelected(s => (s.includes(id) ? s.filter(x => x !== id) : single ? [id] : [...s, id]))

  async function confirm() {
    if (!selected.length) return
    setBusy(true)
    try { await onPick(selected) } finally { setBusy(false) }
  }

  return (
    <Portal>
      <div className="pv-overlay sheet" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
        <div className="pv-modal pv-picker">
          <div className="pv-grip" />
          <div className="pv-row">
            <div className="pv-grow">
              <div className="pv-h2">{title}</div>
              {subtitle && <div className="pv-muted" style={{ fontSize: 13 }}>{subtitle}</div>}
            </div>
            <button className="pv-icon-btn ghost" aria-label="Schließen" onClick={onClose}><Icon name="x" /></button>
          </div>

          <div className="pv-row pv-wrap">
            <label className="pv-search pv-grow" style={{ minWidth: 180 }}>
              <Icon name="search" size={16} />
              <input className="pv-input" type="search" placeholder="Suchen" value={search} onChange={e => setSearch(e.target.value)} />
            </label>
            <button className="pv-btn" onClick={() => input.current?.click()}>
              <Icon name="upload" size={17} /> Vom Gerät
            </button>
            <input
              ref={input}
              type="file"
              multiple={!single}
              accept={onlyKind === 'image' ? 'image/*' : undefined}
              hidden
              onChange={e => {
                if (e.target.files?.length) { waitingForUpload.current = true; upload(e.target.files) }
                e.target.value = ''
              }}
            />
          </div>

          <div className="pv-chips">
            {!onlyKind && KINDS.filter(k => k === 'all' || counts[k]).map(k => (
              <button key={k} className={`pv-chip ${kind === k ? 'active' : ''}`} onClick={() => setKind(k)}>
                {KIND_LABEL[k]} <span className="count">{counts[k] ?? 0}</span>
              </button>
            ))}
          </div>

          <div className="pv-picker-grid">
            {error && <div className="pv-empty" style={{ gridColumn: '1 / -1', color: 'var(--pv-danger)' }}>{error}</div>}
            {!error && files === null && <div className="pv-center" style={{ gridColumn: '1 / -1' }}><div className="pv-spinner" /></div>}
            {!error && files !== null && visible.length === 0 && (
              <div className="pv-empty" style={{ gridColumn: '1 / -1' }}>
                {available.length ? 'Nichts gefunden' : 'Quick Share ist leer – lade oben etwas vom Gerät hoch.'}
              </div>
            )}
            {visible.map(f => {
              const n = selected.indexOf(f.id)
              return (
                <button key={f.id} className={`pv-picker-item ${n >= 0 ? 'selected' : ''}`} onClick={() => toggle(f.id)} title={f.original_name}>
                  <span className="pv-picker-thumb">
                    <FileThumb file={f} iconSize={28} />
                    {showsExtension(f) && <span className="pv-file-ext">{extOf(f.original_name)}</span>}
                    {n >= 0 && <span className="pv-picker-num">{n + 1}</span>}
                  </span>
                  <span className="pv-ellipsis" style={{ fontSize: 12.5, fontWeight: 500 }}>{f.original_name}</span>
                  <span className="pv-muted" style={{ fontSize: 11 }}>{formatBytes(f.size_bytes)} · {formatWhen(f.created_at)}</span>
                </button>
              )
            })}
          </div>

          <div className="pv-modal-actions">
            {selected.length > 0 && <button className="pv-btn ghost" onClick={() => setSelected([])}>Auswahl leeren</button>}
            <button className="pv-btn" onClick={onClose}>Abbrechen</button>
            <button className="pv-btn primary" disabled={!selected.length || busy} onClick={confirm}>
              <Icon name="plus" size={17} /> {selected.length && !single ? `${selected.length} ${confirmLabel}` : confirmLabel[0].toUpperCase() + confirmLabel.slice(1)}
            </button>
          </div>
        </div>
      </div>
    </Portal>
  )
}