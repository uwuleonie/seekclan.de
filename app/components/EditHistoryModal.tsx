'use client'

import { useState, useEffect } from 'react'
import FullScreenView from './FullScreenView'

// Zeigt die volle Bearbeitungshistorie einer Nachricht (Konzeptdokument 13.2):
// jeder Edit als eigener Eintrag mit vorherigem Inhalt, neuem Inhalt, Zeitpunkt, Autor.

type Edit = {
  id: string
  previous_content: string | null
  new_content: string | null
  edited_at: string
  edited_by_username: string
}

type Props = {
  conversationId: string
  messageId: string
  onClose: () => void
}

export default function EditHistoryModal({ conversationId, messageId, onClose }: Props) {
  const [edits, setEdits] = useState<Edit[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/conversations/${conversationId}/messages/${messageId}`)
      .then(r => r.json())
      .then(data => {
        setEdits(data.edits || [])
        setLoading(false)
      })
  }, [conversationId, messageId])

  return (
    <FullScreenView onClose={onClose} title="Bearbeitungshistorie" maxWidth="640px">
        {loading ? (
          <p className="text-sm text-center py-8" style={{ color: 'var(--muted)' }}>Laden...</p>
        ) : edits.length === 0 ? (
          <p className="text-sm text-center py-8" style={{ color: 'var(--muted)' }}>Keine Bearbeitungen gefunden.</p>
        ) : (
          <div className="space-y-4">
            {edits.map((edit, i) => (
              <div key={edit.id} className="rounded-xl p-3" style={{ background: 'var(--muted-bg)' }}>
                <p className="text-xs mb-2" style={{ color: 'var(--muted)' }}>
                  {edit.edited_by_username} · {new Date(edit.edited_at).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  {i === 0 && <span className="ml-1">(erste Bearbeitung)</span>}
                </p>
                <div className="text-sm">
                  <p className="line-through opacity-60">{edit.previous_content}</p>
                  <p className="mt-1">→ {edit.new_content}</p>
                </div>
              </div>
            ))}
          </div>
        )}
    </FullScreenView>
  )
}