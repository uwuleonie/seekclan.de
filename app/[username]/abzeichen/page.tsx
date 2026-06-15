'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '../../lib/auth-context'
import { useParams } from 'next/navigation'
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
  { name: 'Neuling',         min: 0    },
  { name: 'Mitglied',        min: 90   },
  { name: 'Treues Mitglied', min: 180  },
  { name: 'Vertrauter',      min: 365  },
  { name: 'Goat',            min: 730  },
  { name: 'OG',              min: 1095 },
]

const SUPABASE_URL = 'https://lgvrborqklwfbkgbjnvs.supabase.co/storage/v1/object/public/badge-icons'

function daysSince(dateStr: string) {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24))
}

function getCurrentStufe(joinDate: string, override: number | null): number {
  if (override !== null && override >= 0 && override <= 5) return override
  const days = daysSince(joinDate)
  for (let i = STUFEN.length - 1; i >= 0; i--) {
    if (days >= STUFEN[i].min) return i
  }
  return 0
}

function formatDate(d: Date) {
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export default function UserAbzeichenPage() {
  const params = useParams()
  // username kommt aus der URL, z.B. /uwuleonie/abzeichen
  const username = typeof params.username === 'string' ? params.username : ''
  const { user: currentUser } = useAuth()

  const [member, setMember] = useState<Member | null>(null)
  const [allBadges, setAllBadges] = useState<Badge[]>([])
  const [allMembers, setAllMembers] = useState<Member[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [selectedBadge, setSelectedBadge] = useState<Badge | null>(null)
  const [hideUnerreichbar, setHideUnerreichbar] = useState(false)

  useEffect(() => {
    Promise.all([
      fetch('/api/clan/members').then(r => r.json()),
      fetch('/api/badges').then(r => r.json()),
    ]).then(([membersData, badgesData]) => {
      const members: Member[] = membersData.members || []
      const found = members.find(m => m.display_name.toLowerCase() === username.toLowerCase())
      setAllMembers(members)
      setAllBadges(badgesData.badges || [])
      setCategories(badgesData.categories || [])
      if (found) {
        setMember(found)
      } else {
        setNotFound(true)
      }
      setLoading(false)
    })
  }, [username])

  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-400">Laden...</div>

  if (notFound) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <p className="text-5xl mb-4">🔍</p>
        <p className="text-gray-900 font-bold text-xl mb-2">Spieler nicht gefunden</p>
        <p className="text-gray-500 mb-6">„{username}" ist kein Mitglied im Clan oder hat keinen Seek-Account.</p>
        <Link href="/clan" className="btn-gradient text-white px-6 py-3 rounded-xl">Zum Clan</Link>
      </div>
    </div>
  )

  const currentStufe = getCurrentStufe(member!.join_date, member!.stufe_override)
  const myBadgeIds = new Set(member!.badges?.map(b => b.id) || [])
  const isOwnPage = currentUser?.username?.toLowerCase() === username.toLowerCase()

  // Fortschrittsbalken
  let progressPercent = 100
  let daysToNext = 0
  let nextStufeName = ''
  if (currentStufe < STUFEN.length - 1) {
    const days = daysSince(member!.join_date)
    const curMin = STUFEN[currentStufe].min
    const nextMin = STUFEN[currentStufe + 1].min
    progressPercent = Math.min(100, Math.max(0, ((days - curMin) / (nextMin - curMin)) * 100))
    daysToNext = Math.max(0, nextMin - days)
    nextStufeName = STUFEN[currentStufe + 1].name
  }

  const badgeOwnerCount = (badgeId: string) =>
    allMembers.filter(m => m.badges?.some(b => b.id === badgeId)).length

  const visibleBadges = hideUnerreichbar
    ? allBadges.filter(b => b.erreichbar || myBadgeIds.has(b.id))
    : allBadges

  const badgesInCategory = (catId: string | null) =>
    visibleBadges.filter(b => b.category_id === catId)
  const uncategorized = badgesInCategory(null)

  const stufeReachedDate = new Date(member!.join_date)
  stufeReachedDate.setDate(stufeReachedDate.getDate() + STUFEN[currentStufe].min)

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-8 py-10">
        <Link href={`/clan`} className="text-gray-500 text-sm flex items-center gap-1 mb-8 hover:text-gray-700">← Zurück zum Clan</Link>

        {/* Profil-Header */}
        <div className="flex items-center gap-5 mb-8">
          <img src={`https://mc-heads.net/avatar/${member!.display_name}/80`}
            alt={member!.display_name} className="w-20 h-20 rounded-2xl" />
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{member!.display_name}</h1>
            <p className="text-gray-500 mt-1">
              {isOwnPage ? 'Deine Abzeichen' : `Abzeichen von ${member!.display_name}`}
              {' · '}
              <span className="font-medium text-gray-700">{STUFEN[currentStufe].name}</span>
              {' · '}
              {daysSince(member!.join_date)} Tage im Clan
            </p>
            <p className="text-gray-400 text-sm">{myBadgeIds.size} von {allBadges.length} Abzeichen</p>
          </div>
          <div className="ml-auto">
            <img src={`${SUPABASE_URL}/stufe${currentStufe}.png`} alt={STUFEN[currentStufe].name}
              className="w-16 h-16" title={STUFEN[currentStufe].name} />
          </div>
        </div>

        {/* Fortschrittsbalken */}
        {currentStufe < STUFEN.length - 1 && (
          <div className="mb-10">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-xs text-gray-400 w-14">Stufe {currentStufe}</span>
              <div className="flex-1 h-3.5 rounded-full overflow-hidden"
                style={{ background: 'rgba(124,58,237,0.12)', boxShadow: '0 0 16px rgba(124,58,237,0.45), inset 0 0 4px rgba(124,58,237,0.2)' }}>
                <div className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${progressPercent}%`,
                    background: 'linear-gradient(135deg,#4F46E5,#7C3AED,#C026D3)',
                    boxShadow: '0 0 20px rgba(124,58,237,0.9), 0 0 8px rgba(192,38,211,0.8)'
                  }} />
              </div>
              <span className="text-xs text-gray-400 w-14 text-right">Stufe {currentStufe + 1}</span>
            </div>
            <p className="text-xs text-gray-400 text-center">noch {daysToNext} Tage bis „{nextStufeName}"</p>
          </div>
        )}

        {/* Abzeichen Header + Filter */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Spezielle Abzeichen</h2>
            <p className="text-gray-500 text-sm mt-1">Besondere Auszeichnungen für besondere Errungenschaften.</p>
          </div>
          <button
            onClick={() => setHideUnerreichbar(v => !v)}
            className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium border transition-all ${
              hideUnerreichbar
                ? 'bg-gray-900 text-white border-gray-900'
                : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
            }`}>
            {hideUnerreichbar ? '👁 Alle anzeigen' : '🚫 Nicht erreichbare ausblenden'}
          </button>
        </div>

        {allBadges.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 px-6 py-10 text-center">
            <p className="text-4xl mb-3">🎖️</p>
            <p className="text-gray-500 text-sm">Noch keine speziellen Abzeichen erstellt.</p>
          </div>
        ) : (
          <div className="space-y-10">
            {categories.map(cat => {
              const catBadges = badgesInCategory(cat.id)
              if (catBadges.length === 0) return null
              return (
                <div key={cat.id}>
                  <div className="flex items-center gap-3 mb-4">
                    <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider text-white"
                      style={{ backgroundColor: cat.color }}>
                      {cat.name}
                    </span>
                    <div className="flex-1 h-px bg-gray-200" />
                    <span className="text-gray-500 text-sm">
                      {catBadges.filter(b => myBadgeIds.has(b.id)).length}/{catBadges.length}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    {catBadges.map(badge => (
                      <BadgeCard key={badge.id} badge={badge} hasIt={myBadgeIds.has(badge.id)}
                        ownerCount={badgeOwnerCount(badge.id)} onClick={() => setSelectedBadge(badge)} />
                    ))}
                  </div>
                </div>
              )
            })}

            {uncategorized.length > 0 && (
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider text-white bg-gray-400">
                    Sonstige
                  </span>
                  <div className="flex-1 h-px bg-gray-200" />
                  <span className="text-gray-500 text-sm">
                    {uncategorized.filter(b => myBadgeIds.has(b.id)).length}/{uncategorized.length}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  {uncategorized.map(badge => (
                    <BadgeCard key={badge.id} badge={badge} hasIt={myBadgeIds.has(badge.id)}
                      ownerCount={badgeOwnerCount(badge.id)} onClick={() => setSelectedBadge(badge)} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Badge-Popup ── */}
      {selectedBadge && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4"
          onClick={() => setSelectedBadge(null)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div className="relative bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl text-center"
            onClick={e => e.stopPropagation()}>
            <button onClick={() => setSelectedBadge(null)}
              className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 text-sm">
              ✕
            </button>
            <div className="w-24 h-24 rounded-2xl bg-gray-50 flex items-center justify-center mx-auto mb-4 border border-gray-100">
              {selectedBadge.icon_url.startsWith('http') ? (
                <img src={selectedBadge.icon_url} alt={selectedBadge.name} className="w-16 h-16 rounded-xl object-contain" />
              ) : (
                <span className="text-5xl">{selectedBadge.icon_url}</span>
              )}
            </div>
            {selectedBadge.badge_categories && (
              <span className="text-xs px-2 py-0.5 rounded-full text-white font-medium mb-3 inline-block"
                style={{ backgroundColor: selectedBadge.badge_categories.color }}>
                {selectedBadge.badge_categories.name}
              </span>
            )}
            <h3 className="text-xl font-bold text-gray-900 mb-2">{selectedBadge.name}</h3>
            {selectedBadge.description && (
              <p className="text-gray-500 text-sm mb-4">{selectedBadge.description}</p>
            )}
            <div className="flex justify-center gap-6 text-sm mt-4 pt-4 border-t border-gray-100">
              <div className="text-center">
                <p className="text-2xl font-bold text-gray-900">{badgeOwnerCount(selectedBadge.id)}</p>
                <p className="text-gray-400 text-xs">Spieler haben es</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold" style={{ color: selectedBadge.erreichbar ? '#639922' : '#E24B4A' }}>
                  {selectedBadge.erreichbar ? '✓' : '✕'}
                </p>
                <p className="text-gray-400 text-xs">{selectedBadge.erreichbar ? 'Erreichbar' : 'Nicht mehr erreichbar'}</p>
              </div>
              {myBadgeIds.has(selectedBadge.id) && (
                <div className="text-center">
                  <p className="text-2xl font-bold text-green-600">✓</p>
                  <p className="text-gray-400 text-xs">{member!.display_name} hat es</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Rote Kachel */}
      <div className="mt-10 bg-red-50 border-2 border-red-200 rounded-2xl p-6 flex items-center justify-between">
        <div>
          <p className="font-bold text-red-600 text-lg">Dir fehlt ein Abzeichen?</p>
          <p className="text-red-400 text-sm mt-1">Melde es und wir schauen es uns an!</p>
        </div>
        <Link href="/support" className="bg-red-500 hover:bg-red-600 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-all">
          Melden →
        </Link>
      </div>

    </div>
  )
}

function BadgeCard({ badge, hasIt, ownerCount, onClick }: {
  badge: Badge
  hasIt: boolean
  ownerCount: number
  onClick: () => void
}) {
  const style: React.CSSProperties = {}
  if (hasIt) {
    style.background = 'rgba(99,153,34,0.15)'
    style.border = '2px solid #639922'
  } else if (!badge.erreichbar) {
    style.background = 'rgba(226,75,74,0.10)'
    style.border = '2px solid #E24B4A'
  } else {
    style.background = 'rgba(136,135,128,0.08)'
    style.border = '2px solid #888780'
  }

  return (
    <button onClick={onClick}
      className="rounded-2xl p-6 flex flex-col items-center text-center transition-all hover:scale-105 hover:shadow-md w-full"
      style={style}>
      <div className="w-16 h-16 rounded-2xl bg-white flex items-center justify-center mb-3">
        {badge.icon_url.startsWith('http') ? (
          <img src={badge.icon_url} alt={badge.name} className="rounded-xl object-contain" style={{ width: 48, height: 48 }} />
        ) : (
          <span className="text-4xl">{badge.icon_url}</span>
        )}
      </div>
      <p className="font-medium text-gray-900 text-sm">{badge.name}</p>
      <p className="text-xs text-gray-400 mt-1">
        {hasIt ? '✓ Hat es' : badge.erreichbar ? 'Noch erreichbar' : 'Nicht mehr erreichbar'}
      </p>
      <p className="text-xs text-gray-300 mt-0.5">{ownerCount} Spieler</p>
    </button>
  )
}