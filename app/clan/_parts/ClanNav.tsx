import Link from 'next/link'

// Umschalter zwischen den Clan-Seiten: Mitglieder (/clan), Ehemalige (/clan/ex-clan), Verlauf (/clan-history)
export default function ClanNav({ aktiv }: { aktiv: 'mitglieder' | 'ehemalige' | 'verlauf' }) {
  return (
    <nav className="cn-nav" aria-label="Clan-Seiten">
      <Link href="/clan" className={aktiv === 'mitglieder' ? 'on' : ''} aria-current={aktiv === 'mitglieder' ? 'page' : undefined}>Mitglieder</Link>
      <Link href="/clan/ex-clan" className={aktiv === 'ehemalige' ? 'on' : ''} aria-current={aktiv === 'ehemalige' ? 'page' : undefined}>Ehemalige</Link>
      <Link href="/clan-history" className={aktiv === 'verlauf' ? 'on' : ''} aria-current={aktiv === 'verlauf' ? 'page' : undefined}>Clan-Verlauf</Link>
    </nav>
  )
}
