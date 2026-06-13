import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import Navbar from './components/Navbar'
import Link from 'next/link'
import { AuthProvider } from './lib/auth-context'

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
        <AuthProvider>
          <Navbar />
          <main>
            {children}
          </main>
          <footer className="flex justify-between px-8 py-6 text-sm text-gray-500 border-t border-gray-100">
            <div className="flex gap-6">
              <Link href="/impressum">Impressum</Link>
              <Link href="/datenschutz">Datenschutzerklärung</Link>
              <Link href="/team">Team</Link>
            </div>
            <span>© 2026 Seek The Clan</span>
          </footer>
        </AuthProvider>
      </body>
    </html>
  )
}