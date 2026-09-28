'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import Icon from '../_components/Icon'

// Gemeinsame Kopfzeile für alle Planer-Bereiche
const TABS = [
  { href: '/private/planer', label: 'Kalender', icon: 'calendar' },
  { href: '/private/planer/reminder', label: 'Reminder & To-dos', icon: 'check' },
  { href: '/private/planer/stundenplan', label: 'Stundenplan', icon: 'school' },
  { href: '/private/planer/wecker', label: 'Wecker & Timer', icon: 'clock' },
]

export default function PlanerLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || ''
  return (
    <div className="pv-page">
      <nav className="pv-subnav" aria-label="Planer-Bereiche">
        {TABS.map(t => (
          <Link key={t.href} href={t.href} className={pathname === t.href ? 'active' : ''}>
            <Icon name={t.icon} size={16} /> {t.label}
          </Link>
        ))}
      </nav>
      {children}
    </div>
  )
}