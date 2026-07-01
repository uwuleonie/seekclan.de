'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '../../lib/auth-context'
import Link from 'next/link'

// /admin/chatlogs (Konzeptdokument Abschnitt 10 + 13.7): Admins können jede
// Konversation einsehen, müssen aber vorher eine Begründung eingeben. Nachrichten
// sind standardmäßig verdeckt und müssen einzeln "aufgedeckt" werden - das
// entstehende Protokoll (wie weit gescrollt/aufgedeckt) sehen die Teilnehmer.

type ConversationSummary = {
  id: string
  type: string
  name: string | null
  member_count: string
  message_count: string
  last_message_at: string | null
  participant_names: string | null
}

type AdminMessage = {
  id: string
  sender_id: string | null
  content: string | null
  image_url: string | null
  created_at: string
  is_deleted: boolean
  location_label: string | null
  location_chunk_x: number | null
  location_chunk_z: number | null
  edited_at: string | null
  sender_username: string
}

function conversationLabel(c: ConversationSummary): string {
  if (c.type === 'group') return c.name || 'Gruppe'
  if (c.type === 'gc') return `GC: ${c.name || 'Claim-Gruppe'}`
  if (c.type === 'global') return 'Globaler Chat'
  return c.participant_names || 'Direktnachricht'
}

export default function AdminChatlogsPage() {
  const { user, loading } = useAuth()
  const [conversations, setConversations] = useState<ConversationSummary[]>([])
  const [loadingList, setLoadingList] = useState(true)
  const [search, setSearch] = useState('')

  const [selected, setSelected] = useState<ConversationSummary | null>(null)
  const [needsReason, setNeedsReason] = useState(false)
  const [isRepeatView, setIsRepeatView] = useState(false)
  const [reasonInput, setReasonInput] = useState('')
  const [sameAsLast, setSameAsLast] = useState(true)
  const [submittingReason, setSubmittingReason] = useState(false)

  const [messages, setMessages] = useState<AdminMessage[]>([])
  const [revealedUpTo, setRevealedUpTo] = useState<string | null>(null)
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [error, setError] = useState('')

  const fetchList = async () => {
    setLoadingList(true)
    const params = new URLSearchParams()
    if (search.trim()) params.set('search', search.trim())
    const res = await fetch(`/api/admin/chatlogs?${params}`)
    const data = await res.json()
    setConversations(data.conversations || [])
    setLoadingList(false)
  }

  useEffect(() => { if (user) fetchList() }, [user])

  const openConversation = (conv: ConversationSummary) => {
    setSelected(conv)
    setMessages([])
    setRevealedUpTo(null)
    setError('')
    setReasonInput('')
    setSameAsLast(true)
    setNeedsReason(true)
    // Wir wissen erst nach dem ersten View-Aufruf, ob es eine Wiederholung ist -
    // das Formular zeigt sich also erstmal generisch, die Server-Antwort auf
    // /view sagt uns danach is_repeat für nächste Male in dieser Sitzung.
  }

  const submitReasonAndLoad = async () => {
    if (!selected) return
    if (!sameAsLast && !reasonInput.trim()) {
      setError('Begründung erforderlich')
      return
    }
    setSubmittingReason(true)
    setError('')

    const viewRes = await fetch(`/api/admin/chatlogs/${selected.id}/view`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: reasonInput.trim(), same_as_last: isRepeatView && sameAsLast }),
    })
    const viewData = await viewRes.json()
    if (!viewRes.ok) {
      setError(viewData.error || 'Fehler beim Protokollieren des Zugriffs')
      setSubmittingReason(false)
      return
    }
    setIsRepeatView(viewData.is_repeat)

    setLoadingMessages(true)
    const msgRes = await fetch(`/api/admin/chatlogs/${selected.id}`)
    const msgData = await msgRes.json()
    setMessages(msgData.messages || [])
    setRevealedUpTo(msgData.revealed_up_to_message_id || null)
    setLoadingMessages(false)
    setNeedsReason(false)
    setSubmittingReason(false)
  }

  const revealUpTo = async (messageId: string) => {
    if (!selected) return
    setRevealedUpTo(messageId)
    await fetch(`/api/admin/chatlogs/${selected.id}/reveal`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message_id: messageId }),
    })
  }

  const inputStyle = { background: 'var(--muted-bg)', border: '1px solid var(--card-border)', color: 'var(--foreground)' }

  if (loading) return <div className="min-h-screen flex items-center justify-center" style={{ color: 'var(--muted)' }}>Laden...</div>
  if (!user || user.clan_role !== 'admin') return <div className="min-h-screen flex items-center justify-center" style={{ color: 'var(--muted)' }}>Kein Zugriff</div>

  // Index einer Nachricht in der revealed-Kette: alles bis einschließlich revealedUpTo ist sichtbar.
  const revealedIndex = revealedUpTo ? messages.findIndex(m => m.id === revealedUpTo) : -1

  return (
    <div className="min-h-screen" style={{ background: 'var(--background)' }}>
      <div className="max-w-6xl mx-auto px-8 py-10">
        <Link href="/admin" className="text-sm flex items-center gap-1 mb-8 hover:opacity-70" style={{ color: 'var(--muted)' }}>← Zurück zum Admin</Link>
        <h1 className="text-3xl font-bold mb-2" style={{ color: 'var(--foreground)' }}>Chatlogs</h1>
        <p className="text-sm mb-8" style={{ color: 'var(--muted)' }}>
          Jede Einsicht wird protokolliert und den Teilnehmern angezeigt (Konzeptdokument Abschnitt 10).
        </p>

        <div className="grid grid-cols-3 gap-6">
          {/* Konversationsliste */}
          <div className="col-span-1">
            <input value={search} onChange={e => setSearch(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && fetchList()}
              placeholder="Suchen (Name/Spieler)..."
              className="w-full rounded-xl px-3 py-2 text-sm outline-none mb-3" style={inputStyle} />
            {loadingList ? (
              <p className="text-sm" style={{ color: 'var(--muted)' }}>Laden...</p>
            ) : (
              <div className="space-y-1.5 max-h-[70vh] overflow-y-auto">
                {conversations.map(conv => (
                  <button key={conv.id} onClick={() => openConversation(conv)}
                    className="w-full text-left rounded-xl px-3 py-2.5 text-sm transition-all"
                    style={selected?.id === conv.id
                      ? { background: 'var(--card)', border: '1px solid #4F46E5' }
                      : { background: 'var(--card)', border: '1px solid var(--card-border)' }}>
                    <p className="font-medium truncate" style={{ color: 'var(--foreground)' }}>{conversationLabel(conv)}</p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
                      {conv.type} · {conv.member_count} Mitglieder · {conv.message_count} Nachrichten
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Detail-Ansicht */}
          <div className="col-span-2">
            {!selected ? (
              <div className="card rounded-2xl p-10 text-center" style={{ color: 'var(--muted)' }}>
                Wähl links eine Konversation aus.
              </div>
            ) : needsReason ? (
              <div className="card rounded-2xl p-6">
                <h2 className="font-bold text-lg mb-1" style={{ color: 'var(--foreground)' }}>{conversationLabel(selected)}</h2>
                <p className="text-sm mb-4" style={{ color: 'var(--muted)' }}>
                  Bevor du diese Konversation einsiehst, brauchen wir eine Begründung — alle Teilnehmer werden benachrichtigt.
                </p>
                {isRepeatView && (
                  <label className="flex items-center gap-2 text-sm mb-3" style={{ color: 'var(--foreground)' }}>
                    <input type="checkbox" checked={sameAsLast} onChange={e => setSameAsLast(e.target.checked)} />
                    Gleicher Grund wie beim letzten Mal
                  </label>
                )}
                {(!isRepeatView || !sameAsLast) && (
                  <textarea value={reasonInput} onChange={e => setReasonInput(e.target.value)}
                    placeholder="Begründung eingeben..." rows={3}
                    className="w-full rounded-xl px-3 py-2.5 text-sm outline-none mb-3" style={inputStyle} />
                )}
                {error && <p className="text-red-500 text-sm mb-3">{error}</p>}
                <div className="flex gap-3">
                  <button onClick={() => setSelected(null)}
                    className="flex-1 rounded-xl px-4 py-2.5 text-sm font-medium"
                    style={{ border: '1px solid var(--card-border)', color: 'var(--muted)' }}>
                    Abbrechen
                  </button>
                  <button onClick={submitReasonAndLoad} disabled={submittingReason}
                    className="flex-1 text-white px-4 py-2.5 rounded-xl text-sm font-medium disabled:opacity-50"
                    style={{ background: '#4F46E5' }}>
                    {submittingReason ? 'Öffnen...' : 'Konversation öffnen'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="card rounded-2xl p-6">
                <h2 className="font-bold text-lg mb-4" style={{ color: 'var(--foreground)' }}>{conversationLabel(selected)}</h2>
                {loadingMessages ? (
                  <p className="text-sm" style={{ color: 'var(--muted)' }}>Laden...</p>
                ) : (
                  <div className="space-y-2 max-h-[65vh] overflow-y-auto">
                    {messages.map((msg, i) => {
                      const isRevealed = revealedIndex >= 0 && i <= revealedIndex
                      if (!isRevealed) {
                        return (
                          <button key={msg.id} onClick={() => revealUpTo(msg.id)}
                            className="w-full text-left rounded-xl px-3 py-2 text-sm"
                            style={{ background: 'var(--muted-bg)', color: 'var(--muted)' }}>
                            🔒 Verdeckt — {new Date(msg.created_at).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })} · Klicken zum Aufdecken (bis hierhin)
                          </button>
                        )
                      }
                      return (
                        <div key={msg.id} className="rounded-xl px-3 py-2 text-sm" style={{ background: 'var(--muted-bg)', opacity: msg.is_deleted ? 0.5 : 1 }}>
                          <p className="font-medium" style={{ color: 'var(--foreground)' }}>
                            {msg.sender_username}
                            <span className="text-xs font-normal ml-2" style={{ color: 'var(--muted)' }}>
                              {new Date(msg.created_at).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                            </span>
                            {msg.location_label && (
                              <span className="text-xs ml-2 px-1.5 py-0.5 rounded" style={{ background: 'var(--card)', color: 'var(--muted)' }}>
                                📍 {msg.location_label}
                              </span>
                            )}
                            {msg.is_deleted && <span className="text-xs ml-2" style={{ color: '#EF4444' }}>(gelöscht — nur für Admins sichtbar)</span>}
                            {msg.edited_at && <span className="text-xs ml-2 italic" style={{ color: 'var(--muted)' }}>(bearbeitet)</span>}
                          </p>
                          <p style={{ color: 'var(--foreground)' }}>
                            {msg.content}
                            {msg.image_url && <span style={{ color: 'var(--muted)' }}> [Bild]</span>}
                          </p>
                        </div>
                      )
                    })}
                    {messages.length === 0 && (
                      <p className="text-sm text-center py-8" style={{ color: 'var(--muted)' }}>Keine Nachrichten.</p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}