'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

type Commit = { sha: string, message: string, author: string, date: string, url: string }
type Idea = { id: string, title: string, tag: string | null, created_at: string, author_username: string | null }
type Concept = { id: string, title: string, isTextOnly: boolean, isFinished: boolean, progress: number }
type ChatMsg = { content: string, created_at: string, username: string, clan_role: string }
type BoardPost = { title: string, category: string, created_at: string, author: string }

type Overview = {
  openTickets: number
  openConcepts: number
  openIdeas: number
  ideas: Idea[]
  concepts: Concept[]
  chat: ChatMsg[]
  board: BoardPost[]
  commits: Commit[]
}

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return 'gerade eben'
  if (mins < 60) return `vor ${mins} Min.`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `vor ${hours} Std.`
  const days = Math.floor(hours / 24)
  if (days === 1) return 'gestern'
  return `vor ${days} Tagen`
}

const TAG_COLORS: Record<string, string> = {
  feature: '#7C3AED', bug: '#EF4444', event: '#16A34A', ui: '#2563EB',
  idee: '#7C3AED', wichtig: '#EF4444', todo: '#EAB308', info: '#2563EB',
}
function tagColor(tag: string | null): string {
  return TAG_COLORS[(tag || '').toLowerCase()] || '#6B7280'
}

export default function Admin2OverviewPage() {
  const [data, setData] = useState<Overview | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/admin2/overview')
      .then(r => r.json())
      .then(d => setData(d))
      .finally(() => setLoading(false))
  }, [])

  const d = data

  return (
    <div className="max-w-6xl">
      <h1 className="text-3xl font-bold mb-1" style={{ color: 'var(--foreground)' }}>Übersicht</h1>
      <p className="mb-8" style={{ color: 'var(--muted)' }}>Willkommen zurück — hier ist der aktuelle Stand von seekclan.de.</p>

      {/* Kennzahlen */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <StatCard label="Offene Tickets" value={d ? String(d.openTickets ?? 0) : '—'} sub="Support-Tickets" href="/admin2/support-tickets" loading={loading} />
        <StatCard label="Update-Ideen" value={d ? String(d.openIdeas ?? 0) : '—'} sub="neueste zuerst" href="/admin2/updates-ideen" loading={loading} />
        <StatCard label="Aktive Konzepte" value={d ? String(d.openConcepts ?? 0) : '—'} sub="in Arbeit" href="/admin2/update-konzepte" loading={loading} />
        <StatCard label="Letzte Commits" value={d ? String((d.commits ?? []).length) : '—'} sub="auf GitHub" href="/admin2/deploys" loading={loading} />
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 space-y-6">

          {/* GitHub Commits */}
          <Panel title="Letzte GitHub-Commits" href="/admin2/deploys">
            {loading ? <Skeleton /> : !d?.commits.length ? (
              <p className="text-sm" style={{ color: 'var(--muted)' }}>
                Keine Commits geladen — GITHUB_REPO und GITHUB_TOKEN in .env setzen.
              </p>
            ) : (
              <div className="divide-y" style={{ borderColor: 'var(--card-border)' }}>
                {d.commits.map(c => (
                  <div key={c.sha} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                    <span className="w-2 h-2 rounded-full flex-shrink-0 mt-1.5" style={{ background: '#22C55E' }} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <a href={c.url} target="_blank" rel="noreferrer"
                          className="font-mono text-xs px-1.5 py-0.5 rounded hover:opacity-70"
                          style={{ background: 'var(--muted-bg)', color: '#7C3AED' }}>
                          {c.sha}
                        </a>
                        <p className="text-sm truncate" style={{ color: 'var(--foreground)' }}>{c.message}</p>
                      </div>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
                        {c.author} · {timeAgo(c.date)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Panel>

          {/* Update-Ideen */}
          <Panel title="Aktuelle Update-Ideen" href="/admin2/updates-ideen">
            {loading ? <Skeleton /> : !d?.ideas.length ? (
              <p className="text-sm" style={{ color: 'var(--muted)' }}>Noch keine Ideen vorhanden.</p>
            ) : (
              <div className="divide-y" style={{ borderColor: 'var(--card-border)' }}>
                {d.ideas.map(idea => (
                  <div key={idea.id} className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
                    <div className="min-w-0">
                      <p className="font-medium truncate" style={{ color: 'var(--foreground)' }}>{idea.title}</p>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
                        {idea.author_username || 'Unbekannt'} · {timeAgo(idea.created_at)}
                      </p>
                    </div>
                    {idea.tag && (
                      <span className="text-xs px-3 py-1 rounded-full flex-shrink-0"
                        style={{ background: `${tagColor(idea.tag)}22`, color: tagColor(idea.tag) }}>
                        {idea.tag}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </div>

        <div className="space-y-6">
          {/* Konzept-Fortschritt */}
          <Panel title="Konzept-Fortschritt" href="/admin2/update-konzepte">
            {loading ? <Skeleton /> : !d?.concepts.length ? (
              <p className="text-sm" style={{ color: 'var(--muted)' }}>Keine aktiven Konzepte.</p>
            ) : (
              <div className="space-y-4">
                {d.concepts.map(c => (
                  <Link key={c.id} href={`/admin2/update-konzepte/${c.id}`} className="block hover:opacity-80 transition-all">
                    <div className="flex items-center justify-between mb-1.5">
                      <p className="text-sm font-medium truncate" style={{ color: 'var(--foreground)' }}>
                        {c.isTextOnly && '📝 '}{c.title}
                      </p>
                      <p className="text-sm flex-shrink-0 ml-2" style={{ color: 'var(--muted)' }}>{c.progress}%</p>
                    </div>
                    <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--card-border)' }}>
                      <div className="h-full rounded-full" style={{ width: `${c.progress}%`, background: 'linear-gradient(90deg, #7C3AED, #C026D3)' }} />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </Panel>

          {/* Team-Chat */}
          <Panel title="Team-Chat" href="/admin2/team-chat/team-lounge">
            {loading ? <Skeleton /> : !d?.chat.length ? (
              <p className="text-sm" style={{ color: 'var(--muted)' }}>Noch keine Nachrichten.</p>
            ) : (
              <div className="space-y-3">
                {d.chat.map((msg, i) => (
                  <div key={i} className="flex gap-2.5">
                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                      style={{ background: 'var(--muted-bg)', color: 'var(--foreground)' }}>
                      {msg.username.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs mb-0.5" style={{ color: 'var(--muted)' }}>{msg.username} · {timeAgo(msg.created_at)}</p>
                      <p className="text-sm truncate" style={{ color: 'var(--foreground)' }}>{msg.content}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Panel>

          {/* Schnellzugriff */}
          <div className="card rounded-2xl p-6">
            <h2 className="font-bold mb-4" style={{ color: 'var(--foreground)' }}>Schnellzugriff</h2>
            <div className="grid grid-cols-2 gap-2">
              {[
                { href: '/admin2/support-tickets', icon: '🎫', label: 'Tickets' },
                { href: '/admin2/chatlogs', icon: '💬', label: 'Chatlogs' },
                { href: '/admin2/changelog', icon: '📢', label: 'Changelog' },
                { href: '/admin2/clan', icon: '👥', label: 'Mitglieder' },
                { href: '/admin2/notizen', icon: '📌', label: 'Brett' },
                { href: '/admin2/server-deploys', icon: '🖥️', label: 'Server' },
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

function StatCard({ label, value, sub, href, loading }: { label: string, value: string, sub: string, href?: string, loading?: boolean }) {
  const inner = (
    <div className="card rounded-2xl p-5 h-full">
      <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--muted)' }}>{label}</p>
      <p className="text-3xl font-bold mb-1" style={{ color: loading ? 'var(--muted)' : 'var(--foreground)' }}>{value}</p>
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

function Skeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map(i => (
        <div key={i} className="h-4 rounded-full animate-pulse" style={{ background: 'var(--muted-bg)', width: `${60 + i * 10}%` }} />
      ))}
    </div>
  )
}