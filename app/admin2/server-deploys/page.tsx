'use client'

import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../../lib/auth-context'

type Status = {
  online: boolean
  players?: number
  maxPlayers?: number
  tps?: number | null
  error?: string
}

type ConsoleLine = { text: string, type: 'command' | 'response' | 'error' }

export default function ServerDeploysPage() {
  const { user } = useAuth()
  const isOwner = user?.clan_role === 'owner'
  const isAdmin = user?.clan_role === 'administrator'

  const [status, setStatus] = useState<Status | null>(null)
  const [tab, setTab] = useState<'deploys' | 'files' | 'console'>('console')
  const [restarting, setRestarting] = useState(false)
  const [restartMsg, setRestartMsg] = useState('')

  const loadStatus = () => {
    fetch('/api/admin2/server-deploys/status')
      .then(r => r.json())
      .then(data => setStatus(data))
  }

  useEffect(() => {
    loadStatus()
    const interval = setInterval(loadStatus, 10000)
    return () => clearInterval(interval)
  }, [])

  const restart = async () => {
    if (!confirm(isOwner ? 'Server jetzt wirklich neustarten?' : 'Neustart-Anfrage an Leonie senden?')) return
    setRestarting(true)
    setRestartMsg('')
    const res = await fetch('/api/admin2/server-deploys/restart', { method: 'POST' })
    const data = await res.json().catch(() => ({}))
    if (res.ok) {
      setRestartMsg(data.pending ? 'Anfrage gesendet — wartet auf Leonies Bestätigung.' : 'Neustart ausgelöst.')
    } else {
      setRestartMsg(data.error || 'Fehler beim Neustarten')
    }
    setRestarting(false)
  }

  // Diese Seite ist ausschließlich für owner/administrator zugänglich - kein
  // Lesezugriff für Teammitglieder (anders als bei allen anderen admin2
  // Bereichen), da es sich um echte Server-Fernsteuerung handelt.
  if (user && !isOwner && !isAdmin) {
    return (
      <div className="max-w-3xl">
        <div className="card rounded-2xl p-10 text-center">
          <p className="text-3xl mb-3">🔒</p>
          <p style={{ color: 'var(--foreground)' }}>Kein Zugriff auf diesen Bereich.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-6xl">
      <h1 className="text-3xl font-bold mb-1" style={{ color: 'var(--foreground)' }}>Server & Deploys</h1>
      <p className="mb-6" style={{ color: 'var(--muted)' }}>GitHub-Deploys, Dateizugriff, Konsole und Neustart — alles an einem Ort.</p>

      {!isOwner && (
        <p className="text-xs mb-5" style={{ color: '#EAB308' }}>
          🔒 Als Administrator werden deine Aktionen als Anfrage an Leonie geschickt und müssen von ihr bestätigt werden.
        </p>
      )}

      <div className="card rounded-2xl p-5 mb-6 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: status?.online ? '#22C55E' : '#EF4444' }} />
          <div>
            <p className="font-bold" style={{ color: 'var(--foreground)' }}>mc.seekclan.de</p>
            <p className="text-xs" style={{ color: 'var(--muted)' }}>
              {status === null ? 'Lade Status...' : !status.online
                ? `Offline${status.error ? ` · ${status.error}` : ''}`
                : `Online · ${status.players} / ${status.maxPlayers} Spieler${status.tps !== null && status.tps !== undefined ? ` · TPS ${status.tps.toFixed(2)}` : ''}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {restartMsg && <p className="text-xs" style={{ color: 'var(--muted)' }}>{restartMsg}</p>}
          <button onClick={restart} disabled={restarting}
            className="px-4 py-2 rounded-xl text-sm font-medium disabled:opacity-50"
            style={{ background: '#EF444422', color: '#EF4444', border: '1px solid #EF444455' }}>
            {restarting ? '...' : isOwner ? '↻ Jetzt neustarten' : '↻ Neustart anfragen'}
          </button>
        </div>
      </div>

      <div className="flex gap-1 mb-6" style={{ borderBottom: '1px solid var(--card-border)' }}>
        {(['deploys', 'files', 'console'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className="px-4 py-2.5 text-sm font-medium"
            style={tab === t ? { color: 'var(--foreground)', borderBottom: '2px solid #A855F7' } : { color: 'var(--muted)' }}>
            {t === 'deploys' ? 'GitHub-Deploys' : t === 'files' ? 'Dateien' : 'Konsole & Logs'}
          </button>
        ))}
      </div>

      {tab === 'console' && <ConsoleTab isOwner={isOwner} />}
      {tab === 'files' && <FilesTab />}
      {tab === 'deploys' && (
        <div className="card rounded-2xl p-10 text-center">
          <p className="text-3xl mb-3">🚀</p>
          <p style={{ color: 'var(--muted)' }}>GitHub-Deploys folgt als nächster Schritt.</p>
        </div>
      )}
    </div>
  )
}

function ConsoleTab({ isOwner }: { isOwner: boolean }) {
  const [lines, setLines] = useState<ConsoleLine[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [lines.length])

  const send = async () => {
    if (!input.trim() || sending) return
    const command = input.trim()
    setLines(prev => [...prev, { text: `> ${command}`, type: 'command' }])
    setInput('')
    setSending(true)

    const res = await fetch('/api/admin2/server-deploys/console', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command }),
    })
    const data = await res.json().catch(() => ({}))

    if (res.ok && data.executed) {
      setLines(prev => [...prev, { text: data.response || '(keine Ausgabe)', type: 'response' }])
    } else if (res.ok && data.pending) {
      setLines(prev => [...prev, { text: 'Anfrage an Leonie gesendet — wartet auf Bestätigung.', type: 'response' }])
    } else {
      setLines(prev => [...prev, { text: data.error || 'Fehler beim Ausführen', type: 'error' }])
    }
    setSending(false)
  }

  return (
    <div className="card rounded-2xl overflow-hidden">
      <div className="p-4 h-[420px] overflow-y-auto font-mono text-sm space-y-1" style={{ background: '#0a0a0a' }}>
        {lines.length === 0 ? (
          <p style={{ color: 'var(--muted)' }}>Noch keine Befehle ausgeführt.</p>
        ) : lines.map((line, i) => (
          <p key={i} style={{
            color: line.type === 'command' ? '#A855F7' : line.type === 'error' ? '#EF4444' : '#D1D5DB',
            whiteSpace: 'pre-wrap',
          }}>
            {line.text}
          </p>
        ))}
        <div ref={bottomRef} />
      </div>
      <div className="p-3 flex items-center gap-2" style={{ borderTop: '1px solid var(--card-border)' }}>
        <span className="font-mono text-sm" style={{ color: 'var(--muted)' }}>›</span>
        <input value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') send() }}
          placeholder="Befehl eingeben — z. B. list, tps, say Hallo, restart"
          className="flex-1 bg-transparent outline-none font-mono text-sm"
          style={{ color: 'var(--foreground)' }} />
      </div>
    </div>
  )
}

type FileEntry = { name: string, type: 'directory' | 'file' | 'other', size: number, modifiedAt: string }

const TEXT_EXTENSIONS = ['.log', '.txt', '.yml', '.yaml', '.json', '.properties', '.conf', '.cfg', '.toml']

function FilesTab() {
  const [path, setPath] = useState('')
  const [entries, setEntries] = useState<FileEntry[] | null>(null)
  const [error, setError] = useState('')
  const [uploading, setUploading] = useState(false)
  const [viewing, setViewing] = useState<{ path: string, content: string } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const load = (p: string) => {
    setEntries(null)
    setError('')
    fetch(`/api/admin2/server-deploys/files/list?path=${encodeURIComponent(p)}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) setError(data.error)
        else setEntries(data.entries)
      })
  }

  useEffect(() => { load(path) }, [path])

  const isTextFile = (name: string) => TEXT_EXTENSIONS.some(ext => name.toLowerCase().endsWith(ext))

  const openEntry = (entry: FileEntry) => {
    const entryPath = path ? `${path}/${entry.name}` : entry.name
    if (entry.type === 'directory') {
      setPath(entryPath)
    } else if (isTextFile(entry.name)) {
      fetch(`/api/admin2/server-deploys/files/view?path=${encodeURIComponent(entryPath)}`)
        .then(r => r.json())
        .then(data => {
          if (data.error) setError(data.error)
          else setViewing({ path: entryPath, content: data.content })
        })
    }
  }

  const breadcrumbs = path ? path.split('/') : []

  const handleUpload = async (file: File) => {
    setUploading(true)
    setError('')
    const formData = new FormData()
    formData.set('path', path)
    formData.set('file', file)
    const res = await fetch('/api/admin2/server-deploys/files/upload', { method: 'POST', body: formData })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) setError(data.error || 'Upload fehlgeschlagen')
    else load(path)
    setUploading(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <div className="card rounded-2xl overflow-hidden">
      <div className="p-4 flex items-center justify-between flex-wrap gap-3" style={{ borderBottom: '1px solid var(--card-border)' }}>
        <div className="text-sm flex items-center gap-1 flex-wrap" style={{ color: 'var(--muted)' }}>
          <button onClick={() => setPath('')} style={{ color: 'var(--foreground)' }}>/server</button>
          {breadcrumbs.map((segment, i) => (
            <span key={i} className="flex items-center gap-1">
              <span>/</span>
              <button onClick={() => setPath(breadcrumbs.slice(0, i + 1).join('/'))} style={{ color: 'var(--foreground)' }}>
                {segment}
              </button>
            </span>
          ))}
        </div>
        <div>
          <input ref={fileInputRef} type="file" className="hidden" id="file-upload-input"
            onChange={e => e.target.files?.[0] && handleUpload(e.target.files[0])} />
          <label htmlFor="file-upload-input"
            className="px-4 py-2 rounded-xl text-sm font-medium cursor-pointer inline-block"
            style={{ background: '#A855F722', color: '#A855F7', border: '1px solid #A855F755' }}>
            {uploading ? 'Lädt hoch...' : '⬆ Datei hochladen'}
          </label>
        </div>
      </div>

      {error && <div className="p-4 text-sm" style={{ color: '#EF4444' }}>{error}</div>}

      <div className="divide-y" style={{ borderColor: 'var(--card-border)' }}>
        {entries === null ? (
          <div className="p-6 text-center text-sm" style={{ color: 'var(--muted)' }}>Lade...</div>
        ) : entries.length === 0 ? (
          <div className="p-6 text-center text-sm" style={{ color: 'var(--muted)' }}>Ordner ist leer.</div>
        ) : entries.map(entry => (
          <button key={entry.name} onClick={() => openEntry(entry)}
            className="w-full p-3 flex items-center justify-between text-left hover:opacity-80"
            style={{ cursor: entry.type === 'directory' || isTextFile(entry.name) ? 'pointer' : 'default' }}>
            <span className="flex items-center gap-2 text-sm" style={{ color: 'var(--foreground)' }}>
              <span>{entry.type === 'directory' ? '📁' : '📄'}</span>
              {entry.name}
            </span>
            {entry.type === 'file' && (
              <span className="text-xs" style={{ color: 'var(--muted)' }}>
                {(entry.size / 1024).toFixed(1)} KB
              </span>
            )}
          </button>
        ))}
      </div>

      {viewing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: '#00000088' }} onClick={() => setViewing(null)}>
          <div className="rounded-2xl w-full max-w-4xl max-h-[80vh] flex flex-col" style={{ background: 'var(--background)' }} onClick={e => e.stopPropagation()}>
            <div className="p-4 flex items-center justify-between" style={{ borderBottom: '1px solid var(--card-border)' }}>
              <p className="font-mono text-sm" style={{ color: 'var(--foreground)' }}>{viewing.path}</p>
              <button onClick={() => setViewing(null)} style={{ color: 'var(--muted)' }}>✕</button>
            </div>
            <pre className="p-4 overflow-auto text-xs font-mono flex-1" style={{ color: 'var(--foreground)', whiteSpace: 'pre-wrap' }}>
              {viewing.content}
            </pre>
          </div>
        </div>
      )}
    </div>
  )
}