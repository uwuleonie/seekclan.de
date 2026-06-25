'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

type TicketMessage = {
  id: number
  sender_id: string
  is_staff: boolean
  body: string
  created_at: string
  sender: { username: string } | null
}

type Props = {
  ticketId: string
  subject: string
  status: 'open' | 'in_progress' | 'closed'
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  open: { label: 'Offen', color: '#EAB308' },
  in_progress: { label: 'In Bearbeitung', color: '#3B82F6' },
  closed: { label: 'Geschlossen', color: 'var(--muted)' },
}

// Eigenes Polling statt das gemeinsame der /chat-Seite, da Support-Tickets ein
// komplett eigenes Datenmodell (support_messages statt messages) haben und über
// eine eigene API laufen — bewusst getrennt von der conversations-Logik gehalten.
const POLL_INTERVAL_MS = 3000

export default function TicketChatPanel({ ticketId, subject, status }: Props) {
  const [messages, setMessages] = useState<TicketMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [newMessage, setNewMessage] = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/support/tickets/${ticketId}/messages`)
      const data = await res.json()
      setMessages(data.messages || [])
    } catch {
      // Polling-Fehler einfach ignorieren, nächster Versuch folgt in 3s
    } finally {
      setLoading(false)
    }
  }, [ticketId])

  useEffect(() => {
    setLoading(true)
    load()
    const interval = setInterval(load, POLL_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [load])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  const send = async () => {
    if (!newMessage.trim() || sending) return
    setSending(true)
    try {
      const res = await fetch(`/api/support/tickets/${ticketId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: newMessage.trim() }),
      })
      if (res.ok) {
        setNewMessage('')
        load()
      }
    } finally {
      setSending(false)
    }
  }

  const statusInfo = STATUS_LABELS[status] || STATUS_LABELS.open
  const isClosed = status === 'closed'

  return (
    <>
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4" style={{ borderBottom: '1px solid var(--card-border)' }}>
        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-base"
          style={{ background: 'var(--muted-bg)' }}>
          🎫
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm truncate" style={{ color: 'var(--foreground)' }}>{subject}</p>
          <p className="text-xs" style={{ color: statusInfo.color }}>{statusInfo.label}</p>
        </div>
      </div>

      {/* Nachrichten */}
      <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-3">
        {loading ? (
          <p className="text-sm text-center py-8" style={{ color: 'var(--muted)' }}>Laden...</p>
        ) : messages.length === 0 ? (
          <p className="text-sm text-center py-8" style={{ color: 'var(--muted)' }}>Noch keine Nachrichten.</p>
        ) : (
          messages.map(m => (
            <div key={m.id} className={`flex ${m.is_staff ? 'justify-start' : 'justify-end'}`}>
              <div className="max-w-[60%] rounded-2xl px-4 py-2.5 text-sm"
                style={m.is_staff
                  ? { background: 'var(--muted-bg)', border: '1px solid var(--card-border)', color: 'var(--foreground)' }
                  : { background: '#16A34A', color: 'white' }}>
                <p className="text-xs font-medium mb-0.5 opacity-80">
                  {m.is_staff ? `🛡️ ${m.sender?.username || 'Leitung'}` : m.sender?.username}
                </p>
                <p className="whitespace-pre-wrap">{m.body}</p>
              </div>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* Eingabe */}
      <div className="flex gap-2 px-5 py-4" style={{ borderTop: '1px solid var(--card-border)' }}>
        {isClosed ? (
          <p className="text-sm w-full text-center py-2" style={{ color: 'var(--muted)' }}>
            Dieses Ticket ist geschlossen.
          </p>
        ) : (
          <>
            <input
              type="text"
              value={newMessage}
              onChange={e => setNewMessage(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') send() }}
              placeholder="Nachricht schreiben..."
              className="flex-1 rounded-xl px-4 py-2.5 text-sm outline-none"
              style={{ background: 'var(--muted-bg)', border: '1px solid var(--card-border)', color: 'var(--foreground)' }}
            />
            <button
              onClick={send}
              disabled={sending || !newMessage.trim()}
              className="px-5 py-2.5 rounded-xl text-sm font-medium text-white disabled:opacity-50"
              style={{ background: '#16A34A' }}
            >
              Senden
            </button>
          </>
        )}
      </div>
    </>
  )
}