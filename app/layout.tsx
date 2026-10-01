import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import 'leaflet/dist/leaflet.css'
import Navbar from './components/Navbar'
import Link from 'next/link'
import CookieBanner from './components/CookieBanner'
import { AuthProvider } from './lib/auth-context'
import { signatureFont } from './lib/fonts'

const inter = Inter({ subsets: ['latin'] })

// Titel, Beschreibung und Vorschau beim Teilen (Discord, WhatsApp, …).
// Das Vorschaubild liegt als app/opengraph-image.png daneben und wird von Next.js automatisch eingebunden.
export const metadata: Metadata = {
  metadataBase: new URL('https://seekclan.de'),
  title: { default: 'seek – Minecraft-Community', template: '%s · seekclan.de' },
  description: 'Minecraft-Community seit 2022: SMP, Hide\'n\'Seek und Clan. Server-Adresse: seekclan.de',
  applicationName: 'seekclan.de',
  openGraph: {
    type: 'website',
    siteName: 'seekclan.de',
    locale: 'de_DE',
    url: '/',
    title: 'seek – Minecraft-Community',
    description: 'SMP, Hide\'n\'Seek und Clan. Komm vorbei auf seekclan.de',
  },
  twitter: { card: 'summary_large_image' },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="de" className="dark">
      <body className={inter.className}>
          <AuthProvider>
            <Navbar />
            <main>
              {children}
            </main>
            <CookieBanner />
            <footer className="site-footer">
              <nav className="site-footer-links" aria-label="Rechtliches und Infos">
                <Link href="/impressum">Impressum</Link>
                <Link href="/datenschutz">Datenschutzerklärung</Link>
                <Link href="/team">Team</Link>
                <Link href="/rules">Regelwerk</Link>
              </nav>
              <span className="site-footer-brand">
                © {new Date().getFullYear()} <span className={signatureFont.className}>seek</span>
                <img src="/server-icon-hd.png" alt="" />
              </span>
            </footer>
          </AuthProvider>
      </body>
    </html>
  )
}