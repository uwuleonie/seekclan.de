'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '../lib/auth-context'
import Link from 'next/link'

type FriendEntry = {
  id: string
  status: 'pending' | 'accepted'
  created_at: string
  sender: { id: string, username: string }
  receiver: { id: string, username: string }
}

export default function FreundePage() {
  const { user, loading } = useAuth()
  const [friends, setFriends] = useState<FriendEntry[]>([])
  const [userId, setUserId] = useState<string | null>(null)
  const [loadingData, setLoadingData] = useState(true)
  const [newFriend, setNewFriend] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [activeTab, setActiveTab] = useState<'freunde' | 'anfragen'>('freunde')

  const fetchFriends = async () => {
    const res = await fetch('/api/friends')
    const data = await res.json()
    setFriends(data.friends || [])
    setUserId(data.userId)
    setLoadingData(false)
  }

  useEffect(() => {
    if (user) fetchFriends()
  }, [user])

  const handleSend = async () => {
    if (!newFriend.trim()) return
    setSending(true); setError(''); setSuccess('')
    const res = await fetch('/api/friends', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ receiver_username: newFriend.trim() }),
    })
    const data = await res.json()
    if (res.ok) { setSuccess(`Anfrage an ${newFriend} gesendet!`); setNewFriend(''); fetchFriends() }
    else setError(data.error || 'Fehler')
    setSending(false)
  }

  const handleAction = async (id: string, action: 'accept' | 'decline' | 'remove') => {
    await fetch('/api/friends', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, action }),
    })
    fetchFriends()
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--background)', color: 'var(--foreground)' }}>Laden...</div>

  if (!user) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--background)' }}>
      <div className="text-center">
        <p className="mb-4" style={{ color: 'var(--muted)' }}>Du musst eingeloggt sein.</p>
        <Link href="/login" className="btn-gradient text-white px-6 py-3 rounded-xl">Einloggen</Link>
      </div>
    </div>
  )

  const accepted = friends.filter(f => f.status === 'accepted')
  const incoming = friends.filter(f => f.status === 'pending' && f.receiver.id === userId)
  const outgoing = friends.filter(f => f.status === 'pending' && f.sender.id === userId)

  const getFriendName = (f: FriendEntry) => f.sender.id === userId ? f.receiver.username : f.sender.username

  return (
    <div className="min-h-screen" style={{ background: 'var(--background)' }}>
      <div className="max-w-2xl mx-auto px-8 py-10">
        <Link href="/" className="text-sm flex items-center gap-1 mb-8 hover:opacity-70" style={{ color: 'var(--muted)' }}>← Zurück</Link>

        <h1 className="text-3xl font-bold mb-8" style={{ color: 'var(--foreground)' }}>Freunde</h1>

        {/* Anfrage senden */}
        <div className="card rounded-2xl p-6 mb-6">
          <h2 className="font-bold text-lg mb-4" style={{ color: 'var(--foreground)' }}>Freund hinzufügen</h2>
          <div className="flex gap-3">
            <input value={newFriend} onChange={e => setNewFriend(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSend()}
              className="flex-1 rounded-xl px-4 py-2.5 text-sm outline-none"
              style={{ background: 'var(--muted-bg)', border: '1px solid var(--card-border)', color: 'var(--foreground)' }}
              placeholder="Username eingeben..." />
            <button onClick={handleSend} disabled={sending || !newFriend.trim()}
              className="btn-gradient text-white px-5 py-2.5 rounded-xl text-sm font-medium disabled:opacity-50">
              {sending ? '...' : 'Anfrage senden'}
            </button>
          </div>
          {error && <p className="text-red-500 text-sm mt-3">{error}</p>}
          {success && <p className="text-green-500 text-sm mt-3">{success}</p>}
        </div>

        {/* Tabs */}
        <div className="flex rounded-xl overflow-hidden text-sm border mb-6" style={{ background: 'var(--card)', borderColor: 'var(--card-border)' }}>
          <button onClick={() => setActiveTab('freunde')}
            className="flex-1 px-4 py-2.5 font-medium transition-all"
            style={activeTab === 'freunde' ? { background: 'var(--foreground)', color: 'var(--background)' } : { color: 'var(--muted)' }}>
            Freunde ({accepted.length})
          </button>
          <button onClick={() => setActiveTab('anfragen')}
            className="flex-1 px-4 py-2.5 font-medium transition-all relative"
            style={activeTab === 'anfragen' ? { background: 'var(--foreground)', color: 'var(--background)' } : { color: 'var(--muted)' }}>
            Anfragen {incoming.length > 0 && (
              <span className="ml-1 bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5">{incoming.length}</span>
            )}
          </button>
        </div>

        {loadingData ? (
          <div className="text-center py-10" style={{ color: 'var(--muted)' }}>Laden...</div>
        ) : activeTab === 'freunde' ? (
          <div className="card rounded-2xl overflow-hidden">
            {accepted.length === 0 ? (
              <div className="text-center py-10" style={{ color: 'var(--muted)' }}>
                <p className="text-4xl mb-3">👥</p>
                <p>Noch keine Freunde. Sende jemandem eine Anfrage!</p>
              </div>
            ) : (
              <div>
                {accepted.map(f => (
                  <div key={f.id} className="flex items-center gap-4 px-6 py-4" style={{ borderBottom: '1px solid var(--card-border)' }}>
                    <img src={`https://api.creepernation.net/avatar/${getFriendName(f)}/40`} alt={getFriendName(f)} className="w-10 h-10 rounded-xl" />
                    <div className="flex-1">
                      <p className="font-medium" style={{ color: 'var(--foreground)' }}>{getFriendName(f)}</p>
                      <p className="text-xs" style={{ color: 'var(--muted)' }}>Freunde seit {new Date(f.created_at).toLocaleDateString('de-DE')}</p>
                    </div>
                    <Link href={`/${getFriendName(f)}`}
                      className="text-sm px-3 py-1.5 rounded-xl transition-all"
                      style={{ color: '#7C3AED', background: 'rgba(124,58,237,0.1)' }}>
                      Profil
                    </Link>
                    <button onClick={() => handleAction(f.id, 'remove')}
                      className="text-sm px-3 py-1.5 rounded-xl transition-all"
                      style={{ color: '#ef4444', background: 'rgba(239,68,68,0.1)' }}>
                      Entfernen
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {/* Eingehende Anfragen */}
            {incoming.length > 0 && (
              <div className="card rounded-2xl overflow-hidden">
                <div className="px-6 py-3" style={{ borderBottom: '1px solid var(--card-border)' }}>
                  <p className="text-sm font-bold" style={{ color: 'var(--foreground)' }}>Eingehend ({incoming.length})</p>
                </div>
                {incoming.map(f => (
                  <div key={f.id} className="flex items-center gap-4 px-6 py-4" style={{ borderBottom: '1px solid var(--card-border)' }}>
                    <img src={`https://api.creepernation.net/avatar/${f.sender.username}/40`} alt={f.sender.username} className="w-10 h-10 rounded-xl" />
                    <div className="flex-1">
                      <p className="font-medium" style={{ color: 'var(--foreground)' }}>{f.sender.username}</p>
                      <p className="text-xs" style={{ color: 'var(--muted)' }}>Möchte dein Freund sein</p>
                    </div>
                    <button onClick={() => handleAction(f.id, 'accept')}
                      className="text-sm px-3 py-1.5 rounded-xl transition-all text-white"
                      style={{ background: '#639922' }}>
                      ✓ Annehmen
                    </button>
                    <button onClick={() => handleAction(f.id, 'decline')}
                      className="text-sm px-3 py-1.5 rounded-xl transition-all"
                      style={{ color: '#ef4444', background: 'rgba(239,68,68,0.1)' }}>
                      ✕ Ablehnen
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Ausgehende Anfragen */}
            {outgoing.length > 0 && (
              <div className="card rounded-2xl overflow-hidden">
                <div className="px-6 py-3" style={{ borderBottom: '1px solid var(--card-border)' }}>
                  <p className="text-sm font-bold" style={{ color: 'var(--foreground)' }}>Ausstehend ({outgoing.length})</p>
                </div>
                {outgoing.map(f => (
                  <div key={f.id} className="flex items-center gap-4 px-6 py-4" style={{ borderBottom: '1px solid var(--card-border)' }}>
                    <img src={`https://api.creepernation.net/avatar/${f.receiver.username}/40`} alt={f.receiver.username} className="w-10 h-10 rounded-xl" />
                    <div className="flex-1">
                      <p className="font-medium" style={{ color: 'var(--foreground)' }}>{f.receiver.username}</p>
                      <p className="text-xs" style={{ color: 'var(--muted)' }}>Anfrage ausstehend</p>
                    </div>
                    <button onClick={() => handleAction(f.id, 'remove')}
                      className="text-sm px-3 py-1.5 rounded-xl transition-all"
                      style={{ color: '#ef4444', background: 'rgba(239,68,68,0.1)' }}>
                      Anfrage zurückziehen
                    </button>
                  </div>
                ))}
              </div>
            )}

            {incoming.length === 0 && outgoing.length === 0 && (
              <div className="card rounded-2xl text-center py-10" style={{ color: 'var(--muted)' }}>
                <p className="text-4xl mb-3">📭</p>
                <p>Keine offenen Anfragen.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}