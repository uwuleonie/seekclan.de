'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

const slides = [
  { title: 'Changelog', description: 'Was sich auf der Seite und im Clan getan hat', bg: 'from-gray-800 to-gray-900' },
  { title: 'Clan', description: 'Alle Mitglieder mit Rolle und Beitrittsdatum', bg: 'from-purple-800 to-purple-900' },
  { title: 'SMP', description: 'Verbinde dich auf seekclan.de in 1.21.11', bg: 'from-blue-800 to-blue-900' },
  { title: "Hide'n'Seek", description: 'Unser Lieblingsmodus', bg: 'from-teal-800 to-teal-900' },
  { title: 'WM Tippspiel', description: 'Alle 104 WM-Spiele. Tipps abgeben und Punkte sammeln.', bg: 'from-orange-800 to-orange-900' },
]

export default function Home() {
  const [current, setCurrent] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrent(prev => (prev + 1) % slides.length)
    }, 4000)
    return () => clearInterval(timer)
  }, [])

  return (
    <div className="min-h-screen" style={{ background: 'var(--background)' }}>
      {/* Hero Slider */}
      <div className="relative mx-8 mt-6 rounded-2xl overflow-hidden h-96">
        <div className={`absolute inset-0 bg-gradient-to-br ${slides[current].bg} transition-all duration-500`} />
        <div className="absolute bottom-8 left-8 text-white">
          <h1 className="text-4xl font-bold">{slides[current].title}</h1>
          <p className="text-gray-300 mt-2">{slides[current].description}</p>
        </div>
        <button onClick={() => setCurrent(prev => (prev - 1 + slides.length) % slides.length)}
          className="absolute left-4 top-1/2 -translate-y-1/2 bg-purple-600 text-white rounded-full w-10 h-10 flex items-center justify-center">‹</button>
        <button onClick={() => setCurrent(prev => (prev + 1) % slides.length)}
          className="absolute right-4 top-1/2 -translate-y-1/2 bg-purple-600 text-white rounded-full w-10 h-10 flex items-center justify-center">›</button>
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
          {slides.map((_, i) => (
            <button key={i} onClick={() => setCurrent(i)}
              className={`w-6 h-2 rounded-full transition-all ${i === current ? 'bg-purple-500' : 'bg-white/40'}`} />
          ))}
        </div>
      </div>

      {/* Cards */}
      <div className="grid grid-cols-4 gap-4 mx-8 mt-8">
        {[
          { title: 'Clan', desc: 'Alle Mitglieder mit Rolle und Beitrittsdatum.', href: '/clan', icon: '👥' },
          { title: 'SMP', desc: 'Verbinde dich auf seekclan.de in 1.21.11.', href: '/smp', icon: '🖥️' },
          { title: "Hide'n'Seek", desc: 'Erfolge, Rekorde, Top 10 und mehr.', href: '/hidenseek', icon: '🎮' },
          { title: 'Changelog', desc: 'Aktuelle Updates der Seite.', href: '/changelog', icon: '📢' },
        ].map(card => (
          <div key={card.title} className="card rounded-2xl p-6 shadow-sm">
            <div className="text-2xl mb-3">{card.icon}</div>
            <h3 className="font-bold" style={{ color: 'var(--foreground)' }}>{card.title}</h3>
            <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>{card.desc}</p>
            <Link href={card.href} className="text-purple-600 text-sm mt-3 block">Öffnen →</Link>
          </div>
        ))}
      </div>

      {/* WM Highlight */}
      <div className="mx-8 mt-6 card rounded-2xl p-8 border border-orange-200 dark:border-orange-900 wine:border-red-900 navy:border-blue-900 shadow-sm">
        <span className="text-orange-500 text-xs font-bold uppercase tracking-wider">🏆 Highlight 2026</span>
        <div className="flex justify-between items-center mt-2">
          <div>
            <h2 className="text-3xl font-bold" style={{ color: 'var(--foreground)' }}>WM-Tippspiel</h2>
            <p className="mt-1" style={{ color: 'var(--muted)' }}>Alle 104 WM-Spiele. Pro Spiel ein Tipp. Punkte sammeln, Leaderboard knacken.</p>
            <p className="font-bold mt-2" style={{ color: 'var(--foreground)' }}>Startet am 26. Juni 2026.</p>
          </div>
          <Link href="/wm-tippspiel" className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-3 rounded-full font-medium">
            Zur Seite →
          </Link>
        </div>
      </div>

      {/* Über den Clan */}
      <div className="mx-8 mt-6 mb-12 flex gap-6">
        <div className="flex-1">
          <h2 className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>Über den Clan</h2>
          <p className="mt-2" style={{ color: 'var(--muted)' }}>Wir sind eine deutschsprachige Minecraft-Community mit Fokus auf SMP, Minigames und gemeinsamen Events.</p>
        </div>
        {[
          { label: 'Aktive Mitglieder', value: '∞' },
          { label: 'Server-Version', value: '1.21.11', purple: true },
          { label: 'Gegründet', value: '2021' },
        ].map(stat => (
          <div key={stat.label} className="card rounded-2xl p-6 text-center shadow-sm min-w-32">
            <p className="text-xs uppercase tracking-wider" style={{ color: 'var(--muted)' }}>{stat.label}</p>
            <p className={`text-3xl font-bold mt-2 ${stat.purple ? 'text-purple-600' : ''}`}
              style={stat.purple ? {} : { color: 'var(--foreground)' }}>{stat.value}</p>
          </div>
        ))}
      </div>
    </div>
  )
}