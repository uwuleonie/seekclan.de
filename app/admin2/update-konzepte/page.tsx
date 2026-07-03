'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

type GroupMember = { id: string, title: string, status: 'offen' | 'in_arbeit' | 'fertig' }
type Group = {
  name: string
  nameOverride: string | null
  mainNodeId: string
  members: GroupMember[]
  doneCount: number
  totalCount: number
  progress: number
}
type Concept = {
  id: string
  title: string
  groups: Group[]
  doneCount: number
  totalCount: number
  progress: number
}

const STATUS_STYLE: Record<string, { label: string, color: string, dot: string }> = {
  fertig: { label: 'FERTIG', color: '#A855F7', dot: '#A855F7' },
  in_arbeit: { label: 'IN ARBEIT', color: '#EAB308', dot: '#EAB308' },
  offen: { label: 'OFFEN', color: '#6B7280', dot: '#6B7280' },
}

export default function UpdateKonzeptePage() {
  const [concepts, setConcepts] = useState<Concept[]>([])
  const [loading, setLoading] = useState(true)
  const [showNewForm, setShowNewForm] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [saving, setSaving] = useState(false)
  const [renamingGroup, setRenamingGroup] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')

  const loadConcepts = () => {
    setLoading(true)
    fetch('/api/admin2/concepts')
      .then(r => r.json())
      .then(data => setConcepts(data.concepts || []))
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadConcepts() }, [])

  const createConcept = async () => {
    if (!newTitle.trim()) return
    setSaving(true)
    const res = await fetch('/api/admin2/concepts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: newTitle }),
    })
    if (res.ok) {
      setNewTitle('')
      setShowNewForm(false)
      loadConcepts()
    }
    setSaving(false)
  }

  const saveGroupName = async (conceptId: string, mainNodeId: string) => {
    await fetch(`/api/admin2/concepts/${conceptId}/nodes/${mainNodeId}/group-name`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: renameValue }),
    })
    setRenamingGroup(null)
    loadConcepts()
  }

  return (
    <div className="max-w-5xl">
      <div className="flex items-start justify-between gap-6 mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-1" style={{ color: 'var(--foreground)' }}>Update-Konzepte</h1>
          <p style={{ color: 'var(--muted)' }}>Updates Baustein für Baustein zusammenstellen — der Fortschritt leuchtet auf.</p>
        </div>
        <button onClick={() => setShowNewForm(v => !v)}
          className="btn-gradient text-white px-5 py-2.5 rounded-xl text-sm font-medium flex-shrink-0">
          + Neues Konzept
        </button>
      </div>

      {showNewForm && (
        <div className="card rounded-2xl p-6 mb-6">
          <div className="flex gap-2">
            <input value={newTitle} onChange={e => setNewTitle(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') createConcept() }}
              placeholder="Titel, z.B. Update 2.0 — Sommerfest"
              className="flex-1 rounded-xl px-4 py-2.5 text-sm outline-none"
              style={{ background: 'var(--muted-bg)', border: '1px solid var(--card-border)', color: 'var(--foreground)' }} />
            <button onClick={createConcept} disabled={saving}
              className="btn-gradient text-white px-5 py-2.5 rounded-xl text-sm font-medium disabled:opacity-50">
              {saving ? '...' : 'Erstellen'}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-center py-10" style={{ color: 'var(--muted)' }}>Laden...</p>
      ) : concepts.length === 0 ? (
        <div className="card rounded-2xl p-10 text-center">
          <p className="text-3xl mb-3">📐</p>
          <p style={{ color: 'var(--muted)' }}>Noch keine Konzepte vorhanden.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {concepts.map(concept => (
            <div key={concept.id} className="card rounded-2xl p-6">
              <div className="flex items-start justify-between gap-4 mb-3">
                <Link href={`/admin2/update-konzepte/${concept.id}`}
                  className="text-xl font-bold hover:opacity-70 transition-all" style={{ color: 'var(--foreground)' }}>
                  {concept.title}
                </Link>
                <p className="text-sm flex-shrink-0" style={{ color: 'var(--muted)' }}>
                  {concept.doneCount}/{concept.totalCount} Bausteine fertig · {concept.progress} %
                </p>
              </div>

              <div className="h-1.5 rounded-full overflow-hidden mb-5" style={{ background: 'var(--card-border)' }}>
                <div className="h-full rounded-full transition-all" style={{ width: `${concept.progress}%`, background: 'linear-gradient(90deg, #7C3AED, #C026D3)' }} />
              </div>

              {concept.groups.length === 0 ? (
                <div className="flex gap-2">
                  <Link href={`/admin2/update-konzepte/${concept.id}`}
                    className="rounded-xl px-4 py-3 inline-flex items-center justify-center transition-all hover:opacity-70"
                    style={{ border: '1px dashed var(--card-border)', color: 'var(--muted)' }}>
                    + Ersten Baustein im Editor anlegen
                  </Link>
                  <Link href={`/admin2/update-konzepte/${concept.id}?text=1`}
                    className="rounded-xl px-4 py-3 inline-flex items-center justify-center transition-all hover:opacity-70"
                    style={{ border: '1px dashed var(--card-border)', color: 'var(--muted)' }}>
                    📝 Als Text schreiben
                  </Link>
                </div>
              ) : (
                <Link href={`/admin2/update-konzepte/${concept.id}`}
                  className="block rounded-xl px-5 py-4 transition-all hover:opacity-90"
                  style={{ background: 'var(--muted-bg)', border: '1px solid var(--card-border)' }}>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm" style={{ color: 'var(--foreground)' }}>
                      {concept.groups.length} Baustein-Gruppe{concept.groups.length === 1 ? '' : 'n'} · {concept.doneCount}/{concept.totalCount} Bausteine fertig
                    </p>
                    <span className="text-xs px-3 py-1 rounded-full flex-shrink-0"
                      style={{ background: concept.progress === 100 ? '#A855F722' : '#7C3AED22', color: concept.progress === 100 ? '#A855F7' : '#7C3AED' }}>
                      {concept.progress} %
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--card-border)' }}>
                    <div className="h-full rounded-full transition-all" style={{ width: `${concept.progress}%`, background: 'linear-gradient(90deg, #7C3AED, #C026D3)' }} />
                  </div>
                </Link>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}