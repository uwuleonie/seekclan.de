'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '../lib/auth-context'
import Link from 'next/link'
import NewConversationModal from '../components/NewConversationModal'
import MessageRequestsTab from '../components/MessageRequestsTab'
import TicketChatPanel from '../components/TicketChatPanel'
import GroupManagementPanel from '../components/GroupManagementPanel'

type ConversationMember = {
  id: string
  username: string
  display_name: string | null
  minecraft_username: string | null
  profile_picture_url: string | null
}

type LastMessage = {
  id: string
  content: string | null
  image_url: string | null
  sender_id: string
  created_at: string
} | null

type Conversation = {
  id: string
  type: 'direct' | 'group'
  name: string | null
  created_at: string
  avatar_url: string | null
  members: ConversationMember[]
  lastMessage: LastMessage
  unreadCount: number
}

type MessageReaction = {
  id: string
  user_id: string
  emoji: string
}

type Message = {
  id: string
  sender_id: string
  content: string | null
  image_url: string | null
  created_at: string
  users: {
    username: string
    display_name: string | null
    profile_picture_url: string | null
  }
  message_reactions: MessageReaction[]
}

type Ticket = {
  id: string
  user_id: string
  subject: string
  status: 'open' | 'in_progress' | 'closed'
  updated_at: string
  created_at: string
}

// Live-Updates laufen per Polling (kein Realtime mehr seit dem Wechsel von Supabase
// zum eigenen Postgres-Server) — 3s ist schnell genug, um sich "live" anzufühlen,
// ohne die DB unnötig oft abzufragen.
const POLL_INTERVAL_MS = 3000

function getDirectPartner(conv: Conversation, myUserId: string): ConversationMember | null {
  if (conv.type !== 'direct') return null
  return conv.members.find(m => m.id !== myUserId) || null
}

function conversationDisplayName(conv: Conversation, myUserId: string): string {
  if (conv.type === 'group') return conv.name || 'Gruppe'
  const partner = getDirectPartner(conv, myUserId)
  return partner?.display_name || partner?.username || 'Unbekannt'
}

function conversationAvatarUrl(conv: Conversation, myUserId: string): string {
  if (conv.type === 'group') return conv.avatar_url || ''
  const partner = getDirectPartner(conv, myUserId)
  const mcName = partner?.minecraft_username || partner?.username || 'Steve'
  return `https://mc-heads.net/avatar/${mcName}/40`
}

function previewText(msg: LastMessage): string {
  if (!msg) return 'Noch keine Nachrichten'
  if (msg.image_url) return '📷 Bild'
  return msg.content || ''
}

function formatTime(iso: string): string {
  const date = new Date(iso)
  const now = new Date()
  const isToday = date.toDateString() === now.toDateString()
  if (isToday) return date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
  return date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })
}

const TICKET_STATUS_LABELS: Record<string, { label: string; color: string }> = {
  open: { label: 'Offen', color: '#EAB308' },
  in_progress: { label: 'In Bearbeitung', color: '#3B82F6' },
}

export default function ChatPage() {
  const { user, loading } = useAuth()
  const [activeTab, setActiveTab] = useState<'chats' | 'anfragen'>('chats')

  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loadingConversations, setLoadingConversations] = useState(true)
  const [tickets, setTickets] = useState<Ticket[]>([])

  // Die aktive Auswahl kann entweder eine normale Konversation oder ein
  // Support-Ticket sein — beide laufen über komplett unterschiedliche APIs und
  // Datenmodelle, daher zwei getrennte ID-Felder statt einem gemeinsamen.
  const [activeConvId, setActiveConvId] = useState<string | null>(null)
  const [activeTicketId, setActiveTicketId] = useState<string | null>(null)

  const [showNewConversation, setShowNewConversation] = useState(false)
  const [showGroupManagement, setShowGroupManagement] = useState(false)

  const [messages, setMessages] = useState<Message[]>([])
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const fetchConversations = useCallback(async () => {
    try {
      const res = await fetch('/api/conversations')
      const data = await res.json()
      setConversations(data.conversations || [])
    } catch {
      // Polling-Fehler einfach ignorieren, nächster Versuch folgt in 3s
    } finally {
      setLoadingConversations(false)
    }
  }, [])

  const fetchTickets = useCallback(async () => {
    try {
      const res = await fetch('/api/support/tickets')
      const data = await res.json()
      // Nur eigene Tickets (Ersteller oder Participant) sind hier relevant — die
      // API liefert Staff-Nutzern stattdessen ALLE Tickets (isStaff: true), das
      // wollen wir hier nicht, /chat zeigt nur "meine" Tickets, nicht die Inbox.
      const ownOpenTickets = (data.tickets || []).filter(
        (t: Ticket) => !data.isStaff && t.status !== 'closed'
      )
      setTickets(ownOpenTickets)
    } catch {
      // Polling-Fehler einfach ignorieren, nächster Versuch folgt in 3s
    }
  }, [])

  const fetchMessages = useCallback(async (conversationId: string) => {
    try {
      const res = await fetch(`/api/conversations/${conversationId}`)
      const data = await res.json()
      setMessages(data.messages || [])
    } catch {
      // Polling-Fehler einfach ignorieren, nächster Versuch folgt in 3s
    }
  }, [])

  // Konversationsliste + Tickets pollen
  useEffect(() => {
    if (!user) return
    fetchConversations()
    fetchTickets()
    const interval = setInterval(() => {
      fetchConversations()
      fetchTickets()
    }, POLL_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [user, fetchConversations, fetchTickets])

  // Aktive Konversation pollen (nur wenn keine Ticket-Ansicht aktiv ist)
  useEffect(() => {
    if (!activeConvId) return
    setLoadingMessages(true)
    fetchMessages(activeConvId).finally(() => setLoadingMessages(false))
    const interval = setInterval(() => fetchMessages(activeConvId), POLL_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [activeConvId, fetchMessages])

  // Beim Öffnen einer Konversation den Ungelesen-Badge in der Liste sofort lokal
  // auf 0 setzen (das GET der Nachrichten markiert serverseitig schon als gelesen,
  // aber die Liste selbst pollt erst beim nächsten Intervall neu).
  const openConversation = (id: string) => {
    setActiveTab('chats')
    setActiveTicketId(null)
    setActiveConvId(id)
    setConversations(prev => prev.map(c => c.id === id ? { ...c, unreadCount: 0 } : c))
  }

  const openTicket = (id: string) => {
    setActiveTab('chats')
    setActiveConvId(null)
    setActiveTicketId(id)
  }

  // Wird vom "Neue Konversation"-Modal und vom Anfragen-Tab (nach Annahme einer
  // Anfrage) aufgerufen — beide Fälle laufen auf dasselbe hinaus: Konversation
  // öffnen und die Liste sofort neu laden, damit sie auch ohne Warten auf das
  // nächste Polling-Intervall links auftaucht.
  const handleConversationReady = (conversationId: string) => {
    setShowNewConversation(false)
    fetchConversations()
    openConversation(conversationId)
  }

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = async () => {
    if (!activeConvId || !input.trim() || sending) return
    setSending(true)
    try {
      const res = await fetch(`/api/conversations/${activeConvId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: input.trim() }),
      })
      if (res.ok) {
        setInput('')
        fetchMessages(activeConvId)
      }
    } finally {
      setSending(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--background)', color: 'var(--foreground)' }}>
        Laden...
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--background)' }}>
        <div className="text-center">
          <p className="mb-4" style={{ color: 'var(--muted)' }}>Du musst eingeloggt sein.</p>
          <Link href="/login" className="btn-gradient text-white px-6 py-3 rounded-xl">Einloggen</Link>
        </div>
      </div>
    )
  }

  const activeConversation = conversations.find(c => c.id === activeConvId) || null
  const activeTicket = tickets.find(t => t.id === activeTicketId) || null

  return (
    <div className="min-h-screen" style={{ background: 'var(--background)' }}>
      <div className="max-w-6xl mx-auto px-8 py-10">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold" style={{ color: 'var(--foreground)' }}>Nachrichten</h1>
          <button
            onClick={() => setShowNewConversation(true)}
            className="btn-gradient text-white px-5 py-2.5 rounded-xl text-sm font-medium"
          >
            + Neue Konversation
          </button>
        </div>

        <div className="card rounded-2xl overflow-hidden flex" style={{ height: '70vh', minHeight: '500px' }}>
          {/* Linke Spalte: Tabs + Konversationsliste / Anfragen */}
          <div className="w-[320px] flex-shrink-0 flex flex-col" style={{ borderRight: '1px solid var(--card-border)' }}>
            <div className="flex" style={{ borderBottom: '1px solid var(--card-border)' }}>
              <button
                onClick={() => setActiveTab('chats')}
                className="flex-1 px-4 py-3 text-sm font-medium transition-all"
                style={activeTab === 'chats'
                  ? { color: 'var(--foreground)', borderBottom: '2px solid #16A34A' }
                  : { color: 'var(--muted)' }}
              >
                Chats
              </button>
              <button
                onClick={() => setActiveTab('anfragen')}
                className="flex-1 px-4 py-3 text-sm font-medium transition-all"
                style={activeTab === 'anfragen'
                  ? { color: 'var(--foreground)', borderBottom: '2px solid #16A34A' }
                  : { color: 'var(--muted)' }}
              >
                Anfragen
              </button>
            </div>

            {activeTab === 'anfragen' ? (
              <MessageRequestsTab onAccepted={handleConversationReady} />
            ) : (
              <div className="flex-1 overflow-y-auto">
                {/* Offene Support-Tickets — eigenes Datenmodell, daher oberhalb der
                    normalen Konversationen mit eigener Optik (Ticket-Icon statt Avatar) */}
                {tickets.map(ticket => {
                  const statusInfo = TICKET_STATUS_LABELS[ticket.status] || TICKET_STATUS_LABELS.open
                  return (
                    <button
                      key={`ticket-${ticket.id}`}
                      onClick={() => openTicket(ticket.id)}
                      className="w-full flex items-center gap-3 px-5 py-3 text-left transition-all hover:opacity-80"
                      style={{
                        borderBottom: '1px solid var(--card-border)',
                        background: activeTicketId === ticket.id ? 'var(--muted-bg)' : 'transparent',
                      }}
                    >
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-lg"
                        style={{ background: 'var(--muted-bg)' }}>
                        🎫
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate" style={{ color: 'var(--foreground)' }}>
                          {ticket.subject}
                        </p>
                        <p className="text-xs truncate" style={{ color: statusInfo.color }}>
                          {statusInfo.label}
                        </p>
                      </div>
                    </button>
                  )
                })}

                {loadingConversations ? (
                  <p className="text-sm text-center py-8" style={{ color: 'var(--muted)' }}>Laden...</p>
                ) : conversations.length === 0 && tickets.length === 0 ? (
                  <div className="text-center py-10 px-4">
                    <p className="text-3xl mb-2">💬</p>
                    <p className="text-sm" style={{ color: 'var(--muted)' }}>Noch keine Konversationen.</p>
                  </div>
                ) : (
                  conversations.map(conv => (
                    <button
                      key={conv.id}
                      onClick={() => openConversation(conv.id)}
                      className="w-full flex items-center gap-3 px-5 py-3 text-left transition-all hover:opacity-80"
                      style={{
                        borderBottom: '1px solid var(--card-border)',
                        background: activeConvId === conv.id ? 'var(--muted-bg)' : 'transparent',
                      }}
                    >
                      {conv.type === 'group' ? (
                        conv.avatar_url ? (
                          <img src={conv.avatar_url} alt=""
                            className="w-10 h-10 rounded-xl flex-shrink-0 object-cover" />
                        ) : (
                          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-lg"
                            style={{ background: 'var(--muted-bg)' }}>
                            👥
                          </div>
                        )
                      ) : (
                        <img src={conversationAvatarUrl(conv, user.id)} alt=""
                          className="w-10 h-10 rounded-xl flex-shrink-0" />
                      )}

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-medium truncate" style={{ color: 'var(--foreground)' }}>
                            {conversationDisplayName(conv, user.id)}
                          </p>
                          {conv.lastMessage && (
                            <span className="text-xs flex-shrink-0" style={{ color: 'var(--muted)' }}>
                              {formatTime(conv.lastMessage.created_at)}
                            </span>
                          )}
                        </div>
                        <p className="text-xs truncate" style={{ color: 'var(--muted)' }}>
                          {previewText(conv.lastMessage)}
                        </p>
                      </div>

                      {conv.unreadCount > 0 && (
                        <span className="flex-shrink-0 bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5 min-w-[20px] text-center">
                          {conv.unreadCount}
                        </span>
                      )}
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Chat-Fenster */}
          <div className="flex-1 flex flex-col min-w-0">
            {activeTicket ? (
              <TicketChatPanel
                ticketId={activeTicket.id}
                subject={activeTicket.subject}
                status={activeTicket.status}
              />
            ) : !activeConversation ? (
              <div className="flex-1 flex items-center justify-center">
                <p className="text-sm" style={{ color: 'var(--muted)' }}>Wähle eine Konversation aus.</p>
              </div>
            ) : (
              <>
                {/* Header */}
                <div className="flex items-center gap-3 px-5 py-4" style={{ borderBottom: '1px solid var(--card-border)' }}>
                  {activeConversation.type === 'group' ? (
                    activeConversation.avatar_url ? (
                      <img src={activeConversation.avatar_url} alt=""
                        className="w-9 h-9 rounded-xl flex-shrink-0 object-cover" />
                    ) : (
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-base"
                        style={{ background: 'var(--muted-bg)' }}>
                        👥
                      </div>
                    )
                  ) : (
                    <img src={conversationAvatarUrl(activeConversation, user.id)} alt=""
                      className="w-9 h-9 rounded-xl flex-shrink-0" />
                  )}
                  <p className="font-medium text-sm flex-1" style={{ color: 'var(--foreground)' }}>
                    {conversationDisplayName(activeConversation, user.id)}
                  </p>
                  {activeConversation.type === 'group' && (
                    <button
                      onClick={() => setShowGroupManagement(true)}
                      title="Gruppe verwalten"
                      className="text-sm hover:opacity-70 transition-all flex-shrink-0"
                      style={{ color: 'var(--muted)' }}
                    >
                      ⚙️
                    </button>
                  )}
                </div>

                {/* Nachrichten */}
                <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-3">
                  {loadingMessages ? (
                    <p className="text-sm text-center py-8" style={{ color: 'var(--muted)' }}>Laden...</p>
                  ) : messages.length === 0 ? (
                    <p className="text-sm text-center py-8" style={{ color: 'var(--muted)' }}>
                      Noch keine Nachrichten. Schreib die erste!
                    </p>
                  ) : (
                    messages.map(msg => {
                      const isOwn = msg.sender_id === user.id
                      return (
                        <div key={msg.id} className={`flex items-end gap-2 ${isOwn ? 'flex-row-reverse' : ''}`}>
                          {!isOwn && (
                            <img src={`https://mc-heads.net/avatar/${msg.users.username}/24`} alt=""
                              className="w-6 h-6 rounded mb-0.5 flex-shrink-0" />
                          )}
                          <div
                            className="max-w-[60%] rounded-2xl px-4 py-2.5 text-sm"
                            style={isOwn
                              ? { background: '#16A34A', color: 'white' }
                              : { background: 'var(--muted-bg)', color: 'var(--foreground)', border: '1px solid var(--card-border)' }
                            }
                          >
                            {msg.image_url && (
                              <img src={msg.image_url} alt="" className="rounded-lg mb-1 max-w-full" />
                            )}
                            {msg.content && <p>{msg.content}</p>}
                            <p className="text-xs mt-1 opacity-70">{formatTime(msg.created_at)}</p>
                          </div>
                        </div>
                      )
                    })
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Eingabe */}
                <div className="flex gap-2 px-5 py-4" style={{ borderTop: '1px solid var(--card-border)' }}>
                  <input
                    type="text"
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') sendMessage() }}
                    placeholder="Nachricht schreiben..."
                    maxLength={2000}
                    className="flex-1 rounded-xl px-4 py-2.5 text-sm outline-none"
                    style={{ background: 'var(--muted-bg)', border: '1px solid var(--card-border)', color: 'var(--foreground)' }}
                  />
                  <button
                    onClick={sendMessage}
                    disabled={sending || !input.trim()}
                    className="px-5 py-2.5 rounded-xl text-sm font-medium text-white disabled:opacity-50"
                    style={{ background: '#16A34A' }}
                  >
                    Senden
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {showNewConversation && (
        <NewConversationModal
          onClose={() => setShowNewConversation(false)}
          onConversationStarted={handleConversationReady}
        />
      )}

      {showGroupManagement && activeConversation && (
        <GroupManagementPanel
          conversationId={activeConversation.id}
          groupName={activeConversation.name || 'Gruppe'}
          avatarUrl={activeConversation.avatar_url}
          onClose={() => setShowGroupManagement(false)}
          onUpdated={() => {
            setShowGroupManagement(false)
            fetchConversations()
          }}
        />
      )}
    </div>
  )
}