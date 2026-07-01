'use client'

import { useState, useEffect, useMemo } from 'react'
import { useAuth } from '../lib/auth-context'
import FullScreenView from './FullScreenView'

// 3-Punkte-Menü einer Konversation (Konzeptdokument Abschnitte 5, 8, 9):
// - Chatlog: eigener Verlauf in 30-Minuten-Abschnitten, inkl. Position wo vorhanden
// - Links: alle gesendeten Links, filterbar nach Absender, sortierbar
// - Pins: angepinnte Nachrichten, mit Möglichkeit zum Lösen (bei Berechtigung)
//
// Bekommt die bereits im Chat geladenen Nachrichten als Prop (spart einen erneuten
// API-Call für den Chatlog-Tab) - Links und Pins werden separat nachgeladen.

type Message = {
  id: string
  content: string | null
  image_url: string | null
  created_at: string
  location_label: string | null
  location_chunk_x: number | null
  location_chunk_z: number | null
  edited_at: string | null
  users: { username: string; display_name: string | null }
}

type Link = {
  id: string
  url: string
  created_at: string
  sender_username: string
}

type Pin = {
  pin_id: string
  message_id: string
  content: string | null
  image_url: string | null
  created_at: string
  pinned_at: string
  pinned_by: string
  pinned_by_username: string | null
  message_sender: { username: string; display_name: string | null }
}

type Props = {
  conversationId: string
  messages: Message[]
  canManagePins: boolean
  onClose: () => void
}

const THIRTY_MIN_MS = 30 * 60 * 1000

function groupIntoSegments(messages: Message[]): { start: string; messages: Message[] }[] {
  const segments: { start: string; messages: Message[] }[] = []
  for (const msg of messages) {
    const last = segments[segments.length - 1]
    const msgTime = new Date(msg.created_at).getTime()
    if (last && msgTime - new Date(last.messages[last.messages.length - 1].created_at).getTime() < THIRTY_MIN_MS
        && msgTime - new Date(last.start).getTime() < THIRTY_MIN_MS) {
      last.messages.push(msg)
    } else {
      segments.push({ start: msg.created_at, messages: [msg] })
    }
  }
  return segments
}

function formatLocation(msg: Message): string | null {
  if (msg.location_label) return msg.location_label
  if (msg.location_chunk_x !== null && msg.location_chunk_z !== null) {
    return `Wildnis (Chunk ${msg.location_chunk_x}, ${msg.location_chunk_z})`
  }
  return null
}

function senderName(u: { username: string; display_name: string | null }): string {
  return u.display_name || u.username
}

export default function ChatLogMenu({ conversationId, messages, canManagePins, onClose }: Props) {
  const { user } = useAuth()
  const [tab, setTab] = useState<'chatlog' | 'links' | 'pins'>('chatlog')

  const [links, setLinks] = useState<Link[]>([])
  const [loadingLinks, setLoadingLinks] = useState(false)
  const [linkSenderFilter, setLinkSenderFilter] = useState('')
  const [linkSort, setLinkSort] = useState<'asc' | 'desc'>('desc')

  const [pins, setPins] = useState<Pin[]>([])
  const [loadingPins, setLoadingPins] = useState(false)
  const [unpinning, setUnpinning] = useState<string | null>(null)

  const segments = useMemo(() => groupIntoSegments(messages), [messages])

  const loadLinks = async () => {
    setLoadingLinks(true)
    const params = new URLSearchParams({ sort: linkSort })
    if (linkSenderFilter.trim()) params.set('sender', linkSenderFilter.trim())
    const res = await fetch(`/api/conversations/${conversationId}/links?${params}`)
    const data = await res.json()
    setLinks(data.links || [])
    setLoadingLinks(false)
  }

  const loadPins = async () => {
    setLoadingPins(true)
    const res = await fetch(`/api/conversations/${conversationId}/pins`)
    const data = await res.json()
    setPins(data.pins || [])
    setLoadingPins(false)
  }

  useEffect(() => {
    if (tab === 'links') loadLinks()
    if (tab === 'pins') loadPins()
  }, [tab, conversationId])

  useEffect(() => {
    if (tab === 'links') loadLinks()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linkSort])

  const unpin = async (messageId: string) => {
    setUnpinning(messageId)
    await fetch(`/api/conversations/${conversationId}/pins`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message_id: messageId }),
    })
    setPins(prev => prev.filter(p => p.message_id !== messageId))
    setUnpinning(null)
  }

  return (
    <FullScreenView onClose={onClose} title="Chat-Verlauf" maxWidth="800px">
        <div className="flex gap-1 mb-4 rounded-xl p-1 flex-shrink-0" style={{ background: 'var(--muted-bg)' }}>
          {(['chatlog', 'links', 'pins'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className="flex-1 py-2 rounded-lg text-sm font-medium transition-all"
              style={tab === t
                ? { background: 'var(--card)', color: 'var(--foreground)' }
                : { color: 'var(--muted)' }}>
              {t === 'chatlog' ? '📜 Verlauf' : t === 'links' ? '🔗 Links' : '📌 Pins'}
            </button>
          ))}
        </div>

        <div>
          {tab === 'chatlog' && (
            <div className="space-y-5">
              {segments.length === 0 && (
                <p className="text-sm text-center py-8" style={{ color: 'var(--muted)' }}>Noch keine Nachrichten.</p>
              )}
              {segments.map((seg, i) => (
                <div key={i}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: 'var(--muted-bg)', color: 'var(--muted)' }}>
                      {new Date(seg.start).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <div className="flex-1 h-px" style={{ background: 'var(--card-border)' }} />
                  </div>
                  <div className="space-y-1.5">
                    {seg.messages.map(msg => {
                      const location = formatLocation(msg)
                      return (
                        <div key={msg.id} className="text-sm">
                          <span className="font-medium" style={{ color: 'var(--foreground)' }}>{senderName(msg.users)}</span>
                          <span className="text-xs mx-1.5" style={{ color: 'var(--muted)' }}>
                            {new Date(msg.created_at).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          {location && (
                            <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'var(--muted-bg)', color: 'var(--muted)' }}>
                              📍 {location}
                            </span>
                          )}
                          {msg.edited_at && (
                            <span className="text-xs italic ml-1" style={{ color: 'var(--muted)' }}>(bearbeitet)</span>
                          )}
                          <p style={{ color: 'var(--foreground)' }}>
                            {msg.content}
                            {msg.image_url && !msg.content && <span style={{ color: 'var(--muted)' }}>[Bild]</span>}
                          </p>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          {tab === 'links' && (
            <div>
              <div className="flex gap-2 mb-4">
                <input value={linkSenderFilter} onChange={e => setLinkSenderFilter(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && loadLinks()}
                  placeholder="Nach Absender filtern..."
                  className="flex-1 rounded-xl px-3 py-2 text-sm outline-none"
                  style={{ background: 'var(--muted-bg)', border: '1px solid var(--card-border)', color: 'var(--foreground)' }} />
                <button onClick={loadLinks} className="text-sm px-3 py-2 rounded-xl" style={{ background: 'var(--muted-bg)', color: 'var(--foreground)' }}>
                  Filtern
                </button>
                <button onClick={() => setLinkSort(s => s === 'asc' ? 'desc' : 'asc')}
                  title="Sortierung umkehren"
                  className="text-sm px-3 py-2 rounded-xl" style={{ background: 'var(--muted-bg)', color: 'var(--foreground)' }}>
                  {linkSort === 'asc' ? '↑ Älteste zuerst' : '↓ Neueste zuerst'}
                </button>
              </div>
              {loadingLinks ? (
                <p className="text-sm text-center py-8" style={{ color: 'var(--muted)' }}>Laden...</p>
              ) : links.length === 0 ? (
                <p className="text-sm text-center py-8" style={{ color: 'var(--muted)' }}>Keine Links gefunden.</p>
              ) : (
                <div className="space-y-2">
                  {links.map(link => (
                    <div key={link.id} className="rounded-xl p-3" style={{ background: 'var(--muted-bg)' }}>
                      <a href={link.url} target="_blank" rel="noopener noreferrer"
                        className="text-sm font-medium hover:underline break-all" style={{ color: '#4F46E5' }}>
                        {link.url}
                      </a>
                      <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>
                        {link.sender_username} · {new Date(link.created_at).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === 'pins' && (
            <div>
              {loadingPins ? (
                <p className="text-sm text-center py-8" style={{ color: 'var(--muted)' }}>Laden...</p>
              ) : pins.length === 0 ? (
                <p className="text-sm text-center py-8" style={{ color: 'var(--muted)' }}>Noch keine angepinnten Nachrichten.</p>
              ) : (
                <div className="space-y-2">
                  {pins.map(pin => (
                    <div key={pin.pin_id} className="rounded-xl p-3" style={{ background: 'var(--muted-bg)' }}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>{senderName(pin.message_sender)}</p>
                          <p className="text-sm mt-0.5" style={{ color: 'var(--foreground)' }}>
                            {pin.content || (pin.image_url ? '[Bild]' : '')}
                          </p>
                          <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>
                            Angepinnt von {pin.pinned_by_username || 'Unbekannt'} · {new Date(pin.pinned_at).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                        {canManagePins && (
                          <button onClick={() => unpin(pin.message_id)} disabled={unpinning === pin.message_id}
                            title="Pin entfernen"
                            className="text-xs hover:opacity-70 transition-all disabled:opacity-40 flex-shrink-0"
                            style={{ color: '#EF4444' }}>
                            {unpinning === pin.message_id ? '...' : '✕ Lösen'}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
    </FullScreenView>
  )
}