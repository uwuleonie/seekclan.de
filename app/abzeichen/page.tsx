'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '../lib/auth-context'
import Link from 'next/link'

type Category = {
  id: string
  name: string
  color: string
}

type Badge = {
  id: string
  name: string
  icon_url: string
  erreichbar: boolean
  description: string | null
  category_id: string | null
  badge_categories: Category | null
}

type Member = {
  id: string
  display_name: string
  role: string
  join_date: string
  stufe_override: number | null
  badges: Badge[]
}

const STUFEN = [
  { name: 'Neuling', min: 0 },
  { name: 'Mitglied', min: 90 },
  { name: 'Treues Mitglied', min: 180 },
  { name: 'Vertrauter', min: 365 },
  { name: 'Goat', min: 730 },
  { name: 'OG', min: 1095 },
]

const SUPABASE_URL = '/api/uploads/badge-icons'

function daysSince(dateStr: string) {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24))
}

function dateForStufe(joinDate: string, stufeIndex: number) {
  const d = new Date(joinDate)
  d.setDate(d.getDate() + STUFEN[stufeIndex].min)
  return d
}

function formatDate(d: Date) {
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function getCurrentStufe(joinDate: string, override: number | null): number {
  if (override !== null && override >= 0 && override <= 5) return override
  const days = daysSince(joinDate)
  for (let i = STUFEN.length - 1; i >= 0; i--) {
    if (days >= STUFEN[i].min) return i
  }
  return 0
}

export default function AbzeichenPage() {
  const { user } = useAuth()
  const [members, setMembers] = useState<Member[]>([])
  const [allBadges, setAllBadges] = useState<Badge[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [focusIndex, setFocusIndex] = useState(0)
  const [selectedBadge, setSelectedBadge] = useState<Badge | null>(null)
  const [hideUnerreichbar, setHideUnerreichbar] = useState(false)

  useEffect(() => {
    Promise.all([
      fetch('/api/clan/members').then(r => r.json()),
      fetch('/api/badges').then(r => r.json()),
    ]).then(([membersData, badgesData]) => {
      setMembers(membersData.members || [])
      setAllBadges(badgesData.badges || [])
      setCategories(badgesData.categories || [])
      setLoading(false)
    })
  }, [])

  const me = members.find(m => m.display_name === user?.username)
  const currentStufe = me ? getCurrentStufe(me.join_date, me.stufe_override) : -1
  const myBadgeIds = new Set(me?.badges?.map(b => b.id) || [])

  useEffect(() => {
    if (currentStufe >= 0) setFocusIndex(currentStufe)
  }, [currentStufe])

  let progressPercent = 100
  let daysToNext = 0
  let nextStufeName = ''
  if (me && currentStufe < STUFEN.length - 1) {
    const days = daysSince(me.join_date)
    const curMin = STUFEN[currentStufe].min
    const nextMin = STUFEN[currentStufe + 1].min
    progressPercent = Math.min(100, Math.max(0, ((days - curMin) / (nextMin - curMin)) * 100))
    daysToNext = Math.max(0, nextMin - days)
    nextStufeName = STUFEN[currentStufe + 1].name
  }

  const badgeOwnerCount = (badgeId: string) =>
    members.filter(m => m.badges?.some(b => b.id === badgeId)).length

  const visibleBadges = hideUnerreichbar
    ? allBadges.filter(b => b.erreichbar || myBadgeIds.has(b.id))
    : allBadges

  const badgesInCategory = (catId: string | null) =>
    visibleBadges.filter(b => b.category_id === catId)
  const uncategorized = badgesInCategory(null)

  if (loading) return <div className="min-h-screen flex items-center justify-center" style={{ color: 'var(--muted)' }}>Laden...</div>

  const visibleIndexes = [focusIndex - 1, focusIndex, focusIndex + 1].filter(i => i >= 0 && i < STUFEN.length)

  return (
    <div className="min-h-screen" style={{ background: 'var(--background)' }}>
      <div className="max-w-5xl mx-auto px-8 py-10">
        <Link href="/clan" className="text-sm flex items-center gap-1 mb-8 hover:opacity-70" style={{ color: 'var(--muted)' }}>← Zurück zum Clan</Link>

        <h1 className="text-4xl font-bold mb-2" style={{ color: 'var(--foreground)' }}>Abzeichen</h1>

        {!me ? (
          <div className="bg-red-200 border-2 border-red-400 rounded-2xl px-6 py-4 mb-8">
            <p className="text-gray-900 font-medium">Nicht eingeloggt oder Minecraft nicht verknüpft</p>
            <p className="text-gray-700 text-sm mt-1">Logge dich ein und verknüpfe deinen Minecraft-Account, um deinen Fortschritt zu sehen.</p>
          </div>
        ) : (
          <p className="mb-8" style={{ color: 'var(--muted)' }}>Du bist seit {daysSince(me.join_date)} Tagen im Clan — aktuelle Stufe: <span className="font-medium" style={{ color: 'var(--foreground)' }}>{STUFEN[currentStufe].name}</span></p>
        )}

        {/* Fortschrittsbalken */}
        {me && currentStufe < STUFEN.length - 1 && (
          <div className="mb-10">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-xs w-14" style={{ color: 'var(--muted)' }}>Stufe {currentStufe}</span>
              <div className="flex-1 h-3.5 rounded-full overflow-hidden"
                style={{ background: 'rgba(124,58,237,0.12)', boxShadow: '0 0 16px rgba(124,58,237,0.45)' }}>
                <div className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${progressPercent}%`, background: 'linear-gradient(135deg,#4F46E5,#7C3AED,#C026D3)', boxShadow: '0 0 20px rgba(124,58,237,0.9)' }} />
              </div>
              <span className="text-xs w-14 text-right" style={{ color: 'var(--muted)' }}>Stufe {currentStufe + 1}</span>
            </div>
            <p className="text-xs text-center" style={{ color: 'var(--muted)' }}>noch {daysToNext} Tage bis „{nextStufeName}"</p>
          </div>
        )}

        {/* Stufen-Karussell */}
        <div className="flex items-center justify-center gap-3 mb-16">
          <button onClick={() => setFocusIndex(Math.max(0, focusIndex - 1))} disabled={focusIndex === 0}
            className="w-10 h-10 rounded-full flex items-center justify-center hover:opacity-70 disabled:opacity-30 flex-shrink-0 text-2xl leading-none pb-1"
            style={{ border: '1px solid var(--card-border)', background: 'var(--card)', color: 'var(--foreground)' }}>
            ‹
          </button>
          <div className="flex gap-3 items-center">
            {visibleIndexes.map(i => {
              const isCurrent = i === currentStufe
              const isPast = me && i < currentStufe
              const isFuture = me && i > currentStufe
              const reachedDate = me ? dateForStufe(me.join_date, i) : null
              const reached = me && daysSince(me.join_date) >= STUFEN[i].min
              let subtitle = ''
              if (me) {
                if (reached && reachedDate) subtitle = `seit ${formatDate(reachedDate)}`
                else subtitle = `noch ${Math.max(0, STUFEN[i].min - daysSince(me.join_date))} Tage`
              } else subtitle = `ab Tag ${STUFEN[i].min}`

              const style: React.CSSProperties = {}
              if (isCurrent) { style.background = 'rgba(99,153,34,0.15)'; style.border = '2px solid #639922' }
              else if (isPast) { style.background = 'rgba(136,135,128,0.12)'; style.border = '2px solid #888780' }
              else if (isFuture) { style.background = 'rgba(226,75,74,0.10)'; style.border = '2px solid #E24B4A' }
              else { style.border = '1px solid var(--card-border)' }

              const isFocus = i === focusIndex
              return (
                <div key={i} className="rounded-2xl text-center transition-all"
                  style={{ ...style, width: isFocus ? 150 : 130, padding: isFocus ? '20px 10px' : '16px 8px' }}>
                  <div className="mx-auto mb-2.5 rounded-xl flex items-center justify-center" style={{ width: isFocus ? 72 : 60, height: isFocus ? 72 : 60, background: 'var(--card)' }}>
                    <img src={`${SUPABASE_URL}/stufe${i}.png`} alt={STUFEN[i].name} style={{ width: isFocus ? 60 : 48, height: isFocus ? 60 : 48 }} />
                  </div>
                  <p className="font-medium" style={{ fontSize: isFocus ? 15 : 13, color: 'var(--foreground)' }}>{STUFEN[i].name}</p>
                  <p style={{ fontSize: 11, color: 'var(--muted)' }}>{subtitle}</p>
                </div>
              )
            })}
          </div>
          <button onClick={() => setFocusIndex(Math.min(STUFEN.length - 1, focusIndex + 1))} disabled={focusIndex === STUFEN.length - 1}
            className="w-10 h-10 rounded-full flex items-center justify-center hover:opacity-70 disabled:opacity-30 flex-shrink-0 text-2xl leading-none pb-1"
            style={{ border: '1px solid var(--card-border)', background: 'var(--card)', color: 'var(--foreground)' }}>
            ›
          </button>
        </div>

        {/* Spezielle Abzeichen */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>Spezielle Abzeichen</h2>
            <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>Besondere Auszeichnungen für besondere Errungenschaften.</p>
          </div>
          <button onClick={() => setHideUnerreichbar(v => !v)}
            className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium border transition-all"
            style={hideUnerreichbar
              ? { background: 'var(--foreground)', color: 'var(--background)', borderColor: 'var(--foreground)' }
              : { background: 'var(--card)', color: 'var(--muted)', borderColor: 'var(--card-border)' }}>
            {hideUnerreichbar ? '👁 Alle anzeigen' : '🚫 Nicht erreichbare ausblenden'}
          </button>
        </div>

        {allBadges.length === 0 ? (
          <div className="card rounded-2xl px-6 py-10 text-center">
            <p className="text-4xl mb-3">🎖️</p>
            <p className="text-sm" style={{ color: 'var(--muted)' }}>Noch keine speziellen Abzeichen erstellt.</p>
          </div>
        ) : (
          <div className="space-y-10">
            {categories.map(cat => {
              const catBadges = badgesInCategory(cat.id)
              if (catBadges.length === 0) return null
              return (
                <div key={cat.id}>
                  <div className="flex items-center gap-3 mb-4">
                    <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider text-white" style={{ backgroundColor: cat.color }}>{cat.name}</span>
                    <div className="flex-1 h-px" style={{ background: 'var(--card-border)' }} />
                    <span className="text-sm" style={{ color: 'var(--muted)' }}>{catBadges.length} Abzeichen</span>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    {catBadges.map(badge => <BadgeCard key={badge.id} badge={badge} hasIt={myBadgeIds.has(badge.id)} ownerCount={badgeOwnerCount(badge.id)} onClick={() => setSelectedBadge(badge)} />)}
                  </div>
                </div>
              )
            })}
            {uncategorized.length > 0 && (
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider text-white bg-gray-400">Sonstige</span>
                  <div className="flex-1 h-px" style={{ background: 'var(--card-border)' }} />
                  <span className="text-sm" style={{ color: 'var(--muted)' }}>{uncategorized.length} Abzeichen</span>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  {uncategorized.map(badge => <BadgeCard key={badge.id} badge={badge} hasIt={myBadgeIds.has(badge.id)} ownerCount={badgeOwnerCount(badge.id)} onClick={() => setSelectedBadge(badge)} />)}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Badge Popup */}
      {selectedBadge && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4" onClick={() => setSelectedBadge(null)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div className="relative rounded-3xl p-8 max-w-sm w-full shadow-2xl text-center" style={{ background: 'var(--card)' }} onClick={e => e.stopPropagation()}>
            <button onClick={() => setSelectedBadge(null)} className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full text-sm" style={{ background: 'var(--muted-bg)', color: 'var(--muted)' }}>✕</button>
            <div className="w-24 h-24 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: 'var(--muted-bg)', border: '1px solid var(--card-border)' }}>
              {selectedBadge.icon_url.startsWith('http') ? (
                <img src={selectedBadge.icon_url} alt={selectedBadge.name} className="w-16 h-16 rounded-xl object-contain" />
              ) : <span className="text-5xl">{selectedBadge.icon_url}</span>}
            </div>
            {selectedBadge.badge_categories && (
              <span className="text-xs px-2 py-0.5 rounded-full text-white font-medium mb-3 inline-block" style={{ backgroundColor: selectedBadge.badge_categories.color }}>
                {selectedBadge.badge_categories.name}
              </span>
            )}
            <h3 className="text-xl font-bold mb-2" style={{ color: 'var(--foreground)' }}>{selectedBadge.name}</h3>
            {selectedBadge.description && <p className="text-sm mb-4" style={{ color: 'var(--muted)' }}>{selectedBadge.description}</p>}
            <div className="flex justify-center gap-6 text-sm mt-4 pt-4" style={{ borderTop: '1px solid var(--card-border)' }}>
              <div className="text-center">
                <p className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>{badgeOwnerCount(selectedBadge.id)}</p>
                <p className="text-xs" style={{ color: 'var(--muted)' }}>Spieler haben es</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold" style={{ color: selectedBadge.erreichbar ? '#639922' : '#E24B4A' }}>{selectedBadge.erreichbar ? '✓' : '✕'}</p>
                <p className="text-xs" style={{ color: 'var(--muted)' }}>{selectedBadge.erreichbar ? 'Erreichbar' : 'Nicht mehr erreichbar'}</p>
              </div>
              {myBadgeIds.has(selectedBadge.id) && (
                <div className="text-center">
                  <p className="text-2xl font-bold text-green-600">✓</p>
                  <p className="text-xs" style={{ color: 'var(--muted)' }}>Du hast es</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function BadgeCard({ badge, hasIt, ownerCount, onClick }: {
  badge: Badge, hasIt: boolean, ownerCount: number, onClick: () => void
}) {
  const style: React.CSSProperties = {}
  if (hasIt) { style.background = 'rgba(99,153,34,0.15)'; style.border = '2px solid #639922' }
  else if (!badge.erreichbar) { style.background = 'rgba(226,75,74,0.10)'; style.border = '2px solid #E24B4A' }
  else { style.background = 'var(--card)'; style.border = '1px solid var(--card-border)' }

  return (
    <button onClick={onClick} className="rounded-2xl p-6 flex flex-col items-center text-center transition-all hover:scale-105 hover:shadow-md w-full" style={style}>
      <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-3" style={{ background: 'var(--muted-bg)' }}>
        {badge.icon_url.startsWith('http') ? (
          <img src={badge.icon_url} alt={badge.name} className="rounded-xl object-contain" style={{ width: 48, height: 48 }} />
        ) : <span className="text-4xl">{badge.icon_url}</span>}
      </div>
      <p className="font-medium text-sm" style={{ color: 'var(--foreground)' }}>{badge.name}</p>
      <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>{hasIt ? '✓ Du hast es' : badge.erreichbar ? 'Noch erreichbar' : 'Nicht mehr erreichbar'}</p>
      <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>{ownerCount} Spieler</p>
    </button>
  )
}