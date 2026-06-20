'use client'

import { useAuth } from '../../lib/auth-context'
import Link from 'next/link'

export default function AdminClaimsPage() {
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
        <Link href="/admin" className="text-sm flex items-center gap-1 mb-8 hover:opacity-70" style={{ color: 'var(--muted)' }}>← Zurück zum Admin-Panel</Link>

        <div className="card rounded-2xl p-12 text-center">
          <p className="text-5xl mb-4">🛡️</p>
          <h1 className="text-2xl font-bold mb-2" style={{ color: 'var(--foreground)' }}>Adminclaims</h1>
          <p style={{ color: 'var(--muted)' }}>
            Die Verwaltung für Admin-Claims (Permissions, Trust, Übersicht) ist noch in Arbeit und kommt demnächst.
          </p>
        </div>
      </div>
    </div>
  )
}