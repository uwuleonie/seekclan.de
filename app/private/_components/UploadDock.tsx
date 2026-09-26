'use client'

// Schwebende Upload-Anzeige. Liegt in der Shell, damit Uploads weiterlaufen und sichtbar
// bleiben, auch wenn man währenddessen zu Notizen oder GeoGuessr wechselt.

import { useEffect, useState } from 'react'
import Icon from './Icon'
import type { UploadItem } from '../_lib/useUploader'
import { formatBytes, formatEta, formatSpeed } from '../_lib/files'

export default function UploadDock({
  items, totals, onCancel, onRetry, onClear,
}: {
  items: UploadItem[]
  totals: { size: number; sent: number; speed: number }
  onCancel: (key: string) => void
  onRetry: (key: string) => void
  onClear: () => void
}) {
  // Am Handy zunächst eingeklappt, damit die Anzeige nicht den halben Bildschirm verdeckt
  const [open, setOpen] = useState(() => typeof window === 'undefined' || window.innerWidth > 860)
  const running = items.filter(i => i.status === 'uploading' || i.status === 'queued').length
  const failed = items.filter(i => i.status === 'error').length
  const done = items.filter(i => i.status === 'done').length

  // Wenn alles fertig ist, nach kurzer Zeit automatisch aufräumen
  useEffect(() => {
    if (items.length && running === 0 && failed === 0) {
      const t = setTimeout(onClear, 6000)
      return () => clearTimeout(t)
    }
  }, [items.length, running, failed, onClear])

  if (!items.length) return null

  const pct = totals.size ? Math.min(100, (totals.sent / totals.size) * 100) : 100
  const eta = totals.speed > 0 ? (totals.size - totals.sent) / totals.speed : 0

  const headline = running
    ? `${running} ${running === 1 ? 'Datei wird' : 'Dateien werden'} gesendet`
    : failed
      ? `${failed} fehlgeschlagen`
      : `${done} ${done === 1 ? 'Datei' : 'Dateien'} gesendet`

  return (
    <div className="pv-dock pv-glass strong" role="region" aria-label="Uploads">
      <button className="pv-dock-head" onClick={() => setOpen(o => !o)} aria-expanded={open}>
        <span className={`pv-dock-icon ${running ? 'busy' : failed ? 'err' : 'ok'}`}>
          <Icon name={running ? 'upload' : failed ? 'info' : 'check'} size={18} />
        </span>
        <span className="pv-grow" style={{ textAlign: 'left' }}>
          <span style={{ display: 'block', fontWeight: 600, fontSize: 14 }}>{headline}</span>
          <span className="pv-muted" style={{ display: 'block', fontSize: 12 }}>
            {formatBytes(totals.sent)} von {formatBytes(totals.size)}
            {running > 0 && totals.speed > 0 && ` · ${formatSpeed(totals.speed)} · ${formatEta(eta)}`}
          </span>
        </span>
        <Icon name={open ? 'x' : 'more'} size={18} />
      </button>
      <div className={`pv-progress ${!running && !failed ? 'ok' : ''}`} style={{ margin: '0 14px' }}>
        <span style={{ width: `${pct}%` }} />
      </div>

      {open && (
        <div className="pv-dock-list">
          {items.map(i => {
            const p = i.size ? (i.sent / i.size) * 100 : i.status === 'done' ? 100 : 0
            return (
              <div key={i.key} className="pv-queue-item">
                <div className="pv-grow">
                  <div className="pv-ellipsis" style={{ fontSize: 13.5, fontWeight: 500 }}>{i.name}</div>
                  <div className={`pv-progress ${i.status === 'done' ? 'ok' : i.status === 'error' ? 'err' : ''}`} style={{ marginTop: 5, height: 4 }}>
                    <span style={{ width: `${i.status === 'done' ? 100 : p}%` }} />
                  </div>
                  <div className="pv-queue-meta">
                    {i.status === 'queued' && `Wartet · ${formatBytes(i.size)}`}
                    {i.status === 'uploading' && (i.error ?? `${Math.floor(p)} % · ${formatBytes(i.sent)} / ${formatBytes(i.size)}`)}
                    {i.status === 'done' && `Fertig · ${formatBytes(i.size)}`}
                    {i.status === 'error' && <span style={{ color: 'var(--pv-danger)' }}>{i.error}</span>}
                  </div>
                </div>
                {i.status === 'error' && (
                  <button className="pv-icon-btn ghost" aria-label="Erneut versuchen" onClick={() => onRetry(i.key)}>
                    <Icon name="refresh" size={17} />
                  </button>
                )}
                {i.status !== 'done' && (
                  <button className="pv-icon-btn ghost" aria-label="Abbrechen" onClick={() => onCancel(i.key)}>
                    <Icon name="x" size={17} />
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}