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

type TicketInfo = {
  id: number
  category: string
  subject: string
  priority: 'low' | 'normal' | 'high'
  status: 'open' | 'in_progress' | 'closed'
  created_at: string
}

const CATEGORIES: Record<string, { label: string; icon: string; color: string }> = {
  bug:              { label: 'Bug-Report',          icon: '🐛', color: '#EF4444' },
  clan_application: { label: 'Clan-Bewerbung',      icon: '📝', color: '#22C55E' },
  complaint:        { label: 'Beschwerde',          icon: '⚠️', color: '#F59E0B' },
  suggestion:       { label: 'Vorschlag',           icon: '💡', color: '#3B82F6' },
  missing_badge:    { label: 'Abzeichen fehlt',     icon: '🏅', color: '#A855F7' },
  whitelist:        { label: 'Whitelist-Problem',   icon: '🔒', color: '#0891B2' },
  rollback_request: { label: 'Rollback-Anfrage',    icon: '⏪', color: '#DC2626' },
  player_report:    { label: 'Spieler melden',      icon: '🚩', color: '#DB2777' },
  account_link:     { label: 'Account-Verknüpfung', icon: '🔗', color: '#6366F1' },
  other:            { label: 'Sonstiges',           icon: '❓', color: '#6B7280' },
}

const STATUS = {
  open:        { label: 'Offen',          color: '#F59E0B', bg: 'rgba(245,158,11,0.12)', dot: '#F59E0B' },
  in_progress: { label: 'In Bearbeitung', color: '#3B82F6', bg: 'rgba(59,130,246,0.12)', dot: '#3B82F6' },
  closed:      { label: 'Geschlossen',    color: '#6B7280', bg: 'rgba(107,114,128,0.12)', dot: '#6B7280' },
}

function formatTime(iso: string) {
  const d = new Date(iso)
  const now = new Date()
  const diffMin = Math.floor((now.getTime() - d.getTime()) / 60000)
  if (diffMin < 1) return 'gerade eben'
  if (diffMin < 60) return `vor ${diffMin} Min.`
  if (diffMin < 1440) return `vor ${Math.floor(diffMin / 60)} Std.`
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
}

export default function TicketDetailPage() {
  const { user } = useAuth()
  const params = useParams()
  const ticketId = params.ticketId as string

  const [messages, setMessages] = useState<Message[]>([])
  const [ticket, setTicket] = useState<TicketInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [newMessage, setNewMessage] = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const load = () => {
    fetch(`/api/support/tickets/${ticketId}/messages`)
      .then(r => r.json())
      .then(data => {
        setMessages(data.messages || [])
        setLoading(false)
      })
  }

  // Ticket-Info aus der Ticket-Liste holen (via Support-API GET)
  useEffect(() => {
    if (!user) return
    fetch('/api/support/tickets')
      .then(r => r.json())
      .then(data => {
        const t = (data.tickets || []).find((t: any) => String(t.id) === ticketId)
        if (t) setTicket(t)
      })
  }, [user, ticketId])

  useEffect(() => {
    if (user) load()
    const interval = setInterval(() => { if (user) load() }, 8000)
    return () => clearInterval(interval)
  }, [user, ticketId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  const send = async () => {
    if (!newMessage.trim() || sending) return
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

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  if (!user) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--background)' }}>
      <div className="text-center">
        <p className="text-5xl mb-4">🔒</p>
        <p className="font-bold" style={{ color: 'var(--foreground)' }}>Anmelden erforderlich</p>
      </div>
    </div>
  )

  const cat = ticket ? (CATEGORIES[ticket.category] || CATEGORIES.other) : null
  const st = ticket ? STATUS[ticket.status] : null

  return (
    <div className="min-h-screen relative" style={{ background: 'var(--background)', overflow: 'hidden' }}>
      <style>{`
        /* Dekorative Farbflächen im Hintergrund — machen den Glasmorphism-Blur
           der Karten sichtbar (ohne farbigen Hintergrund kein "Durchblick"). */
        .aurora {
          position: fixed;
          border-radius: 9999px;
          filter: blur(90px);
          opacity: 0.5;
          pointer-events: none;
          z-index: 0;
        }
        html.dark .aurora, html.wine .aurora, html.navy .aurora { opacity: 0.38; }
        .aurora-1 { width: 460px; height: 460px; top: -140px; left: -100px; background: #6D28D9; animation: float1 20s ease-in-out infinite; }
        .aurora-2 { width: 400px; height: 400px; bottom: -120px; right: -100px; background: #C026D3; animation: float2 24s ease-in-out infinite; }
        @keyframes float1 { 0%,100%{transform:translate(0,0)} 50%{transform:translate(40px,50px)} }
        @keyframes float2 { 0%,100%{transform:translate(0,0)} 50%{transform:translate(-40px,-40px)} }

        .glass {
          background: color-mix(in srgb, var(--card) 55%, transparent);
          backdrop-filter: blur(16px) saturate(150%);
          -webkit-backdrop-filter: blur(16px) saturate(150%);
          border: 1px solid color-mix(in srgb, var(--card-border) 60%, transparent);
          box-shadow: 0 8px 32px rgba(0,0,0,0.08);
        }
        .glass-strong {
          background: color-mix(in srgb, var(--card) 68%, transparent);
          backdrop-filter: blur(24px) saturate(160%);
          -webkit-backdrop-filter: blur(24px) saturate(160%);
          border: 1px solid color-mix(in srgb, var(--card-border) 70%, transparent);
          box-shadow: 0 8px 40px rgba(0,0,0,0.1);
        }
        .msg-user {
          background: linear-gradient(135deg, #4F46E5, #7C3AED);
          color: white;
          border-radius: 18px 18px 4px 18px;
        }
        .msg-staff {
          background: color-mix(in srgb, var(--muted-bg) 90%, transparent);
          border: 1px solid var(--card-border);
          color: var(--foreground);
          border-radius: 18px 18px 18px 4px;
        }
        .msg-system {
          background: rgba(124,58,237,0.08);
          border: 1px solid rgba(124,58,237,0.2);
          color: var(--muted);
          border-radius: 12px;
        }
        textarea:focus { outline: none; }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .msg-anim { animation: fadeUp 0.2s ease; }
      `}</style>

      {/* Hintergrund-Auroras */}
      <div className="aurora aurora-1" />
      <div className="aurora aurora-2" />

      <div className="max-w-3xl mx-auto px-4 py-6 flex flex-col gap-4 relative" style={{ height: '100vh', maxHeight: '100vh', boxSizing: 'border-box', zIndex: 1 }}>

        {/* Header */}
        <div>
          <Link href="/support" className="flex items-center gap-1.5 text-xs font-medium mb-4 hover:opacity-70 transition-all w-fit"
            style={{ color: 'var(--muted)' }}>
            ← Alle Tickets
          </Link>

          <div className="glass-strong rounded-2xl p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                {cat && (
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-lg"
                    style={{ background: `${cat.color}18`, border: `1px solid ${cat.color}30` }}>
                    {cat.icon}
                  </div>
                )}
                <div className="min-w-0">
                  <h1 className="font-bold text-base truncate" style={{ color: 'var(--foreground)' }}>
                    {ticket?.subject || `Ticket #${ticketId}`}
                  </h1>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
                    #{ticketId} · {cat?.label}
                    {ticket && ` · ${new Date(ticket.created_at).toLocaleDateString('de-DE')}`}
                  </p>
                </div>
              </div>

              {st && (
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-xs font-medium px-3 py-1.5 rounded-full flex items-center gap-1.5"
                    style={{ background: st.bg, color: st.color }}>
                    <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: st.dot }} />
                    {st.label}
                  </span>
                </div>
              )}
            </div>

            {ticket?.status === 'closed' && (
              <div className="mt-3 rounded-xl px-4 py-3 text-xs flex items-center gap-2"
                style={{ background: 'rgba(107,114,128,0.1)', border: '1px solid rgba(107,114,128,0.2)', color: 'var(--muted)' }}>
                🔒 Dieses Ticket ist geschlossen. Du kannst keine weiteren Nachrichten senden.
              </div>
            )}
          </div>
        </div>

        {/* Nachrichten */}
        <div className="glass-strong rounded-2xl flex-1 flex flex-col overflow-hidden min-h-0">
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {loading ? (
              <div className="flex flex-col items-center justify-center h-32 gap-3">
                <div className="w-5 h-5 rounded-full border-2 border-purple-500 border-t-transparent animate-spin" />
                <p className="text-xs" style={{ color: 'var(--muted)' }}>Lädt...</p>
              </div>
            ) : messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 gap-2">
                <p className="text-2xl">💬</p>
                <p className="text-xs" style={{ color: 'var(--muted)' }}>Noch keine Nachrichten.</p>
              </div>
            ) : (
              messages.map((m, i) => {
                const isOwn = m.sender_id === user.id && !m.is_staff
                const showSender = i === 0 || messages[i - 1].is_staff !== m.is_staff || messages[i - 1].sender_id !== m.sender_id

                return (
                  <div key={m.id} className={`flex flex-col msg-anim ${isOwn ? 'items-end' : 'items-start'}`}>
                    {showSender && (
                      <p className="text-xs mb-1 px-1" style={{ color: 'var(--muted)' }}>
                        {m.is_staff ? `🛡️ ${m.sender?.username || 'Team'}` : m.sender?.username}
                      </p>
                    )}
                    <div className={`max-w-[78%] px-4 py-2.5 text-sm whitespace-pre-wrap leading-relaxed ${isOwn ? 'msg-user' : 'msg-staff'}`}>
                      {m.body}
                    </div>
                    <p className="text-xs mt-1 px-1" style={{ color: 'var(--muted)', opacity: 0.7 }}>
                      {formatTime(m.created_at)}
                    </p>
                  </div>
                )
              })
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          {ticket?.status !== 'closed' && (
            <div className="p-4 flex gap-3 items-end" style={{ borderTop: '1px solid var(--card-border)' }}>
              <div className="flex-1 rounded-xl overflow-hidden"
                style={{ background: 'var(--muted-bg)', border: '1px solid var(--card-border)' }}>
                <textarea
                  ref={textareaRef}
                  value={newMessage}
                  onChange={e => setNewMessage(e.target.value)}
                  onKeyDown={handleKey}
                  placeholder="Nachricht schreiben... (Enter zum Senden, Shift+Enter für neue Zeile)"
                  rows={1}
                  className="w-full px-4 py-3 text-sm resize-none bg-transparent"
                  style={{ color: 'var(--foreground)', maxHeight: '120px' }}
                />
              </div>
              <button
                onClick={send}
                disabled={!newMessage.trim() || sending}
                className="btn-gradient text-white text-sm font-medium px-4 py-3 rounded-xl disabled:opacity-40 flex-shrink-0 flex items-center gap-1.5">
                {sending ? (
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" />
                ) : '→'}
              </button>
            </div>
          )}
        </div>

      </div>
    </div>
  )
}