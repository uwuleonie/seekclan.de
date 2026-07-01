'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

// Freunde wurde in die vereinheitlichte Chats/Freunde/Mitteilungen-Seite
// integriert (siehe app/chat/page.tsx) — diese Route bleibt als Weiterleitung
// bestehen, damit alte Links (z.B. von /[username]/page.tsx "Alle anzeigen →")
// weiterhin funktionieren.
export default function FreundeRedirectPage() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/chat?tab=freunde')
  }, [router])

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--background)', color: 'var(--muted)' }}>
      Weiterleitung...
    </div>
  )
}