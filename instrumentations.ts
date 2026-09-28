// Wird von Next.js einmal beim Serverstart aufgerufen.
// Startet die Hintergrund-Uhr des privaten Bereichs (Wecker, Reminder, Termine, Push).
// Nur im Node.js-Server, nicht im Edge-Runtime und nicht während "next build".

export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return
  if (process.env.NEXT_PHASE === 'phase-production-build') return
  const { startPrivateScheduler } = await import('./app/lib/private-scheduler')
  startPrivateScheduler()
}