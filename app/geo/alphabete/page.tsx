import type { Metadata } from 'next'
import AlphabeteView from './AlphabeteView'

export const metadata: Metadata = {
  title: 'Alle Alphabete',
  description: 'Alle Schriften aus „Sprachen & Schriften“ auf einen Blick – jeder Buchstabe zum Anhören, dazu ein Laut in allen Schriften im Vergleich.',
}

export default function AlphabetePage() {
  return <AlphabeteView />
}