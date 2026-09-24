// Hilfsfunktionen fuer Minecraft-Name <-> UUID ueber die Mojang-API

const UUID_RE = /^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/i
const NAME_RE = /^[A-Za-z0-9_]{3,16}$/

export function isUuid(value: string): boolean {
  return UUID_RE.test(value)
}

export function isValidMcName(value: string): boolean {
  return NAME_RE.test(value)
}

export function formatUuid(raw: string): string {
  const h = raw.replace(/-/g, '').toLowerCase()
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
}

// Name -> { uuid, name } (Name in korrekter Schreibweise), null wenn es den Spieler nicht gibt
export async function nameToProfile(name: string): Promise<{ uuid: string; name: string } | null> {
  try {
    const res = await fetch(`https://api.mojang.com/users/profiles/minecraft/${encodeURIComponent(name)}`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok || res.status === 204) return null
    const data = await res.json()
    if (!data?.id) return null
    return { uuid: formatUuid(data.id), name: data.name || name }
  } catch {
    return null
  }
}

// UUID -> aktueller Name, null wenn unbekannt
export async function uuidToName(uuid: string): Promise<string | null> {
  try {
    const res = await fetch(`https://sessionserver.mojang.com/session/minecraft/profile/${uuid.replace(/-/g, '')}`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok || res.status === 204) return null
    const data = await res.json()
    return data?.name || null
  } catch {
    return null
  }
}