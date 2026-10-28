import type { Metadata } from 'next'
import { Playfair_Display } from 'next/font/google'
import './quiz.css'

// seekclan.de/quiz – Hauptseite aller Quizzes (Geografie, Fußball, Sprachen, …)
// Styles: app/quiz/quiz.css (Präfix qz-)
const playfair = Playfair_Display({
  subsets: ['latin', 'latin-ext'],
  weight: ['600', '700'],
  display: 'swap',
  variable: '--qz-font-serif',
})

export const metadata: Metadata = {
  title: { default: 'Quiz', template: '%s · Quiz · seekclan.de' },
  description: 'Alle Quizzes von seekclan.de an einem Ort: Geografie, Fußball, Sprachen und mehr – mit Level, Rangliste und Fortschritt.',
}

export default function QuizLayout({ children }: { children: React.ReactNode }) {
  return <div className={`qz-root ${playfair.variable}`}>{children}</div>
}