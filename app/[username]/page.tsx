'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '../lib/auth-context'
import { useParams } from 'next/navigation'
import Link from 'next/link'

type Profile = {
  user: {
    id: string
    username: string
    display_name: string | null
    biography: string | null
    banner_url: string | null
    background_url: string | null
    background_blur: number | null
    website_xp: number
    website_level: number
    minecraft_username: string | null
    discord_username: string | null
    discord_id: string | null
    profile_picture_url: string | null
    accent_color: string | null
    card_opacity: number | null
    profile_theme: string | null
  }
  clanMember: {
    role: string
    join_date: string
    stufe_override: number | null
  } | null
  badges: {
    id: string
    name: string
    icon_url: string
    badge_categories: { name: string, color: string } | null
  }[]
  friends: {
    id: string
    sender: { id: string, username: string }
    receiver: { id: string, username: string }
  }[]
}

const STUFEN = [
  { name: 'Neuling', min: 0 },
  { name: 'Mitglied', min: 90 },
  { name: 'Treues Mitglied', min: 180 },
  { name: 'Vertrauter', min: 365 },
  { name: 'Goat', min: 730 },
  { name: 'OG', min: 1095 },
]

const SUPABASE_URL = 'https://lgvrborqklwfbkgbjnvs.supabase.co/storage/v1/object/public/badge-icons'

const ROLE_COLORS: Record<string, string> = {
  Owner: 'bg-red-900 text-white',
  Admin: 'bg-red-700 text-white',
  VIP: 'bg-purple-600 text-white',
  Mod: 'bg-red-500 text-white',
  Mitglied: 'bg-green-400 text-white',
}

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

function getLevelProgress(xp: number) {
  const xpForLevel = (level: number) => level * 100
  let level = 1
  let remaining = xp
  while (remaining >= xpForLevel(level)) {
    remaining -= xpForLevel(level)
    level++
  }
  const needed = xpForLevel(level)
  return { level, current: remaining, needed, percent: Math.round((remaining / needed) * 100) }
}

function withOpacity(hex: string, opacity: number) {
  return `color-mix(in srgb, ${hex} ${Math.round(opacity * 100)}%, transparent)`
}

export default function ProfilePage() {
  const params = useParams()
  const username = typeof params.username === 'string' ? params.username : ''
  const { user: currentUser } = useAuth()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [friendStatus, setFriendStatus] = useState<'none' | 'pending_sent' | 'pending_received' | 'friends'>('none')
  const [friendId, setFriendId] = useState<string | null>(null)
  const [sendingRequest, setSendingRequest] = useState(false)
  const [hoveredBadge, setHoveredBadge] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/profile/${username}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) { setNotFound(true); setLoading(false); return }
        setProfile(data)
        setLoading(false)
      })
  }, [username])

  useEffect(() => {
    if (!currentUser || !profile) return
    fetch('/api/friends').then(r => r.json()).then(data => {
      const all = data.friends || []
      const entry = all.find((f: any) =>
        (f.sender.id === currentUser.id && f.receiver.username === username) ||
        (f.receiver.id === currentUser.id && f.sender.username === username)
      )
      if (!entry) { setFriendStatus('none'); return }
      setFriendId(entry.id)
      if (entry.status === 'accepted') setFriendStatus('friends')
      else if (entry.sender.id === currentUser.id) setFriendStatus('pending_sent')
      else setFriendStatus('pending_received')
    })
  }, [currentUser, profile, username])

  const handleFriendAction = async () => {
    setSendingRequest(true)
    if (friendStatus === 'none') {
      await fetch('/api/friends', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ receiver_username: username }),
      })
      setFriendStatus('pending_sent')
    } else if (friendStatus === 'friends' || friendStatus === 'pending_sent') {
      await fetch('/api/friends', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: friendId, action: 'remove' }),
      })
      setFriendStatus('none')
      setFriendId(null)
    } else if (friendStatus === 'pending_received') {
      await fetch('/api/friends', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: friendId, action: 'accept' }),
      })
      setFriendStatus('friends')
    }
    setSendingRequest(false)
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--background)', color: 'var(--foreground)' }}>
      Laden...
    </div>
  )

  if (notFound) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--background)' }}>
      <div className="text-center">
        <p className="text-5xl mb-4">🔍</p>
        <p className="font-bold text-xl mb-2" style={{ color: 'var(--foreground)' }}>Profil nicht gefunden</p>
        <p className="mb-6" style={{ color: 'var(--muted)' }}>„{username}" hat keinen Seek-Account.</p>
        <Link href="/" className="btn-gradient text-white px-6 py-3 rounded-xl">Zur Startseite</Link>
      </div>
    </div>
  )

  const { user, clanMember, badges, friends } = profile!
  const isOwnProfile = currentUser?.username === username
  const stufeIndex = clanMember ? getCurrentStufe(clanMember.join_date, clanMember.stufe_override) : 0
  const levelProgress = getLevelProgress(user.website_xp)

  let stufePercent = 100
  let stufeDaysToNext = 0
  if (clanMember && stufeIndex < STUFEN.length - 1) {
    const days = daysSince(clanMember.join_date)
    const curMin = STUFEN[stufeIndex].min
    const nextMin = STUFEN[stufeIndex + 1].min
    stufePercent = Math.min(100, Math.round(((days - curMin) / (nextMin - curMin)) * 100))
    stufeDaysToNext = Math.max(0, nextMin - days)
  }

  const friendUsernames = friends.map(f =>
    f.sender.id === user.id ? f.receiver.username : f.sender.username
  )

  const friendButtonLabel = () => {
    if (friendStatus === 'friends') return '✓ Befreundet'
    if (friendStatus === 'pending_sent') return 'Anfrage gesendet'
    if (friendStatus === 'pending_received') return '✓ Annehmen'
    return '+ Freund hinzufügen'
  }

  const friendButtonStyle = () => {
    if (friendStatus === 'friends') return { background: 'rgba(99,153,34,0.15)', border: '1px solid #639922', color: '#639922' }
    if (friendStatus === 'pending_sent') return { background: 'var(--muted-bg)', border: '1px solid var(--card-border)', color: 'var(--muted)' }
    if (friendStatus === 'pending_received') return { background: 'rgba(99,153,34,0.15)', border: '1px solid #639922', color: '#639922' }
    return {}
  }

  const accent = user.accent_color || '#7C3AED'
  const cardOpacity = user.card_opacity ?? 1
  const cardStyle = cardOpacity < 1
    ? { background: withOpacity('var(--card)', cardOpacity), border: '1px solid var(--card-border)', backdropFilter: 'blur(8px)' as const }
    : undefined

  return (
    <div className="min-h-screen relative" style={{ background: 'var(--background)' }}>
      {/* Hintergrundbild */}
      {user.background_url && (
        <div className="fixed inset-0 z-0" style={{
          background: `url(${user.background_url}) center/cover`,
          filter: `blur(${user.background_blur ?? 0}px)`,
          transform: 'scale(1.1)',
        }} />
      )}
      <div className="relative z-10">
        {/* Banner */}
        <div className="h-40 w-full relative" style={{
          background: user.banner_url
            ? `url(${user.banner_url}) center/cover`
            : `linear-gradient(135deg, ${accent}, color-mix(in srgb, ${accent} 50%, #000))`
        }} />

        <div className="max-w-3xl mx-auto px-8">
          {/* Avatar + Aktionen */}
          <div className="flex items-end justify-between -mt-12 mb-6">
            <div className="relative">
              <img
                src={user.profile_picture_url || `https://mc-heads.net/avatar/${user.minecraft_username || user.username}/80`}
                alt={user.username}
                className="w-24 h-24 rounded-2xl border-4 object-cover"
                style={{ borderColor: 'var(--background)' }}
              />
              {clanMember && (
                <img src={`${SUPABASE_URL}/stufe${stufeIndex}.png`} alt={STUFEN[stufeIndex].name}
                  className="absolute -bottom-2 -right-2 w-8 h-8" title={STUFEN[stufeIndex].name} />
              )}
            </div>
            <div className="flex gap-2 mb-2">
              {isOwnProfile ? (
                <Link href="/profil-bearbeiten"
                  className="text-sm px-4 py-2 rounded-xl font-medium"
                  style={{ background: 'var(--muted-bg)', border: '1px solid var(--card-border)', color: 'var(--foreground)' }}>
                  ✏️ Profil bearbeiten
                </Link>
              ) : currentUser && (
                <button onClick={handleFriendAction} disabled={sendingRequest}
                  className={friendStatus === 'none' ? 'btn-gradient text-white text-sm px-4 py-2 rounded-xl font-medium disabled:opacity-50' : 'text-sm px-4 py-2 rounded-xl font-medium transition-all disabled:opacity-50'}
                  style={friendStatus === 'none' ? {} : friendButtonStyle()}>
                  {friendButtonLabel()}
                </button>
              )}
            </div>
          </div>

          {/* Name + Info */}
          <div className="mb-6">
            <div className="flex items-center gap-3 mb-0.5">
              <h1 className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>
                {user.display_name || user.username}
              </h1>
              {clanMember && (
                <span className={`text-xs px-2 py-0.5 rounded-full font-bold uppercase ${ROLE_COLORS[clanMember.role] || 'bg-gray-400 text-white'}`}>
                  {clanMember.role}
                </span>
              )}
            </div>
            {/* Spitzname-Hinweis nur für den Besitzer */}
            {user.display_name && (
              <p className="text-xs mb-1" style={{ color: 'var(--muted)' }}>@{user.username}</p>
            )}
            {user.discord_username && (
              <p className="text-sm mb-2" style={{ color: 'var(--muted)' }}>
                {user.discord_id ? (
                  <a href={`https://discord.com/users/${user.discord_id}`} target="_blank" rel="noopener noreferrer"
                    className="text-indigo-500 hover:opacity-70 transition-all">
                    🎮 {user.discord_username}
                  </a>
                ) : (
                  <span className="text-indigo-500">🎮 {user.discord_username}</span>
                )}
              </p>
            )}
            {user.biography && (
              <p className="text-sm" style={{ color: 'var(--muted)' }}>{user.biography}</p>
            )}

            {/* Abzeichen — dezente Icon-Reihe direkt unter Bio */}
            {badges.length > 0 && (
              <div className="flex items-center gap-1.5 mt-3 flex-wrap">
                {badges.slice(0, 12).map(badge => (
                  <div key={badge.id} className="relative"
                    onMouseEnter={() => setHoveredBadge(badge.id)}
                    onMouseLeave={() => setHoveredBadge(null)}>
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center transition-transform hover:scale-110"
                      style={{ background: 'var(--muted-bg)', border: '1px solid var(--card-border)' }}>
                      {badge.icon_url.startsWith('http') ? (
                        <img src={badge.icon_url} alt={badge.name} className="w-5 h-5 rounded object-contain" />
                      ) : (
                        <span className="text-sm">{badge.icon_url}</span>
                      )}
                    </div>
                    {hoveredBadge === badge.id && (
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 rounded-lg text-xs font-medium whitespace-nowrap z-20 pointer-events-none"
                        style={{ background: 'var(--foreground)', color: 'var(--background)' }}>
                        {badge.name}
                        <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0"
                          style={{ borderLeft: '4px solid transparent', borderRight: '4px solid transparent', borderTop: `4px solid var(--foreground)` }} />
                      </div>
                    )}
                  </div>
                ))}
                {badges.length > 12 && (
                  <Link href={`/${username}/abzeichen`}
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold hover:opacity-70 transition-all"
                    style={{ background: 'var(--muted-bg)', color: 'var(--muted)', border: '1px solid var(--card-border)' }}>
                    +{badges.length - 12}
                  </Link>
                )}
                <Link href={`/${username}/abzeichen`}
                  className="text-xs ml-1 hover:opacity-70 transition-all"
                  style={{ color: 'var(--muted)' }}>
                  alle →
                </Link>
              </div>
            )}
          </div>

          {/* 3 Kacheln */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            {/* Clan-Stufe + Im Clan seit */}
            {clanMember ? (
              <Link href={`/${username}/abzeichen`}
                className="card rounded-2xl p-4 col-span-1 block transition-all hover:opacity-80 cursor-pointer"
                style={cardStyle}>
                <p className="text-xs font-medium mb-2" style={{ color: 'var(--muted)' }}>Clan-Stufe</p>
                <div className="flex items-center gap-2 mb-1">
                  <img src={`${SUPABASE_URL}/stufe${stufeIndex}.png`} alt="" className="w-5 h-5" />
                  <span className="text-sm font-bold" style={{ color: 'var(--foreground)' }}>{STUFEN[stufeIndex].name}</span>
                </div>
                <p className="text-xs mb-2" style={{ color: 'var(--muted)' }}>{daysSince(clanMember.join_date)} Tage dabei</p>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--muted-bg)' }}>
                  <div className="h-full rounded-full transition-all" style={{ width: `${stufePercent}%`, background: accent }} />
                </div>
                {stufeIndex < STUFEN.length - 1 && (
                  <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>noch {stufeDaysToNext} Tage</p>
                )}
              </Link>
            ) : (
              <div className="card rounded-2xl p-4 col-span-1" style={cardStyle}>
                <p className="text-xs font-medium mb-2" style={{ color: 'var(--muted)' }}>Clan-Stufe</p>
                <p className="text-sm" style={{ color: 'var(--muted)' }}>Kein Mitglied</p>
              </div>
            )}

            {/* Clan Level */}
            <Link href={`/${username}/level`}
              className="card rounded-2xl p-4 col-span-1 block transition-all hover:opacity-80 cursor-pointer"
              style={cardStyle}>
              <p className="text-xs font-medium mb-2" style={{ color: 'var(--muted)' }}>Clan Level</p>
              <p className="text-2xl font-bold mb-2" style={{ color: 'var(--foreground)' }}>Lv. {levelProgress.level}</p>
              <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--muted-bg)' }}>
                <div className="h-full rounded-full transition-all" style={{ width: `${levelProgress.percent}%`, background: accent }} />
              </div>
              <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>{levelProgress.current}/{levelProgress.needed} XP</p>
            </Link>

            {/* Erfolge */}
            <Link href="/erfolge"
              className="card rounded-2xl p-4 col-span-1 block transition-all hover:opacity-80 cursor-pointer"
              style={cardStyle}>
              <p className="text-xs font-medium mb-2" style={{ color: 'var(--muted)' }}>Erfolge</p>
              <p className="text-2xl mb-2">🏆</p>
              <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--muted-bg)' }}>
                <div className="h-full rounded-full" style={{ width: '0%', background: accent }} />
              </div>
              <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>Kommt bald</p>
            </Link>
          </div>

          {/* Spotify */}
          <SpotifyBlock username={username} cardStyle={cardStyle} />

          {/* Freunde */}
          <div className="card rounded-2xl p-5 mb-8" style={cardStyle}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold" style={{ color: 'var(--foreground)' }}>Freunde ({friendUsernames.length})</h2>
              {isOwnProfile && <Link href="/freunde" className="text-xs hover:opacity-70" style={{ color: 'var(--muted)' }}>Alle anzeigen →</Link>}
            </div>
            {friendUsernames.length === 0 ? (
              <p className="text-sm" style={{ color: 'var(--muted)' }}>Noch keine Freunde.</p>
            ) : (
              <div className="flex flex-wrap gap-3">
                {friendUsernames.slice(0, 8).map(name => (
                  <Link key={name} href={`/${name}`} className="flex flex-col items-center gap-1 hover:opacity-70 transition-all">
                    <img src={`https://mc-heads.net/avatar/${name}/40`} alt={name} className="w-10 h-10 rounded-xl" />
                    <span className="text-xs" style={{ color: 'var(--muted)' }}>{name}</span>
                  </Link>
                ))}
                {friendUsernames.length > 8 && (
                  <div className="flex flex-col items-center gap-1">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xs font-bold"
                      style={{ background: 'var(--muted-bg)', color: 'var(--muted)' }}>
                      +{friendUsernames.length - 8}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )

  function SpotifyBlock({ username, cardStyle }: { username: string, cardStyle: any }) {
    const [data, setData] = useState<any>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
      fetch(`/api/spotify/now-playing?username=${username}`)
        .then(r => r.json())
        .then(d => { setData(d); setLoading(false) })
      const interval = setInterval(() => {
        fetch(`/api/spotify/now-playing?username=${username}`)
          .then(r => r.json())
          .then(d => setData(d))
      }, 30000)
      return () => clearInterval(interval)
    }, [username])

    if (loading || !data?.connected || !data?.track) return null

    return (
      <div className="card rounded-2xl p-5 mb-4" style={cardStyle}>
        <div className="flex items-center gap-3">
          <div className="relative flex-shrink-0">
            {data.track.image && (
              <img src={data.track.image} alt={data.track.album} className="w-14 h-14 rounded-xl" />
            )}
            {data.playing && (
              <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-green-500 flex items-center justify-center">
                <span className="text-white text-xs">▶</span>
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs mb-1" style={{ color: 'var(--muted)' }}>
              {data.playing ? '🎵 Hört gerade' : '🎵 Zuletzt gehört'}
            </p>
            <a href={data.track.url} target="_blank" rel="noopener noreferrer"
              className="font-bold text-sm truncate block hover:opacity-70 transition-all"
              style={{ color: 'var(--foreground)' }}>
              {data.track.name}
            </a>
            <p className="text-xs truncate" style={{ color: 'var(--muted)' }}>{data.track.artist}</p>
          </div>
          <div className="flex-shrink-0">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="#1DB954">
              <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
            </svg>
          </div>
        </div>
        {data.playing && data.track.progress && data.track.duration && (
          <div className="mt-3">
            <div className="h-1 rounded-full overflow-hidden" style={{ background: 'var(--muted-bg)' }}>
              <div className="h-full rounded-full" style={{ width: `${(data.track.progress / data.track.duration) * 100}%`, background: '#1DB954' }} />
            </div>
          </div>
        )}
      </div>
    )
  }
}