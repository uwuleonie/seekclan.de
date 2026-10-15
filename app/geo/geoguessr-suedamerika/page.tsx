import type { Metadata } from 'next'
import GeoGuessrView from '../geoguessr/GeoGuessrView'

export const metadata: Metadata = {
  title: 'GeoGuessr Südamerika',
  description: 'Argentinien, Chile, Brasilien, Kolumbien und mehr für GeoGuessr: Steckbriefe, Kennzeichen, Taxis, Strommasten, Chevrons, Pflanzen, Lernkarten und Ausschluss-Training.',
}

export default function GeoGuessrSuedamerikaPage() {
  return <GeoGuessrView region="suedamerika" />
}