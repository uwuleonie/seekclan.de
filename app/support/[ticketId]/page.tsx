'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useAuth } from '../../lib/auth-context'

type Message = {
  id: number
  sender_id: string
  is_staff: boolean
  body: string
  created_at: string
  sender: { username: string } | null
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  open: { label: 'Offen', color: '#EAB308' },
  in_progress: { label: 'In Bearbeitung', color: '#3B82F6' },
  closed: { label: 'Geschlossen', color: 'var(--muted)' },
}

export default function TicketDetailPage() {
  const { user } = useAuth()
  const params = useParams()
  const ticketId = params.ticketId as string
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [newMessage, setNewMessage] = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  const load = () => {
    fetch(`/api/support/tickets/${ticketId}/messages`)
      .then(r => r.json())
      .then(data => {
        setMessages(data.messages || [])
        setLoading(false)
      })
  }

  useEffect(() => {
    if (user) load()
    const interval = setInterval(() => { if (user) load() }, 8000)
    return () => clearInterval(interval)
  }, [user, ticketId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  const send = async () => {
    if (!newMessage.trim()) return
    setSending(true)
    await fetch(`/api/support/tickets/${ticketId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: newMessage.trim() }),
    })
    setNewMessage('')
    setSending(false)
    load()
  }

  if (!user) {
    return (
      <div className="card rounded-2xl p-12 text-center">
        <p className="text-5xl mb-4">🔒</p>
        <p className="font-bold" style={{ color: 'var(--foreground)' }}>Du musst eingeloggt sein.</p>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-4">
      <Link href="/support" className="text-sm flex items-center gap-1 hover:opacity-70" style={{ color: 'var(--muted)' }}>
        ← Zurück zu Tickets
      </Link>

      <div className="card rounded-2xl overflow-hidden flex flex-col" style={{ height: '70vh' }}>
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {loading ? (
            <p className="text-sm" style={{ color: 'var(--muted)' }}>Lädt...</p>
          ) : messages.length === 0 ? (
            <p className="text-sm" style={{ color: 'var(--muted)' }}>Noch keine Nachrichten.</p>
          ) : (
            messages.map(m => (
              <div key={m.id} className={`flex ${m.is_staff ? 'justify-start' : 'justify-end'}`}>
                <div className="max-w-[80%] rounded-xl px-3 py-2"
                  style={m.is_staff
                    ? { background: 'var(--muted-bg)', border: '1px solid var(--card-border)' }
                    : { background: '#16A34A', color: 'white' }}>
                  <p className="text-xs font-medium mb-0.5" style={{ color: m.is_staff ? 'var(--muted)' : 'rgba(255,255,255,0.8)' }}>
                    {m.is_staff ? `🛡️ ${m.sender?.username || 'Leitung'}` : m.sender?.username}
                  </p>
                  <p className="text-sm whitespace-pre-wrap">{m.body}</p>
                </div>
              </div>
            ))
          )}
          <div ref={bottomRef} />
        </div>

        <div className="p-3 flex gap-2" style={{ borderTop: '1px solid var(--card-border)' }}>
          <input
            type="text"
            value={newMessage}
            onChange={e => setNewMessage(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && send()}
            placeholder="Nachricht schreiben..."
            className="flex-1 px-3 py-2 rounded-lg text-sm"
            style={{ background: 'var(--muted-bg)', border: '1px solid var(--card-border)', color: 'var(--foreground)' }}
          />
          <button onClick={send} disabled={!newMessage.trim() || sending}
            className="px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-40" style={{ background: '#16A34A', color: 'white' }}>
            Senden
          </button>
        </div>
      </div>
    </div>
  )
}