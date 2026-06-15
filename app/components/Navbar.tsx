'use client'

import Link from 'next/link'
import { useAuth } from '../lib/auth-context'
import { useEffect, useState } from 'react'

export default function Navbar() {
  const { user, loading, logout } = useAuth()
 const [showBanner, setShowBanner] = useState(false)
  const [bannerVisible, setBannerVisible] = useState(false)

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

  return (
    <>
      <nav className="flex items-center justify-between px-8 py-4 bg-white border-b border-gray-100">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2">
          <span className="text-2xl font-bold text-purple-600">SEEK</span>
          <span className="text-xs text-gray-500 font-medium tracking-widest uppercase">The Clan</span>
        </Link>

        {/* Navigation Links */}
        <div className="flex items-center gap-8">
          <Link href="/changelog" className="text-gray-600 hover:text-gray-900 text-sm">Changelog</Link>
          <Link href="/clan" className="text-gray-600 hover:text-gray-900 text-sm">Clan</Link>
          <Link href="/smp" className="text-gray-600 hover:text-gray-900 text-sm">SMP</Link>
          <Link href="/hidenseek" className="text-gray-600 hover:text-gray-900 text-sm">Hide'n'Seek</Link>
          <Link href="/wm-tippspiel" className="btn-gradient text-white px-4 py-2 rounded-full text-sm font-medium">
            WM Tippspiel
          </Link>
        </div>

        {/* Rechte Seite */}
        {loading ? (
          <div className="w-20 h-9 bg-gray-100 rounded-full animate-pulse" />
        ) : user ? (
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gray-200 rounded-full overflow-hidden">
              <img src={`https://mc-heads.net/avatar/${user.username}/32`} alt={user.username} />
            </div>
            <span className="text-sm font-medium text-gray-700">{user.username}</span>
            <Link href="/einstellungen" className="text-gray-400 hover:text-gray-600">⚙️</Link>
            {user.clan_role === 'admin' && (
              <Link href="/admin" className="text-purple-600 border border-purple-200 px-3 py-1 rounded-full text-sm hover:bg-purple-50">
                🛡️ Admin
              </Link>
            )}
            <button onClick={logout} className="text-gray-500 hover:text-gray-700 text-sm flex items-center gap-1">
              → Logout
            </button>
          </div>
        ) : (
          <Link href="/login" className="btn-gradient text-white px-4 py-2 rounded-full text-sm font-medium">
            → Login
          </Link>
        )}
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