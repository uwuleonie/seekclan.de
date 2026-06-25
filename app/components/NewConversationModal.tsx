'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '../lib/auth-context'

type FriendEntry = {
  id: string
  status: 'pending' | 'accepted'
  created_at: string
  sender: { id: string, username: string }
  receiver: { id: string, username: string }
}

type Props = {
  onClose: () => void
  onConversationStarted: (conversationId: string) => void
}

// Modal zum Starten einer neuen Direktkonversation. Zeigt nur akzeptierte Freunde,
// da das Backend (/api/conversations, type: 'direct') Nicht-Freunde ohnehin ablehnt
// und auf eine Nachrichtenanfrage verweist.
export default function NewConversationModal({ onClose, onConversationStarted }: Props) {
  const { user } = useAuth()
  const [friends, setFriends] = useState<FriendEntry[]>([])
  const [loadingFriends, setLoadingFriends] = useState(true)
  const [search, setSearch] = useState('')
  const [startingId, setStartingId] = useState<string | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/friends')
      .then(r => r.json())
      .then(data => {
        const accepted = (data.friends || []).filter((f: FriendEntry) => f.status === 'accepted')
        setFriends(accepted)
      })
      .finally(() => setLoadingFriends(false))
  }, [])

  if (!user) return null

  const getFriend = (f: FriendEntry) => f.sender.id === user.id ? f.receiver : f.sender

  const filtered = friends.filter(f =>
    getFriend(f).username.toLowerCase().includes(search.toLowerCase())
  )

  const startConversation = async (targetUserId: string) => {
    setStartingId(targetUserId)
    setError('')
    try {
      const res = await fetch('/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'direct', target_user_id: targetUserId }),
      })
      const data = await res.json()
      if (res.ok) {
        onConversationStarted(data.conversation_id)
      } else {
        setError(data.error || 'Fehler beim Erstellen der Konversation')
      }
    } catch {
      setError('Fehler beim Erstellen der Konversation')
    } finally {
      setStartingId(null)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ background: 'rgba(0,0,0,0.5)' }}
      onClick={onClose}
    >
      <div
        className="card rounded-2xl w-full max-w-md max-h-[80vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--card-border)' }}>
          <p className="font-bold" style={{ color: 'var(--foreground)' }}>Neue Konversation</p>
          <button onClick={onClose} className="text-sm" style={{ color: 'var(--muted)' }}>✕</button>
        </div>

        <div className="px-5 py-3" style={{ borderBottom: '1px solid var(--card-border)' }}>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Freund suchen..."
            className="w-full rounded-xl px-4 py-2.5 text-sm outline-none"
            style={{ background: 'var(--muted-bg)', border: '1px solid var(--card-border)', color: 'var(--foreground)' }}
          />
        </div>

        {error && <p className="text-red-500 text-sm px-5 pt-3">{error}</p>}

        <div className="flex-1 overflow-y-auto">
          {loadingFriends ? (
            <p className="text-sm text-center py-8" style={{ color: 'var(--muted)' }}>Laden...</p>
          ) : filtered.length === 0 ? (
            <div className="text-center py-10 px-4">
              <p className="text-3xl mb-2">👥</p>
              <p className="text-sm" style={{ color: 'var(--muted)' }}>
                {friends.length === 0
                  ? 'Du hast noch keine Freunde. Füge zuerst jemanden über die Freundesliste hinzu.'
                  : 'Kein Freund mit diesem Namen gefunden.'}
              </p>
            </div>
          ) : (
            filtered.map(f => {
              const friend = getFriend(f)
              return (
                <button
                  key={f.id}
                  onClick={() => startConversation(friend.id)}
                  disabled={startingId !== null}
                  className="w-full flex items-center gap-3 px-5 py-3 text-left transition-all hover:opacity-80 disabled:opacity-50"
                  style={{ borderBottom: '1px solid var(--card-border)' }}
                >
                  <img src={`https://mc-heads.net/avatar/${friend.username}/36`} alt=""
                    className="w-9 h-9 rounded-xl flex-shrink-0" />
                  <p className="text-sm font-medium flex-1" style={{ color: 'var(--foreground)' }}>
                    {friend.username}
                  </p>
                  {startingId === friend.id && (
                    <span className="text-xs" style={{ color: 'var(--muted)' }}>...</span>
                  )}
                </button>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}