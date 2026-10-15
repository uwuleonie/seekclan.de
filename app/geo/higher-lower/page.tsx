import type { Metadata } from 'next'
import HigherLowerView from './HigherLowerView'
import './hl.css'

// seekclan.de/geo/higher-lower – Welches Land hat mehr? Über 60 Kategorien, Streak-Bonus, Wetten, Tagesrunde, Ranglisten.

export const metadata: Metadata = {
  title: 'Higher Lower',
  description: 'Welches Land hat mehr Einwohner, mehr Küste, mehr Bier pro Kopf? Höher oder niedriger – mit Streak-Bonus, Sternis-Wetten und Tagesrunde.',
}

export default function HigherLowerPage() {
  return <HigherLowerView />
}