import { supabaseAdmin } from './supabase'

type RateLimitConfig = {
  maxAttempts: number   // Max Versuche im Zeitfenster
  windowSeconds: number // Zeitfenster in Sekunden
  blockSeconds: number  // Wie lange blockieren nach Überschreitung
}

const CONFIGS: Record<string, RateLimitConfig> = {
  login:    { maxAttempts: 10, windowSeconds: 60, blockSeconds: 300  }, // 10/min, 5min Block
  register: { maxAttempts: 5,  windowSeconds: 60, blockSeconds: 600  }, // 5/min, 10min Block
  // Strenger als login, da ein erfolgreicher Treffer hier die komplette
  // Account-Übernahme ermöglicht (Passwort-Reset + automatisches Einloggen).
  recovery: { maxAttempts: 5,  windowSeconds: 300, blockSeconds: 900  }, // 5/5min, 15min Block
  settings: { maxAttempts: 20, windowSeconds: 60, blockSeconds: 60   }, // 20/min, 1min Block
  upload:   { maxAttempts: 10, windowSeconds: 60, blockSeconds: 120  }, // 10/min, 2min Block
  api:      { maxAttempts: 60, windowSeconds: 60, blockSeconds: 60   }, // 60/min, 1min Block
}

export type RateLimitResult =
  | { allowed: true }
  | { allowed: false; retryAfter: number; error: string }

export async function checkRateLimit(
  ip: string,
  action: keyof typeof CONFIGS
): Promise<RateLimitResult> {
  const config = CONFIGS[action]
  const key = `${action}:${ip}`
  const now = new Date()

  try {
    const { data: existing } = await supabaseAdmin
      .from('rate_limits')
      .select('id, attempts, window_start, blocked_until')
      .eq('key', key)
      .single()

    // Noch geblockt?
    if (existing?.blocked_until) {
      const blockedUntil = new Date(existing.blocked_until)
      if (blockedUntil > now) {
        const retryAfter = Math.ceil((blockedUntil.getTime() - now.getTime()) / 1000)
        return {
          allowed: false,
          retryAfter,
          error: `Zu viele Versuche. Bitte warte ${Math.ceil(retryAfter / 60)} Minute(n).`,
        }
      }
    }

    const windowStart = existing ? new Date(existing.window_start) : now
    const windowAge = (now.getTime() - windowStart.getTime()) / 1000

    if (!existing || windowAge > config.windowSeconds) {
      // Neues Fenster
      if (existing) {
        await supabaseAdmin
          .from('rate_limits')
          .update({ attempts: 1, window_start: now.toISOString(), blocked_until: null })
          .eq('key', key)
      } else {
        await supabaseAdmin
          .from('rate_limits')
          .insert({ key, attempts: 1, window_start: now.toISOString() })
      }
      return { allowed: true }
    }

    const newAttempts = existing.attempts + 1

    if (newAttempts > config.maxAttempts) {
      // Blockieren
      const blockedUntil = new Date(now.getTime() + config.blockSeconds * 1000)
      await supabaseAdmin
        .from('rate_limits')
        .update({ attempts: newAttempts, blocked_until: blockedUntil.toISOString() })
        .eq('key', key)

      return {
        allowed: false,
        retryAfter: config.blockSeconds,
        error: `Zu viele Versuche. Bitte warte ${Math.ceil(config.blockSeconds / 60)} Minute(n).`,
      }
    }

    // Zähler erhöhen
    await supabaseAdmin
      .from('rate_limits')
      .update({ attempts: newAttempts })
      .eq('key', key)

    return { allowed: true }
  } catch (err) {
    // Bei DB-Fehler lieber erlauben als blockieren
    console.error('Rate limit check failed:', err)
    return { allowed: true }
  }
}

export function getIP(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim()
  return req.headers.get('x-real-ip') || 'unknown'
}

export function rateLimitResponse(result: Extract<RateLimitResult, { allowed: false }>) {
  return Response.json(
    { error: result.error },
    {
      status: 429,
      headers: { 'Retry-After': String(result.retryAfter) },
    }
  )
}