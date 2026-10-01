'use client'

// Navigationsleiste für die ganze Seite (außer /private, das hat eine eigene)
// Glas-Optik, „seek“-Schriftzug, aktiver Bereich hervorgehoben.
// Am Handy: Links wandern in ein ausklappbares Menü (☰), Glocke und Profil bleiben sichtbar.
// Styles: app/components/navbar.css (Präfix nv-)

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../lib/auth-context'
import { signatureFont } from '../lib/fonts'
import NotificationBell from './NotificationBell'
import './navbar.css'

const LINKS = [
  { href: '/clan', label: 'Clan' },
  { href: '/smp', label: 'SMP' },
  { href: '/hidenseek', label: "Hide'n'Seek" },
  { href: '/changelog', label: 'Changelog' },
]
// Hervorgehobener Link (aktuelles Tippspiel)
const FEATURED = { href: '/ucl2627', label: 'UCL Tippspiel', icon: '/ucl-badge.png' }

function Svg({ children, size = 18 }: { children: React.ReactNode; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>
}
const ICON = {
  chat: <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12Z" />,
  gear: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-2.9-1.2l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0-1.2-2.9H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.2-2.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 2.9-1.2V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 2.9 1.2l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0 1.2 2.9H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" /></>,
  shield: <path d="M12 3 4 6v6c0 5 3.5 8.5 8 9 4.5-.5 8-4 8-9V6l-8-3Z" />,
  menu: <><path d="M4 7h16" /><path d="M4 12h16" /><path d="M4 17h16" /></>,
  close: <><path d="M6 6l12 12" /><path d="M18 6 6 18" /></>,
  chevron: <path d="m6 9 6 6 6-6" />,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4 21c1-4 4.5-6 8-6s7 2 8 6" /></>,
  plus: <><path d="M12 5v14" /><path d="M5 12h14" /></>,
  logout: <><path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3" /><path d="M10 17l5-5-5-5" /><path d="M15 12H4" /></>,
  check: <path d="m5 12 5 5L20 7" />,
  login: <><path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3" /><path d="M10 17l5-5-5-5" /><path d="M15 12H3" /></>,
}

export default function Navbar() {
  const { user, loading, logout } = useAuth()
  const pathname = usePathname() || '/'
  const [showBanner, setShowBanner] = useState(false)
  const [bannerVisible, setBannerVisible] = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [linkedAccounts, setLinkedAccounts] = useState<{ id: string, session_token: string, users: { username: string } }[]>([])
  const [switching, setSwitching] = useState(false)

  const userRef = useRef<HTMLDivElement>(null)

  const fetchAccounts = () => {
    fetch('/api/accounts')
      .then(r => r.json())
      .then(d => setLinkedAccounts(d.accounts || []))
      .catch(() => {})
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
        .catch(() => {})
      fetchAccounts()
    }
  }, [user, loading])

  useEffect(() => {
    window.addEventListener('accounts-updated', fetchAccounts)
    return () => window.removeEventListener('accounts-updated', fetchAccounts)
  }, [])

  // Menüs beim Klick außerhalb / mit Escape schließen
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (userRef.current && !userRef.current.contains(e.target as Node)) setShowUserMenu(false)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { setShowUserMenu(false); setMobileOpen(false) } }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey) }
  }, [])

  // Kein Scrollen der Seite, solange das Handy-Menü offen ist
  useEffect(() => {
    if (!mobileOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [mobileOpen])

  const handleSwitch = async (sessionToken: string) => {
    setSwitching(true)
    await fetch('/api/accounts/switch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_token: sessionToken }),
    })
    window.location.assign('/') // kompletter Neuladen, damit überall der neue Account aktiv ist
  }

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/')
  const isTeam = !!user && ['administrator', 'owner', 'teammitglied'].includes(user.clan_role || '')
  const closeAll = () => { setMobileOpen(false); setShowUserMenu(false) }

  return (
    <>
      <nav className="nv" aria-label="Hauptnavigation">
        <div className="nv-inner">
          {/* Logo + Schriftzug */}
          <Link href="/" className="nv-brand" onClick={closeAll} aria-label="Startseite seekclan.de">
            <img src="/server-icon-hd.png" alt="" className="nv-logo" />
            <span className={`nv-word ${signatureFont.className}`}>seek</span>
          </Link>

          {/* Links (PC) */}
          <div className="nv-links">
            {LINKS.map(l => (
              <Link key={l.href} href={l.href} className={`nv-link ${isActive(l.href) ? 'active' : ''}`} aria-current={isActive(l.href) ? 'page' : undefined}>{l.label}</Link>
            ))}
            <Link href={FEATURED.href} className={`nv-featured ${isActive(FEATURED.href) ? 'active' : ''}`}>
              <img src={FEATURED.icon} alt="" /> {FEATURED.label}
            </Link>
          </div>

          {/* Rechte Seite */}
          <div className="nv-right">
            {loading ? (
              <div className="nv-skeleton" />
            ) : user ? (
              <>
                <div className="nv-bell"><NotificationBell /></div>
                <Link href="/chat" className={`nv-icon-btn nv-desktop ${isActive('/chat') ? 'active' : ''}`} aria-label="Chat" title="Chat"><Svg>{ICON.chat}</Svg></Link>
                <Link href="/einstellungen" className={`nv-icon-btn nv-desktop ${isActive('/einstellungen') ? 'active' : ''}`} aria-label="Einstellungen" title="Einstellungen"><Svg>{ICON.gear}</Svg></Link>
                {isTeam && <Link href="/admin2" className={`nv-icon-btn nv-desktop ${isActive('/admin2') ? 'active' : ''}`} aria-label="Admin-Bereich" title="Admin-Bereich"><Svg>{ICON.shield}</Svg></Link>}

                {/* Profil */}
                <div className="nv-pop-wrap" ref={userRef}>
                  <button className="nv-user" onClick={() => setShowUserMenu(v => !v)} aria-expanded={showUserMenu} aria-label="Profilmenü">
                    <img src={`/api/player-heads/${user.username}/32`} alt="" className="nv-head" />
                    <span className="nv-user-name">{user.username}</span>
                    <Svg size={14}>{ICON.chevron}</Svg>
                  </button>
                  {showUserMenu && (
                    <div className="nv-pop nv-pop-user" role="menu">
                      <Link href={`/profile/${user.username}`} onClick={closeAll} className="nv-pop-item strong">
                        <Svg size={16}>{ICON.user}</Svg> Mein Profil
                      </Link>
                      <div className="nv-pop-sep" />
                      <p className="nv-pop-label">Accounts</p>
                      <div className="nv-pop-item static">
                        <img src={`/api/player-heads/${user.username}/20`} alt="" className="nv-head sm" />
                        <span className="nv-grow">{user.username}</span>
                        <Svg size={15}>{ICON.check}</Svg>
                      </div>
                      {linkedAccounts.map(acc => (
                        <button key={acc.id} onClick={() => handleSwitch(acc.session_token)} disabled={switching} className="nv-pop-item muted">
                          <img src={`/api/player-heads/${acc.users.username}/20`} alt="" className="nv-head sm" />
                          <span className="nv-grow">{acc.users.username}</span>
                        </button>
                      ))}
                      <Link href="/einstellungen?tab=accounts" onClick={closeAll} className="nv-pop-item muted">
                        <Svg size={16}>{ICON.plus}</Svg> Account hinzufügen
                      </Link>
                      <div className="nv-pop-sep" />
                      <button onClick={() => { closeAll(); logout() }} className="nv-pop-item danger">
                        <Svg size={16}>{ICON.logout}</Svg> Abmelden
                      </button>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <Link href="/login" className="nv-login"><Svg size={16}>{ICON.login}</Svg> Login</Link>
            )}

            {/* Handy-Menü */}
            <button className="nv-icon-btn nv-burger" onClick={() => { setMobileOpen(o => !o); setShowUserMenu(false) }}
              aria-label={mobileOpen ? 'Menü schließen' : 'Menü öffnen'} aria-expanded={mobileOpen}>
              <Svg>{mobileOpen ? ICON.close : ICON.menu}</Svg>
            </button>
          </div>
        </div>

        {mobileOpen && (
          <div className="nv-sheet">
            <div className="nv-sheet-links">
              {LINKS.map(l => (
                <Link key={l.href} href={l.href} onClick={closeAll} className={`nv-sheet-link ${isActive(l.href) ? 'active' : ''}`}>{l.label}</Link>
              ))}
              <Link href={FEATURED.href} onClick={closeAll} className={`nv-sheet-link featured ${isActive(FEATURED.href) ? 'active' : ''}`}>
                <img src={FEATURED.icon} alt="" /> {FEATURED.label}
              </Link>
            </div>
            {user && (
              <div className="nv-sheet-row">
                <Link href="/chat" onClick={closeAll} className="nv-sheet-chip"><Svg size={16}>{ICON.chat}</Svg> Chat</Link>
                <Link href="/einstellungen" onClick={closeAll} className="nv-sheet-chip"><Svg size={16}>{ICON.gear}</Svg> Einstellungen</Link>
                {isTeam && <Link href="/admin2" onClick={closeAll} className="nv-sheet-chip"><Svg size={16}>{ICON.shield}</Svg> Admin</Link>}
              </div>
            )}
          </div>
        )}
      </nav>
      {mobileOpen && <div className="nv-backdrop" onClick={() => setMobileOpen(false)} />}

      {/* Hinweis: Minecraft-Account noch nicht verknüpft */}
      {showBanner && (
        <div className={`nv-banner ${bannerVisible ? 'show' : ''}`}>
          <Link href="/verify-account" className="nv-banner-card">
            <img src="/server-icon-hd.png" alt="" className="nv-banner-icon" />
            <span className="nv-grow">
              <b>Minecraft nicht verknüpft</b>
              <small>Klicke hier, um deinen Account zu verbinden</small>
            </span>
            <span aria-hidden="true">→</span>
          </Link>
          <button onClick={() => { setBannerVisible(false); setTimeout(() => setShowBanner(false), 500) }} className="nv-banner-close" aria-label="Hinweis schließen">
            <Svg size={12}>{ICON.close}</Svg>
          </button>
        </div>
      )}
    </>
  )
}