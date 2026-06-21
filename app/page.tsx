'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

const SECTIONS = [
  { title: 'Clan', desc: 'Alle Mitglieder mit Rolle und Beitrittsdatum.', href: '/clan', icon: '👥' },
  { title: 'SMP', desc: 'Verbinde dich auf seekclan.de in 1.21.11.', href: '/smp', icon: '🖥️' },
  { title: "Hide'n'Seek", desc: 'Erfolge, Rekorde, Top 10 und mehr.', href: '/hidenseek', icon: '🎮' },
  { title: 'WM-Tippspiel', desc: 'Alle 104 Spiele. Punkte sammeln.', href: '/wm-tippspiel', icon: '🏆' },
]

const STATS = [
  { label: 'Mitglieder', value: '150+' },
  { label: 'Clan seit', value: '2022' },
]

// Platzhalter — später durch echte Spieler-Screenshots ersetzen (lade die Bilder
// in /public/showcase/ hoch und passe die Dateinamen hier an).
const SHOWCASE = [
  { src: '/showcase/build-1.jpg', caption: 'Niffinos Burg — 64 Chunks' },
  { src: '/showcase/build-2.jpg', caption: 'Das aktuelle Spawn-Gebiet' },
  { src: '/showcase/build-3.jpg', caption: 'WM-Tippspiel startet am 26. Juni' },
]

export default function HomePreview() {
  const [mounted, setMounted] = useState(false)
  const [slide, setSlide] = useState(0)
  const [serverStatus, setServerStatus] = useState<{ online: boolean; players: number } | null>(null)

  useEffect(() => {
    setMounted(true)
    const timer = setInterval(() => setSlide(prev => (prev + 1) % SHOWCASE.length), 5000)

    fetch('/api/smp/server-status').then(r => r.json()).then(setServerStatus).catch(() => {})

    return () => clearInterval(timer)
  }, [])

  return (
    <div style={{ background: 'var(--background)', minHeight: '100vh' }}>
      <style>{`
        @keyframes rise {
          from { opacity: 0; transform: translateY(14px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .rise { animation: rise 0.6s ease-out both; }
        .showcase-frame {
          border-radius: 24px;
          padding: 4px;
          background: linear-gradient(135deg, #4F46E5, #7C3AED, #C026D3);
        }
        .showcase-inner {
          border-radius: 20px;
          overflow: hidden;
          aspect-ratio: 4 / 3;
          position: relative;
          background: var(--muted-bg);
        }
        .showcase-img {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: cover;
          opacity: 0;
          transition: opacity 0.6s ease;
        }
        .showcase-img.active { opacity: 1; }
      `}</style>

      {/* HERO — Text links, Showcase rechts */}
      <div className="max-w-6xl mx-auto px-8 pt-16 pb-20">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div>
            {mounted && (
              <p className="rise text-sm font-semibold mb-4" style={{
                background: 'linear-gradient(135deg, #4F46E5, #7C3AED, #C026D3)',
                WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent',
                letterSpacing: '0.05em',
              }}>
                SEIT 2022 — DEUTSCHSPRACHIGE MINECRAFT-COMMUNITY
              </p>
            )}

            <h1 className="rise text-5xl font-bold leading-tight" style={{ color: 'var(--foreground)', animationDelay: '0.05s' }}>
              Willkommen bei<br />
              <span style={{
                background: 'linear-gradient(135deg, #4F46E5, #7C3AED, #C026D3)',
                WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent',
              }}>
                seek
              </span>
            </h1>

            <div className="rise flex items-center gap-3 mt-5 flex-wrap" style={{ animationDelay: '0.08s' }}>
              <Link href="/join-server" className="flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-full transition hover:opacity-80" style={{ background: 'var(--muted-bg)', color: 'var(--foreground)' }}>
                🖥️ seekclan.de
              </Link>
              <a href="/discord" target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-full transition hover:opacity-80"
                style={{ background: 'var(--muted-bg)', color: 'var(--foreground)' }}>
                💬 Discord beitreten
              </a>
            </div>

            <div className="rise flex items-center gap-3 mt-8" style={{ animationDelay: '0.15s' }}>
              <Link href="/join-server" className="btn-gradient text-white px-7 py-3 rounded-full font-medium">
                Jetzt beitreten →
              </Link>
              <Link href="/clan" className="px-7 py-3 rounded-full font-medium" style={{ border: '1px solid var(--card-border)', color: 'var(--foreground)' }}>
                Clan ansehen
              </Link>
            </div>
          </div>

          {/* Showcase: rotierende Spieler-Screenshots */}
          <div className="rise" style={{ animationDelay: '0.2s' }}>
            <div className="showcase-frame">
              <div className="showcase-inner">
                {SHOWCASE.map((item, i) => (
                  <img key={i} src={item.src} alt={item.caption}
                    className={`showcase-img ${i === slide ? 'active' : ''}`} />
                ))}
              </div>
            </div>
            <div className="flex items-center justify-between mt-3 px-1">
              <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>{SHOWCASE[slide].caption}</p>
              <div className="flex gap-1.5">
                {SHOWCASE.map((_, i) => (
                  <button key={i} onClick={() => setSlide(i)}
                    className="rounded-full transition-all"
                    style={{
                      width: i === slide ? 18 : 6, height: 6,
                      background: i === slide ? '#7C3AED' : 'var(--card-border)',
                    }} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* STATS */}
      <div className="max-w-4xl mx-auto px-8 grid grid-cols-3 gap-4 relative z-10">
        {STATS.map(s => (
          <div key={s.label} className="card rounded-2xl p-5 text-center shadow-sm">
            <p className="text-2xl md:text-3xl font-bold" style={{
              background: 'linear-gradient(135deg, #4F46E5, #7C3AED, #C026D3)',
              WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent',
            }}>
              {s.value}
            </p>
            <p className="text-xs mt-1 uppercase tracking-wide" style={{ color: 'var(--muted)' }}>{s.label}</p>
          </div>
        ))}

        <div className="card rounded-2xl p-5 text-center shadow-sm">
          <p className="text-2xl md:text-3xl font-bold flex items-center justify-center gap-2" style={{ color: 'var(--foreground)' }}>
            {serverStatus === null ? (
              '...'
            ) : (
              <>
                <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: serverStatus.online ? '#16A34A' : '#EF4444' }} />
                {serverStatus.online ? serverStatus.players : '—'}
              </>
            )}
          </p>
          <p className="text-xs mt-1 uppercase tracking-wide" style={{ color: 'var(--muted)' }}>
            {serverStatus?.online ? 'Spieler online' : 'Server offline'}
          </p>
        </div>
      </div>

      {/* SECTIONS */}
      <div className="max-w-5xl mx-auto px-8 mt-16 mb-16">
        <h2 className="text-2xl font-bold mb-1" style={{ color: 'var(--foreground)' }}>Entdecke den Clan</h2>
        <p className="mb-6" style={{ color: 'var(--muted)' }}>Alles, was unsere Community ausmacht — an einem Ort.</p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {SECTIONS.map(s => (
            <Link key={s.title} href={s.href} className="card rounded-2xl p-6 shadow-sm transition-transform hover:-translate-y-1">
              <div className="text-2xl mb-3">{s.icon}</div>
              <h3 className="font-bold" style={{ color: 'var(--foreground)' }}>{s.title}</h3>
              <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>{s.desc}</p>
              <span className="text-sm mt-3 block font-medium" style={{
                background: 'linear-gradient(135deg, #4F46E5, #7C3AED, #C026D3)',
                WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent',
              }}>
                Öffnen →
              </span>
            </Link>
          ))}
        </div>
      </div>

      {/* CTA */}
      <div className="max-w-5xl mx-auto px-8 mb-16">
        <div className="rounded-2xl p-10 text-center relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #4F46E5, #7C3AED, #C026D3)' }}>
          <h3 className="text-2xl md:text-3xl font-bold text-white mb-2">Tritt unserer Community bei</h3>
          <p className="text-white/80 mb-6">Sei dabei auf Discord — für Events, Updates und den direkten Austausch mit dem Clan.</p>
          <a href="/discord" target="_blank" rel="noopener noreferrer" className="inline-block bg-white px-7 py-3 rounded-full font-medium" style={{ color: '#4F46E5' }}>
            Discord beitreten
          </a>
        </div>
      </div>
    </div>
  )
}