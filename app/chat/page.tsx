'use client'

import { useState, useEffect, useCallback, useRef, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { useAuth } from '../lib/auth-context'
import Link from 'next/link'
import NewConversationModal from '../components/NewConversationModal'
import MessageRequestsTab from '../components/MessageRequestsTab'
import TicketChatPanel from '../components/TicketChatPanel'
import GroupManagementPanel from '../components/GroupManagementPanel'
import ChatLogMenu from '../components/ChatLogMenu'
import EditHistoryModal from '../components/EditHistoryModal'
import PersonDetailPanel from '../components/PersonDetailPanel'

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
  location_label: string | null
  location_chunk_x: number | null
  location_chunk_z: number | null
  edited_at: string | null
  read_ingame_at: string | null
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

type FriendEntry = {
  id: string
  status: 'pending' | 'accepted'
  created_at: string
  sender: { id: string; username: string }
  receiver: { id: string; username: string }
}

type NotificationEntry = {
  id: number
  category: 'system' | 'friends' | 'leadership'
  title: string
  body: string | null
  link: string | null
  read: boolean
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
  return `/api/player-heads/${mcName}/40`
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

function ChatPageInner() {
  const { user, loading } = useAuth()
  const searchParams = useSearchParams()
  const disputeViewId = searchParams.get('dispute_view')
  const [disputeStatus, setDisputeStatus] = useState<'idle' | 'sending' | 'done' | 'error'>('idle')
  const [disputeTicketId, setDisputeTicketId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'chats' | 'anfragen'>('chats')
  // Übergeordnete Bereichs-Auswahl (Konzept: Chats/Freunde/Mitteilungen auf einer
  // Seite statt drei getrennter Navbar-Ziele). 'chats' behält seine bisherige
  // Chats/Anfragen-Unteraufteilung über activeTab bei. Initial aus ?tab=... lesbar,
  // damit /freunde (Redirect) und die Mitteilungen-Glocke gezielt verlinken können.
  const initialTab = searchParams.get('tab')
  const [mainSection, setMainSection] = useState<'chats' | 'freunde' | 'mitteilungen'>(
    initialTab === 'freunde' || initialTab === 'mitteilungen' ? initialTab : 'chats'
  )

  const [friends, setFriends] = useState<FriendEntry[]>([])
  const [friendsUserId, setFriendsUserId] = useState<string | null>(null)
  const [loadingFriends, setLoadingFriends] = useState(true)
  const [friendTab, setFriendTab] = useState<'freunde' | 'anfragen'>('freunde')
  const [newFriendInput, setNewFriendInput] = useState('')
  const [sendingFriendRequest, setSendingFriendRequest] = useState(false)
  const [friendError, setFriendError] = useState('')
  const [friendSuccess, setFriendSuccess] = useState('')
  const [selectedFriendUsername, setSelectedFriendUsername] = useState<string | null>(null)
  const [friendSearch, setFriendSearch] = useState('')
  const [conversationSearch, setConversationSearch] = useState('')

  const [notifications, setNotifications] = useState<NotificationEntry[]>([])
  const [loadingNotifications, setLoadingNotifications] = useState(true)
  const [notificationCategory, setNotificationCategory] = useState<NotificationEntry['category']>('system')

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
  const [showChatLogMenu, setShowChatLogMenu] = useState(false)
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null)
  const [editingContent, setEditingContent] = useState('')
  const [savingEdit, setSavingEdit] = useState(false)
  const [historyMessageId, setHistoryMessageId] = useState<string | null>(null)

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

  const fetchFriends = useCallback(async () => {
    try {
      const res = await fetch('/api/friends')
      const data = await res.json()
      setFriends(data.friends || [])
      setFriendsUserId(data.userId || null)
    } catch {
      // Polling-Fehler ignorieren
    } finally {
      setLoadingFriends(false)
    }
  }, [])

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications')
      const data = await res.json()
      setNotifications(data.notifications || [])
    } catch {
      // Polling-Fehler ignorieren
    } finally {
      setLoadingNotifications(false)
    }
  }, [])

  const handleAddFriend = async () => {
    if (!newFriendInput.trim()) return
    setSendingFriendRequest(true); setFriendError(''); setFriendSuccess('')
    const res = await fetch('/api/friends', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ receiver_username: newFriendInput.trim() }),
    })
    const data = await res.json()
    if (res.ok) { setFriendSuccess(`Anfrage an ${newFriendInput} gesendet!`); setNewFriendInput(''); fetchFriends() }
    else setFriendError(data.error || 'Fehler')
    setSendingFriendRequest(false)
  }

  const handleFriendAction = async (id: string, action: 'accept' | 'decline' | 'remove') => {
    await fetch('/api/friends', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, action }),
    })
    if (action === 'remove') setSelectedFriendUsername(null)
    fetchFriends()
  }

  const markNotificationRead = async (id: number) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
    await fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
  }

  const markAllNotificationsRead = async () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
    await fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ markAllRead: true }),
    })
  }

  // Wird von PersonDetailPanel aufgerufen (Nachricht-Button auf einem Freundes-
  // Profil): findet/erstellt die direct-Konversation und wechselt in den Chats-Bereich.
  const handleMessagePerson = async (username: string, targetUserId: string | null) => {
    if (!targetUserId) return // MC-only-Spieler können aktuell nicht direkt aus der Website angeschrieben werden
    const res = await fetch('/api/conversations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'direct', target_user_id: targetUserId }),
    })
    const data = await res.json()
    if (res.ok && data.conversation_id) {
      setMainSection('chats')
      handleConversationReady(data.conversation_id)
    }
  }

  const fetchMessages = useCallback(async (conversationId: string) => {
    try {
      const res = await fetch(`/api/conversations/${conversationId}`)
      const data = await res.json()
      setMessages(data.messages || [])
    } catch {
      // Polling-Fehler einfach ignorieren, nächster Versuch folgt in 3s
    }
  }, [])

  const startEditing = (msg: Message) => {
    setEditingMessageId(msg.id)
    setEditingContent(msg.content || '')
  }

  const cancelEditing = () => {
    setEditingMessageId(null)
    setEditingContent('')
  }

  const saveEditedMessage = async (conversationId: string, messageId: string) => {
    if (!editingContent.trim()) return
    setSavingEdit(true)
    const res = await fetch(`/api/conversations/${conversationId}/messages/${messageId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: editingContent.trim() }),
    })
    if (res.ok) {
      setMessages(prev => prev.map(m => m.id === messageId ? { ...m, content: editingContent.trim(), edited_at: new Date().toISOString() } : m))
      setEditingMessageId(null)
      setEditingContent('')
    }
    setSavingEdit(false)
  }

  const submitDispute = async () => {
    if (!disputeViewId) return
    setDisputeStatus('sending')
    const res = await fetch(`/api/admin-chatlog-views/${disputeViewId}/dispute`, { method: 'POST' })
    const data = await res.json()
    if (res.ok) {
      setDisputeTicketId(data.ticket_id)
      setDisputeStatus('done')
    } else {
      setDisputeStatus('error')
    }
  }

  // Konversationsliste + Tickets + Freunde + Mitteilungen pollen
  useEffect(() => {
    if (!user) return
    fetchConversations()
    fetchTickets()
    fetchFriends()
    fetchNotifications()
    const interval = setInterval(() => {
      fetchConversations()
      fetchTickets()
      fetchFriends()
      fetchNotifications()
    }, POLL_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [user, fetchConversations, fetchTickets, fetchFriends, fetchNotifications])

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

  // Statt schwebender Popups: eine der vier "Unteransichten" (Neue Konversation,
  // Gruppe verwalten, Chat-Verlauf, Bearbeitungshistorie) ersetzt komplett den
  // Inhaltsbereich unter der Navbar, bis man auf "← Zurück" klickt.
  const activeOverlay: 'new-conversation' | 'group-management' | 'chatlog-menu' | 'edit-history' | null =
    showNewConversation ? 'new-conversation'
    : (showGroupManagement && activeConversation) ? 'group-management'
    : (showChatLogMenu && activeConversation) ? 'chatlog-menu'
    : (historyMessageId && activeConversation) ? 'edit-history'
    : null

  const filteredConversations = conversationSearch.trim()
    ? conversations.filter(c => conversationDisplayName(c, user.id).toLowerCase().includes(conversationSearch.trim().toLowerCase()))
    : conversations

  return (
    <div className="h-[calc(100vh-73px)] flex flex-col" style={{ background: 'var(--background)' }}>
      {activeOverlay === 'new-conversation' && (
        <NewConversationModal
          onClose={() => setShowNewConversation(false)}
          onConversationStarted={handleConversationReady}
        />
      )}
      {activeOverlay === 'group-management' && activeConversation && (
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
      {activeOverlay === 'chatlog-menu' && activeConversation && (
        <ChatLogMenu
          conversationId={activeConversation.id}
          messages={messages}
          // Vereinfachung: in freien Gruppen wird der "Pin lösen"-Button hier bewusst
          // ausgeblendet, weil diese Seite die Rollen-/Berechtigungsdaten des Nutzers
          // aktuell nicht lädt (das macht nur GroupManagementPanel). Der Server prüft
          // die Berechtigung ohnehin korrekt ab (siehe pins/route.ts) - das ist also
          // "nur" eine UI-Einschränkung, kein Sicherheitsproblem. Kann bei Bedarf
          // später ergänzt werden, indem die eigene Rolle hier mitgeladen wird.
          canManagePins={activeConversation.type !== 'group'}
          onClose={() => setShowChatLogMenu(false)}
        />
      )}
      {activeOverlay === 'edit-history' && activeConversation && historyMessageId && (
        <EditHistoryModal
          conversationId={activeConversation.id}
          messageId={historyMessageId}
          onClose={() => setHistoryMessageId(null)}
        />
      )}

      {!activeOverlay && (
      <>
      {disputeViewId && disputeStatus !== 'done' && (
        <div className="px-6 pt-4 flex-shrink-0">
          <div className="rounded-2xl p-4 flex items-center justify-between gap-4" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)' }}>
            <p className="text-sm" style={{ color: 'var(--foreground)' }}>
              Ein Admin hat diese Konversation eingesehen. Falls dir die Begründung nicht plausibel erscheint, kannst du das anfechten — es wird automatisch ein Support-Ticket erstellt.
            </p>
            <button onClick={submitDispute} disabled={disputeStatus === 'sending'}
              className="text-sm px-4 py-2 rounded-xl font-medium text-white disabled:opacity-50 flex-shrink-0"
              style={{ background: '#EF4444' }}>
              {disputeStatus === 'sending' ? 'Wird gesendet...' : 'Begründung anstreiten'}
            </button>
          </div>
          {disputeStatus === 'error' && <p className="text-red-500 text-sm mt-2">Fehler beim Anfechten. Bitte erneut versuchen.</p>}
        </div>
      )}
      {disputeStatus === 'done' && disputeTicketId && (
        <div className="px-6 pt-4 flex-shrink-0">
          <div className="rounded-2xl p-4" style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)' }}>
            <p className="text-sm" style={{ color: 'var(--foreground)' }}>
              Anfechtung eingereicht. <Link href={`/support/${disputeTicketId}`} className="underline font-medium">Zum Support-Ticket</Link>
            </p>
          </div>
        </div>
      )}

      <div className="flex-1 flex min-h-0">
        {/* Icon-Leiste ganz links: ersetzt die bisherige obere Tab-Leiste */}
        <div className="w-[88px] flex-shrink-0 flex flex-col items-center py-6" style={{ borderRight: '1px solid var(--card-border)' }}>
          <div className="flex-1" />
          <div className="flex flex-col items-center gap-3">
          {(['chats', 'freunde', 'mitteilungen'] as const).map(section => {
            const unread = section === 'chats'
              ? conversations.reduce((sum, c) => sum + c.unreadCount, 0) + tickets.length
              : section === 'freunde'
              ? friends.filter(f => f.status === 'pending' && f.receiver.id === friendsUserId).length
              : notifications.filter(n => !n.read).length
            const icons = { chats: '💬', freunde: '👥', mitteilungen: '🔔' }
            const labels = { chats: 'Chats', freunde: 'Freunde', mitteilungen: 'Mitteilungen' }
            return (
              <button key={section} onClick={() => setMainSection(section)}
                className="relative w-16 flex flex-col items-center gap-1.5 py-3 rounded-2xl transition-all duration-200"
                style={mainSection === section
                  ? { background: 'var(--muted-bg)', color: 'var(--foreground)' }
                  : { color: 'var(--muted)' }}>
                <span className="text-xl leading-none">{icons[section]}</span>
                <span className="text-[10px] font-medium leading-none">{labels[section]}</span>
                {unread > 0 && (
                  <span className="absolute top-1.5 right-2.5 inline-flex items-center justify-center rounded-full text-white font-bold" style={{ width: 16, height: 16, fontSize: 9, background: '#EF4444' }}>
                    {unread > 9 ? '9+' : unread}
                  </span>
                )}
              </button>
            )
          })}
          </div>
          <div className="flex-1" />
          <Link href="/einstellungen" title="Einstellungen"
            className="w-10 h-10 flex items-center justify-center rounded-xl hover:opacity-70 transition-all flex-shrink-0"
            style={{ color: 'var(--muted)' }}>
            ⚙️
          </Link>
        </div>

        {/* Liste: je nach Bereich unterschiedlicher Inhalt */}
          <div className="w-[340px] flex-shrink-0 flex flex-col" style={{ borderRight: '1px solid var(--card-border)' }}>
            {mainSection === 'chats' && (
            <>
            <div className="flex items-center justify-between px-5 pt-8 pb-4 flex-shrink-0">
              <h1 className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>Nachrichten</h1>
              <button
                onClick={() => setShowNewConversation(true)}
                title="Neue Konversation"
                className="btn-gradient text-white w-9 h-9 rounded-xl text-lg font-medium flex items-center justify-center flex-shrink-0"
              >
                +
              </button>
            </div>
            <div className="px-5 pb-5 flex-shrink-0">
              <input value={conversationSearch} onChange={e => setConversationSearch(e.target.value)}
                placeholder="Suchen..."
                className="w-full rounded-xl px-3 py-2 text-sm outline-none"
                style={{ background: 'var(--muted-bg)', border: '1px solid var(--card-border)', color: 'var(--foreground)' }} />
            </div>
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
                ) : filteredConversations.length === 0 && tickets.length === 0 ? (
                  <div className="text-center py-10 px-4">
                    <p className="text-3xl mb-2">💬</p>
                    <p className="text-sm" style={{ color: 'var(--muted)' }}>
                      {conversationSearch.trim() ? 'Keine Treffer.' : 'Noch keine Konversationen.'}
                    </p>
                  </div>
                ) : (
                  filteredConversations.map(conv => (
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
            </>
            )}

            {mainSection === 'freunde' && (
              <>
                <div className="px-5 pt-5 pb-3 flex-shrink-0">
                  <h1 className="text-2xl font-bold mb-3" style={{ color: 'var(--foreground)' }}>Freunde</h1>
                  <div className="flex gap-2 mb-2">
                    <input value={newFriendInput} onChange={e => setNewFriendInput(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleAddFriend()}
                      placeholder="Username hinzufügen..."
                      className="flex-1 rounded-xl px-3 py-2 text-sm outline-none"
                      style={{ background: 'var(--muted-bg)', border: '1px solid var(--card-border)', color: 'var(--foreground)' }} />
                    <button onClick={handleAddFriend} disabled={sendingFriendRequest || !newFriendInput.trim()}
                      className="text-sm px-4 py-2 rounded-xl font-medium text-white disabled:opacity-50 flex-shrink-0" style={{ background: '#7C3AED' }}>
                      Anfrage
                    </button>
                  </div>
                  {friendError && <p className="text-xs mb-2" style={{ color: '#EF4444' }}>{friendError}</p>}
                  {friendSuccess && <p className="text-xs mb-2" style={{ color: '#22C55E' }}>{friendSuccess}</p>}
                  <input value={friendSearch} onChange={e => setFriendSearch(e.target.value)}
                    placeholder="Freunde durchsuchen..."
                    className="w-full rounded-xl px-3 py-2 text-sm outline-none"
                    style={{ background: 'var(--muted-bg)', border: '1px solid var(--card-border)', color: 'var(--foreground)' }} />
                </div>
                <div className="flex" style={{ borderBottom: '1px solid var(--card-border)' }}>
                  <button onClick={() => setFriendTab('freunde')}
                    className="flex-1 px-4 py-2.5 text-sm font-medium transition-all"
                    style={friendTab === 'freunde' ? { color: 'var(--foreground)', borderBottom: '2px solid #16A34A' } : { color: 'var(--muted)' }}>
                    Freunde ({friends.filter(f => f.status === 'accepted').length})
                  </button>
                  <button onClick={() => setFriendTab('anfragen')}
                    className="flex-1 px-4 py-2.5 text-sm font-medium transition-all"
                    style={friendTab === 'anfragen' ? { color: 'var(--foreground)', borderBottom: '2px solid #16A34A' } : { color: 'var(--muted)' }}>
                    Anfragen {friends.filter(f => f.status === 'pending' && f.receiver.id === friendsUserId).length > 0 && (
                      <span className="ml-1 bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5">
                        {friends.filter(f => f.status === 'pending' && f.receiver.id === friendsUserId).length}
                      </span>
                    )}
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto">
                  {loadingFriends ? (
                    <p className="text-sm text-center py-8" style={{ color: 'var(--muted)' }}>Laden...</p>
                  ) : friendTab === 'freunde' ? (
                    (() => {
                      const acceptedFriends = friends.filter(f => f.status === 'accepted').filter(f => {
                        const friendName = f.sender.id === friendsUserId ? f.receiver.username : f.sender.username
                        return !friendSearch.trim() || friendName.toLowerCase().includes(friendSearch.trim().toLowerCase())
                      })
                      return acceptedFriends.length === 0 ? (
                        <p className="text-sm text-center py-8" style={{ color: 'var(--muted)' }}>
                          {friendSearch.trim() ? 'Keine Treffer.' : 'Noch keine Freunde.'}
                        </p>
                      ) : (
                      acceptedFriends.map(f => {
                        const friendName = f.sender.id === friendsUserId ? f.receiver.username : f.sender.username
                        return (
                          <button key={f.id} onClick={() => setSelectedFriendUsername(friendName)}
                            className="w-full flex items-center gap-3 px-4 py-3 text-left transition-all hover:opacity-80"
                            style={{ borderBottom: '1px solid var(--card-border)', background: selectedFriendUsername === friendName ? 'var(--muted-bg)' : 'transparent' }}>
                            <img src={`/api/player-heads/${friendName}/40`} alt="" className="w-10 h-10 rounded-xl flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate" style={{ color: 'var(--foreground)' }}>{friendName}</p>
                              <p className="text-xs" style={{ color: 'var(--muted)' }}>Freunde seit {new Date(f.created_at).toLocaleDateString('de-DE')}</p>
                            </div>
                          </button>
                        )
                      })
                      )
                    })()
                  ) : (
                    <>
                      {friends.filter(f => f.status === 'pending' && f.receiver.id === friendsUserId).map(f => (
                        <div key={f.id} className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: '1px solid var(--card-border)' }}>
                          <img src={`/api/player-heads/${f.sender.username}/40`} alt="" className="w-10 h-10 rounded-xl flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate" style={{ color: 'var(--foreground)' }}>{f.sender.username}</p>
                            <p className="text-xs" style={{ color: 'var(--muted)' }}>Möchte dein Freund sein</p>
                          </div>
                          <button onClick={() => handleFriendAction(f.id, 'accept')} className="text-xs px-2 py-1 rounded-lg text-white" style={{ background: '#639922' }}>✓</button>
                          <button onClick={() => handleFriendAction(f.id, 'decline')} className="text-xs px-2 py-1 rounded-lg" style={{ color: '#EF4444', background: 'rgba(239,68,68,0.1)' }}>✕</button>
                        </div>
                      ))}
                      {friends.filter(f => f.status === 'pending' && f.sender.id === friendsUserId).map(f => (
                        <div key={f.id} className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: '1px solid var(--card-border)' }}>
                          <img src={`/api/player-heads/${f.receiver.username}/40`} alt="" className="w-10 h-10 rounded-xl flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate" style={{ color: 'var(--foreground)' }}>{f.receiver.username}</p>
                            <p className="text-xs" style={{ color: 'var(--muted)' }}>Ausstehend</p>
                          </div>
                          <button onClick={() => handleFriendAction(f.id, 'remove')} className="text-xs px-2 py-1 rounded-lg" style={{ color: '#EF4444', background: 'rgba(239,68,68,0.1)' }}>Zurückziehen</button>
                        </div>
                      ))}
                      {friends.filter(f => f.status === 'pending').length === 0 && (
                        <p className="text-sm text-center py-8" style={{ color: 'var(--muted)' }}>Keine offenen Anfragen.</p>
                      )}
                    </>
                  )}
                </div>
              </>
            )}

            {mainSection === 'mitteilungen' && (
              <>
                <div className="flex items-center justify-between px-5 pt-5 pb-3 flex-shrink-0">
                  <h1 className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>Mitteilungen</h1>
                  {notifications.some(n => !n.read) && (
                    <button onClick={markAllNotificationsRead} className="text-sm font-medium hover:opacity-70" style={{ color: '#7C3AED' }}>Alle lesen</button>
                  )}
                </div>
                <div className="flex" style={{ borderBottom: '1px solid var(--card-border)' }}>
                  {([
                    { key: 'system' as const, label: '⚙️ System' },
                    { key: 'friends' as const, label: '👥 Freunde' },
                    { key: 'leadership' as const, label: '🛡️ Leitung' },
                  ]).map(tab => {
                    const count = notifications.filter(n => n.category === tab.key && !n.read).length
                    return (
                      <button key={tab.key} onClick={() => setNotificationCategory(tab.key)}
                        className="flex-1 text-xs font-medium py-2.5 transition flex items-center justify-center gap-1"
                        style={notificationCategory === tab.key ? { color: '#16A34A', borderBottom: '2px solid #16A34A' } : { color: 'var(--muted)' }}>
                        {tab.label}
                        {count > 0 && (
                          <span className="rounded-full text-white font-bold flex items-center justify-center" style={{ width: 14, height: 14, fontSize: 8, background: '#EF4444' }}>
                            {count > 9 ? '9' : count}
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
                <div className="flex-1 overflow-y-auto">
                  {loadingNotifications ? (
                    <p className="text-sm text-center py-8" style={{ color: 'var(--muted)' }}>Laden...</p>
                  ) : notifications.filter(n => n.category === notificationCategory).length === 0 ? (
                    <p className="text-sm text-center py-8" style={{ color: 'var(--muted)' }}>Keine Mitteilungen.</p>
                  ) : (
                    notifications.filter(n => n.category === notificationCategory).map(n => {
                      const body = (
                        <div className="px-4 py-3 transition cursor-pointer"
                          style={{ background: n.read ? 'transparent' : 'rgba(22,163,74,0.06)', borderBottom: '1px solid var(--card-border)' }}
                          onClick={() => { if (!n.read) markNotificationRead(n.id) }}>
                          <div className="flex items-start gap-2">
                            {!n.read && <span className="w-2 h-2 rounded-full flex-shrink-0 mt-1.5" style={{ background: '#16A34A' }} />}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>{n.title}</p>
                              {n.body && <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>{n.body}</p>}
                            </div>
                          </div>
                        </div>
                      )
                      return n.link ? (
                        <Link key={n.id} href={n.link} className="block hover:opacity-90">{body}</Link>
                      ) : <div key={n.id}>{body}</div>
                    })
                  )}
                </div>
              </>
            )}
          </div>

          {/* Rechte Spalte: je nach Bereich unterschiedlicher Inhalt */}
          <div className="flex-1 flex flex-col min-w-0">
            {mainSection === 'chats' && (
            <>
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
                  <button
                    onClick={() => setShowChatLogMenu(true)}
                    title="Verlauf, Links & Pins"
                    className="text-sm hover:opacity-70 transition-all flex-shrink-0"
                    style={{ color: 'var(--muted)' }}
                  >
                    ⋯
                  </button>
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
                      const isEditing = editingMessageId === msg.id
                      return (
                        <div key={msg.id} className={`flex items-end gap-2 group ${isOwn ? 'flex-row-reverse' : ''}`}>
                          {!isOwn && (
                            <img src={`/api/player-heads/${msg.users.username}/24`} alt=""
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
                            {isEditing ? (
                              <div className="flex flex-col gap-1.5">
                                <input
                                  type="text"
                                  value={editingContent}
                                  onChange={e => setEditingContent(e.target.value)}
                                  onKeyDown={e => {
                                    if (e.key === 'Enter') saveEditedMessage(activeConvId!, msg.id)
                                    if (e.key === 'Escape') cancelEditing()
                                  }}
                                  autoFocus
                                  maxLength={2000}
                                  className="rounded-lg px-2 py-1 text-sm outline-none"
                                  style={{ background: 'rgba(255,255,255,0.15)', color: 'inherit' }}
                                />
                                <div className="flex gap-2 text-xs">
                                  <button onClick={() => saveEditedMessage(activeConvId!, msg.id)} disabled={savingEdit}
                                    className="underline disabled:opacity-50">Speichern</button>
                                  <button onClick={cancelEditing} className="underline opacity-80">Abbrechen</button>
                                </div>
                              </div>
                            ) : (
                              <>
                                {msg.content && <p>{msg.content}</p>}
                                <p className="text-xs mt-1 opacity-70">
                                  {formatTime(msg.created_at)}
                                  {msg.edited_at && (
                                    <button onClick={() => setHistoryMessageId(msg.id)} className="underline ml-1">bearbeitet</button>
                                  )}
                                  {isOwn && (
                                    <span className="ml-1.5" title={msg.read_ingame_at ? `Ingame gelesen um ${formatTime(msg.read_ingame_at)}` : 'Noch nicht ingame gelesen'}>
                                      {msg.read_ingame_at ? '✓✓ Ingame gelesen' : '✓ Gesendet'}
                                    </span>
                                  )}
                                </p>
                              </>
                            )}
                          </div>
                          {isOwn && !isEditing && msg.content && (
                            <button onClick={() => startEditing(msg)} title="Bearbeiten"
                              className="text-xs opacity-0 group-hover:opacity-60 hover:opacity-100 transition-all flex-shrink-0"
                              style={{ color: 'var(--muted)' }}>
                              ✏️
                            </button>
                          )}
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
            </>
            )}

            {mainSection === 'freunde' && (
              <div className="flex-1 overflow-y-auto p-8">
                {!selectedFriendUsername ? (
                  <div className="h-full flex items-center justify-center">
                    <p className="text-sm" style={{ color: 'var(--muted)' }}>Wähle einen Freund aus.</p>
                  </div>
                ) : (
                  <PersonDetailPanel
                    username={selectedFriendUsername}
                    userId={(() => {
                      const f = friends.find(fr => fr.status === 'accepted' &&
                        (fr.sender.username === selectedFriendUsername || fr.receiver.username === selectedFriendUsername))
                      if (!f) return null
                      return f.sender.username === selectedFriendUsername ? f.sender.id : f.receiver.id
                    })()}
                    isOwnProfile={false}
                    isFriend={true}
                    friendshipId={(() => {
                      const f = friends.find(fr => fr.status === 'accepted' &&
                        (fr.sender.username === selectedFriendUsername || fr.receiver.username === selectedFriendUsername))
                      return f?.id || null
                    })()}
                    friendsSince={(() => {
                      const f = friends.find(fr => fr.status === 'accepted' &&
                        (fr.sender.username === selectedFriendUsername || fr.receiver.username === selectedFriendUsername))
                      return f?.created_at || null
                    })()}
                    onMessage={handleMessagePerson}
                    onFriendRemoved={() => setSelectedFriendUsername(null)}
                  />
                )}
              </div>
            )}

            {mainSection === 'mitteilungen' && (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <p className="text-4xl mb-3">🔔</p>
                  <p className="text-sm" style={{ color: 'var(--muted)' }}>Wähle eine Mitteilung aus.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </>
      )}
    </div>
  )
}

export default function ChatPage() {
  return (
    <Suspense fallback={null}>
      <ChatPageInner />
    </Suspense>
  )
}