import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import 'leaflet/dist/leaflet.css'
import Navbar from './components/Navbar'
import Link from 'next/link'
import CookieBanner from './components/CookieBanner'
import { AuthProvider } from './lib/auth-context'
import { ThemeProvider } from './lib/theme-context'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Seek The Clan',
  description: 'Die offizielle Website des Seek Clans',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="de">
      <body className={inter.className}>
        <ThemeProvider>
          <AuthProvider>
            <Navbar />
            <main>
              {children}
            </main>
            <CookieBanner />
            <footer className="flex justify-between px-8 py-6 text-sm border-t" style={{ background: 'var(--card)', borderColor: 'var(--card-border)', color: 'var(--muted)' }}></footer>
            <footer className="flex justify-between px-8 py-6 text-sm border-t" style={{ background: 'var(--card)', borderColor: 'var(--card-border)', color: 'var(--muted)' }}>
              <div className="flex gap-6">
                <Link href="/impressum">Impressum</Link>
                <Link href="/datenschutz">Datenschutzerklärung</Link>
                <Link href="/team">Team</Link>
              </div>
              <span>© 2026 Seek The Clan</span>
            </footer>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}