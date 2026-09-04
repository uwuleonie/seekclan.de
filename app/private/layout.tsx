'use client'

import { useAuth } from '../lib/auth-context'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NAV_ITEMS = [
  { href: '/private', label: 'Start' },
  { href: '/private/geoguessr', label: 'GeoGuessr' },
  // weitere Tools hier ergänzen
]

export default function PrivateLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const pathname = usePathname()

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #ffd6ec 0%, #ffb3d9 35%, #ff8cc8 65%, #ffaad4 100%)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: 'sans-serif', fontSize: '13px', color: 'rgba(180,60,120,0.5)',
        letterSpacing: '0.1em',
      }}>
        laden...
      </div>
    )
  }

  const canEnter = user && user.clan_role && ['administrator', 'owner'].includes(user.clan_role)

  if (!canEnter) {
    return (
      <div style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #ffd6ec 0%, #ffb3d9 35%, #ff8cc8 65%, #ffaad4 100%)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexDirection: 'column', gap: '12px',
      }}>
        <div style={{
          background: 'rgba(255,255,255,0.38)',
          backdropFilter: 'blur(28px)',
          WebkitBackdropFilter: 'blur(28px)',
          border: '1px solid rgba(255,255,255,0.65)',
          borderRadius: '24px',
          padding: '40px 52px',
          textAlign: 'center',
          boxShadow: '0 8px 40px rgba(255,80,160,0.12), inset 0 1px 0 rgba(255,255,255,0.85)',
        }}>
          <p style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic', fontSize: '22px', color: 'rgba(150,40,100,0.7)', marginBottom: '8px' }}>kein zugriff</p>
          <Link href="/" style={{ fontFamily: 'sans-serif', fontSize: '11px', color: 'rgba(180,60,120,0.4)', letterSpacing: '0.1em', textDecoration: 'none' }}>← zurück</Link>
        </div>
      </div>
    )
  }

  const isActive = (href: string) =>
    href === '/private' ? pathname === '/private' : pathname.startsWith(href)

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #ffd6ec 0%, #ffb3d9 35%, #ff8cc8 65%, #ffaad4 100%)',
      display: 'flex',
      alignItems: 'flex-start',
    }}>
      {/* Sidebar-Menü */}
      <aside style={{
        width: '240px',
        flexShrink: 0,
        height: '100vh',
        position: 'sticky',
        top: 0,
        display: 'flex',
        flexDirection: 'column',
        padding: '40px 20px',
        background: 'rgba(255,255,255,0.35)',
        backdropFilter: 'blur(28px)',
        WebkitBackdropFilter: 'blur(28px)',
        borderRight: '1px solid rgba(255,255,255,0.6)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.85), 4px 0 24px rgba(255,80,160,0.06)',
      }}>
        {/* Titel */}
        <div style={{ paddingLeft: '8px', marginBottom: '36px' }}>
          <p style={{
            fontFamily: 'sans-serif',
            fontSize: '10px',
            letterSpacing: '0.18em',
            color: 'rgba(180,60,120,0.45)',
            textTransform: 'uppercase',
          }}>
            privat · {user!.username.toLowerCase()}
          </p>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          {NAV_ITEMS.map(item => (
            <Link
              key={item.href}
              href={item.href}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '13px 8px',
                borderBottom: '1px solid rgba(255,255,255,0.45)',
                textDecoration: 'none',
                fontFamily: '"Playfair Display", Georgia, serif',
                fontStyle: 'italic',
                fontSize: '22px',
                color: isActive(item.href) ? '#ad1457' : 'rgba(150,40,100,0.75)',
                fontWeight: isActive(item.href) ? 500 : 400,
                transition: 'all 0.2s',
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{
                  width: '5px', height: '5px', borderRadius: '50%',
                  background: '#e91e8c',
                  opacity: isActive(item.href) ? 1 : 0,
                  transition: 'opacity 0.2s',
                  flexShrink: 0,
                }} />
                {item.label}
              </span>
              <span style={{ fontSize: '13px', color: 'rgba(180,60,120,0.35)', opacity: isActive(item.href) ? 1 : 0, transition: 'opacity 0.2s' }}>→</span>
            </Link>
          ))}
        </nav>

        {/* Footer */}
        <Link
          href="/admin2"
          style={{
            fontFamily: 'sans-serif',
            fontSize: '10px',
            letterSpacing: '0.12em',
            color: 'rgba(180,60,120,0.3)',
            textDecoration: 'none',
            paddingTop: '20px',
            borderTop: '1px solid rgba(255,255,255,0.4)',
            marginTop: '16px',
          }}
        >
          ← admin2
        </Link>
      </aside>

      {/* Content */}
      <main style={{ flex: 1, minWidth: 0, padding: '48px' }}>
        {children}
      </main>
    </div>
  )
}