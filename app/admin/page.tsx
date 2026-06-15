'use client'

import { useAuth } from '../lib/auth-context'
import Link from 'next/link'

export default function AdminPage() {
  const { user, loading } = useAuth()

  if (loading) return <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--background)', color: 'var(--foreground)' }}>Laden...</div>

  if (!user || user.clan_role !== 'admin') return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--background)' }}>
      <div className="text-center">
        <p className="text-4xl mb-4">🚫</p>
        <p className="font-bold text-xl mb-2" style={{ color: 'var(--foreground)' }}>Kein Zugriff</p>
        <p className="mb-6" style={{ color: 'var(--muted)' }}>Du hast keine Berechtigung für diese Seite.</p>
        <Link href="/" className="btn-gradient text-white px-6 py-3 rounded-xl">Zur Startseite</Link>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen" style={{ background: 'var(--background)' }}>
      <div className="max-w-4xl mx-auto px-8 py-10">
        <Link href="/" className="text-sm flex items-center gap-1 mb-8 hover:opacity-70" style={{ color: 'var(--muted)' }}>← Zurück</Link>
        <h1 className="text-3xl font-bold mb-2" style={{ color: 'var(--foreground)' }}>Admin</h1>
        <p className="mb-8" style={{ color: 'var(--muted)' }}>Verwaltung der seekclan.de Website.</p>
        <div className="grid grid-cols-2 gap-4">
          {[
            { href: '/admin/accounts', icon: '👤', title: 'Seek Accounts', desc: 'Alle registrierten Accounts, Login-Historie, Bans & Rollen.' },
            { href: '/admin/clan', icon: '👥', title: 'Clan-Mitglieder', desc: 'Minecraft-Namen, Rollen & Sortierung der Clanliste.' },
            { href: '/admin/badges', icon: '🎖️', title: 'Clan-Abzeichen', desc: 'Abzeichen & Kategorien erstellen, Mitgliedern zuweisen.' },
            { href: '/admin/wm-spiele', icon: '🏆', title: 'WM-Spiele', desc: 'Spiele anlegen, Anpfiff setzen, Ergebnisse pflegen.' },
            { href: '/admin/gast-sperren', icon: '🚫', title: 'Gast-Sperren', desc: 'Gast-Tipper sperren und Sperren verwalten.' },
            { href: '/admin/changelog', icon: '📢', title: 'Changelog', desc: 'Einträge erstellen, bearbeiten und löschen.' },
          ].map(item => (
            <Link key={item.href} href={item.href}
              className="card rounded-2xl p-6 shadow-sm hover:shadow-md transition-all group">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl mb-4" style={{ background: 'var(--muted-bg)' }}>{item.icon}</div>
              <h2 className="font-bold text-lg mb-1" style={{ color: 'var(--foreground)' }}>{item.title}</h2>
              <p className="text-sm" style={{ color: 'var(--muted)' }}>{item.desc}</p>
              <span className="text-purple-500 text-sm mt-3 block group-hover:translate-x-1 transition-all">Öffnen →</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}