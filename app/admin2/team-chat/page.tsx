'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function TeamChatIndexPage() {
  const router = useRouter()
  useEffect(() => { router.replace('/admin2/team-chat/team-lounge') }, [router])
  return <p className="text-sm p-6" style={{ color: 'var(--muted)' }}>Laden...</p>
}