import type { Metadata, Viewport } from 'next'
import { Playfair_Display } from 'next/font/google'
import PrivateShell from './_components/PrivateShell'
import './private.css'

// Serifenschrift für Überschriften im privaten Bereich (wurde vorher nur per Name
// angefragt, aber nie geladen → Browser fiel auf Georgia zurück).
const playfair = Playfair_Display({
  subsets: ['latin'],
  style: ['normal', 'italic'],
  weight: ['400', '500', '600'],
  variable: '--pv-font-serif',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Privat · seekclan.de',
  robots: { index: false, follow: false },
  // Als App auf dem Home-Bildschirm installierbar (nötig für Push auf dem iPhone)
  manifest: '/private.webmanifest',
  appleWebApp: { capable: true, title: 'Privat', statusBarStyle: 'default' },
  icons: { apple: '/private-apple-icon.png' },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#f6dcf0',
}

export default function PrivateLayout({ children }: { children: React.ReactNode }) {
  return <PrivateShell fontClass={playfair.variable}>{children}</PrivateShell>
}