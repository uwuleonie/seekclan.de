import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'
import { checkOrigin, csrfError } from '@/app/lib/csrf'
import { DIFFICULTIES, getBalance, countPumpkins, getCurrentHalloween, getUser, isAdmin, isRunning, type Difficulty } from '@/app/lib/halloween'

// POST /api/halloween/find   Body: { pumpkinId }
// Kürbis angeklickt: +Süßigkeiten fürs Finden, dann eine Quizfrage (ohne Lösung!).
// Die Zeit läuft ab jetzt auf dem Server – Schummeln über den Browser bringt nichts.
// Fragen wiederholen sich für einen Spieler NIE, solange es noch eine ungestellte gibt (75 Fragen für 75 Kürbisse):
// Gibt es in der gewünschten Schwierigkeit keine neue Frage mehr, kommt eine neue aus einer anderen Schwierigkeit.
// Mehrere Kürbisse gleichzeitig anklicken ändert daran nichts (Sperre pro Spieler in der Datenbank).

// Wenn ein Kürbis „zufällig“ ist: öfter leicht, seltener schwer
const WEIGHTS: Record<Difficulty, number> = { easy: 50, medium: 35, hard: 15 }

export async function POST(req: NextRequest) {
  if (!checkOrigin(req)) return csrfError()
  const user = await getUser(req)
  if (!user) return NextResponse.json({ error: 'Bitte einloggen, um Kürbisse zu sammeln' }, { status: 401 })

  const event = await getCurrentHalloween()
  // Vor dem Start dürfen nur Administrator/Owner testen
  if (!event || (!isRunning(event) && !isAdmin(user))) return NextResponse.json({ error: 'Das Event läuft gerade nicht' }, { status: 409 })

  const body = await req.json().catch(() => ({})) as { pumpkinId?: number }
  const pumpkinId = Number(body.pumpkinId)
  if (!Number.isInteger(pumpkinId)) return NextResponse.json({ error: 'Ungültiger Kürbis' }, { status: 400 })

  const c = await pool.connect()
  try {
    await c.query('BEGIN')
    // Pro Spieler und Event nur ein Fund gleichzeitig – sonst könnten zwei schnelle Klicks dieselbe Frage bekommen
    await c.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`hw-find:${event.id}:${user.id}`])

    const pr = await c.query('SELECT id, difficulty FROM hw_pumpkins WHERE id = $1 AND event_id = $2 AND active = TRUE', [pumpkinId, event.id])
    const pumpkin = pr.rows[0]
    if (!pumpkin) { await c.query('ROLLBACK'); return NextResponse.json({ error: 'Diesen Kürbis gibt es nicht (mehr)' }, { status: 404 }) }

    // Fragen, die dieser Spieler noch NICHT hatte – je Schwierigkeit gezählt
    const neuJe = (await c.query(
      `SELECT difficulty, COUNT(*)::int AS n FROM hw_questions
        WHERE event_id = $1 AND active = TRUE
          AND id NOT IN (SELECT question_id FROM hw_finds WHERE event_id = $1 AND user_id = $2 AND question_id IS NOT NULL)
        GROUP BY difficulty`, [event.id, user.id]
    )).rows.filter(r => r.n > 0).map(r => r.difficulty as Difficulty)

    // Gewünschte Schwierigkeit: die des Kürbisses, bei „zufällig“ gewichtet (öfter leicht, seltener schwer) –
    // immer nur aus Schwierigkeiten, in denen es noch neue Fragen gibt
    let wunsch: Difficulty | null = null
    if (pumpkin.difficulty !== 'random' && neuJe.includes(pumpkin.difficulty)) wunsch = pumpkin.difficulty
    else if (neuJe.length) {
      const pool_ = DIFFICULTIES.filter(d => neuJe.includes(d))
      const sum = pool_.reduce((sm, d) => sm + WEIGHTS[d], 0)
      let r = Math.random() * sum
      wunsch = pool_.find(d => (r -= WEIGHTS[d]) < 0) || pool_[0]
    }

    // Neue Frage wählen (gewünschte Schwierigkeit zuerst). Hatte der Spieler schon ALLE Fragen, gibt es keine Frage mehr.
    const q: { id: number; question: string; answers: string[]; time_limit: number; difficulty: Difficulty } | null = wunsch ? (await c.query(
      `SELECT id, question, answers, time_limit, difficulty FROM hw_questions
        WHERE event_id = $1 AND active = TRUE
          AND id NOT IN (SELECT question_id FROM hw_finds WHERE event_id = $1 AND user_id = $3 AND question_id IS NOT NULL)
        ORDER BY (difficulty = $2) DESC, random() LIMIT 1`,
      [event.id, wunsch, user.id]
    )).rows[0] ?? null : null
    const difficulty: Difficulty | null = q?.difficulty ?? null

    const ins = await c.query(
      `INSERT INTO hw_finds (event_id, pumpkin_id, user_id, question_id, difficulty, deadline, result, candies)
       VALUES ($1, $2, $3, $4, $5,
               CASE WHEN $6::int IS NULL THEN NULL ELSE NOW() + make_interval(secs => $6::int) END,
               $7, $8)
       ON CONFLICT (pumpkin_id, user_id) DO NOTHING
       RETURNING id, deadline`,
      [event.id, pumpkinId, user.id, q?.id ?? null, q ? difficulty : null, q ? q.time_limit : null, q ? 'pending' : 'none', event.candyFind]
    )
    await c.query('COMMIT')
    if (!ins.rows[0]) return NextResponse.json({ error: 'Diesen Kürbis hast du schon gefunden' }, { status: 409 })

    const balance = await getBalance(event.id, user.id)
    const total = await countPumpkins(event.id)

    return NextResponse.json({
      findId: Number(ins.rows[0].id),
      gained: event.candyFind,
      me: { loggedIn: true, ...balance, total },
      question: q ? {
        text: q.question,
        answers: q.answers,
        difficulty,
        bonus: event.candy[difficulty!],
        timeLimit: q.time_limit,
        deadline: new Date(ins.rows[0].deadline).toISOString(),
      } : null,
    })
  } catch (err) {
    await c.query('ROLLBACK').catch(() => {})
    console.error('Halloween find:', err)
    return NextResponse.json({ error: 'Serverfehler' }, { status: 500 })
  } finally {
    c.release()
  }
}