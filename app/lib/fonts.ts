import { Creepster, Herr_Von_Muellerhoff } from 'next/font/google'

// Geschwungene Schrift für den Schriftzug „seek“ (Startseite + Navbar).
// Nur hier einmal laden, damit die Schrift nicht doppelt eingebunden wird.
export const signatureFont = Herr_Von_Muellerhoff({ weight: '400', subsets: ['latin'], display: 'swap' })

// Gruselige Schrift für das Halloween-Event (Shop-Seite, Quiz, Zähler)
export const spookyFont = Creepster({ weight: '400', subsets: ['latin'], display: 'swap' })