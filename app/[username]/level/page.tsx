'use client'
import Link from 'next/link'
import { useParams } from 'next/navigation'

export default function LevelPage() {
  const params = useParams()
  const username = typeof params.username === 'string' ? params.username : ''
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--background)' }}>
      <div className="text-center max-w-md px-8">
        <p className="text-6xl mb-6">🔧</p>
        <h1 className="text-3xl font-bold mb-3" style={{ color: 'var(--foreground)' }}>Kommt bald</h1>
        <p className="mb-6" style={{ color: 'var(--muted)' }}>Das Level-System wird gerade ausgebaut und erscheint bald.</p>
        <Link href={`/${username}`} className="text-sm hover:opacity-70" style={{ color: 'var(--muted)' }}>← Zurück zum Profil</Link>
      </div>
    </div>
  )
}