import type { LegalPage } from '@/app/lib/legal'
import '../legal.css'

// Anzeige von Impressum / Datenschutzerklärung. Der HTML-Inhalt wurde beim Speichern
// im Admin-Bereich gereinigt (nur einfache Formatierung erlaubt, siehe app/lib/legal.ts).
export default function LegalView({ page }: { page: LegalPage }) {
  return (
    <div className="legal-page">
      <header className="legal-head">
        <h1>{page.title}</h1>
        {page.stand && <p>Stand: {page.stand}</p>}
      </header>
      <article className="legal-card legal-content" dangerouslySetInnerHTML={{ __html: page.html }} />
    </div>
  )
}