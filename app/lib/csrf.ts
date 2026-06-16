const ALLOWED_ORIGINS = [
  'https://seekclande.vercel.app',
  'https://seekclan.de',
  'https://www.seekclan.de',
  // Vercel Preview URLs
]

export function checkOrigin(req: Request): boolean {
  // In development immer erlauben
  if (process.env.NODE_ENV !== 'production') return true

  const origin = req.headers.get('origin')
  const referer = req.headers.get('referer')

  // Kein Origin-Header = direkt/Postman = blockieren für mutating requests
  if (!origin && !referer) return false

  if (origin) {
    // Vercel Preview URLs erlauben (*.vercel.app von unserem Projekt)
    if (origin.endsWith('.vercel.app')) return true
    return ALLOWED_ORIGINS.includes(origin)
  }

  if (referer) {
    return ALLOWED_ORIGINS.some(o => referer.startsWith(o)) ||
      referer.includes('.vercel.app')
  }

  return false
}

export function csrfError() {
  return Response.json(
    { error: 'Ungültige Anfrage' },
    { status: 403 }
  )
}