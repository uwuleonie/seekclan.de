'use client'

import { useAuth } from '../lib/auth-context'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

// Bereiche, die Teammitglieder VOLL bearbeiten dürfen (Rest ist für sie nur
// lesbar - Sidebar bleibt trotzdem komplett sichtbar, siehe NAV_MAIN/NAV_VERWALTUNG
// unten und hasWriteAccess()). Administrator/Owner dürfen immer alles.
export const TEAMMEMBER_WRITE_PATHS = [
  '/admin2/update-konzepte',
  '/admin2/team-chat',
  '/admin2/wm-tippspiel',
]

// Zentrale Helper-Funktion, die von jeder /admin2 Unterseite importiert werden
// kann, um zu entscheiden ob der aktuelle Nutzer auf DIESER Seite schreiben
// (Buttons/Formulare zeigen) oder nur lesen darf (alles ausgeblendet/gesperrt).
export function hasWriteAccess(clanRole: string | null | undefined, pathname: string): boolean {
  if (clanRole === 'administrator' || clanRole === 'owner') return true
  if (clanRole === 'teammitglied') {
    return TEAMMEMBER_WRITE_PATHS.some(p => pathname.startsWith(p))
  }
  return false
}

const NAV_MAIN = [
  { href: '/admin2', label: 'Übersicht', icon: '🏠' },
  { href: '/admin2/notizen', label: 'Schwarzes Brett', icon: '📌' },
  { href: '/admin2/team-chat', label: 'Team-Chat', icon: '💬' },
]

const NAV_KONZEPTE = [
  { href: '/admin2/update-konzepte', label: 'Update-Konzepte', icon: '📐' },
  { href: '/admin2/updates-ideen', label: 'Update-Ideen', icon: '💡' },
]

const NAV_VERWALTUNG = [
  { href: '/admin2/accounts', label: 'Seek Accounts', icon: '👤' },
  { href: '/admin2/clan', label: 'Clan & Abzeichen', icon: '👥' },
  { href: '/admin2/wm-tippspiel', label: 'WM-Tippspiel', icon: '🏆' },
  { href: '/admin2/showcase', label: 'Startseiten-Showcase', icon: '🖼️' },
  { href: '/admin2/support-tickets', label: 'Support-Tickets', icon: '🎫' },
  { href: '/admin2/changelog', label: 'Changelog', icon: '📢' },
  { href: '/admin2/chatlogs', label: 'Chatlogs', icon: '🔍' },
]

const NAV_SERVER = [
  { href: '/admin2/lobby', label: 'Lobby-Verwaltung', icon: '🎮' },
  { href: '/admin2/server-deploys', label: 'Server & Deploys', icon: '🚀' },
  { href: '/admin2/deploys', label: 'GitHub Commits', icon: '📦' },
  { href: '/admin2/bulletin-board', label: 'Schwarzes Brett', icon: '📋' }
]

const ROLE_LABELS: Record<string, string> = {
  owner: 'Leonie',
  administrator: 'Administrator',
  teammitglied: 'Teammitglied',
  vip: 'VIP',
  clanmoderator: 'Clanmoderator',
  clanmitglied: 'Clanmitglied',
  gast: 'Gast',
}

export default function Admin2Layout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const pathname = usePathname()

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--background)', color: 'var(--foreground)' }}>Laden...</div>
  }

  // Zugriff auf den /admin2 Bereich überhaupt: administrator, owner und
  // teammitglied kommen rein (letztere nur mit Lesezugriff auf die meisten
  // Seiten, siehe hasWriteAccess). Alle anderen Rollen sehen "Kein Zugriff".
  const canEnterAdmin2 = user && user.clan_role && ['administrator', 'owner', 'teammitglied'].includes(user.clan_role)

  if (!canEnterAdmin2) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--background)' }}>
        <div className="text-center">
          <p className="text-4xl mb-4">🚫</p>
          <p className="font-bold text-xl mb-2" style={{ color: 'var(--foreground)' }}>Kein Zugriff</p>
          <p className="mb-6" style={{ color: 'var(--muted)' }}>Du hast keine Berechtigung für diese Seite.</p>
          <Link href="/" className="btn-gradient text-white px-6 py-3 rounded-xl">Zur Startseite</Link>
        </div>
      </div>
    )
  }

  const isActive = (href: string) => href === '/admin2' ? pathname === '/admin2' : pathname.startsWith(href)
  const isLocked = (href: string) => user!.clan_role === 'teammitglied' && !TEAMMEMBER_WRITE_PATHS.some(p => href.startsWith(p))

  return (
    <div className="min-h-screen flex" style={{ background: 'var(--background)' }}>
      <aside className="w-[280px] flex-shrink-0 flex flex-col h-screen sticky top-0 px-4 py-6" style={{ borderRight: '1px solid var(--card-border)' }}>
        <div className="flex items-center gap-3 px-2 mb-6">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold flex-shrink-0" style={{ background: 'linear-gradient(135deg, #4F46E5, #7C3AED, #C026D3)' }}>
            S
          </div>
          <div>
            <p className="font-bold text-sm" style={{ color: 'var(--foreground)' }}>seekclan.de</p>
            <p className="text-xs" style={{ color: 'var(--muted)' }}>Admin</p>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto space-y-4">
          <div className="space-y-0.5">
            {NAV_MAIN.map(item => {
              const locked = isLocked(item.href)
              return (
                <Link key={item.href} href={item.href}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all"
                  style={{
                    ...(isActive(item.href) ? { background: 'var(--muted-bg)', color: 'var(--foreground)', border: '1px solid var(--card-border)' } : { color: 'var(--muted)' }),
                    opacity: locked ? 0.55 : 1,
                  }}>
                  <span className="text-base leading-none w-5 text-center">{item.icon}</span>
                  <span className="flex-1">{item.label}</span>
                  {locked && <span className="text-xs">🔒</span>}
                </Link>
              )
            })}
          </div>

          {[
            { label: 'Konzepte & Ideen', items: NAV_KONZEPTE },
            { label: 'Verwaltung', items: NAV_VERWALTUNG },
            { label: 'Server', items: NAV_SERVER },
          ].map(section => (
            <div key={section.label}>
              <p className="text-xs font-semibold uppercase tracking-wider px-3 mb-2" style={{ color: 'var(--muted)' }}>
                {section.label}
              </p>
              <div className="space-y-0.5">
                {section.items.map(item => {
                  const locked = isLocked(item.href)
                  return (
                    <Link key={item.href} href={item.href}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all"
                      style={{
                        ...(isActive(item.href) ? { background: 'var(--muted-bg)', color: 'var(--foreground)', border: '1px solid var(--card-border)' } : { color: 'var(--muted)' }),
                        opacity: locked ? 0.55 : 1,
                      }}>
                      <span className="text-base leading-none w-5 text-center">{item.icon}</span>
                      <span className="flex-1">{item.label}</span>
                      {locked && <span className="text-xs">🔒</span>}
                    </Link>
                  )
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="flex items-center gap-3 px-2 pt-4 mt-4" style={{ borderTop: '1px solid var(--card-border)' }}>
          <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 relative" style={{ background: 'var(--muted-bg)', color: 'var(--foreground)' }}>
            {user!.username.slice(0, 2).toUpperCase()}
            <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2" style={{ background: '#22C55E', borderColor: 'var(--background)' }} />
          </div>
          <div>
            <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>{user!.username}</p>
            <p className="text-xs" style={{ color: 'var(--muted)' }}>{ROLE_LABELS[user!.clan_role || ''] || user!.clan_role}</p>
          </div>
        </div>
      </aside>

      <main className="flex-1 min-w-0 px-10 py-10 flex justify-center">
        <div className="w-full max-w-[1100px]">
          {children}
        </div>
      </main>
    </div>
  )
}