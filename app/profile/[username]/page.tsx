'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useAuth } from '../../lib/auth-context'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import LinkifiedText from '../../components/LinkifiedText'

// ─── Types ────────────────────────────────────────────────────────────────────

type Profile = {
  user: {
    id: string
    username: string
    display_name: string | null
    biography: string | null
    status_text: string | null
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
    glass_config: string | null
    last_seen_at: string | null
    steam_id: string | null
    steam_username: string | null
    steam_avatar: string | null
    favorite_games: { appid: number; name: string; icon: string }[]
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
    badge_categories: { name: string; color: string } | null
  }[]
  friends: {
    id: string
    sender: { id: string; username: string }
    receiver: { id: string; username: string }
  }[]
}

type SmpStats = {
  playtime_minutes: number
  blocks_broken: number
  blocks_placed: number
  mob_kills: number
  deaths: number
  uuid: string
} | null

type SmpRanks = Record<string, number>

// ─── Constants ────────────────────────────────────────────────────────────────

const STUFEN = [
  { name: 'Neuling',         min: 0 },
  { name: 'Mitglied',        min: 90 },
  { name: 'Treues Mitglied', min: 180 },
  { name: 'Vertrauter',      min: 365 },
  { name: 'Goat',            min: 730 },
  { name: 'OG',              min: 1095 },
]

const BADGE_ICON_URL = '/api/uploads/badge-icons'

const ROLE_COLORS: Record<string, { bg: string; text: string }> = {
  Owner:    { bg: 'rgba(185,28,28,0.25)',  text: '#fca5a5' },
  Admin:    { bg: 'rgba(185,28,28,0.2)',   text: '#f87171' },
  VIP:      { bg: 'rgba(147,51,234,0.2)',  text: '#c084fc' },
  Mod:      { bg: 'rgba(239,68,68,0.2)',   text: '#fca5a5' },
  Mitglied: { bg: 'rgba(74,222,128,0.15)', text: '#4ade80' },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function hexToRgb(hex: string) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return { r, g, b, s: `${r},${g},${b}` }
}

function daysSince(dateStr: string) {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000)
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
  const xpForLevel = (l: number) => l * 100
  let level = 1, remaining = xp
  while (remaining >= xpForLevel(level)) { remaining -= xpForLevel(level); level++ }
  const needed = xpForLevel(level)
  return { level, current: remaining, needed, percent: Math.round((remaining / needed) * 100) }
}

function formatLastSeen(dateStr: string | null): { label: string; online: boolean } {
  if (!dateStr) return { label: 'Noch nie online', online: false }
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  const hrs  = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)
  if (mins < 5)  return { label: 'Gerade online', online: true }
  if (mins < 60) return { label: `vor ${mins} Min.`, online: false }
  if (hrs  < 24) return { label: `vor ${hrs} Std.`, online: false }
  if (days < 30) return { label: `vor ${days} Tagen`, online: false }
  return { label: 'Lange nicht online', online: false }
}

function fmtHours(mins: number) {
  const h = Math.floor(mins / 60)
  if (h >= 1000) return `${(h / 1000).toFixed(1)}k h`
  return `${h} h`
}

function fmtNum(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}k`
  return String(n)
}

const DEFAULT_GLASS = { color: '#ffffff', opacity: 8, blur: 16, radius: 16, borderEnabled: true, borderWidth: 1, borderOpacity: 10, shadowBlur: 0, shadowSpread: 0, shadowOpacity: 0, shadowColor: '#000000' }

type GlassConfig = typeof DEFAULT_GLASS

function glassToCSS(g: GlassConfig): React.CSSProperties {
  const r = parseInt(g.color.slice(1, 3), 16)
  const gr = parseInt(g.color.slice(3, 5), 16)
  const b = parseInt(g.color.slice(5, 7), 16)
  const sr = parseInt(g.shadowColor.slice(1, 3), 16)
  const sg = parseInt(g.shadowColor.slice(3, 5), 16)
  const sb = parseInt(g.shadowColor.slice(5, 7), 16)
  return {
    background: `rgba(${r},${gr},${b},${g.opacity / 100})`,
    backdropFilter: `blur(${g.blur}px)`,
    WebkitBackdropFilter: `blur(${g.blur}px)`,
    borderRadius: `${g.radius}px`,
    border: g.borderEnabled ? `${g.borderWidth}px solid rgba(${r},${gr},${b},${g.borderOpacity / 100})` : 'none',
    boxShadow: `0 0 ${g.shadowBlur}px ${g.shadowSpread}px rgba(${sr},${sg},${sb},${g.shadowOpacity / 100})`,
  }
}

const glass = (opacity = 0.08, blur = 16): React.CSSProperties => ({
  background: `rgba(255,255,255,${opacity})`,
  backdropFilter: `blur(${blur}px)`,
  WebkitBackdropFilter: `blur(${blur}px)`,
  border: '1px solid rgba(255,255,255,0.10)',
})

// ─── Particle canvas ──────────────────────────────────────────────────────────

function ParticleCanvas({ accent }: { accent: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rgb = hexToRgb(accent)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    let animId: number

    const resize = () => {
      canvas.width  = window.innerWidth
      canvas.height = window.innerHeight
    }
    resize()
    window.addEventListener('resize', resize)

    // Particles
    const COUNT = 55
    const particles = Array.from({ length: COUNT }, () => ({
      x:    Math.random() * window.innerWidth,
      y:    Math.random() * window.innerHeight,
      r:    Math.random() * 1.8 + 0.3,
      vx:   (Math.random() - 0.5) * 0.25,
      vy:   (Math.random() - 0.5) * 0.25,
      o:    Math.random() * 0.35 + 0.05,
      pulse: Math.random() * Math.PI * 2,
    }))

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      particles.forEach(p => {
        p.x += p.vx
        p.y += p.vy
        p.pulse += 0.012
        if (p.x < 0) p.x = canvas.width
        if (p.x > canvas.width) p.x = 0
        if (p.y < 0) p.y = canvas.height
        if (p.y > canvas.height) p.y = 0

        const alpha = p.o * (0.7 + 0.3 * Math.sin(p.pulse))
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(${rgb.s},${alpha})`
        ctx.fill()
      })
      // Subtle connecting lines
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x
          const dy = particles[i].y - particles[j].y
          const dist = Math.sqrt(dx * dx + dy * dy)
          if (dist < 110) {
            ctx.beginPath()
            ctx.moveTo(particles[i].x, particles[i].y)
            ctx.lineTo(particles[j].x, particles[j].y)
            ctx.strokeStyle = `rgba(${rgb.s},${0.04 * (1 - dist / 110)})`
            ctx.lineWidth = 0.5
            ctx.stroke()
          }
        }
      }
      animId = requestAnimationFrame(draw)
    }
    draw()

    return () => {
      cancelAnimationFrame(animId)
      window.removeEventListener('resize', resize)
    }
  }, [accent])

  return (
    <canvas ref={canvasRef}
      className="fixed inset-0 z-0 pointer-events-none"
      style={{ opacity: 0.6 }} />
  )
}

// ─── Parallax Banner ──────────────────────────────────────────────────────────

function ParallaxBanner({ bannerUrl, accentRgb }: { bannerUrl: string | null; accentRgb: string }) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onScroll = () => {
      if (!ref.current) return
      const y = window.scrollY
      ref.current.style.transform = `translateY(${y * 0.35}px)`
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <div className="relative h-56 w-full overflow-hidden">
      <div ref={ref} className="absolute inset-0 will-change-transform" style={{
        background: bannerUrl
          ? `url(${bannerUrl}) center/cover`
          : `linear-gradient(135deg, rgba(${accentRgb},0.6) 0%, rgba(${accentRgb},0.15) 60%, transparent 100%)`,
        top: '-20%',
        height: '140%',
      }} />
      {/* Vignette */}
      <div className="absolute inset-0" style={{
        background: 'linear-gradient(to bottom, rgba(8,8,16,0.1) 0%, rgba(8,8,16,0.7) 80%, #080810 100%)'
      }} />
    </div>
  )
}

// ─── Animated Avatar Halo ─────────────────────────────────────────────────────

function AvatarHalo({ src, accent, online }: { src: string; accent: string; online: boolean }) {
  const rgb = hexToRgb(accent)

  return (
    <div className="relative w-28 h-28 flex-shrink-0">
      {/* Static accent ring */}
      <div className="absolute inset-0 rounded-3xl"
        style={{
          background: accent,
          borderRadius: '24px',
          padding: '2.5px',
          boxShadow: `0 0 16px rgba(${rgb.s},0.6), 0 0 40px rgba(${rgb.s},0.25)`,
        }}>
        <div className="w-full h-full rounded-[21px]" style={{ background: '#080810' }} />
      </div>
      {/* Outer glow */}
      <div className="absolute -inset-1 rounded-3xl opacity-35"
        style={{
          background: `radial-gradient(circle, rgba(${rgb.s},0.6) 0%, transparent 70%)`,
          filter: 'blur(8px)',
        }} />
      {/* Avatar */}
      <div className="absolute inset-[3px] rounded-[20px] overflow-hidden">
        <img src={src} alt="" className="w-full h-full object-cover" />
      </div>
      {/* Online dot */}
      <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-[3px] z-10"
        style={{
          background: online ? '#22c55e' : '#6b7280',
          borderColor: '#080810',
          boxShadow: online ? '0 0 10px #22c55e88' : 'none',
        }} />
    </div>
  )
}

// ─── Stufe Zeitstrahl ─────────────────────────────────────────────────────────

function StufeTimeline({ joinDate, stufeIndex, accent }: { joinDate: string; stufeIndex: number; accent: string }) {
  const days = daysSince(joinDate)
  const rgb = hexToRgb(accent)

  return (
    <div>
      <p className="text-xs font-medium mb-3" style={{ color: 'rgba(255,255,255,0.4)' }}>Clan-Weg</p>
      <div className="relative">
        {/* Connecting line */}
        <div className="absolute top-4 left-4 right-4 h-px" style={{ background: 'rgba(255,255,255,0.08)' }} />
        <div className="absolute top-4 left-4 h-px transition-all duration-1000"
          style={{
            width: `calc(${Math.min(100, (stufeIndex / (STUFEN.length - 1)) * 100)}% - 32px)`,
            background: `linear-gradient(to right, ${accent}, rgba(${rgb.s},0.3))`,
          }} />

        <div className="relative flex justify-between">
          {STUFEN.map((s, i) => {
            const reached = i <= stufeIndex
            const active  = i === stufeIndex
            return (
              <div key={s.name} className="flex flex-col items-center gap-2" style={{ width: '14%' }}>
                {/* Badge icon */}
                <div className="relative z-10 transition-all duration-500"
                  style={{ filter: reached ? 'none' : 'grayscale(1) opacity(0.25)' }}>
                  <img
                    src={`${BADGE_ICON_URL}/stufe${i}.png`}
                    alt={s.name}
                    className="w-8 h-8 object-contain"
                    style={active ? { filter: `drop-shadow(0 0 6px rgba(${rgb.s},0.9))` } : undefined}
                  />
                </div>
                <span className="text-center leading-tight"
                  style={{
                    fontSize: '9px',
                    color: active ? '#fff' : reached ? `rgba(${rgb.s},0.8)` : 'rgba(255,255,255,0.2)',
                    fontWeight: active ? 700 : 400,
                  }}>
                  {s.name}
                </span>
              </div>
            )
          })}
        </div>
      </div>
      <p className="text-xs mt-3" style={{ color: 'rgba(255,255,255,0.3)' }}>
        {days} Tage dabei
        {stufeIndex < STUFEN.length - 1 && ` · noch ${Math.max(0, STUFEN[stufeIndex + 1].min - days)} bis ${STUFEN[stufeIndex + 1].name}`}
      </p>
    </div>
  )
}

// ─── SMP Rank bars ────────────────────────────────────────────────────────────

function RankBar({ label, value, rank, total, accent }: { label: string; value: string; rank: number; total: number; accent: string }) {
  const pct = Math.max(5, Math.round(((total - rank + 1) / total) * 100))
  const rgb = hexToRgb(accent)
  const top10 = rank <= Math.ceil(total * 0.1)

  return (
    <div className="flex items-center gap-3">
      <div className="w-20 flex-shrink-0">
        <p className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>{label}</p>
        <p className="text-sm font-bold text-white">{value}</p>
      </div>
      <div className="flex-1">
        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
          <div className="h-full rounded-full transition-all duration-1000"
            style={{ width: `${pct}%`, background: top10 ? accent : `rgba(${rgb.s},0.5)` }} />
        </div>
      </div>
      <div className="w-12 text-right flex-shrink-0">
        <span className="text-xs font-semibold"
          style={{ color: top10 ? accent : 'rgba(255,255,255,0.3)' }}>
          #{rank}
          {top10 && ' 🔥'}
        </span>
      </div>
    </div>
  )
}

// ─── Glass Card ───────────────────────────────────────────────────────────────

function GlassCard({ children, className = '', style = {}, hover = false, userGlass }: {
  children: React.ReactNode; className?: string; style?: React.CSSProperties; hover?: boolean; userGlass?: GlassConfig
}) {
  const baseStyle = userGlass ? glassToCSS(userGlass) : glass(0.07, 20)
  return (
    <div className={`${hover ? 'transition-all duration-200 hover:scale-[1.015] cursor-pointer' : ''} ${className}`}
      style={{ ...baseStyle, ...style }}>
      {children}
    </div>
  )
}

// ─── Spotify ──────────────────────────────────────────────────────────────────

function SpotifyBlock({ username, accent, userGlass }: { username: string; accent: string; userGlass: GlassConfig }) {
  const [data, setData] = useState<any>(null)
  useEffect(() => {
    const load = () => fetch(`/api/spotify/now-playing?username=${username}`).then(r => r.json()).then(setData)
    load()
    const iv = setInterval(load, 30000)
    return () => clearInterval(iv)
  }, [username])
  if (!data?.connected || !data?.track) return null
  return (
    <GlassCard userGlass={userGlass}>
      <div className="flex items-center gap-3">
        <div className="relative flex-shrink-0">
          {data.track.image && <img src={data.track.image} alt="" className="w-12 h-12 rounded-xl object-cover" />}
          {data.playing && (
            <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center" style={{ background: '#1DB954' }}>
              <span className="text-white" style={{ fontSize: '7px' }}>▶</span>
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs mb-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>{data.playing ? '🎵 Hört gerade' : '🎵 Zuletzt gehört'}</p>
          <a href={data.track.url} target="_blank" rel="noopener noreferrer"
            className="font-semibold text-sm truncate block hover:opacity-70 transition-opacity text-white">
            {data.track.name}
          </a>
          <p className="text-xs truncate" style={{ color: 'rgba(255,255,255,0.4)' }}>{data.track.artist}</p>
        </div>
        <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24" fill="#1DB954">
          <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
        </svg>
      </div>
      {data.playing && data.track.progress && data.track.duration && (
        <div className="mt-3 h-0.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
          <div className="h-full rounded-full" style={{ width: `${(data.track.progress / data.track.duration) * 100}%`, background: '#1DB954' }} />
        </div>
      )}
    </GlassCard>
  )
}

// ─── Steam ────────────────────────────────────────────────────────────────────

function SteamBlock({ user, accent, userGlass }: { user: Profile['user']; accent: string; userGlass: GlassConfig }) {
  const [games, setGames] = useState<any[]>(user.favorite_games || [])
  useEffect(() => {
    if (!user.favorite_games?.length || !user.steam_id) return
    const appIds = user.favorite_games.map(g => g.appid).join(',')
    fetch(`/api/steam/games?steamId=${user.steam_id}&appIds=${appIds}`)
      .then(r => r.json())
      .then(d => {
        if (!d.games?.length) return
        setGames(d.games.map((g: any) => ({
          ...g,
          name: g.name || user.favorite_games.find(f => f.appid === g.appid)?.name || '',
          icon: user.favorite_games.find(f => f.appid === g.appid)?.icon || g.icon,
        })))
      })
  }, [user.steam_id, user.favorite_games])
  if (!user.favorite_games?.length) return null
  const maxH = Math.max(...games.map(g => g.playtime_hours || 0), 1)
  return (
    <GlassCard userGlass={userGlass}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="rgba(255,255,255,0.6)">
            <path d="M11.979 0C5.678 0 .511 4.86.022 11.037l6.432 2.658c.545-.371 1.203-.59 1.912-.59.063 0 .125.004.188.006l2.861-4.142V8.91c0-2.495 2.028-4.524 4.524-4.524 2.494 0 4.524 2.031 4.524 4.527s-2.03 4.525-4.524 4.525h-.105l-4.076 2.911c0 .052.004.105.004.159 0 1.875-1.515 3.396-3.39 3.396-1.635 0-3.016-1.173-3.331-2.727L.436 15.27C1.862 20.307 6.486 24 11.979 24c6.627 0 11.999-5.373 11.999-12S18.605 0 11.979 0z" />
          </svg>
          <span className="text-sm font-semibold text-white">Lieblingsspiele</span>
        </div>
        {user.steam_username && (
          <a href={`https://steamcommunity.com/profiles/${user.steam_id}`} target="_blank" rel="noopener noreferrer"
            className="text-xs hover:opacity-70 transition-opacity" style={{ color: 'rgba(255,255,255,0.35)' }}>
            {user.steam_username} →
          </a>
        )}
      </div>
      <div className="space-y-2">
        {games.map(game => (
          <a key={game.appid} href={`https://store.steampowered.com/app/${game.appid}`}
            target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-3 p-2.5 rounded-xl transition-all hover:scale-[1.01]"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.07)' }}>
            <img src={game.icon} alt={game.name} className="w-14 h-9 rounded-lg object-cover flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate text-white">{game.name}</p>
              <div className="flex items-center gap-2 mt-1">
                <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.07)' }}>
                  {(game.playtime_hours || 0) > 0 && (
                    <div className="h-full rounded-full" style={{ width: `${Math.min(100, (game.playtime_hours / maxH) * 100)}%`, background: accent }} />
                  )}
                </div>
                <span className="text-xs flex-shrink-0" style={{ color: 'rgba(255,255,255,0.35)' }}>
                  {game.playtime_hours != null ? `${game.playtime_hours}h` : '—'}
                </span>
              </div>
            </div>
          </a>
        ))}
      </div>
    </GlassCard>
  )
}

// ─── Save Design Button ───────────────────────────────────────────────────────

const LS_KEY = 'seekclan_glass_presets'

function saveDesignToStorage(name: string, glass: any, accent: string, fromUser: string) {
  if (typeof window === 'undefined') return
  try {
    const existing = JSON.parse(localStorage.getItem(LS_KEY) || '[]')
    const entry = { id: Date.now().toString(), name, savedAt: new Date().toISOString(), fromUser, glass, accent }
    localStorage.setItem(LS_KEY, JSON.stringify([entry, ...existing].slice(0, 30)))
  } catch {}
}

function SaveDesignButton({ username, accent, glassConfig }: { username: string; accent: string; glassConfig: string | null }) {
  const [saved, setSaved] = useState(false)
  if (!glassConfig) return null

  const handle = () => {
    try {
      const glass = JSON.parse(glassConfig)
      saveDesignToStorage(`Design von @${username}`, glass, accent, username)
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch {}
  }

  return (
    <button onClick={handle}
      className="text-sm px-3 py-2 rounded-xl font-medium transition-all hover:scale-105 flex items-center gap-1.5"
      style={{
        background: 'rgba(255,255,255,0.08)',
        border: '1px solid rgba(255,255,255,0.12)',
        color: saved ? '#4ade80' : 'rgba(255,255,255,0.7)',
      }}
      title="Design speichern">
      {saved ? '✓' : '⭐'}
      <span className="hidden sm:inline">{saved ? 'Gespeichert' : 'Design'}</span>
    </button>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function ProfilePage() {
  const params  = useParams()
  const username = typeof params.username === 'string' ? params.username : ''
  const { user: currentUser } = useAuth()

  const [profile, setProfile]           = useState<Profile | null>(null)
  const [smpStats, setSmpStats]         = useState<SmpStats>(null)
  const [smpRanks, setSmpRanks]         = useState<SmpRanks>({})
  const [totalPlayers, setTotalPlayers] = useState(1)
  const [loading, setLoading]           = useState(true)
  const [notFound, setNotFound]         = useState(false)
  const [friendStatus, setFriendStatus] = useState<'none'|'pending_sent'|'pending_received'|'friends'>('none')
  const [friendId, setFriendId]         = useState<string | null>(null)
  const [sendingFriend, setSendingFriend] = useState(false)
  const [hoveredBadge, setHoveredBadge]   = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/profile/${username}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) { setNotFound(true); setLoading(false); return }
        setProfile(data); setLoading(false)
      })
  }, [username])

  useEffect(() => {
    if (!profile) return
    const mcName = profile.user.minecraft_username || username
    fetch(`/api/smp/stats?username=${mcName}`)
      .then(r => r.json())
      .then(d => {
        setSmpStats(d.stats || null)
        setSmpRanks(d.ranks || {})
        setTotalPlayers(d.totalPlayers || 1)
      })
  }, [profile, username])

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
    setSendingFriend(true)
    if (friendStatus === 'none') {
      await fetch('/api/friends', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ receiver_username: username }) })
      setFriendStatus('pending_sent')
    } else if (friendStatus === 'friends' || friendStatus === 'pending_sent') {
      await fetch('/api/friends', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: friendId, action: 'remove' }) })
      setFriendStatus('none'); setFriendId(null)
    } else if (friendStatus === 'pending_received') {
      await fetch('/api/friends', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: friendId, action: 'accept' }) })
      setFriendStatus('friends')
    }
    setSendingFriend(false)
  }

  // ── Loading / not found ────────────────────────────────────────────────────
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#080810' }}>
      <div className="w-8 h-8 rounded-full border-2 border-t-white border-white/20 animate-spin" />
    </div>
  )
  if (notFound) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#080810' }}>
      <div className="text-center p-10 rounded-3xl" style={glass(0.07, 20)}>
        <p className="text-5xl mb-4">🔍</p>
        <p className="font-bold text-xl mb-2 text-white">Profil nicht gefunden</p>
        <p className="mb-6 text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>„{username}" hat keinen Seek-Account.</p>
        <Link href="/" className="btn-gradient text-white px-6 py-3 rounded-xl text-sm font-medium">Zur Startseite</Link>
      </div>
    </div>
  )

  const { user, clanMember, badges, friends } = profile!
  const isOwnProfile = currentUser?.username === username
  const accent = user.accent_color || '#7C3AED'
  const accentRgb = hexToRgb(accent).s

  // Parse glass config
  const glassConfig: GlassConfig = (() => {
    try { if (user.glass_config) return JSON.parse(user.glass_config) } catch {}
    return DEFAULT_GLASS
  })()
  const stufeIndex = clanMember ? getCurrentStufe(clanMember.join_date, clanMember.stufe_override) : 0
  const levelProgress = getLevelProgress(user.website_xp)
  const { label: lastSeenLabel, online } = formatLastSeen(user.last_seen_at)
  const roleStyle = ROLE_COLORS[clanMember?.role || ''] || { bg: 'rgba(100,100,100,0.2)', text: 'rgba(255,255,255,0.5)' }
  const friendUsernames = friends.map(f => f.sender.id === user.id ? f.receiver.username : f.sender.username)

  const friendBtnLabel = () => {
    if (friendStatus === 'friends')          return '✓ Befreundet'
    if (friendStatus === 'pending_sent')     return 'Anfrage gesendet'
    if (friendStatus === 'pending_received') return '✓ Annehmen'
    return '+ Freund hinzufügen'
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen relative overflow-x-hidden" style={{ background: '#080810' }}>

      {/* Ambient background */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        {user.background_url && (
          <div className="absolute inset-0" style={{
            backgroundImage: `url(${user.background_url})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            filter: `blur(${(user.background_blur ?? 0) + 24}px)`,
            transform: 'scale(1.15)',
            opacity: 0.25,
          }} />
        )}
        {/* Accent glow blob top */}
        <div className="absolute" style={{
          top: '-15%', left: '15%',
          width: '70vw', height: '70vw',
          background: `radial-gradient(circle, rgba(${accentRgb},0.25) 0%, transparent 65%)`,
          filter: 'blur(60px)',
        }} />
        {/* Accent glow blob bottom-right */}
        <div className="absolute" style={{
          bottom: '5%', right: '-5%',
          width: '50vw', height: '50vw',
          background: `radial-gradient(circle, rgba(${accentRgb},0.14) 0%, transparent 65%)`,
          filter: 'blur(80px)',
        }} />
        <div className="absolute inset-0" style={{ background: 'rgba(8,8,16,0.28)' }} />
      </div>

      {/* Particles */}
      <ParticleCanvas accent={accent} />

      {/* Parallax Banner */}
      <div className="relative z-10">
        <ParallaxBanner bannerUrl={user.banner_url} accentRgb={accentRgb} />
      </div>

      {/* Content */}
      <div className="relative z-10 max-w-4xl mx-auto px-6 -mt-20 pb-24">

        {/* ── Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-end gap-5 mb-8">
          <AvatarHalo
            src={user.profile_picture_url || `/api/player-heads/${user.minecraft_username || user.username}/112`}
            accent={accent}
            online={online}
          />
          <div className="flex-1 min-w-0 mb-1">
            <div className="flex flex-wrap items-center gap-2.5 mb-1">
              <h1 className="text-3xl font-bold text-white leading-tight">{user.display_name || user.username}</h1>
              {clanMember && (
                <span className="text-xs px-2.5 py-1 rounded-full font-semibold"
                  style={{ background: roleStyle.bg, color: roleStyle.text, border: `1px solid ${roleStyle.text}33` }}>
                  {clanMember.role}
                </span>
              )}
            </div>
            {user.display_name && (
              <p className="text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>@{user.username}</p>
            )}
            {/* Status text */}
            {user.status_text && (
              <p className="text-sm mt-1 flex items-center gap-1.5" style={{ color: 'rgba(255,255,255,0.55)' }}>
                <span style={{ color: accent }}>●</span>
                {user.status_text}
              </p>
            )}
            <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.3)' }}>{lastSeenLabel}</p>
          </div>
          <div className="flex gap-2 flex-shrink-0 mb-1">
            {isOwnProfile ? (
              <Link href="/profil-bearbeiten"
                className="text-sm px-4 py-2 rounded-xl font-medium transition-all hover:scale-105"
                style={{ ...glass(0.12), color: '#fff' }}>
                ✏️ Bearbeiten
              </Link>
            ) : currentUser && (
              <>
                <button onClick={handleFriendAction} disabled={sendingFriend}
                  className="text-sm px-4 py-2.5 rounded-xl font-medium transition-all hover:scale-105 disabled:opacity-50"
                  style={
                    friendStatus === 'none'
                      ? { background: accent, color: '#fff', boxShadow: `0 4px 24px rgba(${accentRgb},0.45)` }
                      : { ...glass(0.12), color: friendStatus === 'friends' ? '#4ade80' : '#fff' }
                  }>
                  {friendBtnLabel()}
                </button>
                <SaveDesignButton username={username} accent={accent} glassConfig={user.glass_config} />
              </>
            )}
          </div>
        </div>

        {/* ── Bio + Discord + Badges ── */}
        {(user.biography || badges.length > 0 || user.discord_username) && (
          <GlassCard userGlass={glassConfig} className="mb-4">
            {user.discord_username && (
              <div className="flex items-center gap-1.5 mb-3">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="#7289DA">
                  <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057c.002.022.015.041.034.051a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z" />
                </svg>
                {user.discord_id ? (
                  <a href={`https://discord.com/users/${user.discord_id}`} target="_blank" rel="noopener noreferrer"
                    className="text-sm hover:opacity-70 transition-opacity" style={{ color: '#7289DA' }}>
                    {user.discord_username}
                  </a>
                ) : (
                  <span className="text-sm" style={{ color: '#7289DA' }}>{user.discord_username}</span>
                )}
              </div>
            )}
            {user.biography && (
              <LinkifiedText text={user.biography} className="text-sm leading-relaxed mb-4"
                style={{ color: 'rgba(255,255,255,0.65)' }} />
            )}
            {badges.length > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap">
                {badges.slice(0, 16).map(badge => (
                  <div key={badge.id} className="relative"
                    onMouseEnter={() => setHoveredBadge(badge.id)}
                    onMouseLeave={() => setHoveredBadge(null)}>
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center transition-transform hover:scale-110 cursor-default"
                      style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)' }}>
                      {badge.icon_url.startsWith('http') || badge.icon_url.startsWith('/')
                        ? <img src={badge.icon_url} alt={badge.name} className="w-5 h-5 rounded object-contain" />
                        : <span className="text-sm">{badge.icon_url}</span>}
                    </div>
                    {hoveredBadge === badge.id && (
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap z-30 pointer-events-none"
                        style={{ background: 'rgba(12,12,20,0.96)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', backdropFilter: 'blur(16px)' }}>
                        {badge.name}
                        {badge.badge_categories && (
                          <span className="ml-1.5 text-[10px]" style={{ color: badge.badge_categories.color }}>
                            {badge.badge_categories.name}
                          </span>
                        )}
                        <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0"
                          style={{ borderLeft: '4px solid transparent', borderRight: '4px solid transparent', borderTop: '4px solid rgba(12,12,20,0.96)' }} />
                      </div>
                    )}
                  </div>
                ))}
                {badges.length > 16 && (
                  <Link href={`/${username}/abzeichen`}
                    className="w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold hover:opacity-70 transition-opacity"
                    style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.35)', border: '1px solid rgba(255,255,255,0.08)' }}>
                    +{badges.length - 16}
                  </Link>
                )}
              </div>
            )}
          </GlassCard>
        )}

        {/* ── Clan-Weg Zeitstrahl ── */}
        {clanMember && (
          <GlassCard userGlass={glassConfig} className="mb-4">
            <StufeTimeline joinDate={clanMember.join_date} stufeIndex={stufeIndex} accent={accent} />
          </GlassCard>
        )}

        {/* ── Level + SMP Stats nebeneinander ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">

          {/* Level */}
          <GlassCard userGlass={glassConfig} className="h-full">
            <div className="flex items-start justify-between mb-3">
              <p className="text-xs font-medium" style={{ color: 'rgba(255,255,255,0.4)' }}>Clan Level</p>
              <div className="flex items-center gap-2">
                <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: `rgba(${accentRgb},0.15)`, color: accent }}>
                  {levelProgress.current}/{levelProgress.needed} XP
                </span>
                <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                  style={{ background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.35)', border: '1px solid rgba(255,255,255,0.1)' }}>
                  erscheint bald
                </span>
              </div>
            </div>
            <p className="text-5xl font-black mb-3" style={{ color: accent, textShadow: `0 0 30px rgba(${accentRgb},0.5)` }}>
              {levelProgress.level}
            </p>
            <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
              <div className="h-full rounded-full transition-all duration-1000"
                style={{ width: `${levelProgress.percent}%`, background: `linear-gradient(to right, rgba(${accentRgb},0.7), ${accent})` }} />
            </div>
          </GlassCard>

          {/* SMP Rank bars */}
          <GlassCard userGlass={glassConfig} className="h-full">
            <p className="text-xs font-medium mb-4" style={{ color: 'rgba(255,255,255,0.4)' }}>SMP-Stats</p>
            {smpStats ? (
              <div className="space-y-3">
                <RankBar label="⏱ Spielzeit" value={fmtHours(smpStats.playtime_minutes)} rank={smpRanks.playtime_minutes || 1} total={totalPlayers} accent={accent} />
                <RankBar label="⚔️ Mob Kills" value={fmtNum(smpStats.mob_kills)}          rank={smpRanks.mob_kills || 1}         total={totalPlayers} accent={accent} />
                <RankBar label="💀 Deaths"    value={fmtNum(smpStats.deaths)}              rank={smpRanks.deaths || 1}            total={totalPlayers} accent={accent} />
                <RankBar label="⛏ Gebaut"    value={fmtNum(smpStats.blocks_placed)}       rank={smpRanks.blocks_placed || 1}     total={totalPlayers} accent={accent} />
              </div>
            ) : (
              <p className="text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>Noch keine SMP-Daten</p>
            )}
          </GlassCard>
        </div>

        {/* ── Spotify ── */}
        <div className="mb-4"><SpotifyBlock username={username} accent={accent} userGlass={glassConfig} /></div>

        {/* ── Steam ── */}
        <div className="mb-4"><SteamBlock user={user} accent={accent} userGlass={glassConfig} /></div>

        {/* ── Freunde ── */}
        <GlassCard userGlass={glassConfig}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-white">
              Freunde <span style={{ color: 'rgba(255,255,255,0.3)' }}>({friendUsernames.length})</span>
            </h2>
            {isOwnProfile && (
              <Link href="/freunde" className="text-xs hover:opacity-70 transition-opacity" style={{ color: 'rgba(255,255,255,0.3)' }}>
                Alle →
              </Link>
            )}
          </div>
          {friendUsernames.length === 0 ? (
            <p className="text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>Noch keine Freunde.</p>
          ) : (
            <div className="flex flex-wrap gap-3">
              {friendUsernames.slice(0, 10).map(name => (
                <Link key={name} href={`/profile/${name}`}
                  className="flex flex-col items-center gap-1.5 hover:opacity-70 transition-opacity">
                  <img src={`/api/player-heads/${name}/40`} alt={name} className="w-10 h-10 rounded-xl" />
                  <span className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>{name}</span>
                </Link>
              ))}
              {friendUsernames.length > 10 && (
                <div className="flex flex-col items-center gap-1.5">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xs font-bold"
                    style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.35)' }}>
                    +{friendUsernames.length - 10}
                  </div>
                </div>
              )}
            </div>
          )}
        </GlassCard>

      </div>
    </div>
  )
}