'use client'

import { useState, useEffect, useRef, useMemo, type CSSProperties } from 'react'
import Link from 'next/link'
import { useAuth } from '../lib/auth-context'

// ─── Types ────────────────────────────────────────────────────────────────────

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

// Vote: +1 = up, -1 = down, 0 = keine
type VoteState = Record<number, 1 | -1 | 0>

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('de-DE', {
    day: '2-digit', month: 'long', year: 'numeric',
  })
}


function timeAgo(dateStr: string) {
  const days = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000)
  if (days < 1) return 'heute'
  if (days === 1) return 'gestern'
  if (days < 30) return `vor ${days} Tagen`
  const months = Math.floor(days / 30)
  if (months < 12) return `vor ${months} Monat${months === 1 ? '' : 'en'}`
  const years = Math.floor(months / 12)
  return `vor ${years} Jahr${years === 1 ? '' : 'en'}`
}

// ─── Abschnitt-Parser (identisch zu Admin-Panel) ─────────────────────────────

const SUB_OPEN  = '@@SUB@@'
const SUB_CLOSE = '@@ENDSUB@@'

type ParsedSection = { subheading: string; description: string }

function parseDescription(desc: string): ParsedSection[] {
  const regex = new RegExp(`${SUB_OPEN}([\\s\\S]*?)${SUB_CLOSE}`, 'g')
  const sections: ParsedSection[] = []
  let match
  while ((match = regex.exec(desc)) !== null) {
    const parts = match[1].split('\n')
    sections.push({ subheading: parts[0] || '', description: parts.slice(1).join('\n').trim() })
  }
  // Kein strukturiertes Format → plain
  if (sections.length === 0 && desc.trim()) {
    return [{ subheading: '', description: desc.trim() }]
  }
  return sections
}

function RenderDescription({ description, clamp }: { description: string; clamp?: number }) {
  const sections = parseDescription(description)
  return (
    <div>
      {sections.map((s, i) => (
        <div key={i} style={{ marginBottom: i < sections.length - 1 ? 10 : 0 }}>
          {s.subheading && (
            <p style={{ fontWeight: 700, fontSize: 12, color: 'rgba(255,255,255,0.75)', marginBottom: 3 }}>
              {s.subheading}
            </p>
          )}
          {s.description && (
            <p style={{
              fontSize: 12, color: 'rgba(255,255,255,0.52)',
              lineHeight: 1.65, whiteSpace: 'pre-wrap',
              ...(clamp ? {
                display: '-webkit-box',
                WebkitLineClamp: clamp,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              } as React.CSSProperties : {}),
            }}>
              {s.description}
            </p>
          )}
        </div>
      ))}
    </div>
  )
}

// ─── Glassmorphism-Tokens ─────────────────────────────────────────────────────

const G = {
  header: {
    background: 'rgba(12,14,20,0.85)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    borderBottom: '1px solid rgba(255,255,255,0.05)',
  } as CSSProperties,
  col: {
    background: 'rgba(18,20,30,0.68)',
    backdropFilter: 'blur(18px) saturate(150%)',
    WebkitBackdropFilter: 'blur(18px) saturate(150%)',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: 14,
  } as CSSProperties,
  featured: {
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.09)',
    borderRadius: 10,
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
  } as CSSProperties,
  mini: {
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: 8,
  } as CSSProperties,
  input: {
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.10)',
    borderRadius: 8,
    color: '#e2e4ea',
    padding: '8px 13px',
    fontSize: 13,
    outline: 'none',
  } as CSSProperties,
}

// ─── VoteButtons ──────────────────────────────────────────────────────────────
// Ergebnis wird NICHT angezeigt — nur ob der User selbst gevotet hat.

function VoteButtons({
  entryId,
  vote,
  canVote,
  onVote,
}: {
  entryId: number
  vote: 1 | -1 | 0
  canVote: boolean
  onVote: (id: number, v: 1 | -1) => void
}) {
  return (
    <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
      {/* Upvote */}
      <button
        onClick={() => canVote && onVote(entryId, 1)}
        disabled={!canVote}
        title={canVote ? 'Hilfreich' : 'Nur für eingeloggte Spieler'}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: 30, height: 30, borderRadius: 7, border: 'none', cursor: canVote ? 'pointer' : 'default',
          background: vote === 1 ? 'rgba(52,211,153,0.18)' : 'rgba(255,255,255,0.05)',
          color: vote === 1 ? '#34d399' : 'rgba(255,255,255,0.30)',
          fontSize: 14, transition: 'all 0.13s',
          outline: vote === 1 ? '1px solid rgba(52,211,153,0.40)' : '1px solid transparent',
        }}
      >
        ↑
      </button>
      {/* Downvote */}
      <button
        onClick={() => canVote && onVote(entryId, -1)}
        disabled={!canVote}
        title={canVote ? 'Nicht hilfreich' : 'Nur für eingeloggte Spieler'}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: 30, height: 30, borderRadius: 7, border: 'none', cursor: canVote ? 'pointer' : 'default',
          background: vote === -1 ? 'rgba(248,113,113,0.18)' : 'rgba(255,255,255,0.05)',
          color: vote === -1 ? '#f87171' : 'rgba(255,255,255,0.30)',
          fontSize: 14, transition: 'all 0.13s',
          outline: vote === -1 ? '1px solid rgba(248,113,113,0.40)' : '1px solid transparent',
        }}
      >
        ↓
      </button>
    </div>
  )
}

// ─── Badges ───────────────────────────────────────────────────────────────────

function Badges({ entry }: { entry: Entry }) {
  return (
    <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 10, alignItems: 'center' }}>

      {entry.tags.map(tag => (
        <span key={tag.id} style={{
          fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 99,
          background: tag.color + '22', color: tag.color,
          border: `1px solid ${tag.color}40`,
          textTransform: 'uppercase', letterSpacing: '0.04em',
        }}>
          {tag.name}
        </span>
      ))}
      {entry.version && (
        <span style={{
          fontSize: 9, fontWeight: 600, padding: '2px 8px', borderRadius: 99,
          background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.38)',
          border: '1px solid rgba(255,255,255,0.08)',
        }}>
          v{entry.version}
        </span>
      )}
    </div>
  )
}

// ─── Featured Card ────────────────────────────────────────────────────────────

function FeaturedCard({
  entry, vote, canVote, onVote, onImageClick, accentColor,
}: {
  entry: Entry
  vote: 1 | -1 | 0
  canVote: boolean
  onVote: (id: number, v: 1 | -1) => void
  onImageClick: (url: string) => void
  accentColor: string
}) {
  return (
    <div style={{ ...G.featured, overflow: 'hidden', marginBottom: 8 }}>
      <div style={{ height: 3, background: `linear-gradient(90deg, ${accentColor}, transparent)` }} />

      <div style={{ padding: '14px 16px' }}>
        <Badges entry={entry} />

        <h3 style={{ color: '#e2e4ea', fontWeight: 700, fontSize: 14, lineHeight: 1.4, marginBottom: 4 }}>
          {entry.title}
        </h3>
        <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', marginBottom: 10 }}>
          {formatDate(entry.created_at)} · {timeAgo(entry.created_at)}
        </p>

        {/* Erstes Bild prominent */}
        {entry.images.length > 0 && (
          <button
            onClick={() => onImageClick(entry.images[0].url)}
            style={{
              display: 'block', width: '100%', border: 'none', padding: 0,
              cursor: 'pointer', borderRadius: 7, overflow: 'hidden',
              marginBottom: 10, aspectRatio: '16/9',
              background: 'rgba(255,255,255,0.04)',
            }}
          >
            <img
              src={entry.images[0].url} alt=""
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', transition: 'opacity 0.15s' }}
              onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')}
              onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
            />
          </button>
        )}

        {/* Weitere Bilder klein */}
        {entry.images.length > 1 && (
          <div style={{ display: 'flex', gap: 5, marginBottom: 10 }}>
            {entry.images.slice(1).map(img => (
              <button key={img.id} onClick={() => onImageClick(img.url)} style={{
                width: 48, height: 36, border: 'none', padding: 0, cursor: 'pointer',
                borderRadius: 5, overflow: 'hidden', background: 'rgba(255,255,255,0.04)', flexShrink: 0,
              }}>
                <img src={img.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
              </button>
            ))}
          </div>
        )}

        {/* Beschreibung */}
        {/* Beschreibung */}
        <div style={{ marginBottom: 12 }}>
          <RenderDescription description={entry.description} clamp={6} />
        </div>

        {/* Vote-Leiste */}
        <div style={{ paddingTop: 10, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <VoteButtons entryId={entry.id} vote={vote} canVote={canVote} onVote={onVote} />
        </div>
      </div>
    </div>
  )
}

// ─── Mini Card ────────────────────────────────────────────────────────────────

// ─── ExpandableCard (ältere Einträge, klappt inline auf) ─────────────────────

function ExpandableCard({ entry, accentColor, votes, canVote, onVote, onImageClick }: {
  entry: Entry
  accentColor: string
  votes: VoteState
  canVote: boolean
  onVote: (id: number, v: 1 | -1) => void
  onImageClick: (url: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [hov, setHov] = useState(false)

  return (
    <div style={{
      ...G.mini,
      marginBottom: 5,
      overflow: 'hidden',
      borderColor: open ? 'rgba(255,255,255,0.12)' : hov ? 'rgba(255,255,255,0.10)' : 'rgba(255,255,255,0.06)',
      transition: 'border-color 0.12s',
    }}>
      {/* Header-Zeile — immer sichtbar */}
      <div
        onClick={() => setOpen(v => !v)}
        onMouseEnter={() => setHov(true)}
        onMouseLeave={() => setHov(false)}
        style={{
          display: 'flex', gap: 10, alignItems: 'flex-start',
          padding: '10px 13px', cursor: 'pointer',
          background: open ? 'rgba(255,255,255,0.055)' : hov ? 'rgba(255,255,255,0.04)' : 'transparent',
          transition: 'background 0.12s',
        }}
      >
        <span style={{
          width: 7, height: 7, borderRadius: '50%', background: accentColor,
          flexShrink: 0, marginTop: 4, opacity: 0.75,
        }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{
            fontSize: 12, fontWeight: 600, color: '#c8cad4',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 2,
          }}>
            {entry.title}
          </p>
          <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.22)' }}>
            {timeAgo(entry.created_at)}{entry.version ? ` · v${entry.version}` : ''}
          </p>
        </div>
        <span style={{
          fontSize: 10, color: 'rgba(255,255,255,0.25)', flexShrink: 0, marginTop: 2,
          transition: 'transform 0.2s',
          display: 'inline-block',
          transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
        }}>▼</span>
      </div>

      {/* Aufgeklappter Inhalt */}
      {open && (
        <div style={{
          padding: '0 13px 13px 13px',
          borderTop: '1px solid rgba(255,255,255,0.06)',
        }}>
          <div style={{ height: 10 }} />

          {/* Bild(er) */}
          {entry.images.length > 0 && (
            <div style={{ marginBottom: 10 }}>
              <button onClick={() => onImageClick(entry.images[0].url)} style={{
                display: 'block', width: '100%', border: 'none', padding: 0,
                cursor: 'pointer', borderRadius: 7, overflow: 'hidden',
                marginBottom: 5, aspectRatio: '16/9', background: 'rgba(255,255,255,0.04)',
              }}>
                <img src={entry.images[0].url} alt=""
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', transition: 'opacity 0.15s' }}
                  onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')}
                  onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
                />
              </button>
              {entry.images.length > 1 && (
                <div style={{ display: 'flex', gap: 5 }}>
                  {entry.images.slice(1).map(img => (
                    <button key={img.id} onClick={() => onImageClick(img.url)} style={{
                      width: 48, height: 36, border: 'none', padding: 0, cursor: 'pointer',
                      borderRadius: 5, overflow: 'hidden', background: 'rgba(255,255,255,0.04)', flexShrink: 0,
                    }}>
                      <img src={img.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Beschreibung */}
          <div style={{ marginBottom: 10 }}>
            <RenderDescription description={entry.description} />
          </div>

          {/* Votes */}
          <div style={{ paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <VoteButtons
              entryId={entry.id}
              vote={votes[entry.id] ?? 0}
              canVote={canVote}
              onVote={onVote}
            />
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Kategorie-Spalte ─────────────────────────────────────────────────────────

function CategoryColumn({
  tag, entries, votes, canVote, onVote, onImageClick,
}: {
  tag: Tag
  entries: Entry[]
  votes: VoteState
  canVote: boolean
  onVote: (id: number, v: 1 | -1) => void
  onImageClick: (url: string) => void
}) {
  if (entries.length === 0) return null
  const [featured, ...rest] = entries

  return (
    <div style={{
      ...G.col, width: 320, flexShrink: 0,
      display: 'flex', flexDirection: 'column', maxHeight: '100%', overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '13px 16px 11px', borderBottom: '1px solid rgba(255,255,255,0.06)',
        flexShrink: 0, display: 'flex', alignItems: 'center', gap: 9,
      }}>
        <span style={{
          width: 9, height: 9, borderRadius: '50%', background: tag.color,
          boxShadow: `0 0 8px ${tag.color}77`, flexShrink: 0,
        }} />
        <span style={{ color: '#e2e4ea', fontWeight: 700, fontSize: 14, flex: 1 }}>{tag.name}</span>
        <span style={{
          fontSize: 11, fontWeight: 600, padding: '2px 9px', borderRadius: 99,
          background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.35)',
        }}>
          {entries.length}
        </span>
      </div>

      <div className="cl-scroll" style={{ flex: 1, padding: '12px 12px' }}>
        <p style={{
          fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.28)',
          letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 7,
        }}>
          Neuestes Update
        </p>
        <FeaturedCard
          entry={featured}
          vote={votes[featured.id] ?? 0}
          canVote={canVote}
          onVote={onVote}
          onImageClick={onImageClick}
          accentColor={tag.color}
        />

        {rest.length > 0 && (
          <>
            <p style={{
              fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.28)',
              letterSpacing: '0.08em', textTransform: 'uppercase',
              marginTop: 14, marginBottom: 7,
            }}>
              Weitere Updates
            </p>
            {rest.map(entry => (
              <ExpandableCard
                key={entry.id}
                entry={entry}
                accentColor={tag.color}
                votes={votes}
                canVote={canVote}
                onVote={onVote}
                onImageClick={onImageClick}
              />
            ))}
          </>
        )}
        <div style={{ height: 8 }} />
      </div>
    </div>
  )
}

// ─── Lightbox ─────────────────────────────────────────────────────────────────

function Lightbox({ url, onClose }: { url: string; onClose: () => void }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 100,
      background: 'rgba(0,0,0,0.90)', backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 32, cursor: 'pointer',
    }}>
      <img src={url} alt="" style={{ maxWidth: '100%', maxHeight: '100%', borderRadius: 10, boxShadow: '0 24px 80px rgba(0,0,0,0.6)' }} />
      <button onClick={onClose} style={{
        position: 'absolute', top: 20, right: 24,
        background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)',
        borderRadius: 8, color: 'rgba(255,255,255,0.6)', fontSize: 16, cursor: 'pointer', padding: '4px 12px',
      }}>✕</button>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function ChangelogPage() {
  const { user } = useAuth()
  const isAdmin = user && (user.clan_role === 'administrator' || user.clan_role === 'owner')

  const [entries, setEntries] = useState<Entry[]>([])
  const [allTags, setAllTags] = useState<Tag[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null)
  const [votes, setVotes] = useState<VoteState>({})
  const [activeTagFilter, setActiveTagFilter] = useState<number | null>(null)

  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const navbar = document.querySelector('nav') as HTMLElement | null
    const set = () => {
      const navH = navbar ? navbar.getBoundingClientRect().height : 65
      if (containerRef.current) containerRef.current.style.height = `${window.innerHeight - navH}px`
    }
    set()
    window.addEventListener('resize', set)
    return () => window.removeEventListener('resize', set)
  }, [])

  useEffect(() => {
    const html = document.documentElement
    const body = document.body
    html.style.overflow = 'hidden'
    body.style.overflow = 'hidden'
    return () => { html.style.overflow = ''; body.style.overflow = '' }
  }, [])

  useEffect(() => {
    Promise.all([
      fetch('/api/admin2/changelog').then(r => r.json()),
      fetch('/api/admin2/changelog/tags').then(r => r.json()),
    ]).then(([entriesData, tagsData]) => {
      setEntries(entriesData.entries || [])
      setAllTags(tagsData.tags || [])
      setLoading(false)
    })
  }, [])

  // Vote: optimistisch, kein Ergebnis sichtbar — nur eigener Status
  const handleVote = (entryId: number, v: 1 | -1) => {
    if (!user) return
    setVotes(prev => {
      const current = prev[entryId] ?? 0
      // nochmal klicken = toggle off
      return { ...prev, [entryId]: current === v ? 0 : v }
    })
    // Fire & forget — API-Endpunkt für Votes (gleiche Reactions-Route, anderes Emoji-Konzept)
    // Nutzt den bestehenden Reactions-Endpunkt mit 'up'/'down' als emoji-Schlüssel
    fetch('/api/changelog/reactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entry_id: entryId, emoji: v === 1 ? 'up' : 'down' }),
    }).catch(() => {})
  }

  const filteredEntries = useMemo(() => {
    let r = entries
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      r = r.filter(e =>
        e.title.toLowerCase().includes(q) ||
        e.description.toLowerCase().includes(q) ||
        (e.version?.toLowerCase().includes(q) ?? false)
      )
    }
    return r
  }, [entries, search])

  const columns = useMemo(() => {
    const visibleTags = activeTagFilter !== null
      ? allTags.filter(t => t.id === activeTagFilter)
      : allTags
    return visibleTags
      .map(tag => ({ tag, entries: filteredEntries.filter(e => e.tags.some(t => t.id === tag.id)) }))
      .filter(col => col.entries.length > 0)
  }, [allTags, filteredEntries, activeTagFilter])

  const untaggedEntries = useMemo(() =>
    filteredEntries.filter(e => e.tags.length === 0),
    [filteredEntries]
  )

  return (
    <div ref={containerRef} style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', width: '100%', position: 'relative' }}>
      <style>{`
        .cl-scroll { overflow-y: auto; scrollbar-width: none; }
        .cl-scroll::-webkit-scrollbar { display: none; }
        .cl-search::placeholder { color: rgba(255,255,255,0.22); }
      `}</style>

      {/* Hintergrund */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 0, background: 'linear-gradient(135deg, #0a0b10 0%, #0e1020 40%, #0c0e1a 70%, #0a0b14 100%)' }} />
      <div style={{ position: 'absolute', width: 700, height: 700, borderRadius: '50%', top: -250, left: -200, background: 'radial-gradient(circle, rgba(88,65,212,0.32) 0%, transparent 70%)', zIndex: 0, pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', width: 500, height: 500, borderRadius: '50%', bottom: -150, right: -100, background: 'radial-gradient(circle, rgba(124,45,200,0.25) 0%, transparent 70%)', zIndex: 0, pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', width: 400, height: 400, borderRadius: '50%', top: '30%', right: '30%', background: 'radial-gradient(circle, rgba(37,99,200,0.15) 0%, transparent 70%)', zIndex: 0, pointerEvents: 'none' }} />

      {/* ── Top-Bar ────────────────────────────────────────────────────────── */}
      <div style={{ ...G.header, padding: '11px 24px', display: 'flex', alignItems: 'center', gap: 16, flexShrink: 0, position: 'relative', zIndex: 2 }}>
        <span style={{ color: '#fff', fontWeight: 700, fontSize: 15 }}>changelog</span>
        <span style={{ width: 1, height: 16, background: 'rgba(255,255,255,0.10)', flexShrink: 0 }} />

        {/* Kategorie-Tabs */}
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <button
            onClick={() => setActiveTagFilter(null)}
            style={{
              padding: '4px 12px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 500,
              background: activeTagFilter === null ? 'rgba(255,255,255,0.12)' : 'transparent',
              color: activeTagFilter === null ? '#fff' : 'rgba(255,255,255,0.35)',
              transition: 'all 0.12s',
            }}
          >
            Alle
          </button>
          {allTags.map(tag => (
            <button
              key={tag.id}
              onClick={() => setActiveTagFilter(tag.id === activeTagFilter ? null : tag.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '4px 12px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 500,
                background: activeTagFilter === tag.id ? tag.color + '22' : 'transparent',
                color: activeTagFilter === tag.id ? tag.color : 'rgba(255,255,255,0.35)',
                transition: 'all 0.12s',
              }}
            >
              <span style={{
                width: 6, height: 6, borderRadius: '50%', background: tag.color, flexShrink: 0,
                boxShadow: activeTagFilter === tag.id ? `0 0 6px ${tag.color}` : 'none',
                transition: 'all 0.12s',
              }} />
              {tag.name}
            </button>
          ))}
        </div>

        {/* Rechte Seite: Suche + Admin + Login + Zurück */}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          <input
            className="cl-search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Suchen..."
            style={{ ...G.input, width: 180 }}
          />

          {/* Admin-Shortlink — nur für administrator/owner */}
          {isAdmin && (
            <Link
              href="/admin2/changelog"
              style={{
                fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap',
                background: 'rgba(251,191,36,0.12)',
                border: '1px solid rgba(251,191,36,0.30)',
                color: '#fbbf24', borderRadius: 6,
                padding: '5px 13px', textDecoration: 'none',
                display: 'flex', alignItems: 'center', gap: 5,
              }}
            >
              <span style={{ fontSize: 11, opacity: 0.8 }}>⚙</span>
              Admin
            </Link>
          )}

          {!user && (
            <Link
              href="/login"
              style={{
                fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap',
                background: 'rgba(88,101,242,0.18)',
                border: '1px solid rgba(88,101,242,0.35)',
                color: '#a5b4fc', borderRadius: 6,
                padding: '5px 14px', textDecoration: 'none',
              }}
            >
              Anmelden
            </Link>
          )}

          <Link href="/" style={{
            fontSize: 12, color: 'rgba(255,255,255,0.28)', textDecoration: 'none',
            padding: '5px 10px', borderRadius: 6,
            border: '1px solid rgba(255,255,255,0.07)',
            whiteSpace: 'nowrap',
          }}>
            ← Zurück
          </Link>
        </div>
      </div>

      {/* ── Board ──────────────────────────────────────────────────────────── */}
      <div style={{
        flex: 1, overflowX: 'auto', overflowY: 'hidden',
        position: 'relative', zIndex: 1,
        padding: '20px 20px', display: 'flex', gap: 14, alignItems: 'flex-start',
        scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.10) transparent',
      }}>
        {loading ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', paddingTop: 60 }}>
            <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: 14 }}>Lädt...</p>
          </div>
        ) : columns.length === 0 && untaggedEntries.length === 0 ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', paddingTop: 60 }}>
            <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: 14 }}>
              {entries.length === 0 ? 'Noch keine Einträge vorhanden.' : 'Keine Einträge gefunden.'}
            </p>
          </div>
        ) : (
          <>
            {columns.map(({ tag, entries: colEntries }) => (
              <CategoryColumn
                key={tag.id}
                tag={tag}
                entries={colEntries}
                votes={votes}
                canVote={!!user}
                onVote={handleVote}
                onImageClick={setLightboxUrl}
              />
            ))}
            {untaggedEntries.length > 0 && (
              <CategoryColumn
                tag={{ id: -1, name: 'Sonstiges', color: '#6b7280' }}
                entries={untaggedEntries}
                votes={votes}
                canVote={!!user}
                onVote={handleVote}
                onImageClick={setLightboxUrl}
              />
            )}
          </>
        )}
      </div>

      {/* Lightbox */}
      {lightboxUrl && <Lightbox url={lightboxUrl} onClose={() => setLightboxUrl(null)} />}
    </div>
  )
}