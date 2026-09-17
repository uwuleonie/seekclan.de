'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '../../lib/auth-context'

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
type Tag = { id: string, name: string, color: string }
type Concept = {
  id: string
  title: string
  groups: Group[]
  doneCount: number
  totalCount: number
  progress: number
  ownerId: string | null
  ownerUsername: string | null
  isTextOnly: boolean
  contentText: string
  isFinished: boolean
  tags: Tag[]
}

export default function UpdateKonzeptePage() {
  const { user } = useAuth()
  const [concepts, setConcepts] = useState<Concept[]>([])
  const [allTags, setAllTags] = useState<Tag[]>([])
  const [loading, setLoading] = useState(true)
  const [showNewForm, setShowNewForm] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newIsTextOnly, setNewIsTextOnly] = useState(true)
  const [saving, setSaving] = useState(false)

  // Filter/Suche
  const [tab, setTab] = useState<'aktiv' | 'fertig'>('aktiv')
  const [search, setSearch] = useState('')
  const [onlyMine, setOnlyMine] = useState(false)
  const [activeTagIds, setActiveTagIds] = useState<string[]>([])
  const [showTagManager, setShowTagManager] = useState(false)

  const loadConcepts = () => {
    setLoading(true)
    fetch('/api/admin2/concepts')
      .then(r => r.json())
      .then(data => setConcepts(data.concepts || []))
      .finally(() => setLoading(false))
  }

  const loadTags = () => {
    fetch('/api/admin2/concept-tags')
      .then(r => r.json())
      .then(data => setAllTags(data.tags || []))
  }

  useEffect(() => { loadConcepts(); loadTags() }, [])

  const createConcept = async () => {
    if (!newTitle.trim()) return
    setSaving(true)
    const res = await fetch('/api/admin2/concepts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: newTitle, isTextOnly: newIsTextOnly }),
    })
    if (res.ok) {
      setNewTitle('')
      setNewIsTextOnly(true)
      setShowNewForm(false)
      loadConcepts()
    }
    setSaving(false)
  }

  const claimConcept = async (conceptId: string) => {
    const res = await fetch(`/api/admin2/concepts/${conceptId}/claim`, { method: 'POST' })
    if (res.ok) loadConcepts()
  }

  const toggleTagFilter = (tagId: string) => {
    setActiveTagIds(prev => prev.includes(tagId) ? prev.filter(id => id !== tagId) : [...prev, tagId])
  }

  const filteredConcepts = useMemo(() => {
    return concepts.filter(c => {
      if (tab === 'aktiv' && c.isFinished) return false
      if (tab === 'fertig' && !c.isFinished) return false
      if (onlyMine && c.ownerId !== user?.id) return false
      if (activeTagIds.length > 0 && !activeTagIds.every(tid => c.tags.some(t => t.id === tid))) return false
      if (search.trim()) {
        const q = search.trim().toLowerCase()
        const inTitle = c.title.toLowerCase().includes(q)
        const inTags = c.tags.some(t => t.name.toLowerCase().includes(q))
        const inText = c.isTextOnly && c.contentText.toLowerCase().includes(q)
        if (!inTitle && !inTags && !inText) return false
      }
      return true
    })
  }, [concepts, tab, onlyMine, activeTagIds, search, user])

  const aktivCount = concepts.filter(c => !c.isFinished).length
  const fertigCount = concepts.filter(c => c.isFinished).length

  return (
    <div className="max-w-5xl">
      <div className="flex items-start justify-between gap-6 mb-6">
        <div>
          <h1 className="text-3xl font-bold mb-1" style={{ color: 'var(--foreground)' }}>Update-Konzepte</h1>
          <p style={{ color: 'var(--muted)' }}>Updates Baustein für Baustein zusammenstellen — der Fortschritt leuchtet auf.</p>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <Link href="/admin2/update-konzepte/ideen"
            className="px-5 py-2.5 rounded-xl text-sm font-medium inline-flex items-center"
            style={{ background: 'var(--muted-bg)', color: 'var(--foreground)', border: '1px solid var(--card-border)' }}>
            🗂 Unkonzipierte Ideen
          </Link>
          <button onClick={() => setShowNewForm(v => !v)}
            className="btn-gradient text-white px-5 py-2.5 rounded-xl text-sm font-medium">
            + Neues Konzept
          </button>
        </div>
      </div>

      {showNewForm && (
        <div className="card rounded-2xl p-6 mb-6">
          <div className="flex gap-2 mb-3">
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
          <label className="flex items-center gap-2 cursor-pointer text-sm" style={{ color: 'var(--foreground)' }}>
            <input type="checkbox" checked={newIsTextOnly} onChange={e => setNewIsTextOnly(e.target.checked)} />
            Nur Text (kein Baustein-Editor — einfach ein Textdokument, kann später umgestellt werden)
          </label>
        </div>
      )}

      {/* Such-/Filterleiste */}
      <div className="card rounded-2xl p-4 mb-6 space-y-3">
        <div className="flex flex-wrap gap-2 items-center">
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="🔍 Konzepte durchsuchen..."
            className="flex-1 min-w-[200px] rounded-xl px-4 py-2 text-sm outline-none"
            style={{ background: 'var(--muted-bg)', border: '1px solid var(--card-border)', color: 'var(--foreground)' }} />
          <label className="flex items-center gap-2 cursor-pointer text-sm px-3 py-2 rounded-xl flex-shrink-0"
            style={{ background: onlyMine ? '#7C3AED22' : 'var(--muted-bg)', color: onlyMine ? '#7C3AED' : 'var(--foreground)', border: `1px solid ${onlyMine ? '#7C3AED55' : 'var(--card-border)'}` }}>
            <input type="checkbox" checked={onlyMine} onChange={e => setOnlyMine(e.target.checked)} />
            Nur meine Konzepte
          </label>
          <button onClick={() => setShowTagManager(v => !v)}
            className="text-sm px-3 py-2 rounded-xl flex-shrink-0"
            style={{ background: 'var(--muted-bg)', color: 'var(--foreground)', border: '1px solid var(--card-border)' }}>
            🏷 Tags verwalten
          </button>
        </div>

        {allTags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {allTags.map(tag => {
              const active = activeTagIds.includes(tag.id)
              return (
                <button key={tag.id} onClick={() => toggleTagFilter(tag.id)}
                  className="text-xs px-2.5 py-1 rounded-full transition-all"
                  style={active
                    ? { background: tag.color, color: '#fff', border: `1px solid ${tag.color}` }
                    : { background: `${tag.color}22`, color: tag.color, border: `1px solid ${tag.color}55` }}>
                  {tag.name}
                </button>
              )
            })}
          </div>
        )}

        {showTagManager && (
          <TagManager tags={allTags} onChanged={loadTags} />
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        <button onClick={() => setTab('aktiv')}
          className="px-4 py-2 rounded-xl text-sm font-medium transition-all"
          style={tab === 'aktiv'
            ? { background: '#7C3AED22', color: '#7C3AED', border: '1px solid #7C3AED55' }
            : { background: 'var(--muted-bg)', color: 'var(--muted)', border: '1px solid var(--card-border)' }}>
          Aktiv ({aktivCount})
        </button>
        <button onClick={() => setTab('fertig')}
          className="px-4 py-2 rounded-xl text-sm font-medium transition-all"
          style={tab === 'fertig'
            ? { background: '#A855F722', color: '#A855F7', border: '1px solid #A855F755' }
            : { background: 'var(--muted-bg)', color: 'var(--muted)', border: '1px solid var(--card-border)' }}>
          ✅ Fertig ({fertigCount})
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-center py-10" style={{ color: 'var(--muted)' }}>Laden...</p>
      ) : filteredConcepts.length === 0 ? (
        <div className="card rounded-2xl p-10 text-center">
          <p className="text-3xl mb-3">📐</p>
          <p style={{ color: 'var(--muted)' }}>
            {concepts.length === 0 ? 'Noch keine Konzepte vorhanden.' : 'Keine Konzepte passen zu diesem Filter.'}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {filteredConcepts.map(concept => (
            <ConceptCard key={concept.id} concept={concept} allTags={allTags}
              onClaim={() => claimConcept(concept.id)} onChanged={loadConcepts} />
          ))}
        </div>
      )}
    </div>
  )
}

function ConceptCard({ concept, allTags, onClaim, onChanged }: {
  concept: Concept, allTags: Tag[], onClaim: () => void, onChanged: () => void
}) {
  const [showTagPicker, setShowTagPicker] = useState(false)

  const assignTag = async (tagId: string) => {
    await fetch(`/api/admin2/concepts/${concept.id}/tags`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tagId }),
    })
    onChanged()
  }

  const unassignTag = async (tagId: string) => {
    await fetch(`/api/admin2/concepts/${concept.id}/tags/${tagId}`, { method: 'DELETE' })
    onChanged()
  }

  return (
    <div className="card rounded-2xl p-6">
      <div className="flex items-start justify-between gap-4 mb-2">
        <Link href={`/admin2/update-konzepte/${concept.id}`}
          className="text-xl font-bold hover:opacity-70 transition-all inline-flex items-center gap-2" style={{ color: 'var(--foreground)' }}>
          {concept.isTextOnly && <span title="Text-Konzept">📝</span>}
          {concept.title}
        </Link>
        <p className="text-sm flex-shrink-0" style={{ color: 'var(--muted)' }}>
          {concept.isTextOnly
            ? (concept.isFinished ? 'Fertig' : 'In Arbeit')
            : `${concept.doneCount}/${concept.totalCount} Bausteine fertig · ${concept.progress} %`}
        </p>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        {concept.ownerUsername ? (
          <span className="text-xs px-2.5 py-1 rounded-full inline-flex items-center gap-1"
            style={{ background: 'var(--muted-bg)', color: 'var(--muted)' }}>
            👤 {concept.ownerUsername}
          </span>
        ) : (
          <button onClick={onClaim}
            className="text-xs px-2.5 py-1 rounded-full inline-flex items-center gap-1 hover:opacity-80 transition-all"
            style={{ background: '#7C3AED22', color: '#7C3AED', border: '1px solid #7C3AED55' }}>
            🏳️ Niemand — Claimen
          </button>
        )}

        {concept.tags.map(tag => (
          <span key={tag.id}
            onClick={() => unassignTag(tag.id)}
            title="Klicken zum Entfernen"
            className="text-xs px-2.5 py-1 rounded-full cursor-pointer hover:opacity-70 transition-all"
            style={{ background: `${tag.color}22`, color: tag.color, border: `1px solid ${tag.color}55` }}>
            {tag.name} ✕
          </span>
        ))}

        <div className="relative">
          <button onClick={() => setShowTagPicker(v => !v)}
            className="text-xs px-2.5 py-1 rounded-full hover:opacity-80 transition-all"
            style={{ background: 'var(--muted-bg)', color: 'var(--muted)', border: '1px dashed var(--card-border)' }}>
            + Tag
          </button>
          {showTagPicker && (
            <div className="absolute left-0 top-full mt-1 w-56 rounded-xl p-2 shadow-lg z-20"
              style={{ background: 'var(--background)', border: '1px solid var(--card-border)' }}>
              {allTags.filter(t => !concept.tags.some(ct => ct.id === t.id)).length === 0 ? (
                <p className="text-xs px-2 py-1" style={{ color: 'var(--muted)' }}>Keine weiteren Tags verfügbar.</p>
              ) : allTags.filter(t => !concept.tags.some(ct => ct.id === t.id)).map(tag => (
                <button key={tag.id} onClick={() => { assignTag(tag.id); setShowTagPicker(false) }}
                  className="w-full text-left text-xs px-2 py-1.5 rounded-lg hover:opacity-80 flex items-center gap-2"
                  style={{ color: 'var(--foreground)' }}>
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: tag.color }} />
                  {tag.name}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {concept.isTextOnly ? (
        <Link href={`/admin2/update-konzepte/${concept.id}`}
          className="block rounded-xl px-5 py-4 transition-all hover:opacity-90"
          style={{ background: 'var(--muted-bg)', border: '1px solid var(--card-border)' }}>
          <p className="text-sm line-clamp-2" style={{ color: concept.contentText ? 'var(--foreground)' : 'var(--muted)' }}>
            {concept.contentText?.trim() || 'Noch kein Text geschrieben — hier klicken zum Loslegen.'}
          </p>
        </Link>
      ) : (
        <>
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
        </>
      )}
    </div>
  )
}

function TagManager({ tags, onChanged }: { tags: Tag[], onChanged: () => void }) {
  const [name, setName] = useState('')
  const [color, setColor] = useState('#7C3AED')
  const [saving, setSaving] = useState(false)

  const createTag = async () => {
    if (!name.trim()) return
    setSaving(true)
    const res = await fetch('/api/admin2/concept-tags', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, color }),
    })
    if (res.ok) {
      setName('')
      onChanged()
    }
    setSaving(false)
  }

  const deleteTag = async (tagId: string) => {
    if (!confirm('Diesen Tag wirklich überall löschen?')) return
    await fetch(`/api/admin2/concept-tags/${tagId}`, { method: 'DELETE' })
    onChanged()
  }

  return (
    <div className="pt-3" style={{ borderTop: '1px solid var(--card-border)' }}>
      <div className="flex items-center gap-2 mb-3">
        <input value={name} onChange={e => setName(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') createTag() }}
          placeholder="Neuer Tag-Name"
          className="flex-1 px-3 py-1.5 rounded-lg text-sm"
          style={{ background: 'var(--muted-bg)', border: '1px solid var(--card-border)', color: 'var(--foreground)' }} />
        <input type="color" value={color} onChange={e => setColor(e.target.value)}
          className="w-9 h-9 rounded-lg cursor-pointer" />
        <button onClick={createTag} disabled={saving} className="btn-gradient text-white px-3 py-1.5 rounded-lg text-sm disabled:opacity-50">
          Erstellen
        </button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {tags.map(tag => (
          <span key={tag.id}
            className="text-xs px-2.5 py-1 rounded-full inline-flex items-center gap-1.5"
            style={{ background: `${tag.color}22`, color: tag.color, border: `1px solid ${tag.color}55` }}>
            {tag.name}
            <button onClick={() => deleteTag(tag.id)} className="hover:opacity-70">✕</button>
          </span>
        ))}
        {tags.length === 0 && <p className="text-xs" style={{ color: 'var(--muted)' }}>Noch keine Tags vorhanden.</p>}
      </div>
    </div>
  )
}