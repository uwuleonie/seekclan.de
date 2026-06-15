'use client'

import Link from 'next/link'
import { useAuth } from '../lib/auth-context'
import { useTheme, THEMES } from '../lib/theme-context'
import { useEffect, useState } from 'react'

export default function Navbar() {
  const { user, loading, logout } = useAuth()
  const { theme, setTheme } = useTheme()
  const [showBanner, setShowBanner] = useState(false)
  const [bannerVisible, setBannerVisible] = useState(false)
  const [showThemeMenu, setShowThemeMenu] = useState(false)

  useEffect(() => {
    if (user && !loading) {
      fetch('/api/auth/me')
        .then(r => r.json())
        .then(d => {
          if (!d.user?.minecraft_username) {
            setShowBanner(true)
            setTimeout(() => setBannerVisible(true), 100)
          }
        })
    }
  }, [user, loading])

  const currentTheme = THEMES.find(t => t.id === theme)

  return (
    <>
      <nav className="flex items-center justify-between px-8 py-4 border-b" style={{ background: 'var(--card)', borderColor: 'var(--card-border)' }}>
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2">
          <span className="text-2xl font-bold text-purple-600">SEEK</span>
          <span className="text-xs font-medium tracking-widest uppercase" style={{ color: 'var(--muted)' }}>The Clan</span>
        </Link>

        {/* Navigation Links */}
        <div className="flex items-center gap-8">
          <Link href="/changelog" className="text-sm hover:opacity-70 transition-all" style={{ color: 'var(--muted)' }}>Changelog</Link>
          <Link href="/clan" className="text-sm hover:opacity-70 transition-all" style={{ color: 'var(--muted)' }}>Clan</Link>
          <Link href="/smp" className="text-sm hover:opacity-70 transition-all" style={{ color: 'var(--muted)' }}>SMP</Link>
          <Link href="/hidenseek" className="text-sm hover:opacity-70 transition-all" style={{ color: 'var(--muted)' }}>Hide'n'Seek</Link>
          <Link href="/wm-tippspiel" className="text-white px-4 py-2 rounded-full text-sm font-medium"
            style={{
              background: 'linear-gradient(135deg, #F59E0B, #FBBF24, #F59E0B)',
              boxShadow: '0 0 16px rgba(251,191,36,0.8), 0 0 32px rgba(245,158,11,0.5)',
            }}>
            🏆 WM Tippspiel
          </Link>
        </div>

        {/* Rechte Seite */}
        <div className="flex items-center gap-3">
          {/* Theme Dropdown */}
          <div className="relative">
            <button onClick={() => setShowThemeMenu(v => !v)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm border transition-all hover:opacity-80"
              style={{ background: 'var(--muted-bg)', borderColor: 'var(--card-border)', color: 'var(--foreground)' }}>
              <span>{currentTheme?.icon}</span>
              <span className="text-xs" style={{ color: 'var(--muted)' }}>▾</span>
            </button>
            {showThemeMenu && (
              <div className="absolute right-0 mt-1 rounded-xl shadow-lg overflow-hidden z-50 border w-36"
                style={{ background: 'var(--card)', borderColor: 'var(--card-border)' }}>
                {THEMES.map(t => (
                  <button key={t.id} onClick={() => { setTheme(t.id); setShowThemeMenu(false) }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm transition-all hover:opacity-70 text-left"
                    style={{
                      background: theme === t.id ? 'var(--muted-bg)' : 'transparent',
                      color: 'var(--foreground)',
                    }}>
                    <span>{t.icon}</span>
                    <span>{t.label}</span>
                    {theme === t.id && <span className="ml-auto text-purple-500">✓</span>}
                  </button>
                ))}
              </div>
            )}
          </div>

          {loading ? (
            <div className="w-20 h-9 rounded-full animate-pulse" style={{ background: 'var(--muted-bg)' }} />
          ) : user ? (
            <>
              <div className="w-8 h-8 rounded-full overflow-hidden" style={{ background: 'var(--muted-bg)' }}>
                <img src={`https://mc-heads.net/avatar/${user.username}/32`} alt={user.username} />
              </div>
              <span className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>{user.username}</span>
              <Link href="/einstellungen" style={{ color: 'var(--muted)' }}>⚙️</Link>
              {user.clan_role === 'admin' && (
                <Link href="/admin" className="text-purple-600 border border-purple-200 px-3 py-1 rounded-full text-sm hover:bg-purple-50">
                  🛡️ Admin
                </Link>
              )}
              <button onClick={logout} className="text-sm flex items-center gap-1" style={{ color: 'var(--muted)' }}>
                → Logout
              </button>
            </>
          ) : (
            <Link href="/login" className="btn-gradient text-white px-4 py-2 rounded-full text-sm font-medium">
              → Login
            </Link>
          )}
        </div>
      </nav>

      {/* Minecraft Banner */}
      {showBanner && (
        <div className={`fixed bottom-6 right-6 z-50 transition-all duration-500 ${bannerVisible ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'}`}>
          <Link href="/einstellungen?tab=verknuepfungen"
            className="flex items-center gap-3 bg-gradient-to-r from-red-500 to-rose-400 shadow-lg shadow-red-200 rounded-2xl px-6 py-5 hover:shadow-xl hover:shadow-red-300 transition-all group">
            <div className="w-14 h-14 rounded-xl overflow-hidden bg-white/20 flex items-center justify-center">
              <img src="/server-icon-hd.png" alt="Seek Clan" className="w-12 h-12 object-contain" />
            </div>
            <div>
              <p className="font-medium text-gray-900 text-sm">Minecraft nicht verknüpft</p>
              <p className="text-gray-500 text-xs">Klicke hier um deinen Account zu verbinden</p>
            </div>
            <span className="text-purple-400 group-hover:translate-x-1 transition-all">→</span>
          </Link>
          <button onClick={() => { setBannerVisible(false); setTimeout(() => setShowBanner(false), 500) }}
            className="absolute -top-2 -right-2 w-6 h-6 bg-gray-200 hover:bg-gray-300 rounded-full text-xs text-gray-600 flex items-center justify-center">
            ✕
          </button>
        </div>
      )}
    </>
  )
}