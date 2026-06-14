'use client'

import Link from 'next/link'
import { useAuth } from '../lib/auth-context'

export default function Navbar() {
  const { user, loading, logout } = useAuth()

  return (
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
        <Link href="/wm-tippspiel" className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-full text-sm font-medium">
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
          <Link href="/settings" className="text-gray-400 hover:text-gray-600">⚙️</Link>
          {user.username === 'uwuleonie' && (
            <Link href="/admin" className="text-purple-600 border border-purple-200 px-3 py-1 rounded-full text-sm hover:bg-purple-50">
              🛡️ Admin
            </Link>
          )}
          <button onClick={logout} className="text-gray-500 hover:text-gray-700 text-sm flex items-center gap-1">
            → Logout
          </button>
        </div>
      ) : (
        <Link href="/login" className="flex items-center gap-2 btn-gradient text-white px-4 py-2 rounded-full text-sm font-medium">
          → Login
        </Link>
      )}
    </nav>
  )
}