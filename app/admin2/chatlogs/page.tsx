'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '../../lib/auth-context'
import LinkifiedText from '../../components/LinkifiedText'

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

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

export default function ChatlogsPage() {
  const { user } = useAuth()

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
  }

  const submitReasonAndLoad = async () => {
    if (!selected) return
    if (!sameAsLast && !reasonInput.trim()) { setError('Begründung erforderlich'); return }
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
  const revealedIndex = revealedUpTo ? messages.findIndex(m => m.id === revealedUpTo) : -1

  return (
    <div className="max-w-6xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-1" style={{ color: 'var(--foreground)' }}>Chatlogs</h1>
        <p className="text-sm" style={{ color: 'var(--muted)' }}>
          Jede Einsicht wird protokolliert und den Teilnehmern sofort angezeigt.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-6" style={{ minHeight: '75vh' }}>
        {/* Konversationsliste */}
        <div className="col-span-1 flex flex-col gap-3">
          <div className="flex gap-2">
            <input value={search} onChange={e => setSearch(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && fetchList()}
              placeholder="Name / Spieler suchen..."
              className="flex-1 rounded-xl px-3 py-2 text-sm outline-none" style={inputStyle} />
            <button onClick={fetchList}
              className="px-3 py-2 rounded-xl text-sm"
              style={{ background: 'var(--muted-bg)', color: 'var(--foreground)', border: '1px solid var(--card-border)' }}>
              🔍
            </button>
          </div>

          {loadingList ? (
            <p className="text-sm" style={{ color: 'var(--muted)' }}>Laden...</p>
          ) : conversations.length === 0 ? (
            <p className="text-sm" style={{ color: 'var(--muted)' }}>Keine Konversationen gefunden.</p>
          ) : (
            <div className="space-y-1.5 overflow-y-auto" style={{ maxHeight: '70vh' }}>
              {conversations.map(conv => (
                <button key={conv.id} onClick={() => openConversation(conv)}
                  className="w-full text-left rounded-xl px-3 py-2.5 text-sm transition-all"
                  style={selected?.id === conv.id
                    ? { background: '#7C3AED22', border: '1px solid #7C3AED55' }
                    : { background: 'var(--muted-bg)', border: '1px solid var(--card-border)' }}>
                  <p className="font-medium truncate" style={{ color: 'var(--foreground)' }}>
                    {conversationLabel(conv)}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
                    {conv.type} · {conv.member_count} Mitgl. · {conv.message_count} Nachr.
                  </p>
                  {conv.last_message_at && (
                    <p className="text-xs" style={{ color: 'var(--muted)' }}>
                      {formatTime(conv.last_message_at)}
                    </p>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Detail-Ansicht */}
        <div className="col-span-2">
          {!selected ? (
            <div className="card rounded-2xl p-10 text-center h-full flex flex-col items-center justify-center">
              <p className="text-3xl mb-3">💬</p>
              <p style={{ color: 'var(--muted)' }}>Wähl links eine Konversation aus.</p>
            </div>
          ) : needsReason ? (
            <div className="card rounded-2xl p-6">
              <h2 className="font-bold text-lg mb-1" style={{ color: 'var(--foreground)' }}>
                {conversationLabel(selected)}
              </h2>
              <p className="text-sm mb-4" style={{ color: 'var(--muted)' }}>
                Bevor du diese Konversation einsiehst, brauchen wir eine Begründung. Alle Teilnehmer werden sofort benachrichtigt.
              </p>

              {isRepeatView && (
                <label className="flex items-center gap-2 text-sm mb-3 cursor-pointer" style={{ color: 'var(--foreground)' }}>
                  <input type="checkbox" checked={sameAsLast} onChange={e => setSameAsLast(e.target.checked)} />
                  Gleicher Grund wie beim letzten Mal
                </label>
              )}

              {(!isRepeatView || !sameAsLast) && (
                <textarea value={reasonInput} onChange={e => setReasonInput(e.target.value)}
                  placeholder="Begründung eingeben..."
                  rows={3}
                  className="w-full rounded-xl px-3 py-2.5 text-sm outline-none mb-3 resize-none"
                  style={inputStyle} />
              )}

              {error && <p className="text-red-500 text-sm mb-3">{error}</p>}

              <div className="flex gap-3">
                <button onClick={() => setSelected(null)}
                  className="flex-1 rounded-xl px-4 py-2.5 text-sm font-medium"
                  style={{ border: '1px solid var(--card-border)', color: 'var(--muted)' }}>
                  Abbrechen
                </button>
                <button onClick={submitReasonAndLoad} disabled={submittingReason}
                  className="flex-1 btn-gradient text-white px-4 py-2.5 rounded-xl text-sm font-medium disabled:opacity-50">
                  {submittingReason ? 'Öffnen...' : 'Konversation öffnen'}
                </button>
              </div>
            </div>
          ) : (
            <div className="card rounded-2xl p-6 flex flex-col" style={{ maxHeight: '75vh' }}>
              <div className="flex items-center justify-between mb-4 flex-shrink-0">
                <h2 className="font-bold text-lg" style={{ color: 'var(--foreground)' }}>
                  {conversationLabel(selected)}
                </h2>
                <div className="flex items-center gap-2">
                  <span className="text-xs px-3 py-1 rounded-full" style={{ background: '#EAB30822', color: '#EAB308' }}>
                    ⚠️ Einsicht protokolliert
                  </span>
                  <button onClick={() => openConversation(selected)}
                    className="text-xs px-3 py-1 rounded-full"
                    style={{ background: 'var(--muted-bg)', color: 'var(--muted)', border: '1px solid var(--card-border)' }}>
                    Neu öffnen
                  </button>
                </div>
              </div>

              {loadingMessages ? (
                <p className="text-sm" style={{ color: 'var(--muted)' }}>Laden...</p>
              ) : messages.length === 0 ? (
                <p className="text-sm text-center py-8" style={{ color: 'var(--muted)' }}>Keine Nachrichten.</p>
              ) : (
                <div className="space-y-2 overflow-y-auto flex-1">
                  {messages.map((msg, i) => {
                    const isRevealed = revealedIndex >= 0 && i <= revealedIndex
                    if (!isRevealed) {
                      return (
                        <button key={msg.id} onClick={() => revealUpTo(msg.id)}
                          className="w-full text-left rounded-xl px-3 py-2 text-sm transition-all hover:opacity-80"
                          style={{ background: 'var(--muted-bg)', color: 'var(--muted)', border: '1px dashed var(--card-border)' }}>
                          🔒 Verdeckt · {formatTime(msg.created_at)} · Klicken zum Aufdecken bis hierhin
                        </button>
                      )
                    }
                    return (
                      <div key={msg.id} className="rounded-xl px-3 py-2.5 text-sm"
                        style={{ background: 'var(--muted-bg)', opacity: msg.is_deleted ? 0.5 : 1 }}>
                        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                          <span className="font-bold" style={{ color: 'var(--foreground)' }}>{msg.sender_username}</span>
                          <span className="text-xs" style={{ color: 'var(--muted)' }}>{formatTime(msg.created_at)}</span>
                          {msg.location_label && (
                            <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'var(--background)', color: 'var(--muted)' }}>
                              📍 {msg.location_label}
                            </span>
                          )}
                          {msg.is_deleted && (
                            <span className="text-xs" style={{ color: '#EF4444' }}>(gelöscht — nur für Admins)</span>
                          )}
                          {msg.edited_at && (
                            <span className="text-xs italic" style={{ color: 'var(--muted)' }}>(bearbeitet)</span>
                          )}
                        </div>
                        {msg.content && <LinkifiedText text={msg.content} style={{ color: 'var(--foreground)' }} />}
                        {msg.image_url && <span style={{ color: 'var(--muted)' }}> [Bild]</span>}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}