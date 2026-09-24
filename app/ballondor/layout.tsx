import type { Metadata } from 'next'
import { Cormorant_Garamond, Jost } from 'next/font/google'

const serif = Cormorant_Garamond({ subsets: ['latin'], weight: ['300', '500', '600', '700'], variable: '--bdo-serif', display: 'swap' })
const sans = Jost({ subsets: ['latin'], weight: ['300', '400', '500', '600', '700'], variable: '--bdo-sans', display: 'swap' })

export const metadata: Metadata = {
  title: "Ballon d'Or Tippspiel · seekclan",
  description: "Tippe die Gewinner und die Top 30 des Ballon d'Or.",
}

export default function BallonDorLayout({ children }: { children: React.ReactNode }) {
  return <div className={`${serif.variable} ${sans.variable}`}>{children}</div>
}