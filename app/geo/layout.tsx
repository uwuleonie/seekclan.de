import type { Metadata } from 'next'
import { Playfair_Display } from 'next/font/google'
import './geo.css'
import GeoShell from './_components/GeoShell'

// seekclan.de/geo – Geografie-Quizzes, Karten und alles rund um GeoGuessr
const playfair = Playfair_Display({
  subsets: ['latin', 'latin-ext'],
  weight: ['600', '700'],
  display: 'swap',
  variable: '--ga-font-serif',
})

export const metadata: Metadata = {
  title: { default: 'Geo – Atlas & Quizzes', template: '%s · Geo · seekclan.de' },
  description: 'Geografie lernen: Länder, Hauptstädte, Bundesländer, Regionen und GeoGuessr-Wissen – mit Karten-Quizzes zum Klicken, Zuordnen und Eintippen.',
}

export default function GeoLayout({ children }: { children: React.ReactNode }) {
  return (
    <div id="ga-root" className={`ga-root ${playfair.variable}`}>
      <GeoShell>{children}</GeoShell>
    </div>
  )
}