'use client'

import { useState, useEffect, useCallback } from 'react'

type RequestUser = {
  username: string
  display_name: string | null
  profile_picture_url: string | null
}

type IncomingRequest = {
  id: string
  sender_id: string
  first_message: string
  status: string
  created_at: string
  users: RequestUser
}

type OutgoingRequest = {
  id: string
  receiver_id: string
  first_message: string
  status: string
  created_at: string
  users: RequestUser
}

type Props = {
  onAccepted: (conversationId: string) => void
}

// Live-Updates laufen per Polling, wie auf der gesamten /chat-Seite — neue
// eingehende Anfragen sollen ohne manuelles Neuladen auftauchen.
const POLL_INTERVAL_MS = 3000

export default function MessageRequestsTab({ onAccepted }: Props) {
  const [incoming, setIncoming] = useState<IncomingRequest[]>([])
  const [outgoing, setOutgoing] = useState<OutgoingRequest[]>([])
  const [loadingRequests, setLoadingRequests] = useState(true)
  const [actingId, setActingId] = useState<string | null>(null)

  const [targetUsername, setTargetUsername] = useState('')
  const [firstMessage, setFirstMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const fetchRequests = useCallback(async () => {
    try {
      const res = await fetch('/api/message-requests')
      const data = await res.json()
      setIncoming(data.incoming || [])
      setOutgoing(data.outgoing || [])
    } catch {
      // Polling-Fehler einfach ignorieren, nächster Versuch folgt in 3s
    } finally {
      setLoadingRequests(false)
    }
  }, [])

  useEffect(() => {
    fetchRequests()
    const interval = setInterval(fetchRequests, POLL_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [fetchRequests])

  const sendRequest = async () => {
    if (!targetUsername.trim() || !firstMessage.trim() || sending) return
    setSending(true)
    setError('')
    setSuccess('')
    try {
      const res = await fetch('/api/message-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ receiver_username: targetUsername.trim(), message: firstMessage.trim() }),
      })
      const data = await res.json()
      if (res.ok) {
        setSuccess(`Anfrage an ${targetUsername} gesendet!`)
        setTargetUsername('')
        setFirstMessage('')
        fetchRequests()
      } else {
        setError(data.error || 'Fehler beim Senden der Anfrage')
      }
    } catch {
      setError('Fehler beim Senden der Anfrage')
    } finally {
      setSending(false)
    }
  }

  const handleAction = async (id: string, action: 'accept' | 'decline') => {
    setActingId(id)
    try {
      const res = await fetch('/api/message-requests', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action }),
      })
      const data = await res.json()
      if (res.ok) {
        fetchRequests()
        if (action === 'accept' && data.conversation_id) {
          onAccepted(data.conversation_id)
        }
      }
    } finally {
      setActingId(null)
    }
  }

  return (
    <div className="flex-1 overflow-y-auto px-5 py-4">
      {/* Neue Anfrage senden */}
      <div className="rounded-xl p-4 mb-5" style={{ background: 'var(--muted-bg)', border: '1px solid var(--card-border)' }}>
        <p className="text-sm font-bold mb-3" style={{ color: 'var(--foreground)' }}>Nachrichtenanfrage senden</p>
        <p className="text-xs mb-3" style={{ color: 'var(--muted)' }}>
          Für Personen, mit denen du noch nicht befreundet bist. Wird erst zur Konversation, wenn sie annehmen.
        </p>
        <input
          type="text"
          value={targetUsername}
          onChange={e => setTargetUsername(e.target.value)}
          placeholder="Username..."
          className="w-full rounded-xl px-4 py-2.5 text-sm outline-none mb-2"
          style={{ background: 'var(--card)', border: '1px solid var(--card-border)', color: 'var(--foreground)' }}
        />
        <textarea
          value={firstMessage}
          onChange={e => setFirstMessage(e.target.value)}
          placeholder="Erste Nachricht..."
          maxLength={500}
          rows={2}
          className="w-full rounded-xl px-4 py-2.5 text-sm outline-none resize-none mb-2"
          style={{ background: 'var(--card)', border: '1px solid var(--card-border)', color: 'var(--foreground)' }}
        />
        <button
          onClick={sendRequest}
          disabled={sending || !targetUsername.trim() || !firstMessage.trim()}
          className="btn-gradient text-white px-5 py-2.5 rounded-xl text-sm font-medium disabled:opacity-50"
        >
          {sending ? '...' : 'Anfrage senden'}
        </button>
        {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
        {success && <p className="text-green-500 text-sm mt-2">{success}</p>}
      </div>

      {loadingRequests ? (
        <p className="text-sm text-center py-8" style={{ color: 'var(--muted)' }}>Laden...</p>
      ) : (
        <>
          {/* Eingehende Anfragen */}
          <div className="mb-5">
            <p className="text-xs font-bold mb-2" style={{ color: 'var(--muted)' }}>
              EINGEHEND {incoming.length > 0 && `(${incoming.length})`}
            </p>
            {incoming.length === 0 ? (
              <p className="text-sm" style={{ color: 'var(--muted)' }}>Keine eingehenden Anfragen.</p>
            ) : (
              <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--card-border)' }}>
                {incoming.map(req => (
                  <div key={req.id} className="flex items-start gap-3 px-4 py-3"
                    style={{ borderBottom: '1px solid var(--card-border)' }}>
                    <img src={`/api/player-heads/${req.users.username}/36`} alt=""
                      className="w-9 h-9 rounded-xl flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
                        {req.users.display_name || req.users.username}
                      </p>
                      <p className="text-sm truncate" style={{ color: 'var(--muted)' }}>{req.first_message}</p>
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      <button
                        onClick={() => handleAction(req.id, 'accept')}
                        disabled={actingId !== null}
                        className="text-sm px-3 py-1.5 rounded-xl transition-all text-white disabled:opacity-50"
                        style={{ background: '#639922' }}
                      >
                        ✓
                      </button>
                      <button
                        onClick={() => handleAction(req.id, 'decline')}
                        disabled={actingId !== null}
                        className="text-sm px-3 py-1.5 rounded-xl transition-all disabled:opacity-50"
                        style={{ color: '#ef4444', background: 'rgba(239,68,68,0.1)' }}
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Ausgehende Anfragen */}
          <div>
            <p className="text-xs font-bold mb-2" style={{ color: 'var(--muted)' }}>
              AUSSTEHEND {outgoing.length > 0 && `(${outgoing.length})`}
            </p>
            {outgoing.length === 0 ? (
              <p className="text-sm" style={{ color: 'var(--muted)' }}>Keine ausstehenden Anfragen.</p>
            ) : (
              <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--card-border)' }}>
                {outgoing.map(req => (
                  <div key={req.id} className="flex items-start gap-3 px-4 py-3"
                    style={{ borderBottom: '1px solid var(--card-border)' }}>
                    <img src={`/api/player-heads/${req.users.username}/36`} alt=""
                      className="w-9 h-9 rounded-xl flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
                        {req.users.display_name || req.users.username}
                      </p>
                      <p className="text-sm truncate" style={{ color: 'var(--muted)' }}>{req.first_message}</p>
                    </div>
                    <span className="text-xs flex-shrink-0 self-center" style={{ color: 'var(--muted)' }}>
                      Ausstehend
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}