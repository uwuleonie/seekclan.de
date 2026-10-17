import type { Metadata } from 'next'
import LaenderView from './LaenderView'

export const metadata: Metadata = {
  title: 'Alle Länder',
  description: 'Alle Länder der Welt mit eigenem Profil: Steckbrief, Karte, Nachbarländer, Wirtschaft, Zahlen, GeoGuessr und Quizzes.',
}

export default function LaenderPage() {
  return <LaenderView />
}
