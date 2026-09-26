'use client'

// Upload-Motor für Quick Share.
// - Dateien werden in 8-MB-Teilstücken hochgeladen → kein Größenlimit, kein Proxy-Limit
// - Bei Fehlern (Funkloch, Tunnel, WLAN-Wechsel) wird automatisch an der letzten
//   bestätigten Stelle weitergemacht
// - Bildschirm bleibt während großer Uploads an (Wake Lock), damit das Handy nicht
//   einschläft und den Upload abbricht
// - Maximal 2 Dateien gleichzeitig, der Rest wartet in der Schlange

import { useCallback, useEffect, useRef, useState } from 'react'
import type { PFile } from './files'
import { getDeviceId, getDeviceLabel } from './device'

export type UploadStatus = 'queued' | 'uploading' | 'done' | 'error' | 'canceled'

export interface UploadItem {
  key: string
  name: string
  size: number
  sent: number
  status: UploadStatus
  error?: string
  speed: number // Bytes pro Sekunde (geglättet)
}

interface Job extends UploadItem {
  file: File
  folderId: number | null
  serverId?: number
  xhr?: XMLHttpRequest
  lastTick: number
  lastSent: number
}

const PARALLEL = 2
const MAX_ATTEMPTS = 8

class ChunkError extends Error {
  constructor(msg: string, public received?: number, public retryable = true) {
    super(msg)
  }
}

// Status kann sich während await von außen ändern (Abbrechen) → bewusst ohne TS-Eingrenzung prüfen
const isCanceled = (job: { status: UploadStatus }) => job.status === 'canceled'

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init)
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new ChunkError(data.error || `Fehler ${res.status}`, data.received, res.status >= 500 || res.status === 409)
  return data as T
}

export function useUploader(onFileReady: (file: PFile) => void) {
  const jobs = useRef<Map<string, Job>>(new Map())
  const [items, setItems] = useState<UploadItem[]>([])
  const renderTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const onReadyRef = useRef(onFileReady)
  const wakeLock = useRef<WakeLockSentinel | null>(null)
  useEffect(() => { onReadyRef.current = onFileReady }, [onFileReady])

  /* Anzeige gedrosselt aktualisieren (Fortschritt kommt sehr oft) */
  const render = useCallback((now = false) => {
    const flush = () => {
      renderTimer.current = null
      setItems(Array.from(jobs.current.values()).map(j => ({
        key: j.key, name: j.name, size: j.size, sent: j.sent, status: j.status, error: j.error, speed: j.speed,
      })))
    }
    if (now) {
      if (renderTimer.current) clearTimeout(renderTimer.current)
      flush()
    } else if (!renderTimer.current) {
      renderTimer.current = setTimeout(flush, 180)
    }
  }, [])

  const active = items.some(i => i.status === 'uploading' || i.status === 'queued')

  /* Bildschirm wach halten + Warnung beim Schließen, solange hochgeladen wird */
  useEffect(() => {
    if (!active) {
      wakeLock.current?.release().catch(() => {})
      wakeLock.current = null
      return
    }
    const request = async () => {
      try {
        if ('wakeLock' in navigator && !wakeLock.current) {
          wakeLock.current = await navigator.wakeLock.request('screen')
          wakeLock.current.addEventListener('release', () => { wakeLock.current = null })
        }
      } catch { /* nicht unterstützt oder abgelehnt */ }
    }
    request()
    const onVis = () => { if (document.visibilityState === 'visible') request() }
    const onUnload = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = '' }
    document.addEventListener('visibilitychange', onVis)
    window.addEventListener('beforeunload', onUnload)
    return () => {
      document.removeEventListener('visibilitychange', onVis)
      window.removeEventListener('beforeunload', onUnload)
    }
  }, [active])

  const putChunk = (job: Job, offset: number, blob: Blob) =>
    new Promise<number>((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      job.xhr = xhr
      xhr.open('PUT', `/api/private/files/${job.serverId}/chunk?offset=${offset}`)
      xhr.setRequestHeader('Content-Type', 'application/octet-stream')
      xhr.timeout = 5 * 60 * 1000
      xhr.upload.onprogress = e => {
        job.sent = offset + e.loaded
        const now = performance.now()
        const dt = (now - job.lastTick) / 1000
        if (dt >= 0.5) {
          const inst = (job.sent - job.lastSent) / dt
          job.speed = job.speed ? job.speed * 0.7 + inst * 0.3 : inst
          job.lastTick = now
          job.lastSent = job.sent
        }
        render()
      }
      xhr.onload = () => {
        let data: { received?: number; error?: string } = {}
        try { data = JSON.parse(xhr.responseText) } catch { /* leer */ }
        if (xhr.status === 200 && typeof data.received === 'number') resolve(data.received)
        else if (xhr.status === 409) reject(new ChunkError('Stand abgleichen', data.received))
        else reject(new ChunkError(data.error || `Fehler ${xhr.status}`, data.received, xhr.status >= 500 || xhr.status === 400))
      }
      xhr.onerror = () => reject(new ChunkError('Verbindung unterbrochen'))
      xhr.ontimeout = () => reject(new ChunkError('Zeitüberschreitung'))
      xhr.onabort = () => reject(new ChunkError('Abgebrochen', undefined, false))
      xhr.send(blob)
    })

  const run = useCallback(async (job: Job) => {
    job.status = 'uploading'
    job.error = undefined
    job.lastTick = performance.now()
    job.lastSent = job.sent
    render(true)

    try {
      let offset = 0
      if (!job.serverId) {
        const created = await api<{ id: number }>('/api/private/files', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: job.name,
            size: job.size,
            mime: job.file.type,
            folder_id: job.folderId,
            device_id: getDeviceId(),
            source_device: getDeviceLabel(),
          }),
        })
        job.serverId = created.id
      } else {
        // Fortsetzen: Server fragen, wie weit er ist
        const st = await api<{ received: number }>(`/api/private/files/${job.serverId}`)
        offset = st.received
      }

      const chunkSize = 8 * 1024 * 1024
      let attempts = 0
      while (offset < job.size) {
        if (isCanceled(job)) return
        const blob = job.file.slice(offset, Math.min(offset + chunkSize, job.size))
        try {
          offset = await putChunk(job, offset, blob)
          job.sent = offset
          attempts = 0
        } catch (err) {
          if (isCanceled(job)) return
          const e = err as ChunkError
          if (typeof e.received === 'number') { offset = e.received; job.sent = offset }
          if (!e.retryable || ++attempts > MAX_ATTEMPTS) throw e
          job.error = `${e.message} – neuer Versuch …`
          render(true)
          await sleep(Math.min(15000, 800 * 2 ** (attempts - 1)))
          // Nach Netzfehler Stand beim Server abfragen (vielleicht kam das Teilstück doch an)
          try {
            const st = await api<{ received: number }>(`/api/private/files/${job.serverId}`)
            offset = st.received
            job.sent = offset
          } catch { /* nächste Runde versucht es erneut */ }
          job.error = undefined
        }
      }

      const file = await api<PFile>(`/api/private/files/${job.serverId}/complete`, { method: 'POST' })
      job.status = 'done'
      job.sent = job.size
      render(true)
      onReadyRef.current(file)
    } catch (err) {
      if (isCanceled(job)) return
      job.status = 'error'
      job.error = (err as Error).message || 'Fehler'
      render(true)
    } finally {
      job.xhr = undefined
      pump()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [render])

  const pump = useCallback(() => {
    const all = Array.from(jobs.current.values())
    let running = all.filter(j => j.status === 'uploading').length
    for (const j of all) {
      if (running >= PARALLEL) break
      if (j.status === 'queued') {
        running++
        run(j)
      }
    }
  }, [run])

  const add = useCallback((files: FileList | File[], folderId: number | null) => {
    const list = Array.from(files)
    if (!list.length) return
    for (const file of list) {
      const key = `${Date.now()}-${Math.random().toString(36).slice(2)}`
      jobs.current.set(key, {
        key, file, folderId, name: file.name || 'Datei', size: file.size, sent: 0,
        status: 'queued', speed: 0, lastTick: 0, lastSent: 0,
      })
    }
    render(true)
    pump()
  }, [pump, render])

  const cancel = useCallback((key: string) => {
    const job = jobs.current.get(key)
    if (!job) return
    const wasActive = job.status === 'uploading' || job.status === 'queued' || job.status === 'error'
    job.status = 'canceled'
    job.xhr?.abort()
    if (wasActive && job.serverId) {
      fetch(`/api/private/files/${job.serverId}`, { method: 'DELETE' }).catch(() => {})
    }
    jobs.current.delete(key)
    render(true)
    pump()
  }, [pump, render])

  const retry = useCallback((key: string) => {
    const job = jobs.current.get(key)
    if (!job || job.status !== 'error') return
    job.status = 'queued'
    job.error = undefined
    render(true)
    pump()
  }, [pump, render])

  const clearFinished = useCallback(() => {
    for (const [k, j] of jobs.current) if (j.status === 'done') jobs.current.delete(k)
    render(true)
  }, [render])

  /* Aufräumen beim Verlassen der Seite: laufende Uploads stoppen */
  useEffect(() => {
    const map = jobs.current
    return () => {
      for (const j of map.values()) {
        if (j.status === 'uploading') { j.status = 'canceled'; j.xhr?.abort() }
      }
    }
  }, [])

  const totals = items.reduce(
    (acc, i) => {
      if (i.status === 'canceled') return acc
      acc.size += i.size
      acc.sent += i.status === 'done' ? i.size : i.sent
      if (i.status === 'uploading') acc.speed += i.speed
      return acc
    },
    { size: 0, sent: 0, speed: 0 }
  )

  return { items, add, cancel, retry, clearFinished, active, totals }
}