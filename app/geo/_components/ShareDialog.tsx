'use client'

// "Ergebnis teilen": erstellt einen Link (seekclan.de/geo/ergebnis/<id>) mit Schaubild des Ergebnisses.
// Link kopieren, über das Handy teilen oder direkt im seekclan-Chat an jemanden schicken.

import { useEffect, useState } from 'react'
import Icon from './Icon'
import { useGeo } from './GeoShell'

export interface ShareData {
  slug: string; title: string; mode: string; variant: string
  total: number; right: number; wrong: number; seconds: number; accuracy: number; bestStreak: number
  solved: string[]; mistakes: string[]
}

type Conv = { id: string; type: string; name: string | null; members: { id: string; username: string; name?: string }[] }

const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

export default function ShareDialog({ data, onClose }: { data: ShareData; onClose: () => void }) {
  const { loggedIn } = useGeo()
  const [url, setUrl] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [convs, setConvs] = useState<Conv[] | null>(null)
  const [me, setMe] = useState<string | null>(null)
  const [sent, setSent] = useState<string[]>([])
  const [busy, setBusy] = useState<string | null>(null)
  const [note, setNote] = useState('')

  useEffect(() => {
    let alive = true
    fetch('/api/geo/share', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
      .then(r => r.json())
      .then(d => { if (!alive) return; if (d.url) setUrl(window.location.origin + d.url); else setError(d.error || 'Link konnte nicht erstellt werden') })
      .catch(() => { if (alive) setError('Link konnte nicht erstellt werden') })
    return () => { alive = false }
  }, [data])

  const text = `Mein Ergebnis bei „${data.title}“: ${data.variant === 'sprint' ? `${data.right} richtig im Sprint` : `${data.accuracy} %`} (${data.right} richtig, ${data.wrong} Fehler, ${fmtTime(data.seconds)} Min.) – schaffst du mehr?`

  const copy = async () => {
    if (!url) return
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2000) } catch { /* egal */ }
  }
  const nativeShare = async () => {
    if (!url) return
    try { await navigator.share({ title: data.title, text, url }) } catch { /* abgebrochen */ }
  }
  const loadChats = async () => {
    setConvs([])
    try {
      const [c, m] = await Promise.all([fetch('/api/conversations', { cache: 'no-store' }).then(r => r.json()), fetch('/api/auth/me').then(r => r.json())])
      setMe(m?.user?.id ?? null)
      setConvs(c.conversations ?? [])
    } catch { setConvs([]) }
  }
  const sendTo = async (c: Conv) => {
    if (!url) return
    setBusy(c.id)
    try {
      const r = await fetch(`/api/conversations/${c.id}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: `${note ? note + '\n' : ''}${text}\n${url}` }),
      })
      if (r.ok) setSent(s => [...s, c.id])
    } finally { setBusy(null) }
  }
  const convName = (c: Conv) => c.name || c.members.filter(m => m.id !== me).map(m => m.name ?? m.username).join(', ') || 'Chat'

  return (
    <div className="ga-modal-bg" role="dialog" aria-modal="true" aria-labelledby="ga-share-t" onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="ga-modal ga-card">
        <div className="ga-row" style={{ justifyContent: 'space-between' }}>
          <div>
            <p className="ga-eyebrow">Ergebnis teilen</p>
            <h2 id="ga-share-t" className="ga-h2" style={{ margin: '2px 0 0' }}>{data.title}</h2>
          </div>
          <button className="ga-icon-btn" onClick={onClose} aria-label="Schließen"><Icon name="x" size={16} /></button>
        </div>
        <p className="ga-muted" style={{ margin: '8px 0 14px' }}>{text}</p>

        {error ? <p className="ga-adm-flash bad">{error}</p> : !url ? <p className="ga-muted">Link wird erstellt …</p> : (
          <>
            <div className="ga-share-link">
              <input className="ga-input" readOnly value={url} onFocus={e => e.target.select()} aria-label="Link zum Ergebnis" />
              <button className="ga-btn primary" onClick={copy}><Icon name={copied ? 'check' : 'copy'} size={15} /> {copied ? 'Kopiert' : 'Kopieren'}</button>
            </div>
            <div className="ga-row ga-wrap" style={{ marginTop: 10 }}>
              <a className="ga-btn sm" href={url} target="_blank" rel="noopener noreferrer"><Icon name="link" size={14} /> Ansehen</a>
              {typeof navigator !== 'undefined' && 'share' in navigator && <button className="ga-btn sm" onClick={nativeShare}><Icon name="share" size={14} /> Teilen …</button>}
              {loggedIn && convs === null && <button className="ga-btn sm" onClick={loadChats}><Icon name="send" size={14} /> Im Chat senden</button>}
            </div>

            {convs !== null && (
              <div className="ga-share-chats">
                <input className="ga-input" value={note} onChange={e => setNote(e.target.value)} placeholder="Nachricht dazu (optional)" maxLength={300} />
                {convs.length === 0 ? <p className="ga-muted">Keine Chats gefunden.</p> : convs.slice(0, 30).map(c => (
                  <div key={c.id} className="ga-share-chat">
                    <span className="ga-grow">{convName(c)}<span className="ga-muted"> · {c.type === 'group' ? 'Gruppe' : 'Direkt'}</span></span>
                    {sent.includes(c.id) ? <span className="ga-badge ok">Gesendet</span>
                      : <button className="ga-btn sm" disabled={busy === c.id} onClick={() => sendTo(c)}><Icon name="send" size={13} /> Senden</button>}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}