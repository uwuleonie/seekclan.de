'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import Link from 'next/link'
import { useAuth } from '../lib/auth-context'

type Tag = { id: number; name: string; color: string }
type ChangelogImage = { id: number; filename: string; url: string }
type Entry = {
  id: number
  title: string
  description: string
  version: string | null
  created_at: string
  tags: Tag[]
  images: ChangelogImage[]
}

const REACTION_EMOJIS = ['🔥', '❤️', '👍'] as const
type ReactionBucket = { count: number; reacted: boolean }
type ReactionMap = Record<number, Record<string, ReactionBucket>>

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' })
}

function isNew(dateStr: string) {
  return Date.now() - new Date(dateStr).getTime() < 48 * 60 * 60 * 1000
}

function timeAgo(dateStr: string) {
  const diffMs = Date.now() - new Date(dateStr).getTime()
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  if (days < 1) return 'heute'
  if (days === 1) return 'vor 1 Tag'
  if (days < 30) return `vor ${days} Tagen`
  const months = Math.floor(days / 30)
  if (months < 12) return `vor ${months} Monat${months === 1 ? '' : 'en'}`
  const years = Math.floor(months / 12)
  return `vor ${years} Jahr${years === 1 ? '' : 'en'}`
}

// Hook: blendet ein Element sanft ein, sobald es beim Scrollen in den Viewport kommt.
function useRevealOnScroll() {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); observer.disconnect() } },
      { threshold: 0.1 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return { ref, visible }
}

function TimelineEntry({
  entry,
  index,
  reactions,
  onReact,
  canReact,
  onImageClick,
}: {
  entry: Entry
  index: number
  reactions: Record<string, ReactionBucket> | undefined
  onReact: (entryId: number, emoji: string) => void
  canReact: boolean
  onImageClick: (url: string) => void
}) {
  const { ref, visible } = useRevealOnScroll()
  const dotColor = entry.tags[0]?.color || '#7C3AED'

  return (
    <div
      ref={ref}
      className="relative pl-12 sm:pl-16"
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(16px)',
        transition: `opacity 0.5s ease ${index * 0.03}s, transform 0.5s ease ${index * 0.03}s`,
      }}
    >
      {/* Dot auf der Timeline-Linie */}
      <div
        className="absolute left-[18px] sm:left-[26px] top-2 w-3.5 h-3.5 rounded-full"
        style={{ background: dotColor, boxShadow: `0 0 0 4px var(--background)` }}
      />

      <div className="card rounded-2xl p-6 shadow-sm mb-8">
        <div className="flex items-center gap-2 flex-wrap mb-2">
          {isNew(entry.created_at) && (
            <span
              className="text-xs px-2.5 py-1 rounded-full font-bold text-white"
              style={{ background: 'linear-gradient(135deg, #4F46E5, #7C3AED, #C026D3)' }}
            >
              ✨ Neu
            </span>
          )}
          {entry.tags.map(tag => (
            <span key={tag.id} className="text-xs px-2.5 py-1 rounded-full text-white font-medium" style={{ background: tag.color }}>
              {tag.name}
            </span>
          ))}
          {entry.version && (
            <span className="text-xs px-2.5 py-1 rounded-full font-medium" style={{ background: 'var(--muted-bg)', color: 'var(--muted)' }}>
              v{entry.version}
            </span>
          )}
        </div>

        <h2 className="text-xl font-bold mb-1" style={{ color: 'var(--foreground)' }}>{entry.title}</h2>
        <p className="text-xs mb-3" style={{ color: 'var(--muted)', opacity: 0.8 }}>
          {formatDate(entry.created_at)} · {timeAgo(entry.created_at)}
        </p>

        <p className="text-sm whitespace-pre-wrap" style={{ color: 'var(--muted)' }}>{entry.description}</p>

        {entry.images.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-4">
            {entry.images.map(img => (
              <button key={img.id} onClick={() => onImageClick(img.url)} className="rounded-xl overflow-hidden" style={{ aspectRatio: '4 / 3' }}>
                <img src={img.url} alt="" className="w-full h-full object-cover hover:opacity-90 transition" />
              </button>
            ))}
          </div>
        )}

        {/* Reactions */}
        <div className="flex items-center gap-2 mt-4 pt-4" style={{ borderTop: '1px solid var(--card-border)' }}>
          {REACTION_EMOJIS.map(emoji => {
            const bucket = reactions?.[emoji]
            const count = bucket?.count || 0
            const reacted = bucket?.reacted || false
            return (
              <button
                key={emoji}
                onClick={() => canReact && onReact(entry.id, emoji)}
                disabled={!canReact}
                title={canReact ? undefined : 'Nur für eingeloggte Nutzer'}
                className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition"
                style={{
                  background: reacted ? 'rgba(124,58,237,0.12)' : 'var(--muted-bg)',
                  border: reacted ? '1px solid #7C3AED' : '1px solid transparent',
                  color: reacted ? '#7C3AED' : 'var(--muted)',
                  cursor: canReact ? 'pointer' : 'default',
                  opacity: canReact ? 1 : 0.6,
                }}
              >
                <span>{emoji}</span>
                {count > 0 && <span>{count}</span>}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default function ChangelogPage() {
  const { user } = useAuth()
  const [entries, setEntries] = useState<Entry[]>([])
  const [allTags, setAllTags] = useState<Tag[]>([])
  const [activeFilter, setActiveFilter] = useState<number | null>(null)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null)
  const [reactions, setReactions] = useState<ReactionMap>({})

  useEffect(() => {
    Promise.all([
      fetch('/api/admin/changelog').then(r => r.json()),
      fetch('/api/admin/changelog/tags').then(r => r.json()),
    ]).then(([entriesData, tagsData]) => {
      const loadedEntries = (entriesData.entries || []) as Entry[]
      setEntries(loadedEntries)
      setAllTags(tagsData.tags || [])
      setLoading(false)

      if (loadedEntries.length > 0) {
        const ids = loadedEntries.map(e => e.id).join(',')
        fetch(`/api/changelog/reactions?entry_ids=${ids}`)
          .then(r => r.json())
          .then(data => setReactions(data.reactions || {}))
      }
    })
  }, [])

  const handleReact = async (entryId: number, emoji: string) => {
    // Optimistisches Update — UI reagiert sofort, bevor die Antwort vom Server da ist
    setReactions(prev => {
      const entryReactions = prev[entryId] || {}
      const bucket = entryReactions[emoji] || { count: 0, reacted: false }
      const nowReacted = !bucket.reacted
      return {
        ...prev,
        [entryId]: {
          ...entryReactions,
          [emoji]: { count: bucket.count + (nowReacted ? 1 : -1), reacted: nowReacted },
        },
      }
    })

    await fetch('/api/changelog/reactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entry_id: entryId, emoji }),
    })
  }

  const filtered = useMemo(() => {
    let result = entries
    if (activeFilter !== null) {
      result = result.filter(e => e.tags.some(t => t.id === activeFilter))
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      result = result.filter(e =>
        e.title.toLowerCase().includes(q) ||
        e.description.toLowerCase().includes(q) ||
        (e.version ? e.version.toLowerCase().includes(q) : false)
      )
    }
    return result
  }, [entries, activeFilter, search])

  const stats = useMemo(() => {
    if (entries.length === 0) return null
    const oldest = entries[entries.length - 1]
    const sinceYear = new Date(oldest.created_at).getFullYear()
    const latest = entries[0]
    return {
      total: entries.length,
      sinceYear,
      latestAgo: timeAgo(latest.created_at),
    }
  }, [entries])

  return (
    <div className="min-h-screen" style={{ background: 'var(--background)' }}>
      <div className="max-w-3xl mx-auto px-8 py-12">
        <Link href="/" className="text-sm flex items-center gap-1 mb-8 hover:opacity-70" style={{ color: 'var(--muted)' }}>← Zurück zur Startseite</Link>

        {/* Hero-Banner */}
        <div
          className="rounded-3xl p-8 mb-8 relative overflow-hidden"
          style={{ background: 'linear-gradient(135deg, #4F46E5, #7C3AED, #C026D3)' }}
        >
          <h1 className="text-3xl font-bold mb-2 text-white">📢 Changelog</h1>
          <p className="text-white/85 mb-5">Alle Neuigkeiten und Updates von seekclan.de und dem SMP-Server.</p>

          {stats && (
            <div className="flex gap-6 flex-wrap">
              <div>
                <p className="text-2xl font-bold text-white">{stats.total}</p>
                <p className="text-xs text-white/75 uppercase tracking-wide">Updates</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{stats.sinceYear}</p>
                <p className="text-xs text-white/75 uppercase tracking-wide">Seit</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{stats.latestAgo}</p>
                <p className="text-xs text-white/75 uppercase tracking-wide">Letztes Update</p>
              </div>
            </div>
          )}
        </div>

        {/* Suche */}
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="🔍 Changelog durchsuchen..."
          className="w-full px-4 py-3 rounded-xl text-sm mb-4"
          style={{ background: 'var(--muted-bg)', border: '1px solid var(--card-border)', color: 'var(--foreground)' }}
        />

        {/* Filter */}
        {allTags.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-10">
            <button
              onClick={() => setActiveFilter(null)}
              className="px-3 py-1.5 rounded-full text-xs font-medium transition"
              style={activeFilter === null
                ? { background: 'var(--foreground)', color: 'var(--background)' }
                : { background: 'var(--muted-bg)', color: 'var(--muted)' }}
            >
              Alle
            </button>
            {allTags.map(tag => (
              <button
                key={tag.id}
                onClick={() => setActiveFilter(tag.id)}
                className="px-3 py-1.5 rounded-full text-xs font-medium transition"
                style={activeFilter === tag.id
                  ? { background: tag.color, color: 'white' }
                  : { background: 'var(--muted-bg)', color: 'var(--muted)', border: `1px solid ${tag.color}` }}
              >
                {tag.name}
              </button>
            ))}
          </div>
        )}

        {!user && (
          <p className="text-xs mb-6" style={{ color: 'var(--muted)', opacity: 0.8 }}>
            💡 <Link href="/login" className="underline">Melde dich an</Link>, um auf Einträge zu reagieren.
          </p>
        )}

        {loading ? (
          <p className="text-sm" style={{ color: 'var(--muted)' }}>Lädt...</p>
        ) : filtered.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--muted)' }}>
            {entries.length === 0 ? 'Noch keine Einträge vorhanden.' : 'Keine Einträge gefunden.'}
          </p>
        ) : (
          <div className="relative">
            {/* Vertikale Gradient-Linie der Timeline */}
            <div
              className="absolute left-[24px] sm:left-[32px] top-2 bottom-2 w-0.5"
              style={{ background: 'linear-gradient(180deg, #4F46E5, #7C3AED, #C026D3)' }}
            />

            {filtered.map((entry, i) => (
              <TimelineEntry
                key={entry.id}
                entry={entry}
                index={i}
                reactions={reactions[entry.id]}
                onReact={handleReact}
                canReact={!!user}
                onImageClick={setLightboxUrl}
              />
            ))}
          </div>
        )}
      </div>

      {/* Lightbox für Bilder in voller Größe */}
      {lightboxUrl && (
        <div
          onClick={() => setLightboxUrl(null)}
          className="fixed inset-0 flex items-center justify-center p-8 z-50 cursor-pointer"
          style={{ background: 'rgba(0,0,0,0.85)' }}
        >
          <img src={lightboxUrl} alt="" className="max-w-full max-h-full rounded-xl" />
        </div>
      )}
    </div>
  )
}