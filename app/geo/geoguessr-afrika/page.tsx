import type { Metadata } from 'next'
import GeoGuessrView from '../geoguessr/GeoGuessrView'

export const metadata: Metadata = {
  title: 'GeoGuessr Afrika',
  description: 'Südafrika, Namibia, Kenia, Nigeria, Ghana, Senegal und die anderen GeoGuessr-Länder Afrikas: Steckbriefe, Linien, Kennzeichen, Google-Auto, Region-Hinweise, Lernkarten und Ausschluss-Training.',
}

export default function GeoGuessrAfrikaPage() {
  return <GeoGuessrView region="afrika" />
}