import type { Metadata } from 'next'
import LegalView from '../components/LegalView'
import { getLegalPage } from '../lib/legal'

// Text wird unter /admin2/rechtliches bearbeitet (Tabelle legal_pages).
// Immer frisch laden, damit Änderungen sofort sichtbar sind.
export const dynamic = 'force-dynamic'

export const metadata: Metadata = { title: 'Impressum' }

export default async function ImpressumPage() {
  return <LegalView page={await getLegalPage('impressum')} />
}