import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'
import { checkOrigin, csrfError } from '@/app/lib/csrf'
import { countPumpkins, getBalance, getCurrentHalloween, getUser, type Difficulty } from '@/app/lib/halloween'

// POST /api/halloween/answer   Body: { findId, answer: Index | null }
// answer = null heißt: Zeit abgelaufen oder Tab gewechselt → zählt als falsch.
// Der Server prüft selbst, ob die Zeit eingehalten wurde (3 Sekunden Kulanz für langsame Verbindungen).

const GRACE_MS = 3000

export async function POST(req: NextRequest) {
  if (!checkOrigin(req)) return csrfError()
  const user = await getUser(req)
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })
  const event = await getCurrentHalloween()
  if (!event) return NextResponse.json({ error: 'Das Event läuft gerade nicht' }, { status: 409 })

  const body = await req.json().catch(() => ({})) as { findId?: number; answer?: number | null }
  const findId = Number(body.findId)
  if (!Number.isInteger(findId)) return NextResponse.json({ error: 'Ungültige Anfrage' }, { status: 400 })
  const answer = Number.isInteger(body.answer) ? Number(body.answer) : null

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const r = await client.query(
      `SELECT f.id, f.difficulty, f.deadline, f.result, q.correct_index
       FROM hw_finds f LEFT JOIN hw_questions q ON q.id = f.question_id
       WHERE f.id = $1 AND f.user_id = $2 AND f.event_id = $3
       FOR UPDATE OF f`,
      [findId, user.id, event.id]
    )
    const f = r.rows[0]
    if (!f) { await client.query('ROLLBACK'); return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 }) }
    if (f.result !== 'pending') { await client.query('ROLLBACK'); return NextResponse.json({ error: 'Diese Frage ist schon beantwortet' }, { status: 409 }) }

    const late = !f.deadline || Date.now() > new Date(f.deadline).getTime() + GRACE_MS
    const correctIndex = f.correct_index == null ? null : Number(f.correct_index)
    const correct = !late && answer !== null && answer === correctIndex
    const result = correct ? 'correct' : (late || answer === null ? 'timeout' : 'wrong')
    const bonus = correct ? event.candy[f.difficulty as Difficulty] ?? 0 : 0

    await client.query(
      'UPDATE hw_finds SET result = $1, answered_at = NOW(), candies = candies + $2 WHERE id = $3',
      [result, bonus, findId]
    )
    await client.query('COMMIT')

    const balance = await getBalance(event.id, user.id)
    const total = await countPumpkins(event.id)
    return NextResponse.json({ correct, result, correctIndex, bonus, me: { loggedIn: true, ...balance, total } })
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {})
    console.error('Halloween answer:', err)
    return NextResponse.json({ error: 'Serverfehler' }, { status: 500 })
  } finally {
    client.release()
  }
}