'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useAuth } from '../../../lib/auth-context'

type Message = {
  id: number
  is_staff: boolean
  body: string
  created_at: string
  sender: { username: string } | null
}

type TicketDetail = {
  id: number
  category: string
  subject: string
  priority: 'low' | 'normal' | 'high'
  status: 'open' | 'in_progress' | 'closed'
  created_at: string
  creator?: { username: string } | null
  target_user?: { username: string } | null
  target_badge?: { name: string } | null
}

const STATUS_OPTIONS = [
  { key: 'open', label: 'Offen', color: '#EAB308' },
  { key: 'in_progress', label: 'In Bearbeitung', color: '#3B82F6' },
  { key: 'closed', label: 'Geschlossen', color: 'var(--muted)' },
]

const PRIORITY_OPTIONS = [
  { key: 'low', label: 'Niedrig', color: 'var(--muted)' },
  { key: 'normal', label: 'Normal', color: '#3B82F6' },
  { key: 'high', label: 'Hoch', color: '#EF4444' },
]

export default function AdminTicketDetailPage() {
  const { user } = useAuth()
  const params = useParams()
  const ticketId = params.ticketId as string

  const [ticket, setTicket] = useState<TicketDetail | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [newMessage, setNewMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [addParticipantName, setAddParticipantName] = useState('')
  const [addingParticipant, setAddingParticipant] = useState(false)
  const [participantMsg, setParticipantMsg] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  const loadTicket = () => {
    fetch('/api/support/tickets')
      .then(r => r.json())
      .then(data => {
        const found = (data.tickets || []).find((t: TicketDetail) => t.id === Number(ticketId))
        setTicket(found || null)
      })
  }

  const loadMessages = () => {
    fetch(`/api/support/tickets/${ticketId}/messages`)
      .then(r => r.json())
      .then(data => {
        setMessages(data.messages || [])
        setLoading(false)
      })
  }

  useEffect(() => {
    if (!user) return
    loadTicket()
    loadMessages()
    const interval = setInterval(loadMessages, 8000)
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
    loadMessages()
  }

  const updateTicket = async (update: { status?: string; priority?: string }) => {
    await fetch(`/api/support/tickets/${ticketId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(update),
    })
    loadTicket()
  }

  const addParticipant = async () => {
    if (!addParticipantName.trim()) return
    setAddingParticipant(true)
    setParticipantMsg('')
    const res = await fetch(`/api/support/tickets/${ticketId}/participants`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: addParticipantName.trim() }),
    })
    setAddingParticipant(false)
    if (res.ok) {
      setParticipantMsg(`✓ ${addParticipantName.trim()} hinzugefügt`)
      setAddParticipantName('')
    } else {
      const data = await res.json()
      setParticipantMsg(data.error || 'Fehler')
    }
  }

  if (!user || (user.clan_role?.toLowerCase() !== 'admin' && user.clan_role?.toLowerCase() !== 'mod')) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--background)' }}>
        <p style={{ color: 'var(--foreground)' }}>Kein Zugriff.</p>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-4">
      <Link href="/admin/support" className="text-sm flex items-center gap-1 hover:opacity-70" style={{ color: 'var(--muted)' }}>
        ← Zurück zur Übersicht
      </Link>

      {ticket && (
        <div className="card rounded-2xl p-4">
          <h1 className="font-bold text-lg mb-1" style={{ color: 'var(--foreground)' }}>{ticket.subject}</h1>
          <p className="text-xs mb-3" style={{ color: 'var(--muted)' }}>
            von {ticket.creator?.username}
            {ticket.target_user && ` · betrifft ${ticket.target_user.username}`}
            {ticket.target_badge && ` · Abzeichen: ${ticket.target_badge.name}`}
          </p>

          <div className="flex gap-3 flex-wrap">
            <div>
              <p className="text-xs mb-1" style={{ color: 'var(--muted)' }}>Status</p>
              <div className="flex gap-1">
                {STATUS_OPTIONS.map(s => (
                  <button key={s.key} onClick={() => updateTicket({ status: s.key })}
                    className="text-xs font-medium px-2 py-1 rounded-lg transition"
                    style={ticket.status === s.key ? { background: s.color, color: 'white' } : { background: 'var(--muted-bg)', color: 'var(--muted)' }}>
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs mb-1" style={{ color: 'var(--muted)' }}>Priorität</p>
              <div className="flex gap-1">
                {PRIORITY_OPTIONS.map(p => (
                  <button key={p.key} onClick={() => updateTicket({ priority: p.key })}
                    className="text-xs font-medium px-2 py-1 rounded-lg transition"
                    style={ticket.priority === p.key ? { background: p.color, color: 'white' } : { background: 'var(--muted-bg)', color: 'var(--muted)' }}>
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-3 pt-3" style={{ borderTop: '1px solid var(--card-border)' }}>
            <p className="text-xs mb-1" style={{ color: 'var(--muted)' }}>Spieler zum Ticket hinzufügen</p>
            <div className="flex gap-2">
              <input type="text" value={addParticipantName} onChange={e => setAddParticipantName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addParticipant()}
                placeholder="Username..."
                className="flex-1 px-3 py-1.5 rounded-lg text-sm" style={{ background: 'var(--muted-bg)', border: '1px solid var(--card-border)', color: 'var(--foreground)' }} />
              <button onClick={addParticipant} disabled={addingParticipant || !addParticipantName.trim()}
                className="text-xs font-medium px-3 py-1.5 rounded-lg disabled:opacity-40" style={{ background: 'var(--muted-bg)', border: '1px solid var(--card-border)', color: 'var(--foreground)' }}>
                Hinzufügen
              </button>
            </div>
            {participantMsg && <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>{participantMsg}</p>}
          </div>
        </div>
      )}

      <div className="card rounded-2xl overflow-hidden flex flex-col" style={{ height: '60vh' }}>
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {loading ? (
            <p className="text-sm" style={{ color: 'var(--muted)' }}>Lädt...</p>
          ) : messages.length === 0 ? (
            <p className="text-sm" style={{ color: 'var(--muted)' }}>Noch keine Nachrichten.</p>
          ) : (
            messages.map(m => (
              <div key={m.id} className={`flex ${m.is_staff ? 'justify-end' : 'justify-start'}`}>
                <div className="max-w-[80%] rounded-xl px-3 py-2"
                  style={m.is_staff
                    ? { background: '#16A34A', color: 'white' }
                    : { background: 'var(--muted-bg)', border: '1px solid var(--card-border)' }}>
                  <p className="text-xs font-medium mb-0.5" style={{ color: m.is_staff ? 'rgba(255,255,255,0.8)' : 'var(--muted)' }}>
                    {m.is_staff ? `🛡️ ${m.sender?.username}` : m.sender?.username}
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
            placeholder="Als Leitung antworten..."
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