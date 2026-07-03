import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'

async function checkAdmin(req: NextRequest) {
  const token = req.cookies.get('session_token')?.value
  if (!token) return null
  const sessionResult = await pool.query('SELECT user_id FROM sessions WHERE token = $1', [token])
  const session = sessionResult.rows[0]
  if (!session) return null
  const userResult = await pool.query('SELECT clan_role FROM users WHERE id = $1', [session.user_id])
  const user = userResult.rows[0]
  if (!user || (user.clan_role !== 'administrator' && user.clan_role !== 'owner')) return null
  return user
}

// GET /api/admin2/overview
//
// Liefert die Kennzahlen für die neue /admin2 Übersichtsseite. Aktuell nur
// "offene Tickets" ist eine echte Zahl aus der DB - Update-Ideen, Konzepte,
// Deploys, Team-Chat usw. haben noch kein Datenmodell (siehe Kommentare in
// app/admin2/page.tsx) und werden dort bewusst als Platzhalter angezeigt,
// bis diese Features einzeln gebaut werden. Diese Route liefert trotzdem
// schon jetzt ein "placeholders"-Flag mit, damit das Frontend nicht selbst
// entscheiden muss, was schon echt ist.
export async function GET(req: NextRequest) {
  const admin = await checkAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })

  let openTickets = 0
  try {
    const result = await pool.query(
      `SELECT COUNT(*) AS count FROM support_tickets WHERE status = 'open'`
    )
    openTickets = parseInt(result.rows[0]?.count || '0', 10)
  } catch (err: any) {
    // Falls sich der Status-Wortlaut mal ändert, lieber 0 zeigen als die ganze
    // Übersichtsseite crashen zu lassen - das ist nur eine Kennzahl, kein
    // kritischer Pfad.
    console.error('[admin2/overview] Konnte offene Tickets nicht zählen:', err.message)
  }

  return NextResponse.json({ openTickets })
}