'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

// PLATZHALTER-HINWEIS: Diese Seite orientiert sich am Redesign-Mockup. Nur
// "Offene Tickets" kommt aus einer echten API (/api/admin2/overview), da nur
// dafür schon ein Datenmodell existiert (support_tickets). Alles andere hier
// (Serverneustart-Ankündigung, Update-Ideen, Konzept-Fortschritt, Deploys,
// Team-Chat) sind bewusst als statische Demo-Daten eingebaut, damit das Layout
// schon steht - siehe Übergabe-Notiz "Erstmal Platzhalter, das kommt alles
// bald". Wenn die jeweiligen Datenmodelle existieren, hier Stück für Stück
// durch echte fetch()-Aufrufe ersetzen.

const PLACEHOLDER_UPDATE_IDEAS = [
  { title: 'Clan-Abzeichen Rework', author: 'Seek', when: 'vor 2 Std.', tag: 'Feature', tagColor: '#7C3AED' },
  { title: 'Saison-Event: Sommer-WM', author: 'Nico', when: 'gestern', tag: 'Event', tagColor: '#16A34A' },
  { title: 'Showcase-Galerie Lightbox', author: 'Nico', when: 'vor 3 Tagen', tag: 'UI', tagColor: '#2563EB' },
]

const PLACEHOLDER_DEPLOYS = [
  { version: 'v1.7.4', desc: 'Hotfix: Ticket-Benachrichtigungen', when: 'heute, 14:12' },
  { version: 'v1.7.3', desc: 'Showcase-Galerie: neue Bilder-API', when: 'gestern, 19:40' },
  { version: 'core-0.9.2', desc: 'SeekCore Plugin: Claims-Vorbereitung', when: 'Mo, 21:05' },
]

const PLACEHOLDER_CONCEPTS = [
  { title: 'Update 1.8 — Abzeichen-Rework', progress: 43 },
  { title: 'Update 1.9 — Sommer-WM', progress: 0 },
]

const PLACEHOLDER_TEAM_CHAT = [
  { initials: 'MA', name: 'Marlon', when: '21:52', message: 'Ich übernehme die Gast-Sperren, PR kommt heute Abend.' },
  { initials: 'NI', name: 'Nico', when: '22:04', message: 'Neustart für morgen 22:00 angekündigt, Changelog ist vorbereitet.' },
]

export default function Admin2OverviewPage() {
  const [openTickets, setOpenTickets] = useState<number | null>(null)

  useEffect(() => {
    fetch('/api/admin2/overview')
      .then(r => r.json())
      .then(data => setOpenTickets(typeof data.openTickets === 'number' ? data.openTickets : 0))
      .catch(() => setOpenTickets(0))
  }, [])

  return (
    <div className="max-w-6xl">
      <h1 className="text-3xl font-bold mb-1" style={{ color: 'var(--foreground)' }}>Übersicht</h1>
      <p className="mb-8" style={{ color: 'var(--muted)' }}>Willkommen zurück — hier ist der aktuelle Stand von seekclan.de.</p>

      {/* Serverneustart-Banner: Platzhalter, siehe Kommentar oben */}
      <div className="rounded-2xl p-5 mb-6 flex items-center justify-between gap-6 flex-wrap"
        style={{ background: 'var(--muted-bg)', border: '1px solid var(--card-border)' }}>
        <div className="flex items-center gap-4">
          <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: '#7C3AED' }} />
          <div>
            <p className="font-bold" style={{ color: 'var(--foreground)' }}>Serverneustart angekündigt — morgen, 22:00 Uhr</p>
            <p className="text-sm mt-0.5" style={{ color: 'var(--muted)' }}>Geschätzte Downtime ~4 Minuten · Discord-Ankündigung geplant für 21:30</p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          {['Update 1.8 „Abzeichen-Rework"', 'seekcore-0.9.3.jar', 'Changelog v1.8'].map(pill => (
            <span key={pill} className="text-xs px-3 py-1.5 rounded-full" style={{ background: 'var(--background)', border: '1px solid var(--card-border)', color: 'var(--foreground)' }}>
              {pill}
            </span>
          ))}
        </div>
      </div>

      {/* Kennzahlen-Kacheln: nur "Offene Tickets" ist echt */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <StatCard label="Offene Tickets" value={openTickets === null ? '—' : String(openTickets)} sub="Live-Daten" href="/admin/support" />
        <StatCard label="Update-Ideen" value="4" sub="offen oder geplant" />
        <StatCard label="Aktive Konzepte" value="3" sub="in Arbeit" />
        <StatCard label="Deploys" value="5" sub="diese Woche" />
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 space-y-6">
          <Panel title="Letzte Deploys" href="/admin2/deploys">
            <div className="divide-y" style={{ borderColor: 'var(--card-border)' }}>
              {PLACEHOLDER_DEPLOYS.map(d => (
                <div key={d.version} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0" style={{ borderColor: 'var(--card-border)' }}>
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: '#22C55E' }} />
                  <code className="text-sm font-mono flex-shrink-0" style={{ color: 'var(--foreground)' }}>{d.version}</code>
                  <p className="text-sm flex-1" style={{ color: 'var(--foreground)' }}>{d.desc}</p>
                  <p className="text-xs flex-shrink-0" style={{ color: 'var(--muted)' }}>{d.when}</p>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="Aktuelle Update-Ideen" href="/admin2/updates-ideen">
            <div className="divide-y" style={{ borderColor: 'var(--card-border)' }}>
              {PLACEHOLDER_UPDATE_IDEAS.map(idea => (
                <div key={idea.title} className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
                  <div>
                    <p className="font-medium" style={{ color: 'var(--foreground)' }}>{idea.title}</p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>{idea.author} · {idea.when}</p>
                  </div>
                  <span className="text-xs px-3 py-1 rounded-full flex-shrink-0" style={{ background: `${idea.tagColor}22`, color: idea.tagColor }}>
                    {idea.tag}
                  </span>
                </div>
              ))}
            </div>
          </Panel>
        </div>

        <div className="space-y-6">
          <Panel title="Konzept-Fortschritt" href="/admin2/update-konzepte">
            <div className="space-y-4">
              {PLACEHOLDER_CONCEPTS.map(c => (
                <div key={c.title}>
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>{c.title}</p>
                    <p className="text-sm" style={{ color: 'var(--muted)' }}>{c.progress} %</p>
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--card-border)' }}>
                    <div className="h-full rounded-full" style={{ width: `${c.progress}%`, background: 'linear-gradient(90deg, #7C3AED, #C026D3)' }} />
                  </div>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="Team-Chat" href="/admin2/team-chat">
            <div className="space-y-4">
              {PLACEHOLDER_TEAM_CHAT.map((msg, i) => (
                <div key={i} className="flex gap-3">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0" style={{ background: 'var(--muted-bg)', color: 'var(--foreground)' }}>
                    {msg.initials}
                  </div>
                  <div>
                    <p className="text-xs mb-0.5" style={{ color: 'var(--muted)' }}>{msg.name} · {msg.when}</p>
                    <p className="text-sm" style={{ color: 'var(--foreground)' }}>{msg.message}</p>
                  </div>
                </div>
              ))}
            </div>
          </Panel>

          {/* Schnellzugriff: füllt den sonst leeren Platz in der rechten Spalte sinnvoll,
              da die linke Spalte (Deploys + Update-Ideen) mehr Inhalt hat als rechts.
              Reine direkte Links zu den am häufigsten gebrauchten Verwaltungs-Seiten. */}
          <div className="card rounded-2xl p-6">
            <h2 className="font-bold mb-4" style={{ color: 'var(--foreground)' }}>Schnellzugriff</h2>
            <div className="grid grid-cols-2 gap-2">
              {[
                { href: '/admin/support', icon: '🎫', label: 'Tickets' },
                { href: '/admin/chatlogs', icon: '💬', label: 'Chatlogs' },
                { href: '/admin/changelog', icon: '📢', label: 'Changelog' },
                { href: '/admin/clan', icon: '👥', label: 'Mitglieder' },
              ].map(item => (
                <Link key={item.href} href={item.href}
                  className="flex flex-col items-center gap-1.5 py-4 rounded-xl text-center transition-all hover:opacity-80"
                  style={{ background: 'var(--muted-bg)' }}>
                  <span className="text-xl leading-none">{item.icon}</span>
                  <span className="text-xs font-medium" style={{ color: 'var(--foreground)' }}>{item.label}</span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function StatCard({ label, value, sub, href }: { label: string, value: string, sub: string, href?: string }) {
  const inner = (
    <div className="card rounded-2xl p-5 h-full">
      <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--muted)' }}>{label}</p>
      <p className="text-3xl font-bold mb-1" style={{ color: 'var(--foreground)' }}>{value}</p>
      <p className="text-xs" style={{ color: 'var(--muted)' }}>{sub}</p>
    </div>
  )
  return href ? <Link href={href} className="block hover:opacity-90 transition-all">{inner}</Link> : inner
}

function Panel({ title, href, children }: { title: string, href: string, children: React.ReactNode }) {
  return (
    <div className="card rounded-2xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-bold" style={{ color: 'var(--foreground)' }}>{title}</h2>
        <Link href={href} className="text-sm font-medium hover:opacity-70 transition-all" style={{ color: '#A855F7' }}>
          Öffnen →
        </Link>
      </div>
      {children}
    </div>
  )
}