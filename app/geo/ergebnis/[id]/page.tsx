import type { Metadata } from 'next'
import ErgebnisView from './ErgebnisView'

// /geo/ergebnis/<id> – geteiltes Ergebnis mit Schaubild (Vorschaubild für Chats/Messenger: opengraph-image.tsx)

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Ergebnis',
    description: 'Ein Geo-Quiz-Ergebnis auf seekclan.de – schaffst du mehr?',
    openGraph: { title: 'Geo-Quiz-Ergebnis · seekclan.de', description: 'Schaffst du mehr?' },
  }
}

export default async function ErgebnisPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <ErgebnisView id={id} />
}