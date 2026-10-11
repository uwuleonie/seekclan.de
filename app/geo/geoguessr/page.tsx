import type { Metadata } from 'next'
import GeoGuessrView from './GeoGuessrView'

export const metadata: Metadata = {
  title: 'GeoGuessr Europa',
  description: 'Alle europäischen Länder für GeoGuessr: Steckbriefe mit Pollern, Kennzeichen, Schildern und Linien, Lernkarten, Karten und Ausschluss-Training.',
}

export default function GeoGuessrPage() {
  return <GeoGuessrView />
}