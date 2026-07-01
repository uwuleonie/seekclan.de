'use client'

import Link from 'next/link'
import { useAuth } from '../lib/auth-context'
import { useTheme, THEMES } from '../lib/theme-context'
import { useEffect, useState, useRef } from 'react'
import NotificationBell from './NotificationBell'

export default function Navbar() {
  const { user, loading, logout } = useAuth()
  const { theme, setTheme } = useTheme()
  const [showBanner, setShowBanner] = useState(false)
  const [bannerVisible, setBannerVisible] = useState(false)
  const [showThemeMenu, setShowThemeMenu] = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [linkedAccounts, setLinkedAccounts] = useState<{ id: string, session_token: string, users: { username: string } }[]>([])
  const [switching, setSwitching] = useState(false)

  const themeRef = useRef<HTMLDivElement>(null)
  const userRef = useRef<HTMLDivElement>(null)

  const fetchAccounts = () => {
    fetch('/api/accounts')
      .then(r => r.json())
      .then(d => setLinkedAccounts(d.accounts || []))
  }

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
      fetchAccounts()
    }
  }, [user, loading])

  useEffect(() => {
    window.addEventListener('accounts-updated', fetchAccounts)
    return () => window.removeEventListener('accounts-updated', fetchAccounts)
  }, [])

  // Schließen beim Klick außerhalb
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (themeRef.current && !themeRef.current.contains(e.target as Node)) setShowThemeMenu(false)
      if (userRef.current && !userRef.current.contains(e.target as Node)) setShowUserMenu(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleSwitch = async (sessionToken: string) => {
    setSwitching(true)
    await fetch('/api/accounts/switch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_token: sessionToken }),
    })
    window.location.href = '/'
  }

  const currentTheme = THEMES.find(t => t.id === theme)

  return (
    <>
      <nav className="flex items-center justify-between px-8 py-4 border-b" style={{ background: 'var(--card)', borderColor: 'var(--card-border)' }}>
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2">
          <img src="/server-icon-hd.png" alt="seekclan Logo" className="w-9 h-9 rounded-md" />
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
          <div className="relative" ref={themeRef}>
            <button onClick={() => { setShowThemeMenu(v => !v); setShowUserMenu(false) }}
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
                    style={{ background: theme === t.id ? 'var(--muted-bg)' : 'transparent', color: 'var(--foreground)' }}>
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
              <NotificationBell />
              <Link href="/chat" style={{ color: 'var(--muted)' }}>💬</Link>
              <Link href="/einstellungen" style={{ color: 'var(--muted)' }}>⚙️</Link>
              {user.clan_role === 'admin' && (
                <Link href="/admin" className="text-purple-600 border border-purple-200 px-3 py-1 rounded-full text-sm hover:bg-purple-50">
                  🛡️ Admin
                </Link>
              )}

              {/* User Dropdown */}
              <div className="relative" ref={userRef}>
                <button onClick={() => { setShowUserMenu(v => !v); setShowThemeMenu(false) }}
                  className="flex items-center gap-2 hover:opacity-80 transition-all">
                  <div className="w-8 h-8 rounded-full overflow-hidden" style={{ background: 'var(--muted-bg)' }}>
                    <img src={`/api/player-heads/${user.username}/32`} alt={user.username} />
                  </div>
                  <span className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>{user.username}</span>
                  <span className="text-xs" style={{ color: 'var(--muted)' }}>▾</span>
                </button>

                {showUserMenu && (
                  <div className="absolute right-0 mt-2 rounded-xl shadow-lg overflow-hidden z-50 border w-48"
                    style={{ background: 'var(--card)', borderColor: 'var(--card-border)' }}>
                    {/* Profil Link */}
                    <Link href={`/${user.username}`}
                      onClick={() => setShowUserMenu(false)}
                      className="flex items-center gap-2 px-4 py-3 text-sm font-medium hover:opacity-70 transition-all"
                      style={{ color: 'var(--foreground)', borderBottom: '1px solid var(--card-border)' }}>
                      👤 Profil
                    </Link>

                    {/* Aktueller Account */}
                    <div className="px-4 py-2">
                      <p className="text-xs mb-2" style={{ color: 'var(--muted)' }}>Accounts</p>
                      <div className="flex items-center gap-2 py-1.5">
                        <img src={`/api/player-heads/${user.username}/20`} alt="" className="w-5 h-5 rounded" />
                        <span className="text-sm font-medium flex-1" style={{ color: 'var(--foreground)' }}>{user.username}</span>
                        <span className="text-xs text-purple-500">✓</span>
                      </div>

                      {/* Verknüpfte Accounts */}
                      {linkedAccounts.map(acc => (
                        <button key={acc.id}
                          onClick={() => handleSwitch(acc.session_token)}
                          disabled={switching}
                          className="flex items-center gap-2 py-1.5 w-full hover:opacity-70 transition-all">
                          <img src={`/api/player-heads/${acc.users.username}/20`} alt="" className="w-5 h-5 rounded" />
                          <span className="text-sm flex-1 text-left" style={{ color: 'var(--muted)' }}>{acc.users.username}</span>
                        </button>
                      ))}
                    </div>

                    {/* Account hinzufügen + Logout */}
                    <div style={{ borderTop: '1px solid var(--card-border)' }}>
                      <Link href="/einstellungen?tab=accounts"
                        onClick={() => setShowUserMenu(false)}
                        className="flex items-center gap-2 px-4 py-2.5 text-sm hover:opacity-70 transition-all"
                        style={{ color: 'var(--muted)' }}>
                        + Account hinzufügen
                      </Link>
                      <button onClick={() => { setShowUserMenu(false); logout() }}
                        className="flex items-center gap-2 px-4 py-2.5 text-sm w-full hover:opacity-70 transition-all"
                        style={{ color: '#ef4444' }}>
                        → Logout
                      </button>
                    </div>
                  </div>
                )}
              </div>
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
          <Link href="/verify-account"
            className="flex items-center gap-4 bg-gradient-to-r from-red-500 to-rose-400 shadow-lg shadow-red-200 rounded-2xl px-8 py-6 hover:shadow-xl hover:shadow-red-300 transition-all group">
            <div className="w-20 h-20 rounded-xl overflow-hidden bg-white/20 flex items-center justify-center flex-shrink-0">
              <img src="/server-icon-hd.png" alt="Seek Clan" className="w-16 h-16 object-contain" />
            </div>
            <div>
              <p className="font-bold text-gray-900 text-base">Minecraft nicht verknüpft</p>
              <p className="text-gray-600 text-sm">Klicke hier, um deinen Account zu verbinden</p>
            </div>
            <span className="text-purple-400 text-xl group-hover:translate-x-1 transition-all">→</span>
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