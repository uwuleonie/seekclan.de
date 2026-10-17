'use client'

// /admin2/clan (Clan & Abzeichen) ist jetzt Teil von /admin2/personen (Personen, Clan & Ränge an einem Ort) – alte Links und Lesezeichen landen dort.

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function Weiterleitung() {
  const router = useRouter()
  useEffect(() => { router.replace('/admin2/personen?tab=clan') }, [router])
  return <p className="text-sm" style={{ color: 'var(--muted)' }}>Weiter zu „Personen, Clan & Ränge“ …</p>
}
