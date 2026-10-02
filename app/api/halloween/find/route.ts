import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'
import { checkOrigin, csrfError } from '@/app/lib/csrf'
import { DIFFICULTIES, getBalance, countPumpkins, getCurrentHalloween, getUser, isAdmin, isRunning, type Difficulty } from '@/app/lib/halloween'

// POST /api/halloween/find   Body: { pumpkinId }
// Kürbis angeklickt: +Süßigkeiten fürs Finden, dann eine Quizfrage (ohne Lösung!).
// Die Zeit läuft ab jetzt auf dem Server – Schummeln über den Browser bringt nichts.

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

  try {
    const pr = await pool.query('SELECT id, difficulty FROM hw_pumpkins WHERE id = $1 AND event_id = $2 AND active = TRUE', [pumpkinId, event.id])
    const pumpkin = pr.rows[0]
    if (!pumpkin) return NextResponse.json({ error: 'Diesen Kürbis gibt es nicht (mehr)' }, { status: 404 })

    // Welche Schwierigkeiten haben überhaupt Fragen?
    const avail = (await pool.query(
      'SELECT difficulty, COUNT(*)::int AS n FROM hw_questions WHERE event_id = $1 AND active = TRUE GROUP BY difficulty', [event.id]
    )).rows.filter(r => r.n > 0).map(r => r.difficulty as Difficulty)

    let difficulty: Difficulty | null = null
    if (pumpkin.difficulty !== 'random' && avail.includes(pumpkin.difficulty)) difficulty = pumpkin.difficulty
    else if (avail.length) {
      const pool_ = DIFFICULTIES.filter(d => avail.includes(d))
      const sum = pool_.reduce((s, d) => s + WEIGHTS[d], 0)
      let r = Math.random() * sum
      difficulty = pool_.find(d => (r -= WEIGHTS[d]) < 0) || pool_[0]
    }

    // Frage wählen: möglichst eine, die dieser Spieler noch nicht hatte
    let q: { id: number; question: string; answers: string[]; time_limit: number } | null = null
    if (difficulty) {
      const fresh = await pool.query(
        `SELECT id, question, answers, time_limit FROM hw_questions
         WHERE event_id = $1 AND active = TRUE AND difficulty = $2
           AND id NOT IN (SELECT question_id FROM hw_finds WHERE event_id = $1 AND user_id = $3 AND question_id IS NOT NULL)
         ORDER BY random() LIMIT 1`,
        [event.id, difficulty, user.id]
      )
      q = fresh.rows[0] || (await pool.query(
        'SELECT id, question, answers, time_limit FROM hw_questions WHERE event_id = $1 AND active = TRUE AND difficulty = $2 ORDER BY random() LIMIT 1',
        [event.id, difficulty]
      )).rows[0] || null
    }

    const ins = await pool.query(
      `INSERT INTO hw_finds (event_id, pumpkin_id, user_id, question_id, difficulty, deadline, result, candies)
       VALUES ($1, $2, $3, $4, $5,
               CASE WHEN $6::int IS NULL THEN NULL ELSE NOW() + make_interval(secs => $6::int) END,
               $7, $8)
       ON CONFLICT (pumpkin_id, user_id) DO NOTHING
       RETURNING id, deadline`,
      [event.id, pumpkinId, user.id, q?.id ?? null, q ? difficulty : null, q ? q.time_limit : null, q ? 'pending' : 'none', event.candyFind]
    )
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
    console.error('Halloween find:', err)
    return NextResponse.json({ error: 'Serverfehler' }, { status: 500 })
  }
}