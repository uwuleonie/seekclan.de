import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'
import { verifyPluginKey } from '@/app/lib/plugin-auth'

function calculateStreakBonus(streak: number): number {
  let bonus = 0
  // Tag 1-7: jeden Tag +1
  const phase1 = Math.min(streak, 7)
  bonus += phase1
  if (streak <= 7) return bonus

  // Tag 8-30: alle 3 Tage +1
  const phase2Days = Math.min(streak - 7, 23)
  bonus += Math.floor(phase2Days / 3)
  if (streak <= 30) return bonus

  // Tag 31-90: alle 7 Tage +1
  const phase3Days = Math.min(streak - 30, 60)
  bonus += Math.floor(phase3Days / 7)
  if (streak <= 90) return bonus

  // Tag 90+: alle 14 Tage +1
  const phase4Days = streak - 90
  bonus += Math.floor(phase4Days / 14)
  return bonus
}

function calculateDailyAmount(streak: number): number {
  return 5 + calculateStreakBonus(streak)
}

async function ensureRow(uuid: string, playerName: string) {
  await pool.query(
    `INSERT INTO lobby_daily_rewards (uuid, last_reset)
     VALUES ($1, CURRENT_DATE - INTERVAL '1 day')
     ON CONFLICT (uuid) DO NOTHING`,
    [uuid]
  )
  // Reset falls neuer Tag
  await pool.query(
    `UPDATE lobby_daily_rewards
     SET online_minutes_today = 0,
         messages_today = 0,
         quest_online_claimed = false,
         quest_messages_claimed = false,
         last_reset = CURRENT_DATE
     WHERE uuid = $1 AND (last_reset IS NULL OR last_reset < CURRENT_DATE)`,
    [uuid]
  )
}

// GET — Quest-Daten laden
export async function GET(req: NextRequest) {
  if (!await verifyPluginKey(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const uuid = new URL(req.url).searchParams.get('uuid')
  if (!uuid) return NextResponse.json({ error: 'uuid erforderlich' }, { status: 400 })

  await ensureRow(uuid, uuid)
  const result = await pool.query(
    `SELECT online_minutes_today, messages_today, quest_online_claimed, quest_messages_claimed, streak
     FROM lobby_daily_rewards WHERE uuid = $1`,
    [uuid]
  )
  const row = result.rows[0]
  return NextResponse.json({ data: row || { online_minutes_today: 0, messages_today: 0, quest_online_claimed: false, quest_messages_claimed: false, streak: 0 } })
}

// POST /api/internal/daily-rewards/claim — Tägliche Belohnung abholen
export async function POST(req: NextRequest) {
  if (!await verifyPluginKey(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const uuid = new URL(req.url).searchParams.get('uuid')
  const name = new URL(req.url).searchParams.get('name')
  if (!uuid) return NextResponse.json({ error: 'uuid erforderlich' }, { status: 400 })

  await ensureRow(uuid, name || uuid)

  // Prüfen ob heute schon geclaimed
  const result = await pool.query(
    'SELECT last_claim, streak FROM lobby_daily_rewards WHERE uuid = $1',
    [uuid]
  )
  const row = result.rows[0]
  if (!row) return NextResponse.json({ claimed: false })

  const lastClaim = row.last_claim ? new Date(row.last_claim) : null
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  if (lastClaim && lastClaim >= today) {
    return NextResponse.json({ claimed: false })
  }

  // Streak berechnen
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  const wasYesterday = lastClaim && lastClaim >= yesterday && lastClaim < today
  const newStreak = wasYesterday ? (row.streak || 0) + 1 : 1

  const amount = calculateDailyAmount(newStreak)

  // Streak + last_claim updaten + Sternies geben
  await pool.query(
    `UPDATE lobby_daily_rewards SET last_claim = now(), streak = $1 WHERE uuid = $2`,
    [newStreak, uuid]
  )
  await pool.query(
    `UPDATE lobby_player_data SET sternies = sternies + $1 WHERE uuid = $2`,
    [amount, uuid]
  )

  return NextResponse.json({ claimed: true, amount, streak: newStreak })
}

// PATCH — Quest-Fortschritt updaten
export async function PATCH(req: NextRequest) {
  if (!await verifyPluginKey(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { uuid, player_name, add_online_minutes, add_messages, claim_quest } = body as {
    uuid?: string
    player_name?: string
    add_online_minutes?: number
    add_messages?: number
    claim_quest?: string
  }

  if (!uuid) return NextResponse.json({ error: 'uuid erforderlich' }, { status: 400 })

  await ensureRow(uuid, player_name || uuid)

  if (add_online_minutes) {
    await pool.query(
      'UPDATE lobby_daily_rewards SET online_minutes_today = online_minutes_today + $1 WHERE uuid = $2',
      [add_online_minutes, uuid]
    )
  }

  if (add_messages) {
    await pool.query(
      'UPDATE lobby_daily_rewards SET messages_today = messages_today + $1 WHERE uuid = $2',
      [add_messages, uuid]
    )
  }

  if (claim_quest === 'online') {
    await pool.query(
      'UPDATE lobby_daily_rewards SET quest_online_claimed = true WHERE uuid = $1',
      [uuid]
    )
    await pool.query(
      'UPDATE lobby_player_data SET sternies = sternies + 2 WHERE uuid = $1',
      [uuid]
    )
  }

  if (claim_quest === 'messages') {
    await pool.query(
      'UPDATE lobby_daily_rewards SET quest_messages_claimed = true WHERE uuid = $1',
      [uuid]
    )
    await pool.query(
      'UPDATE lobby_player_data SET sternies = sternies + 2 WHERE uuid = $1',
      [uuid]
    )
  }

  return NextResponse.json({ success: true })
}