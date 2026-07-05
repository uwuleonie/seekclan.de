'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

type Commit = {
  sha: string
  message: string
  author: string
  date: string
  url: string
  verified: boolean
}

type Branch = {
  name: string
  sha: string
  url: string
}

type DeployInfo = {
  commits: Commit[]
  branches: Branch[]
  repoUrl: string
  repoName: string
  error?: string
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
  if (days < 7) return `vor ${days} Tagen`
  return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export default function DeploysPage() {
  const [data, setData] = useState<DeployInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [branch, setBranch] = useState('main')

  useEffect(() => {
    setLoading(true)
    fetch(`/api/admin2/deploys?branch=${branch}`)
      .then(r => r.json())
      .then(d => setData(d))
      .finally(() => setLoading(false))
  }, [branch])

  return (
    <div className="max-w-4xl">
      <div className="flex items-start justify-between gap-6 mb-6">
        <div>
          <h1 className="text-3xl font-bold mb-1" style={{ color: 'var(--foreground)' }}>GitHub Deploys</h1>
          <p style={{ color: 'var(--muted)' }}>Commit-Historie und Branch-Übersicht für seekclan.de.</p>
        </div>
        {data?.repoUrl && (
          <a href={data.repoUrl} target="_blank" rel="noreferrer"
            className="px-4 py-2 rounded-xl text-sm font-medium flex-shrink-0 flex items-center gap-2"
            style={{ background: 'var(--muted-bg)', color: 'var(--foreground)', border: '1px solid var(--card-border)' }}>
            <span>🔗</span> GitHub öffnen
          </a>
        )}
      </div>

      {data?.error && (
        <div className="card rounded-2xl p-5 mb-6" style={{ borderColor: '#EF444455' }}>
          <p className="text-sm font-medium mb-1" style={{ color: '#EF4444' }}>GitHub nicht erreichbar</p>
          <p className="text-sm" style={{ color: 'var(--muted)' }}>{data.error}</p>
          <p className="text-xs mt-3" style={{ color: 'var(--muted)' }}>
            Stelle sicher dass <code className="px-1 rounded" style={{ background: 'var(--muted-bg)' }}>GITHUB_REPO</code> und{' '}
            <code className="px-1 rounded" style={{ background: 'var(--muted-bg)' }}>GITHUB_TOKEN</code> in der <code className="px-1 rounded" style={{ background: 'var(--muted-bg)' }}>.env</code> gesetzt sind.
          </p>
        </div>
      )}

      {/* Branch-Auswahl */}
      {data?.branches && data.branches.length > 0 && (
        <div className="card rounded-2xl p-5 mb-6">
          <h2 className="text-sm font-bold mb-3" style={{ color: 'var(--muted)' }}>BRANCHES</h2>
          <div className="flex flex-wrap gap-2">
            {data.branches.map(b => (
              <button key={b.name} onClick={() => setBranch(b.name)}
                className="px-3 py-1.5 rounded-xl text-sm font-medium transition-all"
                style={branch === b.name
                  ? { background: '#7C3AED22', color: '#7C3AED', border: '1px solid #7C3AED55' }
                  : { background: 'var(--muted-bg)', color: 'var(--foreground)', border: '1px solid var(--card-border)' }}>
                {b.name === 'main' ? '🌿 ' : '🌱 '}{b.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Commit-Liste */}
      <div className="card rounded-2xl overflow-hidden">
        <div className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid var(--card-border)' }}>
          <h2 className="font-bold" style={{ color: 'var(--foreground)' }}>
            Commits auf <span style={{ color: '#7C3AED' }}>{branch}</span>
          </h2>
          {loading && <span className="text-xs" style={{ color: 'var(--muted)' }}>Lädt...</span>}
        </div>

        {!loading && (!data?.commits || data.commits.length === 0) ? (
          <p className="text-sm text-center py-10" style={{ color: 'var(--muted)' }}>
            {data?.error ? 'Keine Commits geladen.' : 'Keine Commits gefunden.'}
          </p>
        ) : (
          <div>
            {(data?.commits || []).map((commit, i) => (
              <div key={commit.sha}
                className="px-6 py-4 flex items-start gap-4"
                style={{ borderBottom: i < (data?.commits?.length ?? 0) - 1 ? '1px solid var(--card-border)' : 'none' }}>

                <div className="flex flex-col items-center gap-1 flex-shrink-0 mt-0.5">
                  <span className="w-3 h-3 rounded-full" style={{ background: i === 0 ? '#22C55E' : 'var(--card-border)' }} />
                  {i < (data?.commits?.length ?? 0) - 1 && (
                    <div className="w-px flex-1 mt-1" style={{ background: 'var(--card-border)', minHeight: 20 }} />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-3 flex-wrap mb-1">
                    <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
                      {commit.message}
                    </p>
                    {i === 0 && (
                      <span className="text-xs px-2.5 py-0.5 rounded-full flex-shrink-0"
                        style={{ background: '#22C55E22', color: '#22C55E', border: '1px solid #22C55E55' }}>
                        ✓ Neuester
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 flex-wrap">
                    <a href={commit.url} target="_blank" rel="noreferrer"
                      className="font-mono text-xs px-1.5 py-0.5 rounded hover:opacity-70 transition-all"
                      style={{ background: 'var(--muted-bg)', color: '#7C3AED' }}>
                      {commit.sha}
                    </a>
                    <span className="text-xs" style={{ color: 'var(--muted)' }}>
                      {commit.author}
                    </span>
                    <span className="text-xs" style={{ color: 'var(--muted)' }}>
                      {timeAgo(commit.date)}
                    </span>
                    {commit.verified && (
                      <span className="text-xs px-2 py-0.5 rounded-full"
                        style={{ background: '#2563EB22', color: '#2563EB' }}>
                        ✓ Verified
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <p className="text-xs mt-4 text-center" style={{ color: 'var(--muted)' }}>
        Zeigt die letzten 30 Commits · {data?.repoName || '—'}
      </p>
    </div>
  )
}