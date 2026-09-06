'use client'

import { useAuth } from '../lib/auth-context'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

const USERS = [
  { id: 'mikey', label: 'Mikey', initials: 'M' },
  { id: 'leonie', label: 'Leonie', initials: 'L' },
]

export default function PrivatePage() {
  const { user, loading } = useAuth()
  const router = useRouter()

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

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #ffd6ec 0%, #ffb3d9 35%, #ff8cc8 65%, #ffaad4 100%)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '48px',
    }}>
      <p style={{
        fontFamily: 'sans-serif',
        fontSize: '10px',
        letterSpacing: '0.2em',
        color: 'rgba(180,60,120,0.45)',
        textTransform: 'uppercase',
      }}>
        wer bist du?
      </p>

      <div style={{ display: 'flex', gap: '32px' }}>
        {USERS.map(u => (
          <button
            key={u.id}
            onClick={() => router.push(`/private/${u.id}`)}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '16px',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '0',
            }}
          >
            <div style={{
              width: '96px',
              height: '96px',
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.5)',
              backdropFilter: 'blur(28px)',
              WebkitBackdropFilter: 'blur(28px)',
              border: '1px solid rgba(255,255,255,0.8)',
              boxShadow: '0 8px 32px rgba(255,80,160,0.15), inset 0 1px 0 rgba(255,255,255,0.9)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: '"Playfair Display", Georgia, serif',
              fontStyle: 'italic',
              fontSize: '36px',
              color: 'rgba(150,40,100,0.8)',
              transition: 'transform 0.2s, box-shadow 0.2s',
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLDivElement).style.transform = 'scale(1.06)'
              ;(e.currentTarget as HTMLDivElement).style.boxShadow = '0 12px 40px rgba(255,80,160,0.25), inset 0 1px 0 rgba(255,255,255,0.9)'
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLDivElement).style.transform = 'scale(1)'
              ;(e.currentTarget as HTMLDivElement).style.boxShadow = '0 8px 32px rgba(255,80,160,0.15), inset 0 1px 0 rgba(255,255,255,0.9)'
            }}
            >
              {u.initials}
            </div>
            <span style={{
              fontFamily: 'sans-serif',
              fontSize: '11px',
              letterSpacing: '0.15em',
              color: 'rgba(180,60,120,0.55)',
              textTransform: 'uppercase',
            }}>
              {u.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}